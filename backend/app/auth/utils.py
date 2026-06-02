"""Password hashing (bcrypt) and JWT helpers (python-jose).

Uses the ``bcrypt`` library directly rather than passlib: passlib 1.7.4 is
unmaintained and crashes against bcrypt >= 4.1/5.x (the version installed here).
Secrets never reach the logs: only the token subject is logged, never the token
itself or any password/hash.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger("backend.auth.utils")

# bcrypt only hashes the first 72 bytes; longer inputs raise in bcrypt 5.x, so we
# truncate explicitly (standard practice) to keep behaviour deterministic.
_BCRYPT_MAX_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Return a bcrypt hash of ``password`` (utf-8, decoded to str)."""
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if ``plain`` matches the bcrypt ``hashed`` value."""
    if not hashed:
        # Google-only account (password_hash=None) — no local password to match.
        return False
    try:
        return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))
    except ValueError:
        logger.warning("[auth] verify_password called with invalid hash")
        return False


def create_access_token(data: dict) -> str:
    """Encode ``data`` into a signed JWT with an ``exp`` claim from settings."""
    to_encode = dict(data)
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"] = expire
    token = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    logger.debug("[auth] token issued for sub=%s (exp=%s)", data.get("sub"), expire.isoformat())
    return token


def decode_access_token(token: str) -> dict | None:
    """Decode/verify a JWT. Return the payload, or None if invalid/expired."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as err:
        logger.warning("[auth] token decode failed: %s", err)
        return None
