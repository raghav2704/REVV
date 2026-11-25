"""Shared browser security and bounded, persistent single-host auth throttling."""
from contextlib import closing
import hashlib
import hmac
import logging
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlsplit

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

load_dotenv()
logger = logging.getLogger("revv.security")
ENVIRONMENT = os.getenv("REVV_ENV", "development")
if ENVIRONMENT not in {"development", "test", "production"}:
    raise RuntimeError("REVV_ENV must be development, test or production")
PRODUCTION = ENVIRONMENT == "production"
_LOCAL_ORIGINS = {f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (3000, 3001, 8000)}
ALLOWED_ORIGINS = frozenset(filter(None, (value.strip() for value in os.getenv("REVV_ALLOWED_ORIGINS", "" if PRODUCTION else ",".join(_LOCAL_ORIGINS)).split(","))))
for origin in ALLOWED_ORIGINS:
    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise RuntimeError("REVV_ALLOWED_ORIGINS must contain exact HTTP(S) origins")
    if PRODUCTION and parsed.scheme != "https":
        raise RuntimeError("Production browser origins must use HTTPS")
COOKIE_SECURE = os.getenv("REVV_COOKIE_SECURE", "true" if PRODUCTION else "false").lower() == "true"
ALLOWED_HOSTS = [item.strip() for item in os.getenv("REVV_ALLOWED_HOSTS", "").split(",") if item.strip()]
if PRODUCTION and (not ALLOWED_ORIGINS or not COOKIE_SECURE or not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS):
    raise RuntimeError("Production requires HTTPS origins, secure cookies and explicit allowed hosts")
if PRODUCTION and not os.getenv("REVV_RATE_LIMIT_PATH"):
    raise RuntimeError("Production requires a persistent private REVV_RATE_LIMIT_PATH")
if PRODUCTION:
    limit_path = Path(os.environ["REVV_RATE_LIMIT_PATH"])
    if not limit_path.is_absolute() or "uploads" in limit_path.parts:
        raise RuntimeError("Production rate-limit state requires an absolute private path outside uploads")


def verify_write_origin(request: Request):
    origin = request.headers.get("origin")
    if len(request.headers.getlist("origin")) > 1:
        origin = "null"
    if not origin:
        try:
            parsed = urlsplit(request.headers.get("referer", ""))
            origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
        except ValueError:
            origin = None
    if origin not in ALLOWED_ORIGINS:
        logger.warning("event=csrf_denied")
        raise HTTPException(status_code=403, detail="Request origin is not allowed")


def auth_rate_limit(request: Request, bucket: str, limit: int, window: int, identity: str | None = None):
    """SQLite transactions share limits across worker processes on ONE host.

    No plaintext emails, addresses, passwords or session tokens are stored.
    Multi-host deployment requires an equivalent centralized gateway/Redis limit.
    Failure is closed (503), not an unthrottled login attempt.
    """
    path = Path(os.getenv("REVV_RATE_LIMIT_PATH", str(Path(__file__).resolve().parents[1] / ".security" / "limits.sqlite3")))
    if not path.is_absolute() or "uploads" in path.parts:
        raise HTTPException(503, "Authentication temporarily unavailable")
    try:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        path.chmod(0o600)
        now = int(time.time())
        with closing(sqlite3.connect(path, timeout=5)) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("CREATE TABLE IF NOT EXISTS limiter_key (id INTEGER PRIMARY KEY CHECK(id=1), value BLOB NOT NULL)")
            connection.execute("INSERT OR IGNORE INTO limiter_key VALUES (1, ?)", (secrets.token_bytes(32),))
            key = connection.execute("SELECT value FROM limiter_key WHERE id=1").fetchone()[0]
            subject = identity if identity is not None else (request.client.host if request.client else "unknown")
            digest = hmac.new(key, f"{bucket}:{subject}".encode(), hashlib.sha256).hexdigest()
            connection.execute("CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)")
            connection.execute("CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires)")
            connection.execute("DELETE FROM rate_limits WHERE expires <= ?", (now,))
            row = connection.execute("SELECT count, expires FROM rate_limits WHERE key=?", (digest,)).fetchone()
            if row and row[0] >= limit:
                retry = max(1, row[1] - now)
                logger.warning("event=auth_rate_limited bucket=%s", bucket)
                raise HTTPException(429, "Too many attempts. Try again later.", headers={"Retry-After": str(retry)})
            # Bound disk consumption even under a distributed identity flood.
            if not row and connection.execute("SELECT count(*) FROM rate_limits").fetchone()[0] >= 50000:
                raise HTTPException(503, "Authentication temporarily unavailable")
            connection.execute("INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1", (digest, now + window))
            connection.commit()
    except (OSError, sqlite3.Error):
        logger.error("event=auth_limiter_unavailable")
        raise HTTPException(503, "Authentication temporarily unavailable") from None


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        async def secure_send(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [(b"x-content-type-options", b"nosniff"), (b"referrer-policy", b"strict-origin-when-cross-origin"), (b"x-frame-options", b"DENY")]
                if scope["path"].startswith("/api/"):
                    message["headers"].append((b"cache-control", b"private, no-store"))
                if PRODUCTION:
                    message["headers"].append((b"strict-transport-security", b"max-age=31536000"))
                if message["status"] in {401, 403, 429}:
                    logger.warning("event=request_denied status=%d", message["status"])
            await send(message)
        headers = Headers(scope=scope)
        unsafe = scope["method"] not in {"GET", "HEAD", "OPTIONS"}
        if unsafe:
            try:
                verify_write_origin(Request(scope))
            except HTTPException as error:
                return await JSONResponse({"detail": error.detail}, status_code=error.status_code)(scope, receive, secure_send)
        limit = 52 * 1024 * 1024 if scope["path"].endswith("/images") and scope["method"] == "POST" else 64 * 1024
        length = headers.get("content-length")
        if length is not None:
            try:
                if int(length) < 0:
                    raise ValueError
                too_large = int(length) > limit
            except ValueError:
                return await JSONResponse({"detail": "Invalid Content-Length"}, status_code=400)(scope, receive, secure_send)
            if too_large:
                return await JSONResponse({"detail": "Request body too large"}, status_code=413)(scope, receive, secure_send)
        consumed = 0
        async def limited_receive():
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > limit:
                    raise HTTPException(413, "Request body too large")
            return message
        await self.app(scope, limited_receive, secure_send)
