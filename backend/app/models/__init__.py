
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# --------------------------------------------------
# VEHICLE MODEL
# --------------------------------------------------

class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

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

    # Links a vehicle to the account that created it.
    # Existing demonstration vehicles can remain unassigned.
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


# --------------------------------------------------
# VEHICLE IMAGE MODEL
# --------------------------------------------------

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


# --------------------------------------------------
# AUTHENTICATION MODELS
# --------------------------------------------------

from .user import User
from .user_session import UserSession
