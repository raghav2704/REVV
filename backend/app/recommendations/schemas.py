from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.vehicle_spec_schemas import BodyType, FuelType, Transmission, Drivetrain

Preference = Literal[
    "sporty", "reliability", "efficiency", "family", "luxury", "running_costs"
]
Filter = Literal[
    "makes",
    "models",
    "body_type",
    "min_year",
    "max_mileage",
    "fuel_type",
    "transmission",
    "drivetrain",
    "location",
    "min_seats",
]


class FinderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_budget: int | None = Field(default=None, ge=1000, le=100_000_000)
    min_budget: int | None = Field(default=None, ge=0, le=100_000_000)
    include_near_matches: bool = False
    exclude_demo: bool = False
    makes: list[str] = Field(default_factory=list, max_length=12)
    models: list[str] = Field(default_factory=list, max_length=12)
    body_type: BodyType | None = None
    min_year: int | None = Field(default=None, ge=1900, le=2100)
    max_mileage: int | None = Field(default=None, ge=0, le=2_000_000)
    fuel_type: FuelType | None = None
    transmission: Transmission | None = None
    drivetrain: Drivetrain | None = None
    location: str | None = Field(default=None, max_length=100)
    min_seats: int | None = Field(default=None, ge=1, le=100)
    exclude_makes: list[str] = Field(default_factory=list, max_length=12)
    exclude_fuels: list[FuelType] = Field(default_factory=list, max_length=6)
    sort_by: Literal["match", "price", "newest", "mileage"] = "match"
    criterion_importance: dict[Filter | Literal["budget"], int] = Field(
        default_factory=dict, max_length=11
    )
    mandatory: list[Filter] = Field(default_factory=list, max_length=10)
    priorities: dict[Preference, int] = Field(default_factory=dict, max_length=6)
    text: str = Field(default="", max_length=1000)
    limit: int = Field(default=8, ge=1, le=20)

    @field_validator("makes", "models", "exclude_makes")
    @classmethod
    def clean_names(cls, values):
        cleaned = list(dict.fromkeys(value.strip() for value in values))
        if any(
            not value or len(value) > 100 or any(ord(char) < 32 for char in value)
            for value in cleaned
        ):
            raise ValueError("Manufacturer/model names must contain 1–100 characters")
        return cleaned

    @field_validator("text", "location")
    @classmethod
    def safe_text(cls, value):
        if value is None:
            return None
        if any(ord(char) < 32 and char not in "\n\r\t" for char in value):
            raise ValueError("Unsupported control character")
        return value.strip()

    @field_validator("priorities", "criterion_importance")
    @classmethod
    def valid_priorities(cls, values):
        if any(value not in {1, 2, 3} for value in values.values()):
            raise ValueError("Preference importance must be 1, 2 or 3")
        return values

    @model_validator(mode="after")
    def valid_budget(self):
        if (
            self.min_budget is not None
            and self.max_budget is not None
            and self.min_budget > self.max_budget
        ):
            raise ValueError("Minimum budget cannot exceed maximum budget")
        if {value.casefold() for value in self.makes} & {
            value.casefold() for value in self.exclude_makes
        }:
            raise ValueError("A manufacturer cannot be both preferred and excluded")
        if self.fuel_type in self.exclude_fuels:
            raise ValueError("A fuel type cannot be both preferred and excluded")
        return self
