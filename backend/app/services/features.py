"""Feature preparation for the PatchTST classifier.

Turns raw OHLCV candles into the fixed-length numeric matrix the Hugging Face
model expects, and optionally normalises it with a pre-fitted joblib scaler
(``scaler.pkl``). Every step degrades gracefully: missing/short candles, an
absent scaler file, a scaler whose shape does not match the feature matrix, or
unavailable optional deps all fall back to safe behaviour so the service keeps
working.

Feature matrix layout (one row per candle, columns in this STRICT order):

    ['open', 'high', 'low', 'close', 'volume',
     'rsi', 'macd', 'macd_hist', 'macd_signal', 'bb_width', 'bb_pos']

Technical indicators are computed in pure Python (no pandas/numpy dependency for
the math) so indicator computation never fails on a missing optional dep. numpy
is imported lazily, and only inside :func:`apply_scaler`, where the scaler needs
array shapes.

Optional runtime deps: ``numpy``, ``joblib``, ``scikit-learn`` (needed only when
a real ``scaler.pkl`` is present, or for the fit_transform fallback). They are
imported lazily so the backend boots even when they are not installed.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("backend.features")

# Strict column order expected by the (multivariate) PatchTST model + scaler.
FEATURE_ORDER: tuple[str, ...] = (
    "open",
    "high",
    "low",
    "close",
    "volume",
    "rsi",
    "macd",
    "macd_hist",
    "macd_signal",
    "bb_width",
    "bb_pos",
)


# ---------------------------------------------------------------------------
# Raw candle extraction
# ---------------------------------------------------------------------------


def extract_close_prices(candles: list[dict[str, Any]]) -> list[float]:
    """Extract closing prices from a candle array.

    Supports dict candles (``{"c": 123.45}``) and list candles where the close
    is at index 4 (OKX / Finnhub raw format). Returns an empty list when parsing
    fails or input is empty. Kept for backward compatibility with the univariate
    path and simple callers.
    """
    if not candles:
        return []

    prices: list[float] = []
    for i, c in enumerate(candles):
        try:
            if isinstance(c, dict):
                price = float(c.get("c", c.get("close", 0)))
            elif isinstance(c, (list, tuple)):
                price = float(c[4]) if len(c) > 4 else 0.0
            else:
                continue
            prices.append(price)
        except (TypeError, ValueError, IndexError):
            logger.debug("[features] failed to parse close price at index %d", i)
            continue
    return prices


def extract_ohlcv(candles: list[dict[str, Any]]) -> dict[str, list[float]]:
    """Extract OHLCV series from a candle array into per-column lists.

    Supports the canonical dict shape produced by ``services/candles.py``
    (``{"o","h","l","c","v"}``, also accepts long keys ``open``/``close``/...)
    and OKX/Finnhub raw list candles ``[ts, o, h, l, c, v, ...]`` (indices 1-5).
    Broken rows are skipped. Returns five aligned, equal-length lists; empty
    lists when nothing could be parsed.
    """
    cols: dict[str, list[float]] = {k: [] for k in ("open", "high", "low", "close", "volume")}
    if not candles:
        return cols

    for i, c in enumerate(candles):
        try:
            if isinstance(c, dict):
                o = float(c.get("o", c.get("open", 0)))
                h = float(c.get("h", c.get("high", 0)))
                low = float(c.get("l", c.get("low", 0)))
                close = float(c.get("c", c.get("close", 0)))
                vol = float(c.get("v", c.get("volume", 0)))
            elif isinstance(c, (list, tuple)):
                if len(c) < 6:
                    continue
                o, h, low, close, vol = (
                    float(c[1]),
                    float(c[2]),
                    float(c[3]),
                    float(c[4]),
                    float(c[5]),
                )
            else:
                continue
        except (TypeError, ValueError, IndexError):
            logger.debug("[features] failed to parse OHLCV at index %d", i)
            continue
        cols["open"].append(o)
        cols["high"].append(h)
        cols["low"].append(low)
        cols["close"].append(close)
        cols["volume"].append(vol)

    return cols


# ---------------------------------------------------------------------------
# Technical indicators (pure Python — no numpy/pandas needed)
# ---------------------------------------------------------------------------


def _ema(values: list[float], period: int) -> list[float]:
    """Exponential moving average. Seeded with the first value; length-preserving."""
    n = len(values)
    if n == 0:
        return []
    k = 2.0 / (period + 1)
    ema = values[0]
    out = [ema]
    for i in range(1, n):
        ema = values[i] * k + ema * (1 - k)
        out.append(ema)
    return out


def _sma(values: list[float], period: int) -> list[float]:
    """Simple moving average; warmup positions use the partial mean so the
    series is always length-preserving and never ``None``."""
    n = len(values)
    if n == 0:
        return []
    out: list[float] = []
    for i in range(n):
        start = max(0, i + 1 - period)
        window = values[start : i + 1]
        out.append(sum(window) / len(window))
    return out


def _rsi(closes: list[float], period: int = 14) -> list[float]:
    """Wilder's RSI in ``[0, 100]``. Warmup positions default to a neutral 50."""
    n = len(closes)
    out = [50.0] * n
    if n < period + 1:
        return out

    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        change = closes[i] - closes[i - 1]
        if change >= 0:
            gains += change
        else:
            losses -= change
    avg_gain = gains / period
    avg_loss = losses / period

    def _rsi_value(ag: float, al: float) -> float:
        if al == 0:
            return 100.0 if ag > 0 else 50.0
        rs = ag / al
        return 100.0 - 100.0 / (1.0 + rs)

    out[period] = _rsi_value(avg_gain, avg_loss)
    for i in range(period + 1, n):
        change = closes[i] - closes[i - 1]
        gain = change if change > 0 else 0.0
        loss = -change if change < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        out[i] = _rsi_value(avg_gain, avg_loss)
    return out


def _macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[list[float], list[float], list[float]]:
    """Return ``(macd, macd_signal, macd_hist)``, all length-preserving."""
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)
    macd = [f - s for f, s in zip(ema_fast, ema_slow)]
    macd_signal = _ema(macd, signal)
    macd_hist = [m - s for m, s in zip(macd, macd_signal)]
    return macd, macd_signal, macd_hist


def _bollinger(
    closes: list[float],
    period: int = 20,
    num_std: float = 2.0,
) -> tuple[list[float], list[float]]:
    """Return ``(bb_width, bb_pos)``.

    * ``bb_width`` = (upper - lower) / middle (relative band width; 0 when flat).
    * ``bb_pos``   = position of close inside the band, clamped to ``[0, 1]``
      (0.5 when the band has zero width / on warmup).
    """
    n = len(closes)
    bb_width = [0.0] * n
    bb_pos = [0.5] * n
    if n == 0:
        return bb_width, bb_pos

    for i in range(n):
        start = max(0, i + 1 - period)
        window = closes[start : i + 1]
        mean = sum(window) / len(window)
        if len(window) > 1:
            var = sum((x - mean) ** 2 for x in window) / len(window)
            std = var**0.5
        else:
            std = 0.0
        upper = mean + num_std * std
        lower = mean - num_std * std
        bb_width[i] = (upper - lower) / mean if mean != 0 else 0.0
        if upper != lower:
            pos = (closes[i] - lower) / (upper - lower)
            bb_pos[i] = max(0.0, min(1.0, pos))
        else:
            bb_pos[i] = 0.5
    return bb_width, bb_pos


def _atr(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    period: int = 14,
) -> list[float]:
    """Wilder's Average True Range (ATR), length-preserving.

    True Range at bar *i* = ``max(high-low, |high-prev_close|, |low-prev_close|)``.
    The series is smoothed with Wilder's method (same recurrence as :func:`_rsi`).
    Warmup positions (before the first full *period* of true ranges) default to
    ``0.0`` so the series is always the same length as the inputs and never
    ``None``. ATR is expressed in price units, not normalised.
    """
    n = len(closes)
    out = [0.0] * n
    if n < 2:
        return out

    # True range per bar; tr[0] has no previous close → high-low.
    tr: list[float] = [highs[0] - lows[0] if highs and lows else 0.0]
    for i in range(1, n):
        prev_close = closes[i - 1]
        tr.append(
            max(
                highs[i] - lows[i],
                abs(highs[i] - prev_close),
                abs(lows[i] - prev_close),
            )
        )

    if n < period + 1:
        # Not enough bars for a full Wilder seed — fall back to the running mean
        # of available true ranges so the last value is still informative.
        running = 0.0
        for i in range(n):
            running = (running * i + tr[i]) / (i + 1)
            out[i] = running
        return out

    # Seed ATR with the simple average of the first `period` true ranges.
    atr = sum(tr[1 : period + 1]) / period
    out[period] = atr
    for i in range(period + 1, n):
        atr = (atr * (period - 1) + tr[i]) / period
        out[i] = atr
    return out


def _volume_zscore(volumes: list[float], window: int = 20) -> list[float]:
    """Rolling z-score of volume over the trailing *window*, length-preserving.

    ``z = (v_i - mean_window) / std_window`` using the population std of the
    trailing window (including the current bar). Returns ``0.0`` where the window
    has fewer than two samples or a zero standard deviation (flat volume), so the
    series never raises or yields ``inf``/``nan``.
    """
    n = len(volumes)
    out = [0.0] * n
    if n == 0:
        return out

    for i in range(n):
        start = max(0, i + 1 - window)
        win = volumes[start : i + 1]
        if len(win) < 2:
            continue
        mean = sum(win) / len(win)
        var = sum((v - mean) ** 2 for v in win) / len(win)
        std = var**0.5
        out[i] = (volumes[i] - mean) / std if std > 0 else 0.0
    return out


def compute_indicators(ohlcv: dict[str, list[float]]) -> dict[str, list[float]]:
    """Compute all technical indicators from an OHLCV column dict.

    Returns a dict with arrays ``rsi``, ``macd``, ``macd_signal``,
    ``macd_hist``, ``bb_width``, ``bb_pos`` — each the same length as the close
    series. On too-short input the indicators fall back to their neutral values
    (rsi=50, macd=0, bb_pos=0.5, bb_width=0) rather than raising, so the feature
    matrix is always well-formed.
    """
    closes = ohlcv.get("close", [])
    rsi = _rsi(closes)
    macd, macd_signal, macd_hist = _macd(closes)
    bb_width, bb_pos = _bollinger(closes)
    if closes:
        logger.debug(
            "[features] indicators computed n=%d rsi_last=%.2f macd_last=%.4f bb_pos_last=%.3f",
            len(closes),
            rsi[-1],
            macd[-1],
            bb_pos[-1],
        )
    return {
        "rsi": rsi,
        "macd": macd,
        "macd_signal": macd_signal,
        "macd_hist": macd_hist,
        "bb_width": bb_width,
        "bb_pos": bb_pos,
    }


def compute_extra_indicators(ohlcv: dict[str, list[float]]) -> dict[str, float]:
    """Compute last-bar ATR(14) and volume z-score for the LLM context.

    These two indicators are **NOT** part of :data:`FEATURE_ORDER` / the model
    input (the PatchTST matrix stays 60×11) — they are surfaced only to the AI
    assistant's prompt. Returns the most recent value of each, defaulting to
    ``0.0`` on empty/short input so callers never get ``None``.
    """
    highs = ohlcv.get("high", [])
    lows = ohlcv.get("low", [])
    closes = ohlcv.get("close", [])
    volumes = ohlcv.get("volume", [])

    atr_series = _atr(highs, lows, closes)
    vol_z_series = _volume_zscore(volumes)
    atr = atr_series[-1] if atr_series else 0.0
    vol_z = vol_z_series[-1] if vol_z_series else 0.0
    logger.debug(
        "[features] extra indicators atr=%.4f vol_z=%.3f n=%d",
        atr,
        vol_z,
        len(closes),
    )
    return {"atr": atr, "volume_zscore": vol_z}


# ---------------------------------------------------------------------------
# Feature windows / matrices
# ---------------------------------------------------------------------------


def build_feature_window(
    candles: list[dict[str, Any]],
    seq_len: int,
) -> list[float]:
    """Build a fixed-length close-price window of size *seq_len* (univariate).

    Kept for backward compatibility. Keeps the most recent *seq_len* closes,
    left-padding with the first value when fewer are available. Returns an empty
    list when no closes could be extracted.
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


def build_feature_matrix(
    candles: list[dict[str, Any]],
    seq_len: int,
) -> list[list[float]]:
    """Build a ``seq_len × 11`` feature matrix in :data:`FEATURE_ORDER`.

    Columns are O/H/L/C/V plus the six technical indicators. Keeps the most
    recent *seq_len* rows; if fewer are available the matrix is left-padded with
    a copy of its first row so the model always receives ``seq_len`` rows.
    Returns an empty list when no candles could be parsed.
    """
    ohlcv = extract_ohlcv(candles)
    closes = ohlcv["close"]
    if not closes:
        logger.debug("[features] no OHLCV extracted — empty feature matrix")
        return []

    ind = compute_indicators(ohlcv)
    columns: dict[str, list[float]] = {
        "open": ohlcv["open"],
        "high": ohlcv["high"],
        "low": ohlcv["low"],
        "close": ohlcv["close"],
        "volume": ohlcv["volume"],
        **ind,
    }

    n = len(closes)
    rows: list[list[float]] = [
        [columns[name][i] for name in FEATURE_ORDER] for i in range(n)
    ]

    seq_len = max(1, seq_len)
    window = rows[-seq_len:]
    if len(window) < seq_len:
        pad = [list(window[0]) for _ in range(seq_len - len(window))]
        window = pad + window
        logger.debug(
            "[features] matrix padded from %d to %d rows (×%d cols)",
            n,
            seq_len,
            len(FEATURE_ORDER),
        )
    else:
        logger.debug(
            "[features] matrix built: %d rows ×%d cols", len(window), len(FEATURE_ORDER)
        )
    return window


# ---------------------------------------------------------------------------
# Scaler (joblib) — optional, multivariate
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_scaler() -> Any | None:
    """Lazily load and cache the joblib scaler from ``settings.scaler_path``.

    Returns ``None`` (and logs a warning) when the file is absent or cannot be
    loaded — callers then fall back to a fit_transform on the current matrix.
    """
    path = Path(settings.scaler_path)
    if not path.exists():
        logger.warning(
            "[features] scaler not found at %s — using fit_transform fallback", path
        )
        return None
    try:
        import joblib  # lazy: only needed when a scaler is actually present

        scaler = joblib.load(path)
        logger.info("[features] scaler loaded from %s", path)
        return scaler
    except Exception as exc:  # noqa: BLE001 — any load failure must degrade gracefully
        logger.warning("[features] scaler load failed (%s) — using fit_transform fallback", exc)
        return None


def _fit_transform_fallback(features: list[Any], is_matrix: bool) -> list[Any]:
    """Standardise *features* on the fly with a fresh ``StandardScaler``.

    Used when ``scaler.pkl`` is absent (per the Block 1 spec). Any failure —
    missing numpy/sklearn, degenerate data — returns *features* unchanged.
    """
    logger.warning("[features] scaler.pkl absent — fit_transform fallback on current window")
    try:
        import numpy as np  # lazy
        from sklearn.preprocessing import StandardScaler  # lazy

        arr = np.asarray(features, dtype=float)
        if not is_matrix:
            arr = arr.reshape(-1, 1)
        transformed = StandardScaler().fit_transform(arr)
        if is_matrix:
            return [[float(x) for x in row] for row in transformed]
        return [float(x) for x in transformed.reshape(-1)]
    except Exception as exc:  # noqa: BLE001 — degrade to raw features on any error
        logger.warning(
            "[features] fit_transform fallback failed (%s) — using raw features", exc
        )
        return features


def apply_scaler(features: list[Any], scaler: Any | None = None) -> list[Any]:
    """Normalise *features* with the scaler, falling back gracefully.

    Accepts either a 2D feature matrix (``list[list[float]]`` — the 11-column
    window) or a 1D univariate window (``list[float]`` — legacy). Behaviour:

    * scaler present → ``scaler.transform(...)`` (never ``fit_transform``).
    * scaler absent (``scaler.pkl`` missing / unloadable) → fit_transform on the
      current window via :func:`_fit_transform_fallback`.
    * any transform error (e.g. a univariate ``scaler.pkl`` applied to the
      11-column matrix — a shape mismatch) → return *features* unchanged.

    NOTE: the committed ``scaler.pkl`` was fit on a single close column. Applying
    it to the 11-column matrix raises a shape error and degrades to raw features
    here by design — full normalisation needs a scaler refit on all 11 columns
    (see ``app/ml/README.md``).
    """
    if not features:
        return features

    is_matrix = isinstance(features[0], (list, tuple))

    if scaler is None:
        scaler = load_scaler()
    if scaler is None:
        return _fit_transform_fallback(features, is_matrix)

    try:
        import numpy as np  # lazy: only needed when scaling

        if is_matrix:
            arr = np.asarray(features, dtype=float)
        else:
            arr = np.asarray(features, dtype=float).reshape(-1, 1)
        transformed = scaler.transform(arr)
        if is_matrix:
            out = [[float(x) for x in row] for row in transformed]
            logger.debug("[features] scaler applied to matrix %dx%d", len(out), len(out[0]) if out else 0)
        else:
            out = [float(x) for x in transformed.reshape(-1)]
            logger.debug("[features] scaler applied to %d points", len(out))
        return out
    except Exception as exc:  # noqa: BLE001 — degrade to raw features on any error
        logger.warning(
            "[features] scaler transform failed (%s) — using raw features", exc
        )
        return features
