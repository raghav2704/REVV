
from fastapi import FastAPI, HTTPException

app = FastAPI(
    title="REVV API",
    description="Automotive Marketplace & Intelligence Platform",
    version="1.0.0"
)

# Fictional listings for development
cars = [
    {
        "id": 1,
        "make": "BMW",
        "model": "320i",
        "year": 2024,
        "price_nzd": 59990,
        "mileage_km": 18000,
        "location": "Auckland"
    },
    {
        "id": 2,
        "make": "Mercedes-Benz",
        "model": "C200",
        "year": 2023,
        "price_nzd": 54990,
        "mileage_km": 24000,
        "location": "Wellington"
    },
    {
        "id": 3,
        "make": "Audi",
        "model": "A4",
        "year": 2022,
        "price_nzd": 42990,
        "mileage_km": 35000,
        "location": "Christchurch"
    }
]


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "REVV API"}


@app.get("/api/v1/cars")
def get_cars():
    return {
        "data": cars,
        "pagination": {
            "page": 1,
            "page_size": len(cars),
            "total": len(cars),
            "total_pages": 1
        }
    }


@app.get("/api/v1/cars/{car_id}")
def get_car(car_id: int):
    for car in cars:
        if car["id"] == car_id:
            return car

    raise HTTPException(
        status_code=404,
        detail="Vehicle not found"
    )
