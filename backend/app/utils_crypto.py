"""Fernet symmetric encryption helpers for admin API key storage.

Keys are encrypted before writing to ``api_keys`` and decrypted on read.
The ``ENCRYPTION_KEY`` env-var must be a valid Fernet key (32 url-safe
base64-encoded bytes, generated with ``Fernet.generate_key()``).

If the key is absent an HTTPException 500 is raised at call time so the
rest of the application starts normally without requiring the key.
"""

from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger("backend.utils_crypto")


def _derive_key_from_secret() -> bytes:
    """Derive a deterministic Fernet key from ``SECRET_KEY``.

    Fernet needs a 32-byte url-safe base64 key; SHA-256 of the secret gives exactly
    32 bytes which we base64-encode. Stable across restarts while ``SECRET_KEY`` is
    unchanged, so admin API keys persist without a separate ``ENCRYPTION_KEY``.
    """
    digest = hashlib.sha256(settings.secret_key.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    """Return a Fernet instance.

    Prefers the explicit ``ENCRYPTION_KEY``; if it is absent, falls back to a key
    derived from ``SECRET_KEY`` so the admin API-key store works out of the box.
    Previously a missing ``ENCRYPTION_KEY`` raised 500, which meant saving keys in
    the admin panel silently failed (the value never persisted) while ``test`` still
    passed via the ``.env`` fallback — exactly the reported bug (C1).
    """
    if settings.encryption_key:
        return Fernet(settings.encryption_key.encode())

    if not settings.secret_key:
        logger.error("[crypto] neither ENCRYPTION_KEY nor SECRET_KEY is set")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ни ENCRYPTION_KEY, ни SECRET_KEY не настроены. Задайте ENCRYPTION_KEY в .env.",
        )

    logger.warning(
        "[crypto] ENCRYPTION_KEY не задан — использую ключ, производный от SECRET_KEY. "
        "Для продакшена задайте отдельный ENCRYPTION_KEY (Fernet.generate_key())."
    )
    return Fernet(_derive_key_from_secret())


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string; return the Fernet token as a str."""
    token = _get_fernet().encrypt(plaintext.encode()).decode()
    logger.debug("[crypto] encrypt_value → token length=%d", len(token))
    return token


def decrypt_value(token: str) -> str:
    """Decrypt a Fernet token; raises HTTPException 500 on invalid token."""
    try:
        plaintext = _get_fernet().decrypt(token.encode()).decode()
        logger.debug("[crypto] decrypt_value ok")
        return plaintext
    except InvalidToken:
        logger.error("[crypto] InvalidToken — key rotation or corrupt data")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось расшифровать ключ. Проверьте ENCRYPTION_KEY.",
        )


def mask_value(plaintext: str) -> str:
    """Return plaintext with all but the last 4 chars replaced by '*'."""
    if len(plaintext) <= 4:
        return plaintext
    return "*" * (len(plaintext) - 4) + plaintext[-4:]
