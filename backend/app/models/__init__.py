
from datetime import date

from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ==================================================
# VEHICLE MODEL
# ==================================================

class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    # Basic vehicle information
    make: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    price_nzd: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    mileage_km: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    location: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Existing ownership and permissions
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ----------------------------------------------
    # Vehicle identity
    # ----------------------------------------------

    variant: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    registration_plate: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    vin: Mapped[str | None] = mapped_column(
        String(17),
        nullable=True,
    )

    # ----------------------------------------------
    # Body and appearance
    # ----------------------------------------------

    body_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    exterior_colour: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    seats: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # ----------------------------------------------
    # Mechanical specifications
    # ----------------------------------------------

    fuel_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    transmission: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    drivetrain: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    engine_cc: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # ----------------------------------------------
    # Condition and vehicle origin
    # ----------------------------------------------

    condition: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        index=True,
    )

    vehicle_origin: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    # ----------------------------------------------
    # Compliance
    # ----------------------------------------------

    wof_expiry: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    registration_expiry: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    # ----------------------------------------------
    # Listing information
    # ----------------------------------------------

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    listing_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="active",
        server_default="active",
        index=True,
    )


# ==================================================
# VEHICLE IMAGES
# ==================================================

class VehicleImage(Base):
    __tablename__ = "vehicle_images"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_cover: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    position: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    vehicle: Mapped["Vehicle"] = relationship(
        "Vehicle",
    )


# ==================================================
# VEHICLE MANUFACTURER CATALOGUE
# ==================================================

class VehicleMake(Base):
    __tablename__ = "vehicle_makes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    models: Mapped[list["VehicleModel"]] = relationship(
        "VehicleModel",
        back_populates="make",
    )


# ==================================================
# VEHICLE MODEL CATALOGUE
# ==================================================

class VehicleModel(Base):
    __tablename__ = "vehicle_models"

    __table_args__ = (
        UniqueConstraint(
            "make_id",
            "name",
            name="uq_vehicle_models_make_name",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    make_id: Mapped[int] = mapped_column(
        ForeignKey(
            "vehicle_makes.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    make: Mapped["VehicleMake"] = relationship(
        "VehicleMake",
        back_populates="models",
    )


# ==================================================
# AUTHENTICATION MODELS
# ==================================================

from .user import User
from .user_session import UserSession
