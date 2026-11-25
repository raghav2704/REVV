"""Public, bounded, rules-only recommendations; no buyer profile is stored."""

import re
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy import func, select, text, and_, not_
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Vehicle, VehicleImage
from app.security import auth_rate_limit
from app.recommendations.schemas import FinderRequest
from app.recommendations.interpreter import get_interpreter
from app.recommendations.engine import (
    demo_listing,
    rank,
    sort_key,
    sorted_key,
    public_label,
    model_key,
    DEMO_SUFFIX,
)

router = APIRouter(prefix="/api/v1/recommendations", tags=["Smart Car Finder"])
CANDIDATE_LIMIT = 2000


def get_db():
    with SessionLocal() as db:
        yield db


def bounded_rows(db, query):
    try:
        return db.scalars(query).all()
    except OperationalError:
        db.rollback()
        raise HTTPException(
            503,
            "The search could not finish. Narrow your filters or try again shortly.",
        ) from None


def interpret_request(payload):
    interpretation = get_interpreter().interpret(payload.text)
    explicit = {
        key: value
        for key, value in payload.model_dump().items()
        if value is not None and value != [] and value != {} and value != ""
    }
    inferred = dict(interpretation.inferred)
    if payload.exclude_makes and "makes" in inferred:
        inferred["makes"] = [
            make
            for make in inferred["makes"]
            if make.casefold()
            not in {value.casefold() for value in payload.exclude_makes}
        ]
        interpretation.notes.append(
            "Explicit manufacturer exclusions override text-derived manufacturer preferences."
        )
    if inferred.get("fuel_type") in payload.exclude_fuels:
        inferred.pop("fuel_type")
        interpretation.notes.append(
            "Explicit fuel exclusions override the text-derived fuel preference."
        )
    merged = {**inferred, **explicit}
    merged["mandatory"] = list(
        dict.fromkeys(interpretation.inferred.get("mandatory", []) + payload.mandatory)
    )
    merged["priorities"] = {
        **interpretation.inferred.get("priorities", {}),
        **payload.priorities,
    }
    preferences = FinderRequest.model_validate(merged)
    if preferences.max_budget is None:
        raise HTTPException(
            422,
            "Enter a maximum budget, or use a supported amount such as $35,000 in your description.",
        )
    for field in preferences.mandatory:
        if getattr(preferences, field) in (None, [], ""):
            raise HTTPException(422, f"Choose a value for mandatory filter: {field}")
    notes = interpretation.notes.copy()
    if interpretation.inferred:
        notes.append(
            "Filled-in form selections override interpreted text. Clear the description to remove text-derived preferences. Text-derived filters are soft unless a supported seating requirement is explicitly mandatory. Budget is always a hard limit for best matches."
        )
    return preferences, interpretation.inferred, notes


@router.post("/cars")
def recommend_cars(
    payload: FinderRequest, request: Request, db: Session = Depends(get_db)
):
    auth_rate_limit(request, "car_finder_ip", 30, 60)
    try:
        preferences, inferred, notes = interpret_request(payload)
    except ValidationError:
        raise HTTPException(
            422,
            "The interpreted preferences are outside the supported limits. Adjust the text or use the filters.",
        ) from None
    except ValueError:
        raise HTTPException(
            503,
            "Only the free rules provider is available. No external AI service was called.",
        ) from None
    assert preferences.max_budget is not None
    ceiling = (
        preferences.max_budget
        * (110 if preferences.include_near_matches else 100)
        // 100
    )
    query = select(Vehicle).where(
        Vehicle.listing_status == "active", Vehicle.price_nzd <= ceiling
    )
    if preferences.exclude_demo:
        demo_text = func.upper(
            func.concat_ws(" ", Vehicle.model, Vehicle.variant, Vehicle.description)
        )
        query = query.where(
            not_(and_(demo_text.contains("DEMO"), demo_text.contains("NOT FOR SALE")))
        )
    if preferences.exclude_makes:
        query = query.where(
            func.lower(Vehicle.make).not_in(
                [item.casefold() for item in preferences.exclude_makes]
            )
        )
    if preferences.exclude_fuels:
        # Unknown fuel must not silently pass a mandatory exclusion.
        query = query.where(
            Vehicle.fuel_type.is_not(None),
            func.lower(Vehicle.fuel_type).not_in(
                [item.casefold() for item in preferences.exclude_fuels]
            ),
        )
    if preferences.min_budget is not None:
        query = query.where(Vehicle.price_nzd >= preferences.min_budget)
    for field in preferences.mandatory:
        value = getattr(preferences, field)
        if field in {"makes", "models"}:
            if field == "models":
                column = func.regexp_replace(
                    func.regexp_replace(Vehicle.model, DEMO_SUFFIX, "", "i"),
                    r"[\s-]",
                    "",
                    "g",
                )
                values = [model_key(item) for item in value]
            else:
                column = Vehicle.make
                values = [item.casefold() for item in value]
            query = query.where(func.lower(column).in_(values))
        elif field == "min_seats":
            query = query.where(Vehicle.seats >= value)
        elif field == "min_year":
            query = query.where(Vehicle.year >= value)
        elif field == "max_mileage":
            query = query.where(Vehicle.mileage_km <= value)
        elif field == "location":
            query = query.where(
                func.lower(Vehicle.location).contains(value.casefold(), autoescape=True)
            )
        else:
            query = query.where(func.lower(getattr(Vehicle, field)) == value.casefold())
    db.execute(text("SET LOCAL statement_timeout = '2000ms'"))
    cars = bounded_rows(
        db,
        query.order_by(
            func.abs(Vehicle.price_nzd - preferences.max_budget), Vehicle.id
        ).limit(CANDIDATE_LIMIT + 1),
    )
    truncated = len(cars) > CANDIDATE_LIMIT
    ranked = [rank(car, preferences) for car in cars[:CANDIDATE_LIMIT]]
    best = sorted(
        (item for item in ranked if not item.over_budget),
        key=lambda item: sorted_key(item, preferences.sort_by),
    )[: preferences.limit]
    near = (
        sorted(
            (item for item in ranked if item.over_budget),
            key=lambda item: sorted_key(item, preferences.sort_by),
        )[: preferences.limit]
        if preferences.include_near_matches
        else []
    )
    ids = [item.car.id for item in best + near]
    covers = {}
    if ids:
        photos = bounded_rows(
            db,
            select(VehicleImage)
            .join(Vehicle, Vehicle.id == VehicleImage.vehicle_id)
            .where(VehicleImage.vehicle_id.in_(ids), Vehicle.listing_status == "active")
            .order_by(
                VehicleImage.is_cover.desc(), VehicleImage.position, VehicleImage.id
            )
            .limit(len(ids) * 10),
        )
        for photo in photos:
            if photo.vehicle_id not in covers and re.fullmatch(
                r"[0-9a-f]{32}\.jpg", photo.filename
            ):
                covers[photo.vehicle_id] = f"/uploads/vehicles/{photo.filename}"

    def serialize(item):
        car = item.car
        return {
            "vehicle": {
                key: (
                    public_label(getattr(car, key))
                    if key in {"model", "variant"}
                    else getattr(car, key)
                )
                for key in [
                    "id",
                    "make",
                    "model",
                    "year",
                    "variant",
                    "price_nzd",
                    "mileage_km",
                    "location",
                    "body_type",
                    "fuel_type",
                    "transmission",
                    "drivetrain",
                    "seats",
                    "engine_cc",
                    "condition",
                    "exterior_colour",
                    "vehicle_origin",
                ]
            },
            "photo_url": covers.get(car.id),
            "listing_url": f"/cars/{car.id}",
            "is_demo": demo_listing(car),
            "score": item.score,
            "known_fit": item.known_fit,
            "score_breakdown": item.breakdown,
            "budget_headroom_nzd": max(0, preferences.max_budget - car.price_nzd),
            "evidence_coverage": item.coverage,
            "reasons": item.reasons,
            "unmet_preferences": item.unmet,
            "unknown_preferences": item.unknown,
            "over_budget_nzd": item.over_budget,
            "all_preferences_satisfied": not (item.unmet or item.unknown),
        }

    if truncated:
        notes.append(
            "Ranking is limited to the 2,000 eligible listings closest to the budget. Narrow your mandatory filters for more specific results."
        )
    return {
        "provider": "rules",
        "scoring_version": "2.0",
        "preferences": preferences.model_dump(exclude={"text"}),
        "interpreted": inferred,
        "notes": notes,
        "candidate_limit_reached": truncated,
        "candidates_considered": min(len(cars), CANDIDATE_LIMIT),
        "matches": [serialize(item) for item in best],
        "near_matches": [serialize(item) for item in near],
        "relaxation_options": (
            (
                [
                    {
                        "field": field,
                        "label": (
                            "Review the seating requirement in your description"
                            if field in inferred.get("mandatory", [])
                            else f"Treat {field.replace('_',' ')} as a preference"
                        ),
                        "action": (
                            "edit_text"
                            if field in inferred.get("mandatory", [])
                            else "soften"
                        ),
                    }
                    for field in preferences.mandatory
                ]
                + (
                    [
                        {
                            "field": "include_near_matches",
                            "label": "Check up to 10% above budget",
                            "action": "near",
                        }
                    ]
                    if not preferences.include_near_matches
                    else []
                )
            )
            if not best
            else []
        ),
        "summary": {
            "within_budget": sum(not item.over_budget for item in ranked),
            "over_budget": sum(bool(item.over_budget) for item in ranked),
        },
        "empty_message": (
            None
            if best
            else "No active REVV listings meet these hard requirements. Try a different budget or relax a mandatory filter."
        ),
    }
