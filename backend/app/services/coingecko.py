"""CoinGecko coin info proxy with Redis caching (Phase 2 endpoint).

The frontend's ``useCoinInfo`` calls ``/api/quotes/coin/{id}`` instead of
hitting CoinGecko directly. Cache TTL is long (30 min by default) because the
underlying market_data is mostly static and CoinGecko's free tier is rate-limited
hard.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.coingecko")

_COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/{id}"
_COINGECKO_GLOBAL_URL = "https://api.coingecko.com/api/v3/global"
_COINGECKO_TRENDING_URL = "https://api.coingecko.com/api/v3/search/trending"
_MOCK_PATH = Path(__file__).resolve().parent.parent / "mock" / "coin.json"

# Cold-cache fallback for trending so the widget always has something to render.
_TRENDING_FALLBACK: list[dict[str, Any]] = [
    {"id": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "marketCapRank": 1, "thumb": None, "priceUsd": 0.0},
    {"id": "ethereum", "symbol": "ETH", "name": "Ethereum", "marketCapRank": 2, "thumb": None, "priceUsd": 0.0},
    {"id": "solana", "symbol": "SOL", "name": "Solana", "marketCapRank": 5, "thumb": None, "priceUsd": 0.0},
]

# Last-resort numbers if CoinGecko /global is unreachable on a cold cache. Marked
# isStale so the frontend can flag demo data instead of presenting it as live.
_GLOBAL_FALLBACK: dict[str, Any] = {
    "totalMarketCapUsd": 2.4e12,
    "totalVolumeUsd": 90e9,
    "btcDominance": 54.0,
    "ethDominance": 17.0,
    "marketCapChange24h": 0.0,
    "isStale": True,
}


def _load_mock() -> dict[str, Any]:
    try:
        return json.loads(_MOCK_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("[coingecko] mock file unreadable: %s", err)
        return {}


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    """Trim CoinGecko's enormous payload to the shape the frontend actually uses.

    The frontend's ``CoinInfo`` interface (frontend/src/hooks/useCoinInfo.ts)
    pulls in: description, links, genesis_date, hashing_algorithm, market_cap_rank,
    and a handful of market_data fields. We return exactly those — no more — to
    keep the response bounded.
    """
    md = raw.get("market_data") or {}
    image = raw.get("image") or {}
    links = raw.get("links") or {}
    repos = links.get("repos_url") or {}
    github_urls = repos.get("github") or []
    return {
        "id": raw.get("id"),
        "symbol": raw.get("symbol"),
        "name": raw.get("name"),
        "description": ((raw.get("description") or {}).get("en") or "")[:1000],
        "homepage": (links.get("homepage") or [None])[0] or None,
        "github": github_urls[0] if github_urls else None,
        "twitter": (
            f"https://twitter.com/{links.get('twitter_screen_name')}"
            if links.get("twitter_screen_name") else None
        ),
        "genesis_date": raw.get("genesis_date"),
        "hashing_algorithm": raw.get("hashing_algorithm"),
        "market_cap_rank": raw.get("market_cap_rank"),
        "ath": safe_float((md.get("ath") or {}).get("usd")),
        "ath_date": ((md.get("ath_date") or {}).get("usd") or None),
        "atl": safe_float((md.get("atl") or {}).get("usd")),
        "atl_date": ((md.get("atl_date") or {}).get("usd") or None),
        "total_supply": safe_float(md.get("total_supply")),
        "circulating_supply": safe_float(md.get("circulating_supply")),
        "max_supply": safe_float(md.get("max_supply")),
        "current_price_usd": safe_float((md.get("current_price") or {}).get("usd")),
        "market_cap_usd": safe_float((md.get("market_cap") or {}).get("usd")),
        "total_volume_usd": safe_float((md.get("total_volume") or {}).get("usd")),
        "price_change_percentage_24h": safe_float(md.get("price_change_percentage_24h")),
        "image": {
            "large": image.get("large"),
            "small": image.get("small"),
        },
    }


def _mock_coin(coin_id: str) -> dict[str, Any]:
    """Return the canonical fallback. If the requested id is in the mock map,
    use it; otherwise return bitcoin so the route always has data to return.
    """
    store = _load_mock()
    raw = store.get(coin_id) or store.get("bitcoin") or {}
    logger.info("[coingecko] mock fallback for %s", coin_id)
    return _normalize(raw)


async def get_coin(coin_id: str) -> dict[str, Any]:
    """Return normalized coin info. Cache-first. Falls back to a mock fixture
    when CoinGecko is unreachable (429/quota exhausted/etc)."""
    coin_id = coin_id.strip().lower()
    key = f"cache:coin:{coin_id}"

    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    logger.info("[coingecko] fetch %s", coin_id)
    params = {
        "localization": "false",
        "tickers": "false",
        "community_data": "false",
        "developer_data": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
            resp = await client.get(_COINGECKO_URL.format(id=coin_id), params=params)
            resp.raise_for_status()
            payload: dict[str, Any] = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[coingecko] upstream failed for %s: %s", coin_id, err)
        return {**_mock_coin(coin_id), "source": "mock"}

    result = {**_normalize(payload), "source": "coingecko"}
    await set_cached(key, result, settings.coin_ttl)
    return result


async def get_trending() -> dict[str, Any]:
    """Return the top trending coins from CoinGecko ``/search/trending``.

    Shape: ``{coins: [{id, symbol, name, marketCapRank, thumb, priceUsd}], source}``.
    Cache-first (TTL = coin_ttl). Trending searches change slowly and the free tier
    is rate-limited, so the browser proxies through here instead of calling CoinGecko
    directly (CORS + quota). Falls back to a small static list on a cold cache miss.
    """
    key = "cache:trending"
    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    logger.info("[coingecko] fetch /search/trending")
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
            resp = await client.get(_COINGECKO_TRENDING_URL)
            resp.raise_for_status()
            payload: dict[str, Any] = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[coingecko] /search/trending upstream failed: %s", err)
        return {"coins": _TRENDING_FALLBACK, "source": "fallback"}

    coins: list[dict[str, Any]] = []
    for entry in (payload.get("coins") or []):
        item = entry.get("item") or {}
        if not item.get("id"):
            continue
        coins.append(
            {
                "id": item.get("id"),
                "symbol": str(item.get("symbol", "")).upper(),
                "name": item.get("name"),
                "marketCapRank": item.get("market_cap_rank"),
                "thumb": item.get("thumb") or item.get("small"),
                "priceUsd": safe_float((item.get("data") or {}).get("price")),
            }
        )

    if not coins:
        logger.warning("[coingecko] /search/trending returned no coins — using fallback")
        return {"coins": _TRENDING_FALLBACK, "source": "fallback"}

    result = {"coins": coins, "source": "coingecko"}
    await set_cached(key, result, settings.coin_ttl)
    logger.info("[coingecko] trending fetched: %d coins", len(coins))
    return result


async def get_global() -> dict[str, Any]:
    """Return global crypto market metrics from CoinGecko ``/global``.

    Shape: ``{totalMarketCapUsd, totalVolumeUsd, btcDominance, ethDominance,
    marketCapChange24h, isStale, source}``. Cache-first (TTL = coin_ttl) so the
    market_volume + global_market_cap widgets share one upstream call instead of
    each browser hitting CoinGecko directly (CORS + rate-limit friendly).
    """
    key = "cache:global"
    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    logger.info("[coingecko] fetch /global")
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
            resp = await client.get(_COINGECKO_GLOBAL_URL)
            resp.raise_for_status()
            data = (resp.json() or {}).get("data") or {}
    except httpx.HTTPError as err:
        logger.warning("[coingecko] /global upstream failed: %s", err)
        return {**_GLOBAL_FALLBACK, "source": "fallback"}

    mc_pct = data.get("market_cap_percentage") or {}
    result = {
        "totalMarketCapUsd": safe_float((data.get("total_market_cap") or {}).get("usd")),
        "totalVolumeUsd": safe_float((data.get("total_volume") or {}).get("usd")),
        "btcDominance": safe_float(mc_pct.get("btc")),
        "ethDominance": safe_float(mc_pct.get("eth")),
        "marketCapChange24h": safe_float(data.get("market_cap_change_percentage_24h_usd")),
        "isStale": False,
        "source": "coingecko",
    }
    await set_cached(key, result, settings.coin_ttl)
    return result
