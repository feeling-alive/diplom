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
from app.services.features import apply_scaler, build_feature_window

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
    window = build_feature_window(candles, settings.prediction_seq_len)

    if not window:
        return _neutral_prediction(symbol, reason="no_candle_data")

    if not settings.hf_api_key:
        logger.warning("[patchtst] HF_API_KEY absent; returning neutral")
        return _neutral_prediction(symbol, reason="missing_config")

    inputs = apply_scaler(window)
    url = _HF_INFERENCE_URL.format(model_id=settings.hf_model_id)

    logger.info(
        "[patchtst] fetch symbol=%s seq_len=%d model=%s",
        symbol,
        len(inputs),
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

    prediction, probability, low_confidence = _apply_confidence_gate(scores)

    logger.info(
        "[patchtst] prediction symbol=%s %s prob=%.4f low_conf=%s raw=%s",
        symbol,
        prediction,
        probability,
        low_confidence,
        scores,
    )
    return {
        "symbol": symbol,
        "prediction": prediction,
        "probability": probability,
        "raw_probabilities": scores,
        "low_confidence": low_confidence,
        "source": "huggingface",
    }
