"""Fernet symmetric encryption helpers for admin API key storage.

Keys are encrypted before writing to ``api_keys`` and decrypted on read.
The ``ENCRYPTION_KEY`` env-var must be a valid Fernet key (32 url-safe
base64-encoded bytes, generated with ``Fernet.generate_key()``).

If the key is absent an HTTPException 500 is raised at call time so the
rest of the application starts normally without requiring the key.
"""

from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger("backend.utils_crypto")


def _get_fernet() -> Fernet:
    """Return a Fernet instance using the configured encryption key."""
    if not settings.encryption_key:
        logger.error("[crypto] ENCRYPTION_KEY is not set")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ENCRYPTION_KEY не настроен. Задайте его в .env.",
        )
    return Fernet(settings.encryption_key.encode())


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
