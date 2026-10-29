
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Response,
    status,
)
from pydantic import BaseModel, EmailStr, Field, field_validator
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.user_session import UserSession


router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

password_hasher = PasswordHash.recommended()

COOKIE_NAME = "revv_session"
SESSION_DAYS = 7
COOKIE_SECURE = os.getenv("REVV_COOKIE_SECURE", "false").lower() == "true"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters")

        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(c.isalpha() for c in value):
            raise ValueError("Password must contain a letter")

        if not any(c.isdigit() for c in value):
            raise ValueError("Password must contain a number")

        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


def get_current_user(
    revv_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not revv_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_token(revv_session)
        )
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    now = datetime.now(timezone.utc)

    if session.expires_at < now:
        db.delete(session)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    user = db.get(User, session.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found",
        )

    return user


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    existing = db.scalar(
        select(User).where(User.email == email)
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    user = User(
        full_name=payload.full_name,
        email=email,
        password_hash=password_hasher.hash(payload.password),
        role="user",
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login_user(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user or not password_hasher.verify(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(
        days=SESSION_DAYS
    )

    session = UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=expires,
    )

    db.add(session)
    db.commit()

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )

    return {
        "message": "Logged in successfully",
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
def get_my_account(
    user: User = Depends(get_current_user),
):
    return user


@router.post("/logout")
def logout_user(
    response: Response,
    revv_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if revv_session:
        session = db.scalar(
            select(UserSession).where(
                UserSession.token_hash == hash_token(
                    revv_session
                )
            )
        )

        if session:
            db.delete(session)
            db.commit()

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )

    return {"message": "Logged out successfully"}
