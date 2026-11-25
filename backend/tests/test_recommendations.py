from types import SimpleNamespace
import socket
import urllib.request
import pytest
from sqlalchemy import text
from app.models import Vehicle, VehicleImage
from app.recommendations.schemas import FinderRequest
from app.recommendations.engine import rank, sort_key
from app.recommendations.interpreter import RuleBasedPreferenceInterpreter
from conftest import headers

URL = "/api/v1/recommendations/cars"


def search(client, **values):
    return client.post(URL, headers=headers(), json={"max_budget": 30000, **values})


def car(**changes):
    values = dict(
        id=1,
        make="Toyota",
        model="Corolla",
        year=2022,
        price_nzd=25000,
        mileage_km=40000,
        location="Auckland",
        variant=None,
        description=None,
        body_type="Sedan",
        fuel_type="Hybrid",
        transmission="Automatic",
        drivetrain="FWD",
        seats=5,
    )
    return SimpleNamespace(**{**values, **changes})


def test_budget_and_public_active_only(client, db):
    db.get(Vehicle, 3).listing_status = "sold"
    db.get(Vehicle, 4).listing_status = "withdrawn"
    db.commit()
    response = search(client).json()
    assert [item["vehicle"]["id"] for item in response["matches"]] == [1]
    assert search(client, max_budget=24000).json()["matches"] == []
    assert all(
        "owner_id" not in item["vehicle"] and "vin" not in item["vehicle"]
        for item in response["matches"]
    )


def test_drafts_stay_excluded_even_for_admin(client):
    response = client.post(URL, headers=headers("admin"), json={"max_budget": 30000})
    assert response.status_code == 200
    assert 2 not in [item["vehicle"]["id"] for item in response.json()["matches"]]


def test_near_matches_separate_and_opt_in(client, db):
    db.get(Vehicle, 1).price_nzd = 31500
    db.get(Vehicle, 3).price_nzd = 33000
    db.get(Vehicle, 4).price_nzd = 33001
    db.commit()
    assert search(client).json()["matches"] == []
    response = search(client, include_near_matches=True).json()
    assert response["matches"] == []
    assert {item["vehicle"]["id"] for item in response["near_matches"]} == {1, 3}
    assert all(item["over_budget_nzd"] > 0 for item in response["near_matches"])


def test_near_never_relaxes_other_mandatory_filters(client, db):
    db.get(Vehicle, 1).price_nzd = 31500
    db.get(Vehicle, 1).body_type = "SUV"
    db.commit()
    response = search(
        client, include_near_matches=True, body_type="Sedan", mandatory=["body_type"]
    ).json()
    assert response["near_matches"] == []


def test_soft_vs_hard_brand_and_body(client, db):
    db.get(Vehicle, 1).body_type = "Sedan"
    db.get(Vehicle, 3).make = "BMW"
    db.get(Vehicle, 3).body_type = "SUV"
    db.commit()
    soft = search(client, makes=["BMW"], body_type="SUV").json()["matches"]
    assert soft[0]["vehicle"]["id"] == 3
    assert any(item["unmet_preferences"] for item in soft if item["vehicle"]["id"] == 1)
    hard = search(
        client, makes=["BMW"], body_type="SUV", mandatory=["makes", "body_type"]
    ).json()["matches"]
    assert [item["vehicle"]["id"] for item in hard] == [3]


@pytest.mark.parametrize(
    "options",
    [
        {"min_year": 2023, "mandatory": ["min_year"]},
        {"max_mileage": 30000, "mandatory": ["max_mileage"]},
        {"models": ["RAV4"], "mandatory": ["models"]},
        {"fuel_type": "Electric", "mandatory": ["fuel_type"]},
        {"transmission": "Manual", "mandatory": ["transmission"]},
        {"drivetrain": "AWD", "mandatory": ["drivetrain"]},
        {"location": "Wellington", "mandatory": ["location"]},
        {"min_budget": 26000},
    ],
)
def test_hard_constraints_are_enforced(client, options):
    response = search(client, **options)
    assert response.status_code == 200
    assert response.json()["matches"] == []


def test_unknown_specs_not_invented():
    result = rank(
        car(seats=None),
        FinderRequest(
            max_budget=30000,
            priorities={
                "reliability": 3,
                "sporty": 2,
                "efficiency": 2,
                "luxury": 1,
                "running_costs": 2,
                "family": 3,
            },
        ),
    )
    assert len(result.unknown) == 6
    assert (
        result.score == result.coverage
        and result.known_fit == 100
        and result.coverage < 100
    )
    assert not any("reliable" in reason.lower() for reason in result.reasons)
    assert not rank(
        car(), FinderRequest(max_budget=30000, priorities={"family": 2})
    ).unknown


def test_scoring_consistent_normalized_and_prioritized():
    preferences = FinderRequest(
        max_budget=30000,
        makes=["BMW"],
        body_type="Sedan",
        min_year=2020,
        max_mileage=60000,
    )
    first = rank(car(make="BMW"), preferences)
    assert first == rank(car(make="BMW"), preferences)
    assert (
        first.score
        > rank(car(make="Toyota", year=2010, mileage_km=120000), preferences).score
    )
    assert 0 <= first.score <= 100 and 0 <= first.coverage <= 100
    ideal = car(seats=5)
    a = rank(ideal, FinderRequest(max_budget=30000, priorities={"family": 1}))
    b = rank(car(seats=2), FinderRequest(max_budget=30000, priorities={"family": 3}))
    assert a.score > b.score
    assert sort_key(first)[-1] == first.car.id


def test_text_interpretation_and_explicit_override(client):
    interpreter = RuleBasedPreferenceInterpreter()
    values = interpreter.interpret(
        "I have $35,000 and want a sporty European sedan with low kilometres."
    ).inferred
    assert values["max_budget"] == 35000 and "BMW" in values["makes"]
    assert values["body_type"] == "Sedan" and values["max_mileage"] == 60000
    assert values["priorities"]["sporty"] == 2
    response = search(
        client, max_budget=25000, text="I have $35,000 for a BMW sedan"
    ).json()
    assert response["preferences"]["max_budget"] == 25000
    assert response["interpreted"]["max_budget"] == 35000
    assert "text" not in response["preferences"]


@pytest.mark.parametrize(
    "sentence,expected",
    [
        (
            "Budget NZD 40000 for a Toyota RAV4 hybrid in Auckland",
            {
                "max_budget": 40000,
                "models": ["RAV4"],
                "fuel_type": "Hybrid",
                "location": "Auckland",
            },
        ),
        (
            "35k for a VW Golf automatic under 50k km from 2021",
            {
                "max_budget": 35000,
                "makes": ["Volkswagen"],
                "transmission": "Automatic",
                "max_mileage": 49999,
                "min_year": 2021,
            },
        ),
        (
            "A plug-in hybrid SUV with AWD",
            {"fuel_type": "Plug-in Hybrid", "body_type": "SUV", "drivetrain": "AWD"},
        ),
    ],
)
def test_supported_taxonomy(sentence, expected):
    values = RuleBasedPreferenceInterpreter().interpret(sentence).inferred
    for key, value in expected.items():
        assert values[key] == value


def test_ambiguous_and_negated_text_is_transparent():
    interpreter = RuleBasedPreferenceInterpreter()
    assert interpreter.interpret("Not a diesel; avoid BMW").inferred == {}
    assert interpreter.interpret("$20k to $35k").inferred.get("max_budget") is None
    assert interpreter.interpret("under 50k km").inferred.get("max_budget") is None
    assert interpreter.interpret("An automatic or manual sedan").notes


def test_text_only_budget_and_missing_budget(client):
    assert (
        client.post(URL, headers=headers(), json={"text": "I have $35,000"}).status_code
        == 200
    )
    assert (
        client.post(URL, headers=headers(), json={"text": "something nice"}).status_code
        == 422
    )


def test_demo_and_real_cover_label(client, db):
    db.get(Vehicle, 1).variant = "Hybrid — DEMO — NOT FOR SALE"
    db.add(
        VehicleImage(
            vehicle_id=1, filename="b" * 32 + ".jpg", position=0, is_cover=True
        )
    )
    db.commit()
    result = search(client).json()["matches"]
    item = next(item for item in result if item["vehicle"]["id"] == 1)
    assert (
        item["is_demo"]
        and item["photo_url"] == "/uploads/vehicles/" + "b" * 32 + ".jpg"
    )
    assert (
        next(item for item in result if item["vehicle"]["id"] == 3)["photo_url"] is None
    )
    assert all("a" * 32 not in str(item) for item in result)


def test_empty_inventory_returns_no_invented_records(client, db):
    db.execute(text("UPDATE vehicles SET listing_status='draft'"))
    db.commit()
    response = search(client).json()
    assert (
        response["matches"] == []
        and response["near_matches"] == []
        and response["empty_message"]
    )


@pytest.mark.parametrize(
    "options",
    [
        {"max_budget": -1},
        {"max_budget": 100000001},
        {"min_budget": 40000},
        {"max_mileage": -1},
        {"max_mileage": 2000001},
        {"text": "x" * 1001},
        {"priorities": {"sporty": 99}},
        {"priorities": {"made_up": 1}},
        {"body_type": "<script>"},
        {"owner_id": 1},
        {"limit": 100},
        {"makes": ["x"] * 13},
        {"mandatory": ["secret"]},
        {"mandatory": ["fuel_type"]},
    ],
)
def test_malformed_and_abusive_input_rejected(client, options):
    assert search(client, **options).status_code == 422


def test_no_external_ai_or_network_requests(client, monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("External request attempted")

    monkeypatch.setattr(socket, "create_connection", blocked)
    monkeypatch.setattr(urllib.request, "urlopen", blocked)
    assert search(client, text="BMW sedan with good reliability").status_code == 200
    monkeypatch.setenv("REVV_AI_PROVIDER", "openai")
    assert search(client).status_code == 503


def test_recommendation_rate_limit_and_csrf(client):
    for _ in range(30):
        assert search(client).status_code == 200
    assert search(client).status_code == 429
    assert (
        client.post(
            URL, headers={"Origin": "https://evil.example"}, json={"max_budget": 30000}
        ).status_code
        == 403
    )


def test_demo_suffix_does_not_break_model_matching(client, db):
    db.get(Vehicle, 1).model = "Corolla — DEMO — NOT FOR SALE"
    db.commit()
    response = search(client, models=["Corolla"], mandatory=["models"]).json()
    assert any(item["vehicle"]["id"] == 1 for item in response["matches"])
    item = next(item for item in response["matches"] if item["vehicle"]["id"] == 1)
    assert item["is_demo"] and item["vehicle"]["model"] == "Corolla"
    assert db.get(Vehicle, 1).model.endswith("NOT FOR SALE")


def test_deleted_listing_excluded(client, db):
    from sqlalchemy import delete

    db.execute(delete(Vehicle).where(Vehicle.id == 1))
    db.commit()
    assert all(item["vehicle"]["id"] != 1 for item in search(client).json()["matches"])


def test_candidate_search_is_bounded(client, monkeypatch):
    from app.routes import recommendations

    monkeypatch.setattr(recommendations, "CANDIDATE_LIMIT", 1)
    response = search(client).json()
    assert response["candidate_limit_reached"]
    assert response["candidates_considered"] == 1
    assert len(response["matches"]) == 1


@pytest.mark.parametrize(
    "options",
    [
        {"text": "hello\0world"},
        {"location": "Auckland\0", "mandatory": ["location"]},
        {"makes": ["BMW\0"]},
    ],
)
def test_control_characters_are_rejected(client, options):
    assert search(client, **options).status_code == 422


def test_common_model_punctuation_aliases(client, db):
    db.get(Vehicle, 1).model = "CX5"
    db.get(Vehicle, 1).make = "Mazda"
    db.commit()
    result = search(client, models=["CX-5"], mandatory=["models"]).json()
    assert [item["vehicle"]["id"] for item in result["matches"]] == [1]
    assert result["matches"][0]["score"] == 100
    assert RuleBasedPreferenceInterpreter().interpret("Mazda CX5").inferred[
        "models"
    ] == ["CX5"]


def test_after_year_is_exclusive_and_european_group_bounded():
    interpreted = (
        RuleBasedPreferenceInterpreter().interpret("European sedan after 2020").inferred
    )
    assert interpreted["min_year"] == 2021
    assert len(interpreted["makes"]) <= 12 and "Alfa Romeo" in interpreted["makes"]


def test_unknown_criteria_cannot_inflate_supported_score():
    result = rank(
        car(seats=None),
        FinderRequest(max_budget=30000, priorities={"reliability": 3, "family": 3}),
    )
    assert result.known_fit == 100
    assert result.score < 100
    assert result.score == result.coverage
    assert all(
        item["score_points"] == 0
        for item in result.breakdown
        if item["status"] == "unknown"
    )
    assert sum(item["score_points"] for item in result.breakdown) == pytest.approx(
        result.score, abs=0.15
    )


def test_importance_changes_ranking_not_hard_eligibility(client, db):
    db.get(Vehicle, 1).make = "BMW"
    db.get(Vehicle, 1).body_type = "SUV"
    db.get(Vehicle, 3).make = "Toyota"
    db.get(Vehicle, 3).body_type = "Sedan"
    db.commit()
    brand = search(
        client,
        makes=["BMW"],
        body_type="Sedan",
        criterion_importance={"makes": 3, "body_type": 1},
    ).json()
    body = search(
        client,
        makes=["BMW"],
        body_type="Sedan",
        criterion_importance={"makes": 1, "body_type": 3},
    ).json()
    assert brand["matches"][0]["vehicle"]["id"] == 1
    assert body["matches"][0]["vehicle"]["id"] == 3
    mandatory = search(
        client,
        makes=["BMW"],
        body_type="Sedan",
        mandatory=["body_type"],
        criterion_importance={"body_type": 1},
    ).json()
    assert all(item["vehicle"]["body_type"] == "Sedan" for item in mandatory["matches"])


def test_seating_requirements_and_unknowns(client, db):
    db.get(Vehicle, 1).seats = 7
    db.get(Vehicle, 3).seats = 5
    db.commit()
    response = search(client, min_seats=7, mandatory=["min_seats"]).json()
    assert [item["vehicle"]["id"] for item in response["matches"]] == [1]
    result = rank(
        car(seats=7),
        FinderRequest(max_budget=30000, min_seats=7, priorities={"family": 3}),
    )
    assert (
        len(
            [
                item
                for item in result.breakdown
                if item["criterion"] in {"family", "min_seats"}
            ]
        )
        == 1
    )


def test_exclusions_are_hard_and_unknown_fuel_is_excluded(client, db):
    db.get(Vehicle, 1).make = "BMW"
    db.get(Vehicle, 1).fuel_type = "Diesel"
    db.get(Vehicle, 3).fuel_type = "Hybrid"
    db.commit()
    response = search(client, exclude_fuels=["Diesel"]).json()
    assert [item["vehicle"]["id"] for item in response["matches"]] == [3]
    response = search(client, exclude_makes=["BMW"]).json()
    assert all(item["vehicle"]["make"] != "BMW" for item in response["matches"])
    assert search(client, makes=["BMW"], exclude_makes=["BMW"]).status_code == 422
    assert (
        search(client, fuel_type="Diesel", exclude_fuels=["Diesel"]).status_code == 422
    )


def test_explicit_exclusions_override_text_preferences(client):
    response = search(
        client,
        text="European diesel sedan",
        exclude_makes=["BMW"],
        exclude_fuels=["Diesel"],
    )
    assert response.status_code == 200
    assert "BMW" not in response.json()["preferences"]["makes"]
    assert response.json()["preferences"]["fuel_type"] is None


@pytest.mark.parametrize(
    "sort_by,attribute,reverse",
    [
        ("price", "price_nzd", False),
        ("newest", "year", True),
        ("mileage", "mileage_km", False),
    ],
)
def test_explicit_sorting(client, db, sort_by, attribute, reverse):
    db.get(Vehicle, 1).price_nzd = 21000
    db.get(Vehicle, 1).year = 2024
    db.get(Vehicle, 1).mileage_km = 5000
    db.get(Vehicle, 3).price_nzd = 22000
    db.get(Vehicle, 3).year = 2020
    db.get(Vehicle, 3).mileage_km = 90000
    db.commit()
    result = search(client, sort_by=sort_by).json()["matches"]
    values = [item["vehicle"][attribute] for item in result]
    assert values == sorted(values, reverse=reverse)


def test_budget_range_required_seats_and_strict_mileage(client):
    result = (
        RuleBasedPreferenceInterpreter()
        .interpret("between $20k and $35k, need 7 seats, under 50k km, 2021 or newer")
        .inferred
    )
    assert result["min_budget"] == 20000 and result["max_budget"] == 35000
    assert result["mandatory"] == ["min_seats"] and result["min_seats"] == 7
    assert result["max_mileage"] == 49999 and result["min_year"] == 2021
    response = client.post(
        URL, headers=headers(), json={"text": "I have $35k and need 7 seats"}
    )
    assert response.status_code == 200 and response.json()["matches"] == []
    options = response.json()["relaxation_options"]
    assert any(
        item["field"] == "min_seats" and item["action"] == "edit_text"
        for item in options
    )


def test_hide_demo_and_score_breakdown(client, db):
    db.get(Vehicle, 1).variant = "DEMO — NOT FOR SALE"
    db.commit()
    result = search(client, exclude_demo=True).json()
    assert all(not item["is_demo"] for item in result["matches"])
    for item in result["matches"]:
        assert item["score_breakdown"] and item["known_fit"] <= 100
        assert sum(
            part["score_points"] for part in item["score_breakdown"]
        ) == pytest.approx(item["score"], abs=0.15)
        assert "owner_id" not in item["vehicle"]


@pytest.mark.parametrize(
    "options",
    [
        {"min_seats": 0},
        {"min_seats": 101},
        {"criterion_importance": {"makes": 0}},
        {"criterion_importance": {"fake": 1}},
        {"sort_by": "SQL"},
        {"exclude_fuels": ["anything"]},
    ],
)
def test_advanced_input_validation(client, options):
    assert search(client, **options).status_code == 422
