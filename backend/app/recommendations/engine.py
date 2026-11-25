"""Deterministic evidence-based scoring. No make-based quality stereotypes."""

import re
from dataclasses import dataclass
from app.recommendations.schemas import FinderRequest

# Changing these changes ranking, not eligibility. Keep versioned with docs/tests.
WEIGHTS = {
    "budget": 3.0,
    "makes": 2.0,
    "models": 2.0,
    "body_type": 2.0,
    "min_year": 1.0,
    "max_mileage": 1.5,
    "fuel_type": 2.0,
    "transmission": 1.5,
    "drivetrain": 1.5,
    "location": 1.0,
    "personal": 2.0,
    "min_seats": 2.0,
}
LABELS = {
    "sporty": "Performance",
    "reliability": "Reliability",
    "efficiency": "Fuel efficiency",
    "luxury": "Comfort/luxury",
    "running_costs": "Running costs",
    "family": "Family practicality",
}


DEMO_SUFFIX = r"\s*[-–—]?\s*DEMO\s*[-–—]?\s*NOT\s+FOR\s+SALE\s*"


def public_label(value):
    if value is None:
        return None
    return re.sub(DEMO_SUFFIX, "", value, flags=re.IGNORECASE).strip() or value


def model_key(value):
    return re.sub(r"[\s-]", "", public_label(value)).casefold()


def same(a, b):
    return str(a).strip().casefold() == str(b).strip().casefold()


def demo_listing(car):
    text = f'{car.model} {car.variant or ""} {car.description or ""}'.upper()
    return "DEMO" in text and "NOT FOR SALE" in text


@dataclass
class Ranked:
    car: object
    score: float
    coverage: float
    reasons: list[str]
    unmet: list[str]
    unknown: list[str]
    over_budget: int
    known_fit: float
    breakdown: list[dict]


def rank(car, preferences: FinderRequest) -> Ranked:
    known_weight = total_weight = earned = 0.0
    reasons, unmet, unknown, breakdown = [], [], [], []

    def factor(name, weight, value, explanation, failure):
        nonlocal known_weight, total_weight, earned
        weight *= preferences.criterion_importance.get(name, 2) / 2
        total_weight += weight
        criterion_labels = {
            "budget": "Budget",
            "makes": "Manufacturer",
            "models": "Model",
            "body_type": "Body type",
            "min_year": "Model year",
            "max_mileage": "Kilometres",
            "fuel_type": "Fuel type",
            "transmission": "Transmission",
            "drivetrain": "Drivetrain",
            "location": "Location",
            "min_seats": "Seating",
        }
        status = (
            "unknown"
            if value is None
            else "matched" if value == 1 else "unmet" if value == 0 else "partial"
        )
        detail = explanation if value is None or value == 1 else failure
        breakdown.append(
            {
                "criterion": name,
                "label": criterion_labels.get(name, LABELS.get(name, name)),
                "weight": weight,
                "fit_percent": None if value is None else round(value * 100, 1),
                "status": status,
                "explanation": detail,
            }
        )
        if value is None:
            unknown.append(explanation)
            return
        known_weight += weight
        earned += weight * value
        (reasons if value == 1 else unmet).append(detail)

    budget = preferences.max_budget
    assert budget is not None
    excess = max(0, car.price_nzd - budget)
    factor(
        "budget",
        WEIGHTS["budget"],
        1.0 if not excess else max(0, 1 - excess / (budget * 0.1)),
        f"Within your NZ${budget:,} maximum budget",
        f"NZ${excess:,} above your maximum budget",
    )
    for field, attr, wanted in [
        ("makes", "make", preferences.makes),
        ("models", "model", preferences.models),
    ]:
        if wanted:
            match = any(
                (
                    model_key(getattr(car, attr)) == model_key(value)
                    if field == "models"
                    else same(getattr(car, attr), value)
                )
                for value in wanted
            )
            factor(
                field,
                WEIGHTS[field],
                float(match),
                f'Matches your preferred {"manufacturer" if field == "makes" else "model"}: {public_label(getattr(car,attr))}',
                f"{public_label(getattr(car,attr))} is outside your preferred {field}",
            )
    for field in ["body_type", "fuel_type", "transmission", "drivetrain", "location"]:
        wanted = getattr(preferences, field)
        if wanted is None:
            continue
        actual = getattr(car, field)
        match = (
            None
            if not actual
            else (
                str(wanted).casefold() in str(actual).casefold()
                if field == "location"
                else same(actual, wanted)
            )
        )
        label = field.replace("_", " ")
        factor(
            field,
            WEIGHTS[field],
            None if match is None else float(match),
            (
                f"Matches your {label} preference: {wanted}"
                if actual
                else f"{label.capitalize()} is not recorded"
            ),
            f"{label.capitalize()}: {actual}; you preferred {wanted}",
        )
    if preferences.min_year is not None:
        match = car.year >= preferences.min_year
        factor(
            "min_year",
            WEIGHTS["min_year"],
            1.0 if match else max(0, 1 - (preferences.min_year - car.year) / 10),
            f"{car.year} meets your minimum year of {preferences.min_year}",
            f"{car.year} is earlier than your preferred {preferences.min_year}",
        )
    if preferences.max_mileage is not None:
        maximum = preferences.max_mileage
        match = car.mileage_km <= maximum
        factor(
            "max_mileage",
            WEIGHTS["max_mileage"],
            (
                1.0
                if match
                else max(0, 1 - (car.mileage_km - maximum) / max(maximum, 10000))
            ),
            f"{car.mileage_km:,} km meets your {maximum:,} km preference",
            f"{car.mileage_km:,} km exceeds your preferred {maximum:,} km",
        )
    if preferences.min_seats is not None and "family" not in preferences.priorities:
        seats = car.seats
        wanted = preferences.min_seats
        factor(
            "min_seats",
            WEIGHTS["min_seats"],
            None if seats is None else float(seats >= wanted),
            (
                f"{seats} listed seats meet your minimum of {wanted}"
                if seats is not None
                else "Seating capacity is not recorded"
            ),
            f"{seats} listed seats fall below your preference for {wanted}",
        )
    for key, importance in preferences.priorities.items():
        weight = WEIGHTS["personal"] * importance
        factor_name = (
            "min_seats"
            if key == "family" and preferences.min_seats is not None
            else key
        )
        if factor_name == "min_seats":
            weight += WEIGHTS["min_seats"]
        if key == "family" and car.seats is not None:
            factor(
                factor_name,
                weight,
                float(car.seats >= max(5, preferences.min_seats or 5)),
                f"{car.seats} listed seats meet your family seating preference ({max(5, preferences.min_seats or 5)}+); space and child-seat fit are not verified",
                f"Only {car.seats} seats are listed; your family seating preference is {max(5, preferences.min_seats or 5)}+",
            )
        else:
            factor(
                factor_name,
                weight,
                None,
                f"{LABELS[key]} cannot be verified from the available listing specifications",
                "",
            )
    return Ranked(
        car,
        round(earned / total_weight * 100, 1) if total_weight else 0.0,
        round(known_weight / total_weight * 100, 1),
        reasons,
        unmet,
        unknown,
        excess,
        round(earned / known_weight * 100, 1) if known_weight else 0.0,
        [
            {
                **item,
                "weight_share_percent": round(item["weight"] / total_weight * 100, 1),
                "score_points": round(
                    item["weight"] / total_weight * (item["fit_percent"] or 0), 2
                ),
            }
            for item in breakdown
        ],
    )


def sorted_key(result, mode="match"):
    if mode == "price":
        return (result.car.price_nzd, *sort_key(result))
    if mode == "newest":
        return (-result.car.year, *sort_key(result))
    if mode == "mileage":
        return (result.car.mileage_km, *sort_key(result))
    return sort_key(result)


def sort_key(result):
    return (
        -result.score,
        -result.coverage,
        result.car.price_nzd,
        -result.car.year,
        result.car.mileage_km,
        result.car.id,
    )
