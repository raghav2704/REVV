
"""
REVV Deals API

Watchlists
Signed-in viewer statistics
Seller dashboard data
Structured buyer/seller negotiations
Offer history
Message and offer notification counts

Offers represent an agreement in principle only.
No payment or vehicle ownership transfer occurs here.
"""

from datetime import datetime
from urllib.parse import urlsplit

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Vehicle
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/api/v1/deals",
    tags=["REVV Deals"],
)

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
}

TERMINAL_STATUSES = {
    "accepted",
    "declined",
    "withdrawn",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def protect_write(request: Request):
    origin = request.headers.get("origin")

    if not origin:
        referer = request.headers.get("referer", "")
        if referer:
            parsed = urlsplit(referer)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"

    if origin not in ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=403,
            detail="Untrusted request origin",
        )


def public_vehicle(db: Session, vehicle_id: int):
    vehicle = db.get(Vehicle, vehicle_id)

    if vehicle is None or vehicle.listing_status != "active":
        raise HTTPException(
            status_code=404,
            detail="Active vehicle not found",
        )

    return vehicle


def normalize_conditions(value: str):
    value = value.strip()

    if len(value) > 1000:
        raise HTTPException(
            status_code=422,
            detail="Offer conditions are too long",
        )

    return value


class NewOffer(BaseModel):
    amount_nzd: int = Field(gt=0, le=100000000)
    conditions: str = Field(default="", max_length=1000)


class OfferResponse(BaseModel):
    action: str
    amount_nzd: int | None = Field(
        default=None,
        gt=0,
        le=100000000,
    )
    conditions: str | None = Field(
        default=None,
        max_length=1000,
    )


def offer_row(
    db: Session,
    offer_id: int,
    user_id: int,
    lock: bool = False,
):
    query = """
        SELECT
            o.id,
            o.vehicle_id,
            o.buyer_id,
            o.seller_id,
            o.current_amount_nzd,
            o.conditions,
            o.status,
            o.created_at,
            o.updated_at,
            v.year,
            v.make,
            v.model,
            buyer.full_name AS buyer_name,
            seller.full_name AS seller_name
        FROM vehicle_offers o
        JOIN vehicles v ON v.id = o.vehicle_id
        JOIN users buyer ON buyer.id = o.buyer_id
        JOIN users seller ON seller.id = o.seller_id
        WHERE o.id = :offer_id
          AND (
              o.buyer_id = :user_id
              OR o.seller_id = :user_id
          )
    """

    # Lock the offer row during negotiation decisions,
    # preventing two concurrent decisions on one offer.
    if lock:
        query += " FOR UPDATE OF o"

    row = db.execute(
        text(query),
        {
            "offer_id": offer_id,
            "user_id": user_id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Offer not found",
        )

    return dict(row)


def add_offer_event(
    db: Session,
    offer_id: int,
    actor_id: int,
    action: str,
    amount: int,
    conditions: str,
):
    db.execute(
        text("""
            INSERT INTO vehicle_offer_events (
                offer_id,
                actor_id,
                action,
                amount_nzd,
                conditions
            )
            VALUES (
                :offer_id,
                :actor_id,
                :action,
                :amount,
                :conditions
            )
        """),
        {
            "offer_id": offer_id,
            "actor_id": actor_id,
            "action": action,
            "amount": amount,
            "conditions": conditions,
        },
    )


# -----------------------------------------
# WATCHLIST
# -----------------------------------------

@router.get("/watchlist")
def get_watchlist(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        text("""
            SELECT
                v.id,
                v.year,
                v.make,
                v.model,
                v.price_nzd,
                v.mileage_km,
                v.location,
                w.created_at AS saved_at
            FROM vehicle_watchlists w
            JOIN vehicles v ON v.id = w.vehicle_id
            WHERE w.user_id = :user_id
              AND v.listing_status = 'active'
            ORDER BY w.created_at DESC
            LIMIT 200
        """),
        {"user_id": user.id},
    ).mappings().all()

    return {"data": [dict(row) for row in rows]}


@router.get("/vehicles/{vehicle_id}/watchlist")
def watchlist_status(
    vehicle_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    watched = db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM vehicle_watchlists
                WHERE user_id = :user_id
                  AND vehicle_id = :vehicle_id
            )
        """),
        {
            "user_id": user.id,
            "vehicle_id": vehicle_id,
        },
    ).scalar_one()

    return {"watched": bool(watched)}


@router.post("/vehicles/{vehicle_id}/watchlist")
def add_to_watchlist(
    vehicle_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)
    vehicle = public_vehicle(db, vehicle_id)

    if vehicle.owner_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot watch your own listing",
        )

    db.execute(
        text("""
            INSERT INTO vehicle_watchlists (
                user_id,
                vehicle_id
            )
            VALUES (:user_id, :vehicle_id)
            ON CONFLICT DO NOTHING
        """),
        {
            "user_id": user.id,
            "vehicle_id": vehicle_id,
        },
    )

    db.commit()
    return {"watched": True}


@router.delete("/vehicles/{vehicle_id}/watchlist")
def remove_from_watchlist(
    vehicle_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)

    db.execute(
        text("""
            DELETE FROM vehicle_watchlists
            WHERE user_id = :user_id
              AND vehicle_id = :vehicle_id
        """),
        {
            "user_id": user.id,
            "vehicle_id": vehicle_id,
        },
    )

    db.commit()
    return {"watched": False}


# -----------------------------------------
# LISTING VIEWS
# -----------------------------------------

@router.post("/vehicles/{vehicle_id}/view")
def register_view(
    vehicle_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)
    vehicle = public_vehicle(db, vehicle_id)

    # Seller views must never inflate their metrics.
    if vehicle.owner_id == user.id:
        return {"ok": True, "counted": False}

    result = db.execute(
        text("""
            INSERT INTO vehicle_view_events (
                vehicle_id,
                viewer_id,
                viewed_on
            )
            VALUES (
                :vehicle_id,
                :viewer_id,
                (NOW() AT TIME ZONE 'Pacific/Auckland')::date
            )
            ON CONFLICT DO NOTHING
        """),
        {
            "vehicle_id": vehicle_id,
            "viewer_id": user.id,
        },
    )

    db.commit()

    return {
        "ok": True,
        "counted": result.rowcount > 0,
    }


# -----------------------------------------
# SELLER DASHBOARD
# -----------------------------------------

@router.get("/seller/overview")
def seller_overview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        text("""
            SELECT
                v.id AS vehicle_id,
                v.year,
                v.make,
                v.model,
                v.price_nzd,
                v.listing_status,

                (
                    SELECT COUNT(*)
                    FROM vehicle_view_events e
                    WHERE e.vehicle_id = v.id
                ) AS views,

                (
                    SELECT COUNT(*)
                    FROM vehicle_watchlists w
                    WHERE w.vehicle_id = v.id
                ) AS watchers,

                (
                    SELECT COUNT(*)
                    FROM vehicle_offers o
                    WHERE o.vehicle_id = v.id
                ) AS total_offers,

                (
                    SELECT COUNT(*)
                    FROM vehicle_offers o
                    WHERE o.vehicle_id = v.id
                      AND o.status = 'pending_seller'
                ) AS offers_awaiting_you,

                (
                    SELECT COUNT(*)
                    FROM conversations c
                    JOIN messages m
                        ON m.conversation_id = c.id
                    WHERE c.vehicle_id = v.id
                      AND c.seller_id = :user_id
                      AND m.sender_id <> :user_id
                      AND m.read_at IS NULL
                ) AS unread_messages

            FROM vehicles v
            WHERE v.owner_id = :user_id
            ORDER BY v.id DESC
            LIMIT 200
        """),
        {"user_id": user.id},
    ).mappings().all()

    listings = [dict(row) for row in rows]

    return {
        "listings": listings,
        "totals": {
            "views": sum(int(x["views"]) for x in listings),
            "watchers": sum(int(x["watchers"]) for x in listings),
            "offers": sum(int(x["total_offers"]) for x in listings),
            "offers_awaiting_you": sum(
                int(x["offers_awaiting_you"])
                for x in listings
            ),
            "unread_messages": sum(
                int(x["unread_messages"])
                for x in listings
            ),
        },
    }


# -----------------------------------------
# CREATE A FORMAL OFFER
# -----------------------------------------

@router.post(
    "/vehicles/{vehicle_id}/offers",
    status_code=status.HTTP_201_CREATED,
)
def create_offer(
    vehicle_id: int,
    payload: NewOffer,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)
    vehicle = public_vehicle(db, vehicle_id)

    if vehicle.owner_id is None:
        raise HTTPException(
            status_code=409,
            detail="This listing has no assigned seller",
        )

    if vehicle.owner_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot offer on your own vehicle",
        )

    conditions = normalize_conditions(payload.conditions)

    try:
        # Serialize this buyer's offer creations.
        db.execute(
            text("SELECT pg_advisory_xact_lock(:user_id)"),
            {"user_id": int(user.id)},
        )

        recent = db.execute(
            text("""
                SELECT COUNT(*)
                FROM vehicle_offer_events
                WHERE actor_id = :user_id
                  AND created_at > NOW() - INTERVAL '1 minute'
            """),
            {"user_id": user.id},
        ).scalar_one()

        if recent >= 5:
            raise HTTPException(
                status_code=429,
                detail="Too many offer actions. Try again shortly.",
            )

        existing = db.execute(
            text("""
                SELECT id
                FROM vehicle_offers
                WHERE vehicle_id = :vehicle_id
                  AND buyer_id = :buyer_id
            """),
            {
                "vehicle_id": vehicle_id,
                "buyer_id": user.id,
            },
        ).scalar_one_or_none()

        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "You already have a negotiation for "
                    "this vehicle. Open your existing offer."
                ),
            )

        offer_id = db.execute(
            text("""
                INSERT INTO vehicle_offers (
                    vehicle_id,
                    buyer_id,
                    seller_id,
                    current_amount_nzd,
                    conditions,
                    status
                )
                VALUES (
                    :vehicle_id,
                    :buyer_id,
                    :seller_id,
                    :amount,
                    :conditions,
                    'pending_seller'
                )
                RETURNING id
            """),
            {
                "vehicle_id": vehicle_id,
                "buyer_id": user.id,
                "seller_id": vehicle.owner_id,
                "amount": payload.amount_nzd,
                "conditions": conditions,
            },
        ).scalar_one()

        add_offer_event(
            db,
            offer_id,
            user.id,
            "offer",
            payload.amount_nzd,
            conditions,
        )

        db.commit()

        return {
            "offer_id": offer_id,
            "status": "pending_seller",
        }
    except Exception:
        db.rollback()
        raise


# -----------------------------------------
# OFFERS INBOX
# -----------------------------------------

@router.get("/offers")
def list_offers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        text("""
            SELECT
                o.id,
                o.vehicle_id,
                o.buyer_id,
                o.seller_id,
                o.current_amount_nzd,
                o.conditions,
                o.status,
                o.created_at,
                o.updated_at,
                v.year,
                v.make,
                v.model,
                buyer.full_name AS buyer_name,
                seller.full_name AS seller_name
            FROM vehicle_offers o
            JOIN vehicles v ON v.id = o.vehicle_id
            JOIN users buyer ON buyer.id = o.buyer_id
            JOIN users seller ON seller.id = o.seller_id
            WHERE o.buyer_id = :user_id
               OR o.seller_id = :user_id
            ORDER BY o.updated_at DESC, o.id DESC
            LIMIT 100
        """),
        {"user_id": user.id},
    ).mappings().all()

    return {"data": [dict(row) for row in rows]}


@router.get("/offers/{offer_id}")
def get_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    offer = offer_row(db, offer_id, user.id)

    history = db.execute(
        text("""
            SELECT
                e.id,
                e.actor_id,
                e.action,
                e.amount_nzd,
                e.conditions,
                e.created_at,
                u.full_name AS actor_name
            FROM vehicle_offer_events e
            JOIN users u ON u.id = e.actor_id
            WHERE e.offer_id = :offer_id
            ORDER BY e.id ASC
        """),
        {"offer_id": offer_id},
    ).mappings().all()

    return {
        "offer": offer,
        "history": [dict(row) for row in history],
    }


# -----------------------------------------
# NEGOTIATE AN OFFER
# -----------------------------------------

@router.post("/offers/{offer_id}/respond")
def respond_to_offer(
    offer_id: int,
    payload: OfferResponse,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)

    if payload.action not in {
        "accept",
        "decline",
        "counter",
        "withdraw",
    }:
        raise HTTPException(
            status_code=422,
            detail="Invalid negotiation action",
        )

    try:
        offer = offer_row(
            db,
            offer_id,
            user.id,
            lock=True,
        )

        if offer["status"] in TERMINAL_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="This negotiation is already closed",
            )

        is_buyer = offer["buyer_id"] == user.id
        is_seller = offer["seller_id"] == user.id

        # Only the recipient of the latest proposal
        # may accept, reject or counter it.
        expected_actor = (
            offer["seller_id"]
            if offer["status"] == "pending_seller"
            else offer["buyer_id"]
        )

        if payload.action == "withdraw":
            if not is_buyer or offer["status"] != "pending_seller":
                raise HTTPException(
                    status_code=403,
                    detail="Only a buyer awaiting a seller response can withdraw",
                )
        elif user.id != expected_actor:
            raise HTTPException(
                status_code=403,
                detail="It is not your turn to respond",
            )

        amount = offer["current_amount_nzd"]
        conditions = offer["conditions"]

        if payload.action == "counter":
            if payload.amount_nzd is None:
                raise HTTPException(
                    status_code=422,
                    detail="A counteroffer requires a price",
                )

            amount = payload.amount_nzd

            if payload.conditions is not None:
                conditions = normalize_conditions(
                    payload.conditions
                )

            # A real counter must change at least
            # the price or the conditions.
            if (
                amount == offer["current_amount_nzd"]
                and conditions == offer["conditions"]
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Counteroffer must change the terms",
                )

            next_status = (
                "pending_seller"
                if is_buyer
                else "pending_buyer"
            )

        elif payload.action == "accept":
            next_status = "accepted"

        elif payload.action == "decline":
            next_status = "declined"

        else:
            next_status = "withdrawn"

        # Record each action without overwriting history.
        add_offer_event(
            db,
            offer_id,
            user.id,
            payload.action,
            amount,
            conditions,
        )

        db.execute(
            text("""
                UPDATE vehicle_offers
                SET
                    current_amount_nzd = :amount,
                    conditions = :conditions,
                    status = :status,
                    updated_at = NOW()
                WHERE id = :offer_id
            """),
            {
                "amount": amount,
                "conditions": conditions,
                "status": next_status,
                "offer_id": offer_id,
            },
        )

        db.commit()

        return {
            "offer_id": offer_id,
            "status": next_status,
            "amount_nzd": amount,
            "conditions": conditions,
            "agreement_type": (
                "in_principle"
                if next_status == "accepted"
                else None
            ),
        }

    except Exception:
        db.rollback()
        raise


# -----------------------------------------
# NOTIFICATION COUNTS
# -----------------------------------------

@router.get("/notifications/summary")
def notification_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    unread_messages = db.execute(
        text("""
            SELECT COUNT(*)
            FROM messages m
            JOIN conversations c
                ON c.id = m.conversation_id
            WHERE (
                c.buyer_id = :user_id
                OR c.seller_id = :user_id
            )
              AND m.sender_id <> :user_id
              AND m.read_at IS NULL
        """),
        {"user_id": user.id},
    ).scalar_one()

    actionable_offers = db.execute(
        text("""
            SELECT COUNT(*)
            FROM vehicle_offers
            WHERE (
                seller_id = :user_id
                AND status = 'pending_seller'
            )
            OR (
                buyer_id = :user_id
                AND status = 'pending_buyer'
            )
        """),
        {"user_id": user.id},
    ).scalar_one()

    return {
        "unread_messages": int(unread_messages),
        "offers_awaiting_response": int(actionable_offers),
        "total": int(unread_messages) + int(actionable_offers),
    }
