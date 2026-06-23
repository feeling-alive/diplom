"""Runtime API-key resolver: admin-panel DB value first, ``.env`` fallback.

The admin panel stores encrypted keys in the ``api_keys`` table, but the services
historically read keys straight from :mod:`app.config` settings (``.env``). That
meant changing a key in the panel had no effect until a restart. This resolver
unifies both sources:

1. read the (encrypted) value from ``api_keys`` for the service, decrypt it;
2. if absent / DB unavailable / decrypt fails — silently fall back to the
   ``.env`` value from settings.

The *source* of the key (db vs env) is never surfaced in API responses or the UI.
A tiny in-memory cache avoids a DB round-trip on every external call; it is
invalidated whenever the admin saves keys (see ``admin.save_api_keys``).
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import ApiKey
from app.utils_crypto import decrypt_value

logger = logging.getLogger("backend.services.api_keys")

# Canonical DB service name -> Settings attribute holding the .env fallback.
# DB/admin uses short service names; settings uses ``*_api_key`` (note newsapi).
_SERVICE_SETTINGS_ATTR: dict[str, str] = {
    "groq": "groq_api_key",
    "finnhub": "finnhub_api_key",
    "newsapi": "news_api_key",
    "openrouter": "openrouter_api_key",
}

# Cache resolved plaintext keys per service. Empty string is a valid cached
# result ("nothing configured anywhere") and still avoids repeat DB hits.
_cache: dict[str, str] = {}


async def get_api_key(service: str) -> str:
    """Return the active key for *service*: DB value if present, else ``.env``.

    Returns an empty string when neither source has a key. Never raises — a DB
    outage or decrypt error degrades gracefully to the ``.env`` fallback.
    """
    if service in _cache:
        logger.debug("[api_keys] resolve service=%s source=cache present=%s", service, bool(_cache[service]))
        return _cache[service]

    value = await _resolve_from_db(service)
    source = "db"
    if not value:
        value = _resolve_from_env(service)
        source = "env"

    _cache[service] = value
    logger.debug("[api_keys] resolve service=%s source=%s present=%s", service, source, bool(value))
    return value


async def _resolve_from_db(service: str) -> str:
    """Read + decrypt the stored key for *service*; ``""`` if missing/unavailable."""
    try:
        async with AsyncSessionLocal() as session:
            row = (
                await session.execute(select(ApiKey).where(ApiKey.service == service))
            ).scalar_one_or_none()
        if row is None:
            return ""
        return decrypt_value(row.encrypted_value)
    except Exception as exc:  # noqa: BLE001 — DB down / decrypt fail → fall back to env
        logger.warning("[api_keys] db resolve failed for service=%s: %s", service, exc)
        return ""


def _resolve_from_env(service: str) -> str:
    """Return the ``.env``/settings fallback for *service* (``""`` if unknown)."""
    attr = _SERVICE_SETTINGS_ATTR.get(service)
    if attr is None:
        logger.warning("[api_keys] unknown service=%s — no env fallback", service)
        return ""
    return getattr(settings, attr, "") or ""


def invalidate_cache(service: str | None = None) -> None:
    """Drop cached key(s). Called after the admin saves keys so the new value
    takes effect immediately without a restart. ``None`` clears the whole cache."""
    if service is None:
        _cache.clear()
        logger.debug("[api_keys] cache cleared (all)")
    else:
        _cache.pop(service, None)
        logger.debug("[api_keys] cache invalidated service=%s", service)
