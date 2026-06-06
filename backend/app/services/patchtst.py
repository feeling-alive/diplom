"""Hugging Face Inference API client for PatchTST time-series classifier.

Sends a (optionally scaled) closing-price window to a Hugging Face classifier
model and returns a directional prediction (UP/DOWN/SIDEWAYS) with a confidence
score and a low-confidence flag.

Confidence gating: a top UP/DOWN label that is below
``prediction_confidence_threshold`` — or wins by a margin smaller than
``prediction_margin`` over the runner-up — is downgraded to a low-confidence
SIDEWAYS signal. This prevents a near-flat ~51% call from reading as a confident
direction (the "боковик" problem).

Graceful degradation: returns a neutral fallback when the upstream is
unreachable, the API key is missing, or the response is malformed. A fallback
SIDEWAYS (``source`` = reason) stays distinguishable from a genuine model
SIDEWAYS (``source="huggingface"``).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.services.features import (
    apply_scaler,
    build_feature_matrix,
    compute_indicators,
    extract_ohlcv,
)

logger = logging.getLogger("backend.patchtst")

_HF_INFERENCE_URL = "https://api-inference.huggingface.co/models/{model_id}"

_VALID_LABELS = ("UP", "DOWN", "SIDEWAYS")


def _neutral_prediction(symbol: str, reason: str = "fallback") -> dict[str, Any]:
    """Return a safe neutral prediction when the upstream is unavailable.

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
    }


def _parse_scores(raw: Any) -> dict[str, float]:
    """Parse a HF text-classification response into ``{label: score}``.

    Accepts ``[[{"label": "UP", "score": 0.7}, ...]]`` or the unwrapped
    ``[{"label": "UP", "score": 0.7}, ...]``. Unknown labels are ignored and
    scores are clamped to ``[0, 1]``. Returns ``{}`` on failure.
    """
    try:
        if not isinstance(raw, list) or not raw:
            return {}
        inner = raw[0] if isinstance(raw[0], list) else raw
        if not isinstance(inner, list):
            return {}
        scores: dict[str, float] = {}
        for item in inner:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label", "")).upper()
            if label not in _VALID_LABELS:
                continue
            score = max(0.0, min(1.0, float(item.get("score", 0))))
            scores[label] = score
        return scores
    except (TypeError, ValueError, KeyError, IndexError):
        return {}


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


def _rule_based_signal(candles: list[dict[str, Any]]) -> float:
    """Compute a rule-based technical score in ``[-1.0, +1.0]``.

    Combines three independent signals from the candle series:

    1. **RSI**: ``<35`` → +1 (oversold/bullish), ``>65`` → -1 (overbought/bearish),
       else 0.
    2. **MACD**: bullish cross → +1, bearish cross → -1, else +0.5/-0.5 depending
       on which side of the signal line MACD sits.
    3. **Trend (MA)**: ``close > SMA20 > SMA50`` → +1, ``close < SMA20 < SMA50``
       → -1, else 0.

    ``rule_score = (rsi + macd + trend) / 3`` clamped to ``[-1, 1]``.

    NOTE: the prompt phrased this as ``_rule_based_signal(df)`` over a pandas
    DataFrame. This project does not use pandas — we operate on the candle list
    via the pure-Python indicator helpers in ``services/features.py`` instead.
    Degrades to neutral (0.0) on missing/short data rather than raising.
    """
    ohlcv = extract_ohlcv(candles)
    closes = ohlcv["close"]
    if not closes:
        logger.debug("[patchtst] rule signal: no closes -> 0.0")
        return 0.0

    ind = compute_indicators(ohlcv)
    rsi = ind["rsi"]
    macd = ind["macd"]
    macd_signal = ind["macd_signal"]

    # 1. RSI signal
    last_rsi = rsi[-1]
    if last_rsi < 35:
        rsi_sig = 1.0
    elif last_rsi > 65:
        rsi_sig = -1.0
    else:
        rsi_sig = 0.0

    # 2. MACD signal (crossover takes priority over level)
    if len(macd) >= 2:
        m_now, m_prev = macd[-1], macd[-2]
        s_now, s_prev = macd_signal[-1], macd_signal[-2]
        if m_now > s_now and m_prev <= s_prev:
            macd_sig = 1.0
        elif m_now < s_now and m_prev >= s_prev:
            macd_sig = -1.0
        elif m_now > s_now:
            macd_sig = 0.5
        elif m_now < s_now:
            macd_sig = -0.5
        else:
            macd_sig = 0.0
    else:
        macd_sig = 0.0

    # 3. Trend signal (SMA20 vs SMA50). Needs enough history to be meaningful.
    trend_sig = 0.0
    if len(closes) >= 50:
        sma20 = sum(closes[-20:]) / 20
        sma50 = sum(closes[-50:]) / 50
        last_close = closes[-1]
        if last_close > sma20 > sma50:
            trend_sig = 1.0
        elif last_close < sma20 < sma50:
            trend_sig = -1.0

    rule_score = (rsi_sig + macd_sig + trend_sig) / 3.0
    rule_score = max(-1.0, min(1.0, rule_score))
    logger.debug(
        "[patchtst] rule signals rsi=%.1f macd=%.2f trend=%.2f -> score=%.3f",
        rsi_sig,
        macd_sig,
        trend_sig,
        rule_score,
    )
    return rule_score


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
    """Send a scaled close-price window to the PatchTST classifier.

    Returns ``{symbol, prediction, probability, raw_probabilities,
    low_confidence, source}``.

    * ``source`` is ``"huggingface"`` on success, or a fallback reason label.
    * ``prediction`` is one of ``UP``, ``DOWN``, ``SIDEWAYS``.
    * ``probability`` is a float in ``[0, 1]`` for the reported prediction.
    * ``low_confidence`` is ``True`` when a weak directional call was gated down
      to SIDEWAYS (or on a technical fallback).
    """
    matrix = build_feature_matrix(candles, settings.prediction_seq_len)

    if not matrix:
        return _neutral_prediction(symbol, reason="no_candle_data")

    if not settings.hf_api_key:
        logger.warning("[patchtst] HF_API_KEY absent; returning neutral")
        return _neutral_prediction(symbol, reason="missing_config")

    # NOTE: the 11-feature matrix changes the HF payload shape vs. the previous
    # flat close-price window. A model expecting the univariate window may reject
    # the matrix — that surfaces as an HTTP/parse error below and degrades to a
    # neutral fallback (see _neutral_prediction). See plan risk #2.
    inputs = apply_scaler(matrix)
    url = _HF_INFERENCE_URL.format(model_id=settings.hf_model_id)

    logger.info(
        "[patchtst] fetch symbol=%s seq_len=%d cols=%d model=%s",
        symbol,
        len(inputs),
        len(inputs[0]) if inputs and isinstance(inputs[0], list) else 1,
        settings.hf_model_id,
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                json={"inputs": inputs},
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

    scores = _parse_scores(raw)
    if not scores:
        logger.warning("[patchtst] unexpected response shape from HF: %s", raw)
        return _neutral_prediction(symbol, reason="unexpected_response")

    # --- Hybrid step: blend the model with rule-based technical signals -------
    patchtst_prob_up = scores.get("UP", 0.5)
    rule_score = _rule_based_signal(candles)
    combined_up, combined_down = _combine_signals(patchtst_prob_up, rule_score)

    patchtst_direction = "UP" if patchtst_prob_up > 0.5 else "DOWN"
    rule_direction = "UP" if rule_score > 0.1 else ("DOWN" if rule_score < -0.1 else "NEUTRAL")
    signals_agree = patchtst_direction == rule_direction

    # Feed the combined UP/DOWN probabilities through the same confidence gate
    # so the SIDEWAYS/боковик semantics are preserved. The model's own SIDEWAYS
    # mass is kept so a strong genuine-sideways call can still win the ranking.
    combined_scores = {
        "UP": combined_up,
        "DOWN": combined_down,
        "SIDEWAYS": scores.get("SIDEWAYS", 0.0),
    }
    prediction, probability, low_confidence = _apply_confidence_gate(combined_scores)

    logger.info(
        "[patchtst] prediction symbol=%s %s prob=%.4f low_conf=%s "
        "patchtst_up=%.3f rule=%.3f agree=%s raw=%s",
        symbol,
        prediction,
        probability,
        low_confidence,
        patchtst_prob_up,
        rule_score,
        signals_agree,
        scores,
    )
    return {
        "symbol": symbol,
        "prediction": prediction,
        "probability": probability,
        "raw_probabilities": scores,
        "low_confidence": low_confidence,
        "source": "huggingface",
        "patchtst_prob": patchtst_prob_up,
        "rule_score": rule_score,
        "signals_agree": signals_agree,
    }
