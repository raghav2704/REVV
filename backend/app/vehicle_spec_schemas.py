
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ==================================================
# VEHICLE SPECIFICATION OPTIONS
# ==================================================

BodyType = Literal[
    "Sedan",
    "SUV",
    "Hatchback",
    "Wagon",
    "Coupe",
    "Convertible",
    "Ute",
    "Van",
    "People Mover",
    "Other",
]

FuelType = Literal[
    "Petrol",
    "Diesel",
    "Hybrid",
    "Plug-in Hybrid",
    "Electric",
    "Other",
]

Transmission = Literal[
    "Automatic",
    "Manual",
    "CVT",
    "Other",
]

Drivetrain = Literal[
    "FWD",
    "RWD",
    "AWD",
    "4WD",
    "Other",
]

Condition = Literal[
    "New",
    "Used",
    "Demonstrator",
]

VehicleOrigin = Literal[
    "NZ New",
    "Imported",
    "Unknown",
]

ListingStatus = Literal[
    "active",
    "draft",
    "sold",
    "withdrawn",
]


# ==================================================
# SHARED VEHICLE SPECIFICATIONS
# ==================================================

class VehicleSpecifications(BaseModel):

    variant: str | None = Field(
        default=None,
        max_length=150,
    )

    registration_plate: str | None = Field(
        default=None,
        max_length=20,
    )

    vin: str | None = Field(
        default=None,
        min_length=17,
        max_length=17,
    )

    body_type: BodyType | None = None

    exterior_colour: str | None = Field(
        default=None,
        max_length=50,
    )

    seats: int | None = Field(
        default=None,
        ge=1,
        le=100,
    )

    fuel_type: FuelType | None = None

    transmission: Transmission | None = None

    drivetrain: Drivetrain | None = None

    engine_cc: int | None = Field(
        default=None,
        ge=1,
        le=30000,
    )

    condition: Condition | None = None

    vehicle_origin: VehicleOrigin | None = None

    wof_expiry: date | None = None

    registration_expiry: date | None = None

    description: str | None = Field(
        default=None,
        max_length=10000,
    )

    @field_validator(
        "variant",
        "registration_plate",
        "vin",
        "exterior_colour",
        "description",
    )
    @classmethod
    def trim_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip()
        return value or None

    @field_validator("vin")
    @classmethod
    def validate_vin(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.upper()

        if not value.isalnum():
            raise ValueError(
                "VIN must contain only letters and numbers"
            )

        if any(char in value for char in "IOQ"):
            raise ValueError(
                "VIN cannot contain I, O or Q"
            )

        return value


# ==================================================
# CREATE VEHICLE
# ==================================================

class VehicleCreate(VehicleSpecifications):

    make: str = Field(
        min_length=1,
        max_length=100,
    )

    model: str = Field(
        min_length=1,
        max_length=100,
    )

    year: int = Field(
        ge=1900,
        le=2100,
    )

    price_nzd: int = Field(
        gt=0,
    )

    mileage_km: int = Field(
        ge=0,
    )

    location: str = Field(
        min_length=1,
        max_length=100,
    )

    listing_status: ListingStatus = "active"

    @field_validator(
        "make",
        "model",
        "location",
    )
    @classmethod
    def validate_required_text(
        cls,
        value: str,
    ) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "This field cannot be empty"
            )

        return value


# ==================================================
# UPDATE VEHICLE
# ==================================================

class VehicleUpdate(VehicleSpecifications):

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

    listing_status: ListingStatus | None = None

    @field_validator(
        "make",
        "model",
        "location",
    )
    @classmethod
    def validate_optional_required_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError(
                "This field cannot be empty"
            )

        return value
