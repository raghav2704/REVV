
"""
REVV Messaging V2

- Buyer and seller account names
- Secure vehicle-linked conversations
- Persistent message history
- Inbox and unread counts
- Message sending and read receipts
- Basic rate limiting
"""

from urllib.parse import urlsplit

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
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

MAX_MESSAGE_LENGTH = 2000
MAX_MESSAGES_PER_MINUTE = 10


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


class StartConversation(BaseModel):
    vehicle_id: int = Field(gt=0)
    message: str = Field(
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank")
        return value


class SendMessage(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str):
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
                c.id,
                c.vehicle_id,
                c.buyer_id,
                c.seller_id,
                c.created_at,
                c.updated_at,
                buyer.full_name AS buyer_name,
                seller.full_name AS seller_name
            FROM conversations c
            JOIN users buyer
                ON buyer.id = c.buyer_id
            JOIN users seller
                ON seller.id = c.seller_id
            WHERE c.id = :conversation_id
              AND (
                  c.buyer_id = :user_id
                  OR c.seller_id = :user_id
              )
        """),
        {
            "conversation_id": conversation_id,
            "user_id": user.id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    return dict(row)


def enforce_rate_limit(db: Session, user_id: int):
    # Serialise sends for a user so concurrent requests
    # cannot easily bypass this database-backed limit.
    db.execute(
        text("SELECT pg_advisory_xact_lock(:user_id)"),
        {"user_id": int(user_id)},
    )

    count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM messages
            WHERE sender_id = :user_id
              AND created_at > NOW() - INTERVAL '1 minute'
        """),
        {"user_id": user_id},
    ).scalar_one()

    if count >= MAX_MESSAGES_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="Too many messages. Please try again shortly.",
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
            SET updated_at = NOW()
            WHERE id = :conversation_id
        """),
        {"conversation_id": conversation_id},
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

    if vehicle is None or vehicle.listing_status != "active":
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
            detail="You cannot message your own listing",
        )

    try:
        enforce_rate_limit(db, user.id)

        conversation_id = db.execute(
            text("""
                INSERT INTO conversations (
                    vehicle_id,
                    buyer_id,
                    seller_id
                )
                VALUES (
                    :vehicle_id,
                    :buyer_id,
                    :seller_id
                )
                ON CONFLICT (vehicle_id, buyer_id)
                DO UPDATE SET
                    updated_at = conversations.updated_at
                RETURNING id
            """),
            {
                "vehicle_id": vehicle.id,
                "buyer_id": user.id,
                "seller_id": vehicle.owner_id,
            },
        ).scalar_one()

        require_participant(conversation_id, user, db)

        message = write_message(
            db,
            conversation_id,
            user.id,
            payload.message,
        )

        db.commit()

        return {
            "conversation_id": conversation_id,
            "message": message,
        }
    except Exception:
        db.rollback()
        raise


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
                c.created_at,
                c.updated_at,

                buyer.full_name AS buyer_name,
                seller.full_name AS seller_name,

                v.make,
                v.model,
                v.year,

                (
                    SELECT COUNT(*)
                    FROM messages m
                    WHERE m.conversation_id = c.id
                      AND m.sender_id <> :user_id
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

            JOIN vehicles v
                ON v.id = c.vehicle_id

            JOIN users buyer
                ON buyer.id = c.buyer_id

            JOIN users seller
                ON seller.id = c.seller_id

            WHERE c.buyer_id = :user_id
               OR c.seller_id = :user_id

            ORDER BY c.updated_at DESC, c.id DESC
            LIMIT 100
        """),
        {"user_id": user.id},
    ).mappings().all()

    return {
        "data": [dict(row) for row in rows],
        "total_returned": len(rows),
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

    if before_id is not None and before_id <= 0:
        raise HTTPException(
            status_code=422,
            detail="Invalid message cursor",
        )

    query = """
        SELECT
            id,
            conversation_id,
            sender_id,
            body,
            created_at,
            read_at
        FROM messages
        WHERE conversation_id = :conversation_id
    """

    parameters = {
        "conversation_id": conversation_id,
    }

    if before_id is not None:
        query += " AND id < :before_id"
        parameters["before_id"] = before_id

    query += """
        ORDER BY id DESC
        LIMIT 51
    """

    rows = db.execute(
        text(query),
        parameters,
    ).mappings().all()

    has_more = len(rows) > 50
    messages = [dict(row) for row in reversed(rows[:50])]

    return {
        "conversation": conversation,
        "messages": messages,
        "has_more": has_more,
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: int,
    payload: SendMessage,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)
    require_participant(conversation_id, user, db)

    try:
        enforce_rate_limit(db, user.id)

        message = write_message(
            db,
            conversation_id,
            user.id,
            payload.message,
        )

        db.commit()
        return message
    except Exception:
        db.rollback()
        raise


@router.post("/conversations/{conversation_id}/read")
def mark_read(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    protect_write(request)
    require_participant(conversation_id, user, db)

    try:
        result = db.execute(
            text("""
                UPDATE messages
                SET read_at = NOW()
                WHERE conversation_id = :conversation_id
                  AND sender_id <> :user_id
                  AND read_at IS NULL
            """),
            {
                "conversation_id": conversation_id,
                "user_id": user.id,
            },
        )

        updated_count = result.rowcount
        db.commit()

        return {
            "ok": True,
            "marked_read": updated_count,
        }
    except Exception:
        db.rollback()
        raise
