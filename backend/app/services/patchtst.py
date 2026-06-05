"""Hugging Face Inference API client for PatchTST time-series classifier.

Sends closing-price sequences to a Hugging Face classifier model and returns
a directional prediction (UP/DOWN/SIDEWAYS) with a confidence score.

Graceful degradation: returns a neutral fallback when the upstream is
unreachable, the API key is missing, or the response is malformed.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("backend.patchtst")

_HF_INFERENCE_URL = "https://api-inference.huggingface.co/models/{model_id}"


def _extract_close_prices(candles: list[dict[str, Any]]) -> list[float]:
    """Extract closing prices from a candle array.

    Supports both dict candles (``{"c": 123.45}``) and list candles
    where the close is at index 4 (OKX / Finnhub raw format).
    Returns an empty list when parsing fails or input is empty.
    """
    if not candles:
        return []

    prices: list[float] = []
    for i, c in enumerate(candles):
        try:
            if isinstance(c, dict):
                price = float(c.get("c", 0))
            elif isinstance(c, (list, tuple)):
                price = float(c[4]) if len(c) > 4 else 0.0
            else:
                continue
            prices.append(price)
        except (TypeError, ValueError, IndexError):
            logger.debug("[patchtst] failed to parse close price at index %d", i)
            continue
    return prices


def _neutral_prediction(symbol: str, reason: str = "fallback") -> dict[str, Any]:
    """Return a safe neutral prediction when the upstream is unavailable."""
    logger.info("[patchtst] neutral fallback for %s reason=%s", symbol, reason)
    return {
        "symbol": symbol,
        "prediction": "SIDEWAYS",
        "probability": 0.5,
        "source": reason,
    }


def _parse_classifier_response(raw: Any) -> dict[str, Any] | None:
    """Parse a Hugging Face text-classification-style response.

    Expected shape: ``[[{"label": "UP", "score": 0.85}, {"label": "DOWN", "score": 0.15}]]``
    or the unwrapped ``[{"label": "UP", "score": 0.85}]``.

    Returns ``{prediction, probability}`` or ``None`` on failure.
    """
    try:
        if isinstance(raw, list) and len(raw) > 0:
            inner = raw[0] if isinstance(raw[0], list) else raw
            if isinstance(inner, list) and len(inner) > 0:
                best = max(inner, key=lambda x: float(x.get("score", 0)))
                label = str(best.get("label", "SIDEWAYS")).upper()
                if label not in ("UP", "DOWN", "SIDEWAYS"):
                    label = "SIDEWAYS"
                score = max(0.0, min(1.0, float(best.get("score", 0.5))))
                return {"prediction": label, "probability": score}
    except (TypeError, ValueError, KeyError, IndexError):
        pass
    return None


async def get_prediction(
    candles: list[dict[str, Any]],
    symbol: str = "unknown",
) -> dict[str, Any]:
    """Send closing prices to Hugging Face PatchTST classifier and return a prediction.

    Returns ``{symbol, prediction, probability, source}``.

    * ``source`` is ``"huggingface"`` on success, or a fallback label when
      the API key is absent, the call fails, or parsing fails.
    * ``prediction`` is one of ``UP``, ``DOWN``, ``SIDEWAYS``.
    * ``probability`` is a float in ``[0, 1]``.
    """
    close_prices = _extract_close_prices(candles)

    if not close_prices:
        return _neutral_prediction(symbol, reason="no_candle_data")

    if not settings.hf_api_key:
        logger.warning("[patchtst] HF_API_KEY absent; returning neutral")
        return _neutral_prediction(symbol, reason="missing_config")

    url = _HF_INFERENCE_URL.format(model_id=settings.hf_model_id)

    logger.info(
        "[patchtst] fetch symbol=%s close_prices=%d model=%s",
        symbol,
        len(close_prices),
        settings.hf_model_id,
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                json={"inputs": close_prices},
                headers={"Authorization": f"Bearer {settings.hf_api_key}"},
            )
            resp.raise_for_status()
            raw: Any = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[patchtst] HF API error for %s: %s", symbol, err)
        return _neutral_prediction(symbol, reason="hf_api_error")
    except (json.JSONDecodeError, TypeError, ValueError) as err:
        logger.warning("[patchtst] HF response parse error: %s", err)
        return _neutral_prediction(symbol, reason="parse_error")

    parsed = _parse_classifier_response(raw)
    if parsed is None:
        logger.warning("[patchtst] unexpected response shape from HF: %s", raw)
        return _neutral_prediction(symbol, reason="unexpected_response")

    prediction = parsed["prediction"]
    probability = parsed["probability"]

    logger.info(
        "[patchtst] prediction symbol=%s %s probability=%.4f",
        symbol,
        prediction,
        probability,
    )
    return {
        "symbol": symbol,
        "prediction": prediction,
        "probability": probability,
        "source": "huggingface",
    }
