"""A deliberately small, maintained phrase taxonomy, not LLM understanding."""

import os
import re
from dataclasses import dataclass, field
from typing import Protocol

MAKES = {
    "BMW": ["bmw"],
    "Mercedes-Benz": ["mercedes", "mercedes benz", "merc"],
    "Audi": ["audi"],
    "Volkswagen": ["volkswagen", "vw"],
    "Toyota": ["toyota"],
    "Tesla": ["tesla"],
    "Ford": ["ford"],
    "Mazda": ["mazda"],
    "Hyundai": ["hyundai"],
    "Kia": ["kia"],
    "Subaru": ["subaru"],
    "Nissan": ["nissan"],
    "Lexus": ["lexus"],
    "Honda": ["honda"],
    "Suzuki": ["suzuki"],
    "Volvo": ["volvo"],
    "Porsche": ["porsche"],
    "Skoda": ["skoda"],
    "Peugeot": ["peugeot"],
    "Renault": ["renault"],
    "Alfa Romeo": ["alfa romeo"],
    "Jaguar": ["jaguar"],
    "Land Rover": ["land rover"],
}
EUROPEAN = [
    "BMW",
    "Mercedes-Benz",
    "Audi",
    "Volkswagen",
    "Volvo",
    "Porsche",
    "Skoda",
    "Peugeot",
    "Renault",
    "Alfa Romeo",
    "Jaguar",
    "Land Rover",
]
MODELS = {
    "320i": "BMW",
    "218i": "BMW",
    "C200": "Mercedes-Benz",
    "A250": "Mercedes-Benz",
    "A4": "Audi",
    "Corolla": "Toyota",
    "RAV4": "Toyota",
    "Model 3": "Tesla",
    "Model3": "Tesla",
    "Ranger": "Ford",
    "CX-5": "Mazda",
    "CX5": "Mazda",
    "Tucson": "Hyundai",
    "Sportage": "Kia",
    "Golf": "Volkswagen",
    "WRX": "Subaru",
    "X-Trail": "Nissan",
}
LOCATIONS = [
    "Auckland",
    "Wellington",
    "Christchurch",
    "Hamilton",
    "Tauranga",
    "Dunedin",
    "Queenstown",
    "Nelson",
    "Napier",
    "Palmerston North",
    "New Plymouth",
    "Whangarei",
    "Invercargill",
]


def contains(text, phrase):
    return (
        re.search(
            r"(?<!\w)" + re.escape(phrase.lower().replace("-", " ")) + r"(?!\w)", text
        )
        is not None
    )


@dataclass
class Interpretation:
    inferred: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


class PreferenceInterpreter(Protocol):
    def interpret(self, text: str) -> Interpretation: ...


class RuleBasedPreferenceInterpreter:
    def interpret(self, text: str) -> Interpretation:
        if not text.strip():
            return Interpretation()
        words = re.sub(r"[-—]", " ", text.lower())
        result = Interpretation(
            notes=[
                "Only supported phrases are interpreted. Review the interpreted preferences; other text may be ignored."
            ]
        )
        # Negation is deliberately not guessed: ask for structured controls instead.
        if re.search(r"\b(not|no|avoid|except|without)\b|don't|do not", words):
            result.notes.append(
                "Negation is not interpreted. Use the filters to express exclusions or mandatory requirements."
            )
            return result
        amounts = re.findall(
            r"(?:\$|nzd\s*)(\d[\d,]*(?:\.\d+)?)\s*(k)?|\b(\d+(?:\.\d+)?)\s*k\b(?!\s*(?:km|kilometres|kilometers))",
            words,
        )
        budgets = []
        for amount, suffix, plain_k in amounts:
            value = float((amount or plain_k).replace(",", "")) * (
                1000 if suffix or plain_k else 1
            )
            if 1000 <= value <= 100_000_000:
                budgets.append(int(value))
        if budgets:

            if len(set(budgets)) == 1:
                result.inferred["max_budget"] = budgets[0]
            elif len(budgets) == 2 and re.search(
                r"\b(?:between|from)\b.+\b(?:and|to)\b", words
            ):
                result.inferred["min_budget"], result.inferred["max_budget"] = budgets
                result.notes.append(
                    "The stated budget range is treated as a hard minimum and maximum; form values override it."
                )
            else:
                result.notes.append(
                    "Multiple money amounts found; enter the maximum budget in the form."
                )
        makes = [
            make
            for make, aliases in MAKES.items()
            if any(contains(words, alias) for alias in aliases)
        ]
        if not makes and contains(words, "european"):
            makes = EUROPEAN.copy()
            result.notes.append(
                "European uses the maintained brand group shown below, not a complete list or a guarantee of manufacturing location."
            )
        models = [model for model in MODELS if contains(words, model)]
        if models and not makes:
            makes = list(dict.fromkeys(MODELS[model] for model in models))
        if makes:
            result.inferred["makes"] = makes
        if models:
            result.inferred["models"] = models
        rules = {
            "body_type": {
                "SUV": ["suv"],
                "Sedan": ["sedan", "saloon"],
                "Hatchback": ["hatchback", "hatch"],
                "Wagon": ["wagon", "estate"],
                "Ute": ["ute", "pickup"],
                "Coupe": ["coupe"],
                "Van": ["van"],
                "Convertible": ["convertible"],
            },
            "fuel_type": {
                "Electric": ["electric", "ev"],
                "Hybrid": ["hybrid"],
                "Diesel": ["diesel"],
                "Petrol": ["petrol"],
                "Plug-in Hybrid": ["plug in hybrid", "phev"],
            },
            "transmission": {
                "Automatic": ["automatic", "auto"],
                "Manual": ["manual"],
                "CVT": ["cvt"],
            },
            "drivetrain": {
                "AWD": ["awd", "all wheel drive"],
                "4WD": ["4wd", "four wheel drive"],
                "RWD": ["rwd", "rear wheel drive"],
                "FWD": ["fwd", "front wheel drive"],
            },
        }
        for field_name, options in rules.items():
            matches = [
                value
                for value, aliases in options.items()
                if any(contains(words, alias) for alias in aliases)
            ]
            if field_name == "fuel_type" and "Plug-in Hybrid" in matches:
                matches = [value for value in matches if value != "Hybrid"]
            if len(matches) == 1:
                result.inferred[field_name] = matches[0]
            elif len(matches) > 1:
                result.notes.append(
                    f'Multiple {field_name.replace("_", " ")} choices found; choose one with the filters.'
                )
        for location in LOCATIONS:
            if contains(words, location):
                result.inferred["location"] = location
                break
        year = re.search(
            r"\b(?:from|after|since|minimum year|min year)\s+(19\d{2}|20\d{2})\b", words
        )
        if year:
            result.inferred["min_year"] = int(year.group(1)) + (
                1 if year.group(0).startswith("after") else 0
            )
        if not year:
            newer = re.search(r"\b(19\d{2}|20\d{2})\s*(?:or newer|onwards|\+)", words)
            if newer:
                result.inferred["min_year"] = int(newer.group(1))
        seats = re.search(r"\b(\d{1,2})\s*(?:seats|seater|seat)\b", words)
        if seats:
            result.inferred["min_seats"] = int(seats.group(1))
            if re.search(
                r"\b(?:need|require|must have|at least)\s+(?:at least\s+)?\d{1,2}\s*(?:seats|seater|seat)\b",
                words,
            ):
                result.inferred["mandatory"] = ["min_seats"]
                result.notes.append(
                    "The required seating count is a hard constraint. Unrecorded seating cannot satisfy it."
                )
        mileage = re.search(
            r"\b(?:under|below|less than|max(?:imum)?)\s+(\d[\d,]*)\s*(k)?\s*(?:km|kilometres|kilometers)\b",
            words,
        )
        if mileage:
            result.inferred["max_mileage"] = int(mileage.group(1).replace(",", "")) * (
                1000 if mileage.group(2) else 1
            )
            if mileage.group(0).startswith(("under", "below", "less than")):
                result.inferred["max_mileage"] -= 1
        elif re.search(r"\blow (?:kms|km|kilometres|kilometers|mileage)\b", words):
            result.inferred["max_mileage"] = 60000
            result.notes.append(
                "“Low kilometres” is interpreted as a soft preference for at most 60,000 km; adjust it if needed."
            )
        priorities = {}
        for key, aliases in {
            "sporty": ["sporty", "performance"],
            "reliability": ["reliable", "reliability"],
            "efficiency": ["fuel efficient", "efficiency", "economical"],
            "family": ["family", "practical"],
            "luxury": ["luxury", "comfortable", "comfort"],
            "running_costs": ["low running costs", "cheap to run"],
        }.items():
            if any(contains(words, alias) for alias in aliases):
                priorities[key] = 2
        if priorities:
            result.inferred["priorities"] = priorities
        return result


def get_interpreter() -> PreferenceInterpreter:
    provider = os.getenv("REVV_AI_PROVIDER", "rules").strip().lower()
    if provider != "rules":
        raise ValueError(
            "Only the free rules provider is available. No external AI service was called."
        )
    return RuleBasedPreferenceInterpreter()
