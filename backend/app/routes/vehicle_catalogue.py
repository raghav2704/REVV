
from collections.abc import Generator

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import VehicleMake, VehicleModel


router = APIRouter(
    prefix="/api/v1",
    tags=["Vehicle Catalogue"],
)


# --------------------------------------------------
# DATABASE SESSION
# --------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# RESPONSE SCHEMAS
# --------------------------------------------------

class MakeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    make_id: int
    name: str


# --------------------------------------------------
# GET ALL VEHICLE MAKES
# --------------------------------------------------

@router.get(
    "/vehicle-makes",
    response_model=list[MakeResponse],
)
def get_vehicle_makes(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(VehicleMake).order_by(VehicleMake.name)
    ).all()


# --------------------------------------------------
# GET MODELS FOR A SPECIFIC MAKE
# --------------------------------------------------

@router.get(
    "/vehicle-makes/{make_id}/models",
    response_model=list[ModelResponse],
)
def get_vehicle_models(
    make_id: int,
    db: Session = Depends(get_db),
):
    make = db.get(VehicleMake, make_id)

    if make is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle make not found",
        )

    return db.scalars(
        select(VehicleModel)
        .where(VehicleModel.make_id == make_id)
        .order_by(VehicleModel.name)
    ).all()


# --------------------------------------------------
# GET SINGLE VEHICLE MODEL
# --------------------------------------------------

@router.get(
    "/vehicle-models/{model_id}",
    response_model=ModelResponse,
)
def get_vehicle_model(
    model_id: int,
    db: Session = Depends(get_db),
):
    model = db.get(VehicleModel, model_id)

    if model is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle model not found",
        )

    return model
