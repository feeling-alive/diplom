"""Redis cache layer with graceful degradation.

If Redis is unreachable, every operation logs a warning and degrades to a no-op
(``get_cached`` returns ``None``, ``set_cached`` does nothing). The service then
keeps working by calling external APIs directly — important for a demo where
Redis might not be running.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger("backend.cache")

# Single shared connection pool. decode_responses=True -> str in/out (we json-encode).
_client: redis.Redis | None = None


def get_client() -> redis.Redis:
    """Lazily build the shared async Redis client."""
    global _client
    if _client is None:
        _client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        logger.debug("[cache] client created for %s", settings.redis_url)
    return _client


async def get_cached(key: str) -> dict[str, Any] | None:
    """Return the cached JSON object for ``key``, or ``None`` on miss/unavailable."""
    try:
        raw = await get_client().get(key)
    except (RedisError, OSError) as err:
        logger.warning("[cache] unavailable on GET %s: %s", key, err)
        return None

    if raw is None:
        logger.debug("[cache] MISS %s", key)
        return None

    try:
        data: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError as err:
        logger.warning("[cache] corrupt value for %s, ignoring: %s", key, err)
        return None

    logger.debug("[cache] HIT %s", key)
    return data


async def set_cached(key: str, data: dict[str, Any], ttl: int) -> None:
    """Store ``data`` under ``key`` with a ``ttl`` (seconds). No-op if Redis is down."""
    try:
        await get_client().set(key, json.dumps(data), ex=ttl)
        logger.debug("[cache] SET %s ttl=%d", key, ttl)
    except (RedisError, OSError) as err:
        logger.warning("[cache] unavailable on SET %s: %s", key, err)


async def close_client() -> None:
    """Close the Redis connection pool on shutdown."""
    global _client
    if _client is not None:
        try:
            await _client.aclose()
            logger.debug("[cache] client closed")
        except (RedisError, OSError) as err:
            logger.warning("[cache] error closing client: %s", err)
        finally:
            _client = None
