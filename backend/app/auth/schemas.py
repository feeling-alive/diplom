"""Pydantic v2 schemas for the auth API (request/response contracts)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    """Registration payload. Username 3-20 chars, password 8+ with a digit."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def password_has_digit(cls, value: str) -> str:
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return value


class LoginRequest(BaseModel):
    """Login payload."""

    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    """Запрос ссылки сброса пароля."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Смена пароля по 6-значному коду из письма. Правила пароля — как при регистрации."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_has_digit(cls, value: str) -> str:
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return value


class UserResponse(BaseModel):
    """Public user representation. Built from the ORM User via ``from_attributes``."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    username: str
    avatar_url: str | None
    role: str
    created_at: datetime

    @field_validator("id", "role", mode="before")
    @classmethod
    def coerce_to_str(cls, value: object) -> str:
        """Coerce UUID / Enum (UserRole) values to plain strings.

        ``UserRole`` is a ``str`` Enum, so ``str(value)`` would yield
        ``'UserRole.user'`` — use ``.value`` when present to get ``'user'``.
        """
        if hasattr(value, "value"):
            return str(value.value)
        return str(value)


class TokenResponse(BaseModel):
    """Wrapper returned by register/login alongside the cookie."""

    user: UserResponse
    message: str
