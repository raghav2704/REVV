
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Vehicle


def seed_database():
    Base.metadata.create_all(bind=engine)

    demo_cars = [
        {
            "id": 1,
            "make": "BMW",
            "model": "320i",
            "year": 2024,
            "price_nzd": 59990,
            "mileage_km": 18000,
            "location": "Auckland",
        },
        {
            "id": 2,
            "make": "Mercedes-Benz",
            "model": "C200",
            "year": 2023,
            "price_nzd": 54990,
            "mileage_km": 24000,
            "location": "Wellington",
        },
        {
            "id": 3,
            "make": "Audi",
            "model": "A4",
            "year": 2022,
            "price_nzd": 42990,
            "mileage_km": 35000,
            "location": "Christchurch",
        },
    ]

    with SessionLocal() as db:
        for data in demo_cars:
            existing = db.get(Vehicle, data["id"])

            if existing is None:
                db.add(Vehicle(**data))

        db.commit()

    print("REVV database initialised successfully!")


if __name__ == "__main__":
    seed_database()
