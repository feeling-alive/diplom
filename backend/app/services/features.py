"""Feature preparation for the PatchTST classifier.

Turns raw OHLCV candles into the fixed-length numeric window the Hugging Face
model expects, and optionally normalises it with a pre-fitted joblib scaler
(``scaler.pkl``). Every step degrades gracefully: missing/short candles, an
absent scaler file, or unavailable optional deps (``numpy``/``joblib``) all fall
back to raw close prices so the service keeps working — behaviour identical to
the pre-scaler implementation.

Optional runtime deps: ``numpy``, ``joblib``, ``scikit-learn`` (only needed when
a real ``scaler.pkl`` is present). They are imported lazily so the backend boots
even when they are not installed.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("backend.features")


def extract_close_prices(candles: list[dict[str, Any]]) -> list[float]:
    """Extract closing prices from a candle array.

    Supports dict candles (``{"c": 123.45}``) and list candles where the close
    is at index 4 (OKX / Finnhub raw format). Returns an empty list when parsing
    fails or input is empty.
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
            logger.debug("[features] failed to parse close price at index %d", i)
            continue
    return prices


def build_feature_window(
    candles: list[dict[str, Any]],
    seq_len: int,
) -> list[float]:
    """Build a fixed-length close-price window of size *seq_len*.

    Keeps the most recent *seq_len* closes. If fewer are available the window is
    left-padded with its first value so the model always receives ``seq_len``
    points. Returns an empty list when no closes could be extracted.
    """
    closes = extract_close_prices(candles)
    if not closes:
        logger.debug("[features] no close prices extracted")
        return []

    seq_len = max(1, seq_len)
    window = closes[-seq_len:]
    if len(window) < seq_len:
        pad = [window[0]] * (seq_len - len(window))
        window = pad + window
        logger.debug(
            "[features] window padded from %d to %d points", len(closes), seq_len
        )
    else:
        logger.debug("[features] window built: %d points", len(window))
    return window


@lru_cache(maxsize=1)
def load_scaler() -> Any | None:
    """Lazily load and cache the joblib scaler from ``settings.scaler_path``.

    Returns ``None`` (and logs a warning) when the file is absent or cannot be
    loaded — callers then fall back to raw features.
    """
    path = Path(settings.scaler_path)
    if not path.exists():
        logger.warning(
            "[features] scaler not found at %s — using raw features", path
        )
        return None
    try:
        import joblib  # lazy: only needed when a scaler is actually present

        scaler = joblib.load(path)
        logger.info("[features] scaler loaded from %s", path)
        return scaler
    except Exception as exc:  # noqa: BLE001 — any load failure must degrade gracefully
        logger.warning("[features] scaler load failed (%s) — using raw features", exc)
        return None


def apply_scaler(features: list[float], scaler: Any | None = None) -> list[float]:
    """Normalise *features* with the scaler, falling back to raw values.

    A univariate scaler (fit on a single close-price column) is assumed: the
    window is reshaped to ``(n, 1)`` before ``transform``. Any failure — no
    scaler, missing numpy, shape mismatch — returns *features* unchanged.
    """
    if not features:
        return features

    if scaler is None:
        scaler = load_scaler()
    if scaler is None:
        return features

    try:
        import numpy as np  # lazy: only needed when scaling

        arr = np.asarray(features, dtype=float).reshape(-1, 1)
        transformed = scaler.transform(arr)
        out = [float(x) for x in transformed.reshape(-1)]
        logger.debug("[features] scaler applied to %d points", len(out))
        return out
    except Exception as exc:  # noqa: BLE001 — degrade to raw features on any error
        logger.warning(
            "[features] scaler transform failed (%s) — using raw features", exc
        )
        return features
