
"""
REVV Messaging Backend V1

Features:
- Authenticated buyer-to-seller conversations
- Vehicle-linked enquiries
- Secure conversation access
- Message history and pagination
- Send messages and replies
- Inbox and unread counts
- Mark messages as read
- Basic anti-spam rate limiting
"""

from urllib.parse import urlsplit

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from pydantic import (
    BaseModel,
    Field,
    field_validator,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Vehicle
from app.models.user import User
from app.routes.auth import get_current_user


# ----------------------------------------
# ROUTER
# ----------------------------------------

router = APIRouter(
    prefix="/api/v1/messages",
    tags=["Messaging"],
)


# ----------------------------------------
# SECURITY CONFIGURATION
# ----------------------------------------

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
}

MAX_MESSAGE_LENGTH = 2000
MAX_MESSAGES_PER_MINUTE = 10


# ----------------------------------------
# DATABASE
# ----------------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ----------------------------------------
# ORIGIN PROTECTION
# ----------------------------------------

def protect_write(request: Request):
    origin = request.headers.get("origin")

    if not origin:
        referer = request.headers.get("referer", "")

        if referer:
            parsed = urlsplit(referer)

            if parsed.scheme and parsed.netloc:
                origin = (
                    f"{parsed.scheme}://{parsed.netloc}"
                )

    if origin not in ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=403,
            detail="Untrusted request origin",
        )


# ----------------------------------------
# REQUEST SCHEMAS
# ----------------------------------------

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
            raise ValueError(
                "Message cannot be blank"
            )

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
            raise ValueError(
                "Message cannot be blank"
            )

        return value


# ----------------------------------------
# CONVERSATION ACCESS CONTROL
# ----------------------------------------

def require_participant(
    conversation_id: int,
    user: User,
    db: Session,
):
    """
    Only the buyer or seller belonging to
    a conversation may access it.

    Admins do not automatically receive
    access to private conversations.
    """

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

            WHERE id = :conversation_id

            AND (
                buyer_id = :user_id
                OR seller_id = :user_id
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


# ----------------------------------------
# RATE LIMITING
# ----------------------------------------

def enforce_rate_limit(
    db: Session,
    user_id: int,
):
    """
    Basic PostgreSQL-backed limit.

    A transaction-level advisory lock
    serialises message creation for each
    user across requests.
    """

    db.execute(
        text("""
            SELECT pg_advisory_xact_lock(
                :user_id
            )
        """),
        {
            "user_id": int(user_id),
        },
    )

    count = db.execute(
        text("""
            SELECT COUNT(*)

            FROM messages

            WHERE sender_id = :user_id

            AND created_at >
                NOW() - INTERVAL '1 minute'
        """),
        {
            "user_id": user_id,
        },
    ).scalar_one()

    if count >= MAX_MESSAGES_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many messages. "
                "Please try again shortly."
            ),
        )


# ----------------------------------------
# MESSAGE CREATION HELPER
# ----------------------------------------

def write_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    body: str,
):
    message = db.execute(
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
        {
            "conversation_id": conversation_id,
        },
    )

    return dict(message)


# ----------------------------------------
# START CONVERSATION
# ----------------------------------------

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

    vehicle = db.get(
        Vehicle,
        payload.vehicle_id,
    )

    if (
        vehicle is None
        or vehicle.listing_status != "active"
    ):
        raise HTTPException(
            status_code=404,
            detail="Active vehicle not found",
        )

    if vehicle.owner_id is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This vehicle cannot "
                "receive enquiries yet"
            ),
        )

    if vehicle.owner_id == user.id:
        raise HTTPException(
            status_code=400,
            detail=(
                "You cannot message "
                "your own vehicle listing"
            ),
        )

    try:
        enforce_rate_limit(
            db,
            user.id,
        )

        # Reuse an existing conversation
        # rather than creating duplicates.
        conversation_id = db.execute(
            text("""
                SELECT id

                FROM conversations

                WHERE vehicle_id = :vehicle_id
                  AND buyer_id = :buyer_id
            """),
            {
                "vehicle_id": vehicle.id,
                "buyer_id": user.id,
            },
        ).scalar_one_or_none()

        if conversation_id is None:
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

                    ON CONFLICT (
                        vehicle_id,
                        buyer_id
                    )

                    DO UPDATE SET
                        updated_at =
                            conversations.updated_at

                    RETURNING id
                """),
                {
                    "vehicle_id": vehicle.id,
                    "buyer_id": user.id,
                    "seller_id": vehicle.owner_id,
                },
            ).scalar_one()

        # Confirm participants before writing.
        require_participant(
            conversation_id,
            user,
            db,
        )

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


# ----------------------------------------
# GET INBOX
# ----------------------------------------

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

                v.make,
                v.model,
                v.year,

                (
                    SELECT COUNT(*)

                    FROM messages m

                    WHERE
                        m.conversation_id = c.id

                    AND m.sender_id <> :user_id

                    AND m.read_at IS NULL

                ) AS unread_count,

                (
                    SELECT m.body

                    FROM messages m

                    WHERE
                        m.conversation_id = c.id

                    ORDER BY m.id DESC

                    LIMIT 1

                ) AS last_message

            FROM conversations c

            JOIN vehicles v
                ON v.id = c.vehicle_id

            WHERE
                c.buyer_id = :user_id
                OR c.seller_id = :user_id

            ORDER BY
                c.updated_at DESC,
                c.id DESC

            LIMIT 100
        """),
        {
            "user_id": user.id,
        },
    ).mappings().all()

    return {
        "data": [
            dict(row)
            for row in rows
        ],
        "total_returned": len(rows),
    }


# ----------------------------------------
# GET CONVERSATION MESSAGES
# ----------------------------------------

@router.get(
    "/conversations/{conversation_id}"
)
def conversation_messages(
    conversation_id: int,
    before_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns up to 50 messages.

    Optional before_id enables pagination.

    The query is constructed with only
    fixed SQL fragments and bound values.
    """

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
        query += """
            AND id < :before_id
        """

        parameters["before_id"] = before_id

    query += """
        ORDER BY id DESC

        LIMIT 50
    """

    rows = db.execute(
        text(query),
        parameters,
    ).mappings().all()

    messages = [
        dict(row)
        for row in reversed(rows)
    ]

    return {
        "conversation": conversation,
        "messages": messages,
        "has_more": len(messages) == 50,
    }


# ----------------------------------------
# SEND MESSAGE
# ----------------------------------------

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

    require_participant(
        conversation_id,
        user,
        db,
    )

    try:
        enforce_rate_limit(
            db,
            user.id,
        )

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


# ----------------------------------------
# MARK MESSAGES AS READ
# ----------------------------------------

@router.post(
    "/conversations/{conversation_id}/read"
)
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

    try:
        result = db.execute(
            text("""
                UPDATE messages

                SET read_at = NOW()

                WHERE
                    conversation_id = :conversation_id

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
