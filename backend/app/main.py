
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Vehicle

app = FastAPI(
    title="REVV API",
    description="New Zealand Automotive Marketplace API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=1900, le=2100)
    price_nzd: int = Field(gt=0)
    mileage_km: int = Field(ge=0)
    location: str = Field(min_length=1, max_length=100)


def get_db():
    with SessionLocal() as db:
        yield db


def vehicle_to_dict(vehicle: Vehicle):
    return {
        "id": vehicle.id,
        "make": vehicle.make,
        "model": vehicle.model,
        "year": vehicle.year,
        "price_nzd": vehicle.price_nzd,
        "mileage_km": vehicle.mileage_km,
        "location": vehicle.location,
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "REVV API"}


@app.get("/api/v1/cars")
def get_cars(db: Session = Depends(get_db)):
    cars = db.scalars(
        select(Vehicle).order_by(Vehicle.id)
    ).all()

    data = [vehicle_to_dict(car) for car in cars]

    return {
        "data": data,
        "pagination": {
            "page": 1,
            "page_size": len(data),
            "total": len(data),
            "total_pages": 1 if data else 0,
        },
    }


@app.get("/api/v1/cars/{car_id}")
def get_car(
    car_id: int,
    db: Session = Depends(get_db),
):
    car = db.get(Vehicle, car_id)

    if car is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    return vehicle_to_dict(car)


@app.post(
    "/api/v1/cars",
    status_code=status.HTTP_201_CREATED,
)
def create_car(
    car: VehicleCreate,
    db: Session = Depends(get_db),
):
    new_car = Vehicle(
        make=car.make.strip(),
        model=car.model.strip(),
        year=car.year,
        price_nzd=car.price_nzd,
        mileage_km=car.mileage_km,
        location=car.location.strip(),
    )

    db.add(new_car)
    db.commit()
    db.refresh(new_car)

    return vehicle_to_dict(new_car)
