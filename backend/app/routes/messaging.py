
"""REVV Messaging V1: authenticated buyer/seller conversations."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Vehicle
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/api/v1/messages",
    tags=["Messaging"],
)

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def protect_write(request: Request):
    origin = request.headers.get("origin")

    if origin not in ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=403,
            detail="Untrusted request origin",
        )


class StartConversation(BaseModel):
    vehicle_id: int = Field(gt=0)
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str):
        value = value.strip()

        if not value:
            raise ValueError("Message cannot be blank")

        return value


class SendMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str):
        value = value.strip()

        if not value:
            raise ValueError("Message cannot be blank")

        return value


def require_participant(
    conversation_id: int,
    user: User,
    db: Session,
):
    row = db.execute(
        text("""
            SELECT
                id,
                vehicle_id,
                buyer_id,
                seller_id,
                created_at,
                updated_at
            FROM conversations
            WHERE id = :id
              AND (
                  buyer_id = :user_id
                  OR seller_id = :user_id
              )
        """),
        {
            "id": conversation_id,
            "user_id": user.id,
        },
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    return dict(row)


def enforce_rate_limit(db: Session, user_id: int):
    count = db.execute(
        text("""
            SELECT count(*)
            FROM messages
            WHERE sender_id = :uid
              AND created_at >
                  now() - interval '1 minute'
        """),
        {"uid": user_id},
    ).scalar_one()

    if count >= 10:
        raise HTTPException(
            status_code=429,
            detail="Too many messages. Try again shortly.",
        )


def write_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    body: str,
):
    row = db.execute(
        text("""
            INSERT INTO messages (
                conversation_id,
                sender_id,
                body
            )
            VALUES (
                :conversation_id,
                :sender_id,
                :body
            )
            RETURNING
                id,
                conversation_id,
                sender_id,
                body,
                created_at,
                read_at
        """),
        {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "body": body,
        },
    ).mappings().one()

    db.execute(
        text("""
            UPDATE conversations
            SET updated_at = now()
            WHERE id = :id
        """),
        {"id": conversation_id},
    )

    return dict(row)


@router.post(
    "/conversations",
    status_code=status.HTTP_201_CREATED,
)
def start_conversation(
    payload: StartConversation,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)

    vehicle = db.get(Vehicle, payload.vehicle_id)

    if not vehicle or vehicle.listing_status != "active":
        raise HTTPException(
            status_code=404,
            detail="Active vehicle not found",
        )

    if vehicle.owner_id is None:
        raise HTTPException(
            status_code=409,
            detail="This vehicle cannot receive enquiries yet",
        )

    if vehicle.owner_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot message your own listing",
        )

    db.execute(
        text("SELECT pg_advisory_xact_lock(:uid)"),
        {"uid": int(user.id)},
    )

    enforce_rate_limit(db, user.id)

    existing = db.execute(
        text("""
            SELECT id
            FROM conversations
            WHERE vehicle_id = :vid
              AND buyer_id = :uid
        """),
        {
            "vid": vehicle.id,
            "uid": user.id,
        },
    ).scalar_one_or_none()

    if existing is None:
        existing = db.execute(
            text("""
                INSERT INTO conversations (
                    vehicle_id,
                    buyer_id,
                    seller_id
                )
                VALUES (
                    :vid,
                    :uid,
                    :seller
                )
                RETURNING id
            """),
            {
                "vid": vehicle.id,
                "uid": user.id,
                "seller": vehicle.owner_id,
            },
        ).scalar_one()

    message = write_message(
        db,
        existing,
        user.id,
        payload.message,
    )

    db.commit()

    return {
        "conversation_id": existing,
        "message": message,
    }


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        text("""
            SELECT
                c.id,
                c.vehicle_id,
                c.buyer_id,
                c.seller_id,
                c.updated_at,
                v.make,
                v.model,
                v.year,

                (
                    SELECT count(*)
                    FROM messages m
                    WHERE m.conversation_id = c.id
                      AND m.sender_id <> :uid
                      AND m.read_at IS NULL
                ) AS unread_count,

                (
                    SELECT m.body
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message

            FROM conversations c
            JOIN vehicles v ON v.id = c.vehicle_id

            WHERE c.buyer_id = :uid
               OR c.seller_id = :uid

            ORDER BY c.updated_at DESC
            LIMIT 100
        """),
        {"uid": user.id},
    ).mappings().all()

    return {
        "data": [dict(row) for row in rows],
    }


@router.get("/conversations/{conversation_id}")
def conversation_messages(
    conversation_id: int,
    before_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conversation = require_participant(
        conversation_id,
        user,
        db,
    )

    rows = db.execute(
        text("""
            SELECT
                id,
                conversation_id,
                sender_id,
                body,
                created_at,
                read_at
            FROM messages
            WHERE conversation_id = :cid
              AND (
                  :before IS NULL
                  OR id < :before
              )
            ORDER BY id DESC
            LIMIT 50
        """),
        {
            "cid": conversation_id,
            "before": before_id,
        },
    ).mappings().all()

    return {
        "conversation": conversation,
        "messages": list(
            reversed([dict(row) for row in rows])
        ),
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=201,
)
def send_message(
    conversation_id: int,
    payload: SendMessage,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)

    require_participant(
        conversation_id,
        user,
        db,
    )

    db.execute(
        text("SELECT pg_advisory_xact_lock(:uid)"),
        {"uid": int(user.id)},
    )

    enforce_rate_limit(db, user.id)

    message = write_message(
        db,
        conversation_id,
        user.id,
        payload.message,
    )

    db.commit()

    return message


@router.post("/conversations/{conversation_id}/read")
def mark_read(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)

    require_participant(
        conversation_id,
        user,
        db,
    )

    db.execute(
        text("""
            UPDATE messages
            SET read_at = now()
            WHERE conversation_id = :cid
              AND sender_id <> :uid
              AND read_at IS NULL
        """),
        {
            "cid": conversation_id,
            "uid": user.id,
        },
    )

    db.commit()

    return {"ok": True}
