
import io
import logging
import uuid
from pathlib import Path
from urllib.parse import urlsplit
from typing import Annotated
from pydantic import BaseModel, Field


from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles

from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Vehicle, VehicleImage
from app.models.user import User
from app.routes.auth import (
    get_current_user,
    router as auth_router,
)

logger = logging.getLogger(__name__)

# --------------------------------------------------
# APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="REVV API",
    description="New Zealand Automotive Marketplace API",
    version="1.0.0",
)

app.include_router(auth_router)

# --------------------------------------------------
# CORS
# --------------------------------------------------

FRONTEND_ORIGINS = {
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
}

ALLOWED_WRITE_ORIGINS = FRONTEND_ORIGINS | {
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(FRONTEND_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

# --------------------------------------------------
# FILE STORAGE
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
MAX_IMAGE_PIXELS = 25_000_000

# --------------------------------------------------
# DATABASE
# --------------------------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()



# --------------------------------------------------
# PHOTO MANAGEMENT - OWNER OR ADMIN
# --------------------------------------------------

class PhotoOrderRequest(BaseModel):
    image_ids: list[int] = Field(
        min_length=1,
        max_length=10,
    )


def get_owned_photo(
    car_id: int,
    image_id: int,
    db: Session,
) -> VehicleImage:
    image = db.scalar(
        select(VehicleImage).where(
            VehicleImage.id == image_id,
            VehicleImage.vehicle_id == car_id,
        )
    )

    if image is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle photo not found",
        )

    return image


# --------------------------------------------------
# DELETE AN INDIVIDUAL VEHICLE PHOTO
# --------------------------------------------------

@app.delete(
    "/api/v1/cars/{car_id}/images/{image_id}"
)
def delete_vehicle_photo(
    car_id: int,
    image_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)
    require_listing_access(car_id, db, user)

    image = get_owned_photo(
        car_id,
        image_id,
        db,
    )

    filename = image.filename
    was_cover = image.is_cover

    db.delete(image)
    db.flush()

    remaining = db.scalars(
        select(VehicleImage)
        .where(VehicleImage.vehicle_id == car_id)
        .order_by(
            VehicleImage.position,
            VehicleImage.id,
        )
    ).all()

    for index, photo in enumerate(remaining):
        photo.position = index

        # Guarantee one cover for non-empty galleries.
        if was_cover:
            photo.is_cover = index == 0

    db.commit()

    # Delete the physical photo only after DB success.
    try:
        (UPLOAD_DIR / filename).unlink(
            missing_ok=True
        )
    except OSError:
        logger.exception(
            "Unable to remove photo file: %s",
            filename,
        )

    return {
        "message": "Photo deleted successfully",
        "deleted_image_id": image_id,
        "remaining_images": len(remaining),
    }


# --------------------------------------------------
# SET A NEW COVER PHOTO
# --------------------------------------------------

@app.patch(
    "/api/v1/cars/{car_id}/images/{image_id}/cover"
)
def set_vehicle_cover_photo(
    car_id: int,
    image_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)
    require_listing_access(car_id, db, user)

    selected = get_owned_photo(
        car_id,
        image_id,
        db,
    )

    photos = db.scalars(
        select(VehicleImage).where(
            VehicleImage.vehicle_id == car_id
        )
    ).all()

    for photo in photos:
        photo.is_cover = (
            photo.id == selected.id
        )

    db.commit()
    db.refresh(selected)

    return {
        "message": "Cover photo updated",
        "vehicle_id": car_id,
        "cover_image": image_to_dict(selected),
    }


# --------------------------------------------------
# REORDER VEHICLE PHOTOS
# --------------------------------------------------

@app.put(
    "/api/v1/cars/{car_id}/images/order"
)
def reorder_vehicle_photos(
    car_id: int,
    payload: PhotoOrderRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)
    require_listing_access(car_id, db, user)

    photos = db.scalars(
        select(VehicleImage).where(
            VehicleImage.vehicle_id == car_id
        )
    ).all()

    requested_ids = payload.image_ids
    existing_ids = {photo.id for photo in photos}

    if len(requested_ids) != len(set(requested_ids)):
        raise HTTPException(
            status_code=422,
            detail="Duplicate photo IDs are not allowed",
        )

    if set(requested_ids) != existing_ids:
        raise HTTPException(
            status_code=422,
            detail=(
                "Provide every photo ID belonging "
                "to this vehicle, exactly once"
            ),
        )

    positions = {
        image_id: index
        for index, image_id in enumerate(requested_ids)
    }

    for photo in photos:
        photo.position = positions[photo.id]

    db.commit()

    ordered = sorted(
        photos,
        key=lambda photo: photo.position,
    )

    return {
        "message": "Photo order updated",
        "vehicle_id": car_id,
        "images": [
            image_to_dict(photo)
            for photo in ordered
        ],
    }

# --------------------------------------------------
# REQUEST VALIDATION
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
    def validate_text(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty")

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
    def validate_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty")

        return value


# --------------------------------------------------
# SECURITY HELPERS
# --------------------------------------------------

def verify_write_origin(request: Request):
    """
    Local development CSRF protection.

    Reject browser-changing requests unless the Origin
    or Referer matches an explicitly trusted origin.

    This is not a replacement for production HTTPS,
    CSRF tokens and a full security review.
    """

    origin = request.headers.get("origin")

    if not origin:
        referer = request.headers.get("referer", "")

        if referer:
            parsed = urlsplit(referer)

            if parsed.scheme and parsed.netloc:
                origin = (
                    f"{parsed.scheme}://{parsed.netloc}"
                )

    if origin not in ALLOWED_WRITE_ORIGINS:
        raise HTTPException(
            status_code=403,
            detail="Request origin is not allowed",
        )


def require_listing_access(
    car_id: int,
    db: Session,
    user: User,
) -> Vehicle:
    car = db.get(Vehicle, car_id)

    if car is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    # Admin can manage every vehicle.
    if user.role == "admin":
        return car

    # Unassigned demo cars are admin-only.
    if car.owner_id != user.id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission "
                "to manage this listing"
            ),
        )

    return car


def require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )


# --------------------------------------------------
# SERIALISERS
# --------------------------------------------------

def vehicle_to_dict(car: Vehicle):
    return {
        "id": car.id,
        "make": car.make,
        "model": car.model,
        "year": car.year,
        "price_nzd": car.price_nzd,
        "mileage_km": car.mileage_km,
        "location": car.location,
        "owner_id": car.owner_id,
    }


def image_to_dict(image: VehicleImage):
    return {
        "id": image.id,
        "url": (
            f"/uploads/vehicles/{image.filename}"
        ),
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
# PUBLIC VEHICLE LISTINGS
# --------------------------------------------------

@app.get("/api/v1/cars")
def list_cars(
    db: Session = Depends(get_db),
):
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


# --------------------------------------------------
# CREATE VEHICLE - LOGIN REQUIRED
# --------------------------------------------------

@app.post(
    "/api/v1/cars",
    status_code=status.HTTP_201_CREATED,
)
def create_car(
    payload: VehicleCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)

    car = Vehicle(
        **payload.model_dump(),
        owner_id=user.id,
    )

    db.add(car)
    db.commit()
    db.refresh(car)

    return vehicle_to_dict(car)


# --------------------------------------------------
# EDIT VEHICLE - OWNER OR ADMIN
# --------------------------------------------------

@app.patch("/api/v1/cars/{car_id}")
def update_car(
    car_id: int,
    changes: VehicleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)

    car = require_listing_access(
        car_id,
        db,
        user,
    )

    updates = changes.model_dump(
        exclude_unset=True
    )

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
# VEHICLE IMAGE UPLOAD - OWNER OR ADMIN
# --------------------------------------------------

@app.post(
    "/api/v1/cars/{car_id}/images",
    status_code=status.HTTP_201_CREATED,
)
async def upload_car_images(
    car_id: int,
    files: Annotated[list[UploadFile], File()],
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)

    require_listing_access(
        car_id,
        db,
        user,
    )

    if not files or len(files) > MAX_IMAGES_PER_VEHICLE:
        raise HTTPException(
            status_code=400,
            detail="Upload between 1 and 10 images",
        )

    existing = db.scalars(
        select(VehicleImage)
        .where(VehicleImage.vehicle_id == car_id)
        .order_by(
            VehicleImage.position,
            VehicleImage.id,
        )
    ).all()

    if (
        len(existing) + len(files)
        > MAX_IMAGES_PER_VEHICLE
    ):
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 photos per vehicle",
        )

    saved_paths: list[Path] = []
    added_images: list[VehicleImage] = []

    try:
        for index, file in enumerate(files):
            raw = await file.read(
                MAX_UPLOAD_BYTES + 1
            )

            if len(raw) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Each photo must be 5 MB or less",
                )

            try:
                with Image.open(
                    io.BytesIO(raw)
                ) as source:
                    if source.format not in {
                        "JPEG",
                        "PNG",
                        "WEBP",
                    }:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                "Only JPG, PNG and WEBP "
                                "photos are supported"
                            ),
                        )

                    width, height = source.size

                    if (
                        width * height
                        > MAX_IMAGE_PIXELS
                    ):
                        raise HTTPException(
                            status_code=400,
                            detail="Image dimensions are too large",
                        )

                    source.verify()

                with Image.open(
                    io.BytesIO(raw)
                ) as source:
                    processed = ImageOps.exif_transpose(
                        source
                    )

                    processed.thumbnail(
                        (1600, 1600)
                    )

                    if processed.mode in {
                        "RGBA",
                        "LA",
                    } or (
                        processed.mode == "P"
                        and "transparency"
                        in processed.info
                    ):
                        rgba = processed.convert("RGBA")

                        background = Image.new(
                            "RGB",
                            rgba.size,
                            (255, 255, 255),
                        )

                        background.paste(
                            rgba,
                            mask=rgba.getchannel("A"),
                        )

                        processed = background
                    else:
                        processed = processed.convert(
                            "RGB"
                        )

                    filename = (
                        f"{uuid.uuid4().hex}.jpg"
                    )

                    destination = (
                        UPLOAD_DIR / filename
                    )

                    processed.save(
                        destination,
                        format="JPEG",
                        quality=85,
                        optimize=True,
                    )

                    saved_paths.append(
                        destination
                    )

            except HTTPException:
                raise

            except (
                UnidentifiedImageError,
                Image.DecompressionBombError,
                OSError,
                ValueError,
            ) as error:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or damaged image",
                ) from error

            image_record = VehicleImage(
                vehicle_id=car_id,
                filename=filename,
                position=len(existing) + index,
                is_cover=(
                    len(existing) == 0
                    and index == 0
                ),
            )

            db.add(image_record)
            added_images.append(image_record)

        db.commit()

        for image in added_images:
            db.refresh(image)

        return {
            "vehicle_id": car_id,
            "images": [
                image_to_dict(image)
                for image in added_images
            ],
        }

    except Exception:
        db.rollback()

        for path in saved_paths:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.exception(
                    "Unable to clean up uploaded image"
                )

        raise

    finally:
        for file in files:
            await file.close()


# --------------------------------------------------
# PUBLIC VEHICLE PHOTOS
# --------------------------------------------------

@app.get("/api/v1/cars/{car_id}/images")
def get_car_images(
    car_id: int,
    db: Session = Depends(get_db),
):
    car = db.get(Vehicle, car_id)

    if car is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    images = db.scalars(
        select(VehicleImage)
        .where(VehicleImage.vehicle_id == car_id)
        .order_by(
            VehicleImage.position,
            VehicleImage.id,
        )
    ).all()

    return {
        "vehicle_id": car_id,
        "images": [
            image_to_dict(image)
            for image in images
        ],
    }


# --------------------------------------------------
# DELETE VEHICLE - OWNER OR ADMIN
# --------------------------------------------------

@app.delete("/api/v1/cars/{car_id}")
def delete_car(
    car_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    verify_write_origin(request)

    car = require_listing_access(
        car_id,
        db,
        user,
    )

    images = db.scalars(
        select(VehicleImage).where(
            VehicleImage.vehicle_id == car_id
        )
    ).all()

    filenames = [
        image.filename
        for image in images
    ]

    for image in images:
        db.delete(image)

    db.delete(car)
    db.commit()

    for filename in filenames:
        try:
            (UPLOAD_DIR / filename).unlink(
                missing_ok=True
            )
        except OSError:
            logger.exception(
                "Could not remove vehicle photo: %s",
                filename,
            )

    return {
        "message": "Vehicle deleted successfully",
        "deleted_vehicle_id": car_id,
        "deleted_images": len(images),
    }


# --------------------------------------------------
# MY LISTINGS - LOGIN REQUIRED
# --------------------------------------------------

@app.get("/api/v1/my/cars")
def get_my_listings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cars = db.scalars(
        select(Vehicle)
        .where(Vehicle.owner_id == user.id)
        .order_by(Vehicle.id.desc())
    ).all()

    return {
        "data": [
            vehicle_to_dict(car)
            for car in cars
        ],
        "total": len(cars),
    }


# --------------------------------------------------
# ADMIN LISTINGS - ADMIN ONLY
# --------------------------------------------------

@app.get("/api/v1/admin/cars")
def get_admin_listings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)

    cars = db.scalars(
        select(Vehicle)
        .order_by(Vehicle.id.desc())
    ).all()

    return {
        "data": [
            vehicle_to_dict(car)
            for car in cars
        ],
        "total": len(cars),
    }


# --------------------------------------------------
# OPENAPI IMAGE UPLOAD COMPATIBILITY
# --------------------------------------------------

def custom_openapi():
    if app.openapi_schema is not None:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    for component in (
        schema.get("components", {})
        .get("schemas", {})
        .values()
    ):
        for property_schema in (
            component.get("properties", {})
            .values()
        ):
            items = property_schema.get(
                "items",
                {},
            )

            if (
                items.get("contentMediaType")
                == "application/octet-stream"
            ):
                items.pop(
                    "contentMediaType",
                    None,
                )
                items["format"] = "binary"

    app.openapi_schema = schema

    return schema


app.openapi = custom_openapi
