"""Run tests with connection-local PostgreSQL temporary tables only.

The test connection uses search_path=pg_temp. No persistent tables, records,
sessions, uploaded files or accounts are created or changed.
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    with tempfile.TemporaryDirectory(prefix="revv-security-", dir="/tmp") as directory:
        env = dict(os.environ)
        env.update({
            "DATABASE_URL": "postgresql+psycopg://localhost/revv_db?options=-csearch_path%3Dpg_temp",
            "REVV_SECURITY_TEMP_TABLES": "1",
            "REVV_RATE_LIMIT_PATH": str(Path(directory) / "limits.sqlite3"),
            "REVV_ENV": "development",
            "REVV_COOKIE_SECURE": "false",
        })
        return subprocess.call([sys.executable, "-m", "pytest", "tests", "-q", *sys.argv[1:]], cwd=Path(__file__).resolve().parents[1], env=env)


if __name__ == "__main__":
    raise SystemExit(main())
