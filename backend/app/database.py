
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from app.security import PRODUCTION
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://localhost/revv_db",
)

if PRODUCTION:
    if not os.getenv("DATABASE_URL"):
        raise RuntimeError("Production requires an explicit DATABASE_URL")
    parsed = make_url(DATABASE_URL)
    if parsed.host not in {None, "localhost", "127.0.0.1", "::1"} and parsed.query.get("sslmode") != "verify-full":
        raise RuntimeError("Remote production PostgreSQL requires sslmode=verify-full")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, hide_parameters=True)

if PRODUCTION:
    @event.listens_for(engine, "connect")
    def reject_privileged_runtime_role(connection, record):
        with connection.cursor() as cursor:
            cursor.execute("SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user")
            row = cursor.fetchone()
            if row is None or row[0]:
                raise RuntimeError("Production database runtime role must not be privileged")

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass
