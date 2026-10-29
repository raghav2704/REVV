
import io
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.routes.auth import router as auth_router



from app.database import SessionLocal
from app.models import Vehicle, VehicleImage

from app.routes.auth import router as auth_router

# --------------------------------------------------
# APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="REVV API",
    description="New Zealand Automotive Marketplace API",
    version="1.0.0",
)

app.include_router(auth_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)



# --------------------------------------------------
# IMAGE STORAGE
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads" / "vehicles"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=str(BACKEND_DIR / "uploads")),
    name="uploads",
)

MAX_IMAGES_PER_VEHICLE = 10
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


# --------------------------------------------------
# DATABASE CONNECTION
# --------------------------------------------------

def get_db():
    with SessionLocal() as db:
        yield db


# --------------------------------------------------
# PYDANTIC SCHEMAS
# --------------------------------------------------

class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=1900, le=2100)
    price_nzd: int = Field(gt=0)
    mileage_km: int = Field(ge=0)
    location: str = Field(min_length=1, max_length=100)

    @field_validator("make", "model", "location")
    @classmethod
    def clean_text(cls, value: str):
        value = value.strip()

        if not value:
            raise ValueError("Field cannot be empty")

        return value


class VehicleUpdate(BaseModel):
    make: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    model: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    year: int | None = Field(
        default=None,
        ge=1900,
        le=2100,
    )
    price_nzd: int | None = Field(
        default=None,
        gt=0,
    )
    mileage_km: int | None = Field(
        default=None,
        ge=0,
    )
    location: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    @field_validator("make", "model", "location")
    @classmethod
    def clean_text(cls, value: str | None):
        if value is None:
            return value

        value = value.strip()

        if not value:
            raise ValueError("Field cannot be empty")

        return value


# --------------------------------------------------
# RESPONSE HELPERS
# --------------------------------------------------

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


def image_to_dict(image: VehicleImage):
    return {
        "id": image.id,
        "url": f"/uploads/vehicles/{image.filename}",
        "is_cover": image.is_cover,
        "position": image.position,
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "REVV API",
    }


# --------------------------------------------------
# GET ALL VEHICLES
# --------------------------------------------------

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


# --------------------------------------------------
# GET ONE VEHICLE
# --------------------------------------------------

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


# --------------------------------------------------
# CREATE VEHICLE
# --------------------------------------------------

@app.post(
    "/api/v1/cars",
    status_code=status.HTTP_201_CREATED,
)
def create_car(
    car: VehicleCreate,
    db: Session = Depends(get_db),
):
    new_car = Vehicle(**car.model_dump())

    db.add(new_car)
    db.commit()
    db.refresh(new_car)

    return vehicle_to_dict(new_car)


# --------------------------------------------------
# UPDATE VEHICLE
# LOCAL DEVELOPMENT ONLY
# --------------------------------------------------

@app.patch("/api/v1/cars/{car_id}")
def update_car(
    car_id: int,
    changes: VehicleUpdate,
    db: Session = Depends(get_db),
):
    car = db.get(Vehicle, car_id)

    if car is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    updates = changes.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if value is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null",
            )

        setattr(car, field, value)

    db.commit()
    db.refresh(car)

    return vehicle_to_dict(car)


# --------------------------------------------------
# UPLOAD VEHICLE PHOTOS
# --------------------------------------------------

@app.post(
    "/api/v1/cars/{car_id}/images",
    status_code=status.HTTP_201_CREATED,
)
async def upload_vehicle_images(
    car_id: int,
    files: Annotated[list[UploadFile], File()],
    db: Session = Depends(get_db),
):
    vehicle = db.get(Vehicle, car_id)

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    if not 1 <= len(files) <= MAX_IMAGES_PER_VEHICLE:
        raise HTTPException(
            status_code=400,
            detail="Upload between 1 and 10 photos.",
        )

    existing_images = db.scalars(
        select(VehicleImage)
        .where(VehicleImage.vehicle_id == car_id)
        .order_by(VehicleImage.position)
    ).all()

    if len(existing_images) + len(files) > MAX_IMAGES_PER_VEHICLE:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 photos per vehicle.",
        )

    prepared_images: list[tuple[str, bytes]] = []

    for file in files:
        try:
            contents = await file.read(MAX_UPLOAD_BYTES + 1)

            if len(contents) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail="Each photo must be 5 MB or smaller.",
                )

            try:
                with Image.open(io.BytesIO(contents)) as image:
                    if image.format not in {"JPEG", "PNG", "WEBP"}:
                        raise ValueError("Unsupported format")

                    image.verify()

                with Image.open(io.BytesIO(contents)) as image:
                    if image.width * image.height > 25_000_000:
                        raise ValueError("Image dimensions too large")

                    image = image.convert("RGB")
                    image.thumbnail((1600, 1600))

                    output = io.BytesIO()

                    image.save(
                        output,
                        format="JPEG",
                        quality=85,
                        optimize=True,
                    )

            except (
                UnidentifiedImageError,
                ValueError,
                OSError,
                Image.DecompressionBombError,
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid image. Use JPG, PNG or WEBP.",
                )

            filename = f"{uuid.uuid4().hex}.jpg"

            prepared_images.append(
                (filename, output.getvalue())
            )

        finally:
            await file.close()

    saved_paths: list[Path] = []
    uploaded_images: list[dict] = []

    try:
        for index, (filename, contents) in enumerate(
            prepared_images
        ):
            path = UPLOAD_DIR / filename

            path.write_bytes(contents)
            saved_paths.append(path)

            record = VehicleImage(
                vehicle_id=car_id,
                filename=filename,
                is_cover=(
                    len(existing_images) == 0
                    and index == 0
                ),
                position=len(existing_images) + index,
            )

            db.add(record)
            db.flush()

            uploaded_images.append(
                image_to_dict(record)
            )

        db.commit()

    except Exception:
        db.rollback()

        for path in saved_paths:
            path.unlink(missing_ok=True)

        raise

    return {
        "vehicle_id": car_id,
        "images": uploaded_images,
    }


# --------------------------------------------------
# GET VEHICLE PHOTOS
# --------------------------------------------------

@app.get("/api/v1/cars/{car_id}/images")
def get_vehicle_images(
    car_id: int,
    db: Session = Depends(get_db),
):
    vehicle = db.get(Vehicle, car_id)

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    images = db.scalars(
        select(VehicleImage)
        .where(VehicleImage.vehicle_id == car_id)
        .order_by(VehicleImage.position, VehicleImage.id)
    ).all()

    return {
        "vehicle_id": car_id,
        "images": [
            image_to_dict(image)
            for image in images
        ],
    }


# --------------------------------------------------
# SWAGGER / OPENAPI FIX
# --------------------------------------------------

def custom_openapi():
    # Always return a valid schema, never None.
    if app.openapi_schema is not None:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # Compatibility for Swagger UI file upload controls.
    for component in (
        schema.get("components", {})
        .get("schemas", {})
        .values()
    ):
        for property_schema in (
            component.get("properties", {}).values()
        ):
            items = property_schema.get("items", {})

            if (
                items.get("contentMediaType")
                == "application/octet-stream"
            ):
                items.pop("contentMediaType")
                items["format"] = "binary"

    app.openapi_schema = schema

    return schema


# --------------------------------------------------
# DELETE VEHICLE (LOCAL DEVELOPMENT ONLY)
# --------------------------------------------------

@app.delete("/api/v1/cars/{car_id}")
def delete_car(
    car_id: int,
    db: Session = Depends(get_db),
):
    car = db.get(Vehicle, car_id)

    if car is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    # Collect the photo filenames before deleting records.
    images = db.scalars(
        select(VehicleImage).where(
            VehicleImage.vehicle_id == car_id
        )
    ).all()

    filenames = [image.filename for image in images]

    # Delete photo database records first.
    for image in images:
        db.delete(image)

    # Delete the vehicle record.
    db.delete(car)
    db.commit()

    # Remove uploaded files after database deletion.
    for filename in filenames:
        try:
            (UPLOAD_DIR / filename).unlink(missing_ok=True)
        except OSError:
            # Log file cleanup failures for investigation.
            import logging
            logging.exception(
                "Could not remove vehicle photo: %s",
                filename,
            )

    return {
        "message": "Vehicle deleted successfully",
        "deleted_vehicle_id": car_id,
        "deleted_images": len(images),
    }



app.openapi = custom_openapi
