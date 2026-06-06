"""Tests for the PatchTST client: confidence gating + graceful fallbacks.

The HF call is mocked at ``httpx.AsyncClient.post``. The scaler is patched at the
patchtst boundary so these tests need no numpy/joblib.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services.patchtst import get_prediction

# Enough candles to fill any reasonable window; values are arbitrary.
_CANDLES = [{"c": 100.0 + i} for i in range(120)]


def _hf_response(url: str, scores: dict[str, float]) -> httpx.Response:
    payload = [[{"label": k, "score": v} for k, v in scores.items()]]
    return httpx.Response(200, json=payload, request=httpx.Request("POST", url))


def _mock_post(
    monkeypatch: pytest.MonkeyPatch,
    scores: dict[str, float],
    captured: dict[str, Any] | None = None,
) -> None:
    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        if captured is not None:
            captured.update(kwargs.get("json", {}))
        return _hf_response(url, scores)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


@pytest.fixture(autouse=True)
def _deterministic_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.hf_api_key", "test-key")
    monkeypatch.setattr("app.config.settings.prediction_confidence_threshold", 0.55)
    monkeypatch.setattr("app.config.settings.prediction_margin", 0.10)


async def test_confident_up(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_post(monkeypatch, {"UP": 0.80, "DOWN": 0.12, "SIDEWAYS": 0.08})
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "UP"
    assert res["low_confidence"] is False
    assert res["source"] == "huggingface"
    assert res["probability"] == pytest.approx(0.80)


async def test_weak_up_below_threshold_downgraded(monkeypatch: pytest.MonkeyPatch) -> None:
    # 0.51 < 0.55 threshold -> downgrade to low-confidence SIDEWAYS.
    _mock_post(monkeypatch, {"UP": 0.51, "DOWN": 0.30, "SIDEWAYS": 0.19})
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["low_confidence"] is True


async def test_small_margin_downgraded(monkeypatch: pytest.MonkeyPatch) -> None:
    # 0.58 >= threshold but margin 0.06 < 0.10 -> downgrade.
    _mock_post(monkeypatch, {"UP": 0.58, "DOWN": 0.52, "SIDEWAYS": 0.0})
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["low_confidence"] is True


async def test_genuine_sideways_not_low_confidence(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_post(monkeypatch, {"SIDEWAYS": 0.70, "UP": 0.20, "DOWN": 0.10})
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["low_confidence"] is False
    assert res["source"] == "huggingface"


async def test_missing_key_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.hf_api_key", "")
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["source"] == "missing_config"


async def test_no_candles_fallback() -> None:
    res = await get_prediction([], "BTC-USDT")
    assert res["source"] == "no_candle_data"
    assert res["prediction"] == "SIDEWAYS"


async def test_api_error_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        raise httpx.HTTPStatusError(
            "500", request=httpx.Request("POST", url), response=httpx.Response(500)
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    # Fallback stays distinguishable from a genuine model SIDEWAYS.
    assert res["source"] == "hf_api_error"


async def test_unexpected_response_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        return httpx.Response(200, json={"nonsense": True}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["source"] == "unexpected_response"


async def test_scaler_applied_to_inputs(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}
    _mock_post(monkeypatch, {"UP": 0.90, "DOWN": 0.05, "SIDEWAYS": 0.05}, captured)
    # Patch the scaler the same way features would, but deterministically (x2 per
    # cell of the 11-column feature matrix).
    monkeypatch.setattr(
        "app.services.patchtst.apply_scaler",
        lambda matrix: [[v * 2 for v in row] for row in matrix],
    )
    res = await get_prediction(
        [
            {"o": 10, "h": 10, "l": 10, "c": 10.0, "v": 1},
            {"o": 20, "h": 20, "l": 20, "c": 20.0, "v": 2},
        ],
        "BTC-USDT",
    )
    assert res["prediction"] == "UP"
    inputs = captured["inputs"]
    # inputs is now a 2D matrix: seq_len rows × 11 columns, each value doubled.
    assert isinstance(inputs, list) and isinstance(inputs[0], list)
    assert len(inputs[0]) == 11
    # close is column index 3; most recent real row close 20 * 2 = 40.
    assert inputs[-1][3] == 40.0
    # left-padded first row reuses the first real row close 10 * 2 = 20.
    assert inputs[0][3] == 20.0
