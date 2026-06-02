"""Smoke tests for the new Settings fields and DSN masking."""

from __future__ import annotations

from app.config import _mask_dsn_password, settings


def test_jwt_defaults() -> None:
    assert settings.algorithm == "HS256"
    # 7 days in minutes.
    assert settings.access_token_expire_minutes == 60 * 24 * 7
    assert settings.uploads_dir == "uploads"


def test_database_url_is_asyncpg() -> None:
    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_mask_dsn_hides_password() -> None:
    masked = _mask_dsn_password("postgresql+asyncpg://u:secret@host:5432/db")
    assert "secret" not in masked
    assert "***" in masked
    assert "host:5432/db" in masked


def test_mask_dsn_without_password_is_unchanged() -> None:
    dsn = "postgresql+asyncpg://host:5432/db"
    assert _mask_dsn_password(dsn) == dsn
