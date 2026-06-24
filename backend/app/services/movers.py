"""Top movers across asset classes (round 3, C1).

Aggregates today's % change from the SAME live quote sources the market overview
uses — OKX (crypto) and Finnhub (stocks) — and returns the biggest gainers or
losers, sorted by percent change. Powers both the ``/api/quotes/top-movers``
endpoint and the chat assistant's ``get_top_movers`` tool.

Forex is intentionally excluded: Frankfurter exposes only the latest rate (no
reliable free intraday % change), and a fabricated forex %change was removed in a
previous round. So movers reflect crypto + stocks, which carry genuine daily %.

Every step degrades gracefully: an upstream failure for one class just drops that
class from the ranking instead of failing the whole request.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from app.services import finnhub, okx
from app.services.cache import get_cached, set_cached
from app.config import settings

logger = logging.getLogger("backend.movers")

Direction = Literal["up", "down"]

# Universe mirrors frontend/src/data/prices.json (crypto + stock entries). Kept in
# sync manually — these are the assets the app actually has pages/data for.
_CRYPTO_PAIRS: tuple[str, ...] = (
    "BTC-USDT", "ETH-USDT", "SOL-USDT", "XRP-USDT", "ADA-USDT", "DOGE-USDT",
    "DOT-USDT", "AVAX-USDT", "LINK-USDT", "POL-USDT", "UNI-USDT", "ATOM-USDT",
    "LTC-USDT", "APT-USDT", "ARB-USDT", "NEAR-USDT", "STX-USDT", "S-USDT",
    "INJ-USDT", "AAVE-USDT",
)
_STOCK_SYMBOLS: tuple[str, ...] = (
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V",
    "JNJ", "XOM", "PG", "KO", "DIS", "NFLX", "AMD", "INTC",
)

_TTL = 60  # seconds — movers are intraday; a short cache tames request storms.


async def _crypto_movers() -> list[dict[str, Any]]:
    """Crypto candidates from one batched OKX tickers call. Empty on failure."""
    try:
        data = await okx.get_tickers(list(_CRYPTO_PAIRS))
    except Exception as exc:  # noqa: BLE001 — graceful: drop the whole class
        logger.warning("[movers] crypto source failed: %s", exc)
        return []
    out: list[dict[str, Any]] = []
    for t in data.get("tickers") or []:
        symbol = str(t.get("symbol", "")).upper()
        if not symbol:
            continue
        out.append({
            "symbol": symbol,
            "name": symbol.split("-")[0],
            "type": "crypto",
            "price": float(t.get("price", 0.0)),
            "changePercent": float(t.get("changePercent", 0.0)),
        })
    return out


async def _stock_movers() -> list[dict[str, Any]]:
    """Stock candidates via per-symbol Finnhub quotes (failures isolated)."""
    async def one(sym: str) -> dict[str, Any] | None:
        try:
            q = await finnhub.get_quote(sym)
        except Exception as exc:  # noqa: BLE001 — isolate one symbol
            logger.warning("[movers] stock %s failed: %s", sym, exc)
            return None
        price = float(q.get("price", 0.0))
        # Finnhub returns zeros when the symbol is unknown / quota hit — skip those
        # so they do not pollute the ranking as fake 0% movers.
        if price <= 0:
            return None
        return {
            "symbol": sym,
            "name": sym,
            "type": "stock",
            "price": price,
            "changePercent": float(q.get("changePercent", 0.0)),
        }

    results = await asyncio.gather(*(one(s) for s in _STOCK_SYMBOLS))
    return [r for r in results if r is not None]


async def get_top_movers(direction: Direction = "up", limit: int = 5) -> list[dict[str, Any]]:
    """Return the top *limit* gainers (``up``) or losers (``down``) across crypto
    and stocks, each as ``{symbol, name, type, price, changePercent}``."""
    direction = "down" if str(direction).lower() == "down" else "up"
    limit = max(1, min(int(limit), 20))

    key = f"cache:movers:{direction}:{limit}"
    cached = await get_cached(key)
    if cached is not None:
        logger.debug("[movers] cache hit %s", key)
        return cached.get("items", [])

    crypto, stocks = await asyncio.gather(_crypto_movers(), _stock_movers())
    candidates = crypto + stocks
    logger.info(
        "[movers] candidates crypto=%d stock=%d dir=%s limit=%d",
        len(crypto), len(stocks), direction, limit,
    )

    reverse = direction == "up"
    candidates.sort(key=lambda c: c["changePercent"], reverse=reverse)
    top = candidates[:limit]

    # Cache the sliced result keyed by direction+limit.
    await set_cached(key, {"items": top}, _TTL)
    logger.debug(
        "[movers] top %s: %s",
        direction,
        ", ".join(f"{c['name']} {c['changePercent']:+.2f}%" for c in top),
    )
    return top
