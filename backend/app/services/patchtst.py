"""Local PyTorch inference for the PatchTST time-series classifier.

Loads ``app/ml/pytorch_model.pt`` (exact architecture restored from the
training notebook — see ``services/patchtst_model.py``) and runs inference
in-process: no HF Inference API, no network calls, no API key.

The model is binary (UP/DOWN over a 60×11 feature window). Its probabilities
are blended with a rule-based technical signal (``_rule_based_signal`` +
``_combine_signals``) and the combined call goes through the same confidence
gate as before: a weak UP/DOWN — below ``prediction_confidence_threshold`` or
with a margin under ``prediction_margin`` — is downgraded to a low-confidence
SIDEWAYS (the "боковик" problem).

Graceful degradation: missing model/scaler files, short candle history, or an
inference error all return a neutral fallback with a distinguishable
``source`` reason instead of raising.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import torch

from app.config import settings
from app.services.features import compute_indicators, extract_ohlcv
from app.services.patchtst_model import PatchTST

logger = logging.getLogger("backend.patchtst")

MODEL_PATH = Path(__file__).parent.parent / "ml" / "pytorch_model.pt"
SCALER_PATH = Path(__file__).parent.parent / "ml" / "scaler.pkl"

FEATURE_NAMES = [
    'open', 'high', 'low', 'close', 'volume',
    'rsi', 'macd', 'macd_hist', 'macd_signal', 'bb_width', 'bb_pos'
]

_VALID_LABELS = ("UP", "DOWN", "SIDEWAYS")

_model = None
_scaler = None


def _load_resources() -> None:
    """Lazily load the PyTorch weights and the joblib scaler (once per process)."""
    global _model, _scaler
    if _model is not None:
        return

    # Модель
    try:
        state_dict = torch.load(
            MODEL_PATH, map_location="cpu", weights_only=True
        )
        m = PatchTST(n_features=11)
        m.load_state_dict(state_dict)
        m.eval()
        _model = m
        logger.info("[patchtst] PatchTST loaded locally ✅")
    except Exception as e:  # noqa: BLE001 — degrade gracefully, never crash startup
        logger.warning("[patchtst] PatchTST load failed: %s", e)

    # Scaler
    try:
        _scaler = joblib.load(SCALER_PATH)
        logger.info("[patchtst] Scaler loaded ✅")
    except Exception as e:  # noqa: BLE001
        logger.warning("[patchtst] Scaler load failed: %s", e)


def _build_features(candles) -> np.ndarray | None:
    """Строит матрицу (seq_len, 11) из свечей.

    Порядок признаков строго как при обучении:
    open,high,low,close,volume,rsi,macd,macd_hist,macd_signal,bb_width,bb_pos
    """
    try:
        opens, highs, lows, closes, volumes = [], [], [], [], []
        for c in candles:
            if isinstance(c, (list, tuple)):
                opens.append(float(c[1]))
                highs.append(float(c[2]))
                lows.append(float(c[3]))
                closes.append(float(c[4]))
                volumes.append(float(c[5]))
            elif isinstance(c, dict):
                opens.append(float(c.get('o') or c.get('open', 0)))
                highs.append(float(c.get('h') or c.get('high', 0)))
                lows.append(float(c.get('l') or c.get('low', 0)))
                closes.append(float(c.get('c') or c.get('close', 0)))
                volumes.append(float(c.get('v') or c.get('volume', 0)))

        n = len(closes)
        if n < 60:
            return None

        cl = np.array(closes, dtype=np.float64)
        op = np.array(opens, dtype=np.float64)
        hi = np.array(highs, dtype=np.float64)
        lo = np.array(lows, dtype=np.float64)
        vo = np.array(volumes, dtype=np.float64)

        # RSI (14, EMA-сглаживание как при обучении)
        delta = np.diff(cl, prepend=cl[0])
        gain = np.where(delta > 0, delta, 0.0)
        loss = np.where(delta < 0, -delta, 0.0)
        alpha = 1.0 / 14
        avg_gain = np.zeros(n)
        avg_loss = np.zeros(n)
        avg_gain[0] = gain[0]
        avg_loss[0] = loss[0]
        for i in range(1, n):
            avg_gain[i] = gain[i]*alpha + avg_gain[i-1]*(1-alpha)
            avg_loss[i] = loss[i]*alpha + avg_loss[i-1]*(1-alpha)
        # errstate: np.where evaluates both branches eagerly, so a zero
        # avg_loss (monotonic series) emits a noisy RuntimeWarning even though
        # the 100.0 fallback is what gets picked. Values are unchanged.
        with np.errstate(divide="ignore", invalid="ignore"):
            rs = np.where(avg_loss > 1e-10, avg_gain/avg_loss, 100.0)
        rsi = 100 - 100/(1+rs)

        # MACD (EWM span=12,26,9)
        def ewm(arr, span):
            alpha = 2.0/(span+1)
            result = np.zeros(len(arr))
            result[0] = arr[0]
            for i in range(1, len(arr)):
                result[i] = arr[i]*alpha + result[i-1]*(1-alpha)
            return result

        ema12 = ewm(cl, 12)
        ema26 = ewm(cl, 26)
        macd = ema12 - ema26
        macd_signal = ewm(macd, 9)
        macd_hist = macd - macd_signal

        # Bollinger Bands (20 периодов)
        bb_width = np.zeros(n)
        bb_pos = np.zeros(n)
        for i in range(19, n):
            window = cl[i-19:i+1]
            sma = window.mean()
            std = window.std()
            if std > 1e-10 and sma > 1e-10:
                upper = sma + 2*std
                lower = sma - 2*std
                bb_width[i] = (upper-lower)/sma
                bb_pos[i] = (cl[i]-lower)/(upper-lower+1e-10)

        matrix = np.column_stack([
            op, hi, lo, cl, vo,
            rsi, macd, macd_hist, macd_signal,
            bb_width, bb_pos
        ])

        # Берём последние 60 строк
        matrix = matrix[-60:]

        # Нормализация
        if _scaler is not None:
            try:
                matrix = _scaler.transform(matrix)
            except Exception:  # noqa: BLE001 — shape mismatch etc.
                # Fallback: window normalization
                mean = matrix.mean(axis=0)
                std = matrix.std(axis=0)
                std[std < 1e-8] = 1e-8
                matrix = (matrix - mean) / std
        else:
            mean = matrix.mean(axis=0)
            std = matrix.std(axis=0)
            std[std < 1e-8] = 1e-8
            matrix = (matrix - mean) / std

        return matrix.astype(np.float32)

    except Exception as e:  # noqa: BLE001
        logger.warning("[patchtst] Feature build error: %s", e)
        return None


def _patchtst_predict(candles) -> tuple[float, float, bool]:
    """Returns (prob_up, prob_down, available)."""
    _load_resources()
    if _model is None:
        return 0.5, 0.5, False

    matrix = _build_features(candles)
    if matrix is None:
        return 0.5, 0.5, False

    try:
        x = torch.tensor(matrix).unsqueeze(0)  # (1, 60, 11)
        with torch.no_grad():
            logits = _model(x)
            probs = torch.softmax(logits, dim=1)[0]
        return probs[1].item(), probs[0].item(), True
    except Exception as e:  # noqa: BLE001
        logger.warning("[patchtst] Inference error: %s", e)
        return 0.5, 0.5, False


def _neutral_prediction(symbol: str, reason: str = "fallback") -> dict[str, Any]:
    """Return a safe neutral prediction when the model is unavailable.

    ``source`` carries the *reason* so callers can tell a technical fallback
    apart from a genuine model SIDEWAYS.
    """
    logger.info("[patchtst] neutral fallback for %s reason=%s", symbol, reason)
    return {
        "symbol": symbol,
        "prediction": "SIDEWAYS",
        "probability": 0.5,
        "raw_probabilities": {},
        "low_confidence": True,
        "source": reason,
        # Hybrid fields — safe neutral defaults so callers can rely on them.
        "patchtst_prob": 0.5,
        "rule_score": 0.0,
        "signals_agree": False,
        "indicator_details": {},
    }


def _apply_confidence_gate(scores: dict[str, float]) -> tuple[str, float, bool]:
    """Decide the reported prediction from raw label scores.

    Returns ``(prediction, probability, low_confidence)``:

    * The model's top label wins by default.
    * A top ``UP``/``DOWN`` whose score is below the threshold, or whose margin
      over the runner-up is below ``prediction_margin``, is downgraded to
      ``SIDEWAYS`` with ``low_confidence=True``.
    * A genuine top ``SIDEWAYS`` keeps ``low_confidence=False``.
    * ``probability`` is the score of the *reported* prediction (honest: a
      downgraded signal reports the SIDEWAYS score, not the rejected UP score).
    """
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_label, top_score = ranked[0]
    runner_score = ranked[1][1] if len(ranked) > 1 else 0.0
    margin = top_score - runner_score

    threshold = settings.prediction_confidence_threshold
    min_margin = settings.prediction_margin

    if top_label in ("UP", "DOWN") and (top_score < threshold or margin < min_margin):
        prediction = "SIDEWAYS"
        low_confidence = True
        logger.info(
            "[patchtst] downgrade %s(%.3f) -> SIDEWAYS (score<%.2f or margin %.3f<%.2f)",
            top_label, top_score, threshold, margin, min_margin,
        )
    else:
        prediction = top_label
        low_confidence = False

    probability = scores.get(prediction, top_score)
    return prediction, probability, low_confidence


# ---------------------------------------------------------------------------
# Hybrid signal: PatchTST + rule-based technical indicators
# ---------------------------------------------------------------------------


def _rule_based_signal(candles: list[dict[str, Any]]) -> tuple[float, dict[str, Any]]:
    """Compute a rule-based technical score plus a human-readable indicator snapshot.

    Combines three independent signals from the candle series:

    1. **RSI**: ``<35`` → +1 (oversold/bullish), ``>65`` → -1 (overbought/bearish),
       else 0.
    2. **MACD**: bullish cross → +1, bearish cross → -1, else +0.5/-0.5 depending
       on which side of the signal line MACD sits.
    3. **Trend (MA)**: ``close > SMA20 > SMA50`` → +1, ``close < SMA20 < SMA50``
       → -1, else 0.

    ``rule_score = (rsi + macd + trend) / 3`` clamped to ``[-1, 1]``.

    Returns ``(rule_score, indicator_details)`` where ``indicator_details`` carries
    the real indicator values the chat system prompt renders:
    ``{rsi, rsi_zone, macd_cross, macd_position, trend, price_vs_sma20}``.

    SMA availability: ``SMA20`` (needed for ``price_vs_sma20`` and the trend
    classification) is meaningful from ~20 candles, so it is computed under its
    own ``>= 20`` guard, separate from the ``>= 50`` guard that ``SMA50`` and the
    up/down trend verdict require. With ``< 20`` candles ``price_vs_sma20`` stays
    ``0.0`` and ``trend`` stays ``"смешанный"`` — never divides by zero.

    Degrades to ``(0.0, {})`` on missing/short data rather than raising.
    """
    ohlcv = extract_ohlcv(candles)
    closes = ohlcv["close"]
    if not closes:
        logger.debug("[patchtst] rule signal: no closes -> 0.0")
        return 0.0, {}

    ind = compute_indicators(ohlcv)
    rsi = ind["rsi"]
    macd = ind["macd"]
    macd_signal = ind["macd_signal"]
    last_close = closes[-1]

    # 1. RSI signal + zone
    last_rsi = rsi[-1]
    if last_rsi < 35:
        rsi_sig = 1.0
        rsi_zone = "перепродан"
    elif last_rsi > 65:
        rsi_sig = -1.0
        rsi_zone = "перекуплен"
    else:
        rsi_sig = 0.0
        rsi_zone = "нейтральная зона"

    # 2. MACD signal (crossover takes priority over level) + cross/position text
    macd_cross = "нет пересечения"
    if len(macd) >= 2:
        m_now, m_prev = macd[-1], macd[-2]
        s_now, s_prev = macd_signal[-1], macd_signal[-2]
        if m_now > s_now and m_prev <= s_prev:
            macd_sig = 1.0
            macd_cross = "бычье пересечение"
        elif m_now < s_now and m_prev >= s_prev:
            macd_sig = -1.0
            macd_cross = "медвежье пересечение"
        elif m_now > s_now:
            macd_sig = 0.5
        elif m_now < s_now:
            macd_sig = -0.5
        else:
            macd_sig = 0.0
    else:
        macd_sig = 0.0

    if macd and macd_signal:
        macd_position = "выше сигнальной" if macd[-1] > macd_signal[-1] else "ниже сигнальной"
    else:
        macd_position = "ниже сигнальной"

    # 3. Trend signal (SMA20 vs SMA50). SMA20 (>=20) drives price_vs_sma20; the
    #    full up/down verdict additionally needs SMA50 (>=50).
    trend_sig = 0.0
    trend = "смешанный"
    price_vs_sma20 = 0.0
    if len(closes) >= 20:
        sma20 = sum(closes[-20:]) / 20
        if sma20:
            price_vs_sma20 = round((last_close / sma20 - 1) * 100, 2)
        if len(closes) >= 50:
            sma50 = sum(closes[-50:]) / 50
            if last_close > sma20 > sma50:
                trend_sig = 1.0
                trend = "восходящий"
            elif last_close < sma20 < sma50:
                trend_sig = -1.0
                trend = "нисходящий"

    rule_score = (rsi_sig + macd_sig + trend_sig) / 3.0
    rule_score = max(-1.0, min(1.0, rule_score))

    indicator_details: dict[str, Any] = {
        "rsi": round(last_rsi, 1),
        "rsi_zone": rsi_zone,
        "macd_cross": macd_cross,
        "macd_position": macd_position,
        "trend": trend,
        "price_vs_sma20": price_vs_sma20,
    }

    logger.debug(
        "[patchtst] rule signals rsi=%.1f(%s) macd=%.2f(%s) trend=%s -> score=%.3f",
        last_rsi,
        rsi_zone,
        macd_sig,
        macd_cross,
        trend,
        rule_score,
    )
    return rule_score, indicator_details


def _combine_signals(patchtst_prob_up: float, rule_score: float) -> tuple[float, float]:
    """Combine the PatchTST UP probability with the rule-based score.

    Weights: PatchTST 60%, rules 40%. When both point the same way, confidence
    is boosted by up to 15% (clamped to ``[0.15, 0.85]``). Returns
    ``(combined_prob_up, combined_prob_down)``.
    """
    # Map rule_score [-1, 1] -> probability of UP [0, 1].
    rule_prob_up = (rule_score + 1) / 2

    combined_prob_up = 0.6 * patchtst_prob_up + 0.4 * rule_prob_up
    combined_prob_down = 1 - combined_prob_up

    patchtst_direction = "UP" if patchtst_prob_up > 0.5 else "DOWN"
    rule_direction = "UP" if rule_score > 0.1 else ("DOWN" if rule_score < -0.1 else "NEUTRAL")

    if patchtst_direction == rule_direction:
        # Signals agree — strengthen confidence.
        boost = 0.15 * abs(combined_prob_up - 0.5)
        if combined_prob_up > 0.5:
            combined_prob_up = min(0.85, combined_prob_up + boost)
        else:
            combined_prob_up = max(0.15, combined_prob_up - boost)
        combined_prob_down = 1 - combined_prob_up

    logger.debug(
        "[patchtst] combine pt_up=%.3f rule=%.3f -> up=%.3f down=%.3f",
        patchtst_prob_up,
        rule_score,
        combined_prob_up,
        combined_prob_down,
    )
    return combined_prob_up, combined_prob_down


async def get_prediction(
    candles: list[dict[str, Any]],
    symbol: str = "unknown",
) -> dict[str, Any]:
    """Run the local PatchTST model over the candle window and blend with rules.

    Returns ``{symbol, prediction, probability, raw_probabilities,
    low_confidence, source, patchtst_prob, rule_score, signals_agree,
    indicator_details}``.

    * ``source`` is ``"local"`` on success, or a fallback reason label.
    * ``prediction`` is one of ``UP``, ``DOWN``, ``SIDEWAYS``.
    * ``probability`` is a float in ``[0, 1]`` for the reported prediction.
    * ``low_confidence`` is ``True`` when a weak directional call was gated down
      to SIDEWAYS (or on a technical fallback).

    Kept ``async`` for caller compatibility (routes/chat.py awaits it); the
    inference itself is a fast in-process CPU forward pass.
    """
    if not candles:
        return _neutral_prediction(symbol, reason="no_candle_data")

    prob_up, prob_down, available = _patchtst_predict(candles)
    if not available:
        return _neutral_prediction(symbol, reason="model_unavailable")

    scores = {"UP": prob_up, "DOWN": prob_down}

    # --- Hybrid step: blend the model with rule-based technical signals -------
    rule_score, indicator_details = _rule_based_signal(candles)
    combined_up, combined_down = _combine_signals(prob_up, rule_score)

    patchtst_direction = "UP" if prob_up > 0.5 else "DOWN"
    rule_direction = "UP" if rule_score > 0.1 else ("DOWN" if rule_score < -0.1 else "NEUTRAL")
    signals_agree = patchtst_direction == rule_direction

    # Feed the combined UP/DOWN probabilities through the same confidence gate
    # so the SIDEWAYS/боковик semantics are preserved. The local model is
    # binary, so there is no genuine SIDEWAYS mass — the gate alone produces it.
    combined_scores = {
        "UP": combined_up,
        "DOWN": combined_down,
        "SIDEWAYS": 0.0,
    }
    prediction, probability, low_confidence = _apply_confidence_gate(combined_scores)

    logger.info(
        "[patchtst] prediction symbol=%s %s prob=%.4f low_conf=%s "
        "patchtst_up=%.3f rule=%.3f agree=%s",
        symbol,
        prediction,
        probability,
        low_confidence,
        prob_up,
        rule_score,
        signals_agree,
    )
    return {
        "symbol": symbol,
        "prediction": prediction,
        "probability": probability,
        "raw_probabilities": scores,
        "low_confidence": low_confidence,
        "source": "local",
        "patchtst_prob": prob_up,
        "rule_score": rule_score,
        "signals_agree": signals_agree,
        "indicator_details": indicator_details,
    }
