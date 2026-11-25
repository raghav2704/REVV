import os
from pathlib import Path

# Abort before importing the app unless the safe runner fixes the connection.
if os.environ.get("REVV_SECURITY_TEMP_TABLES") != "1" or os.environ.get("DATABASE_URL") != "postgresql+psycopg://localhost/revv_db?options=-csearch_path%3Dpg_temp":
    raise RuntimeError("Use python tests/run_security.py: temporary-table-only connection required")

from datetime import datetime, timedelta, timezone
import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import text, MetaData
from sqlalchemy.orm import Session
from app import main
from app.database import Base, engine
from app.models import User, UserSession, Vehicle, VehicleImage
from app.routes import auth, deals, messaging, vehicle_catalogue, recommendations

PASSWORD = "Test-only-password-917!"
TOKENS = {name: f"fictional-test-session-{name}" for name in ("seller", "buyer", "outsider", "admin")}
ORIGIN = "http://127.0.0.1:3001"


@pytest.fixture(scope="session")
def connection():
    connection = engine.connect()
    assert connection.execute(text("SHOW search_path")).scalar_one() == "pg_temp"
    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        temporary = table.to_metadata(metadata)
        temporary._prefixes = ["TEMPORARY"]
    # checkfirst=False is deliberate: never inspect or reuse persistent tables.
    metadata.create_all(connection, checkfirst=False)
    for name in ("005_messaging.sql", "006_deal_room_watchlists.sql"):
        sql = (Path(__file__).parents[1] / "migrations" / name).read_text()
        sql = sql.replace("BEGIN;", "").replace("COMMIT;", "").replace("CREATE TABLE IF NOT EXISTS", "CREATE TEMPORARY TABLE").replace("CREATE TABLE ", "CREATE TEMPORARY TABLE ")
        connection.exec_driver_sql(sql)
    connection.commit()
    yield connection
    connection.close()  # PostgreSQL drops all connection-local temporary objects.
    engine.dispose()


@pytest.fixture(scope="session")
def password_hash():
    return auth.password_hasher.hash(PASSWORD)


@pytest.fixture
def db(password_hash, connection):
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    for index, name in enumerate(TOKENS, 1):
        session.add(User(id=index, full_name=f"Fictional {name}", email=f"{name}@example.com", role="admin" if name == "admin" else "user", password_hash=password_hash))
    session.flush()
    for index, (name, token) in enumerate(TOKENS.items(), 1):
        session.add(UserSession(user_id=index, token_hash=auth.hash_token(token), expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
    for index, owner, status in ((1, 1, "active"), (2, 1, "draft"), (3, 3, "active"), (4, None, "active")):
        session.add(Vehicle(id=index, owner_id=owner, make="Toyota", model="Corolla", year=2022, price_nzd=25000, mileage_km=40000, location="Auckland", listing_status=status, registration_plate="PRIVATE", vin="ABCDEFGH123456789"))
    session.flush()
    session.add(VehicleImage(id=1, vehicle_id=2, filename="a" * 32 + ".jpg", position=0, is_cover=True))
    session.execute(text("INSERT INTO conversations(id,vehicle_id,buyer_id,seller_id) VALUES (1,1,2,1)"))
    session.execute(text("INSERT INTO messages(conversation_id,sender_id,body) VALUES (1,2,'Private test message')"))
    session.execute(text("INSERT INTO vehicle_offers(id,vehicle_id,buyer_id,seller_id,current_amount_nzd) VALUES (1,1,2,1,20000)"))
    session.execute(text("INSERT INTO vehicle_offer_events(offer_id,actor_id,action,amount_nzd) VALUES (1,2,'offer',20000)"))
    session.execute(text("INSERT INTO vehicle_watchlists(user_id,vehicle_id) VALUES (2,1)"))
    for table in ("users", "vehicles", "vehicle_images", "conversations", "vehicle_offers"):
        session.execute(text("SELECT setval(pg_get_serial_sequence(:table, 'id'), 100)"), {"table": table})
    session.commit()
    yield session
    session.close()
    transaction.rollback()


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
    Image.new("RGB", (20, 20), "navy").save(tmp_path / ("a" * 32 + ".jpg"))
    # New limiter file per test; no runtime/local application state is touched.
    monkeypatch.setenv("REVV_RATE_LIMIT_PATH", str(tmp_path / "limits.sqlite3"))
    def override():
        yield db
    for module in (main, auth, deals, messaging, vehicle_catalogue, recommendations):
        main.app.dependency_overrides[module.get_db] = override
    with TestClient(main.app, raise_server_exceptions=False) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


def headers(who=None, origin=ORIGIN):
    result = {"Origin": origin}
    if who:
        result["Cookie"] = f"revv_session={TOKENS[who]}"
    return result


def photo():
    stream = io.BytesIO()
    Image.new("RGB", (20, 20), "navy").save(stream, "PNG")
    return stream.getvalue()
