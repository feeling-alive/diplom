"""Tests for the local PatchTST inference: confidence gating + graceful fallbacks.

The torch inference is mocked at the ``_patchtst_predict`` boundary — these
tests exercise the hybrid blend + confidence gate deterministically without
needing the model weights on disk.
"""

from __future__ import annotations

import pytest

from app.services.patchtst import _combine_signals, _rule_based_signal, get_prediction

# Enough candles to fill any reasonable window; values are arbitrary.
_CANDLES = [{"c": 100.0 + i} for i in range(120)]


def _mock_predict(
    monkeypatch: pytest.MonkeyPatch,
    prob_up: float,
    prob_down: float,
    available: bool = True,
) -> None:
    monkeypatch.setattr(
        "app.services.patchtst._patchtst_predict",
        lambda candles: (prob_up, prob_down, available),
    )


@pytest.fixture(autouse=True)
def _deterministic_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.prediction_confidence_threshold", 0.55)
    monkeypatch.setattr("app.config.settings.prediction_margin", 0.03)
    # Neutralise the rule-based signal by default so the confidence-gate tests
    # below exercise the gate deterministically. With rule_score=0 the hybrid
    # maps the model UP probability p to combined_up = 0.6*p + 0.2. Tests that
    # need a real / specific rule score re-patch this within the test. Returns
    # the (rule_score, indicator_details) tuple shape the real function returns.
    monkeypatch.setattr("app.services.patchtst._rule_based_signal", lambda candles: (0.0, {}))


async def test_confident_up(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_predict(monkeypatch, 0.80, 0.20)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "UP"
    assert res["low_confidence"] is False
    assert res["source"] == "local"
    # With the neutral rule (rule_score=0): combined_up = 0.6*0.80 + 0.2 = 0.68.
    assert res["probability"] == pytest.approx(0.68)
    # The original model UP probability is preserved in patchtst_prob.
    assert res["patchtst_prob"] == pytest.approx(0.80)


async def test_near_tie_reported_sideways(monkeypatch: pytest.MonkeyPatch) -> None:
    # combined_up = 0.6*0.51 + 0.2 = 0.506: |UP-DOWN| = 0.012 < 0.03 margin ->
    # no detectable edge, reported as SIDEWAYS (flagged low_confidence).
    _mock_predict(monkeypatch, 0.51, 0.49)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["low_confidence"] is True


async def test_weak_direction_kept_with_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    # combined_up = 0.6*0.58 + 0.2 = 0.548: margin 0.096 >= 0.03 so the UP
    # direction is KEPT; probability 0.548 < 0.55 only raises the flag.
    _mock_predict(monkeypatch, 0.58, 0.42)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "UP"
    assert res["low_confidence"] is True
    assert res["probability"] == pytest.approx(0.548)


async def test_weak_down_kept_with_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    # Mirror case: combined_up = 0.6*0.42 + 0.2 = 0.452 -> DOWN 0.548 with
    # margin 0.096 -> direction kept, flagged low_confidence.
    _mock_predict(monkeypatch, 0.42, 0.58)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "DOWN"
    assert res["low_confidence"] is True
    assert res["probability"] == pytest.approx(0.548)


async def test_neutral_model_gives_low_confidence_sideways(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # A flat 50/50 call is an exact tie (margin 0 < 0.03) -> SIDEWAYS with the
    # low_confidence flag (probability 0.5 < 0.55 threshold).
    _mock_predict(monkeypatch, 0.50, 0.50)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["low_confidence"] is True
    assert res["source"] == "local"


async def test_model_unavailable_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    # Missing weights / short history inside _patchtst_predict -> neutral fallback
    # that stays distinguishable from a gated model SIDEWAYS.
    _mock_predict(monkeypatch, 0.5, 0.5, available=False)
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["prediction"] == "SIDEWAYS"
    assert res["source"] == "model_unavailable"
    assert res["low_confidence"] is True


async def test_no_candles_fallback() -> None:
    res = await get_prediction([], "BTC-USDT")
    assert res["source"] == "no_candle_data"
    assert res["prediction"] == "SIDEWAYS"


# ---------------------------------------------------------------------------
# Hybrid signal: _rule_based_signal (pure function, no network)
# ---------------------------------------------------------------------------


def _ohlcv_candles(closes: list[float]) -> list[dict[str, float]]:
    return [{"o": c, "h": c, "l": c, "c": float(c), "v": 1.0} for c in closes]


def test_rule_signal_uptrend_positive() -> None:
    # Steady rise: bullish MACD + bullish MA trend dominate the overbought RSI.
    score, _ = _rule_based_signal(_ohlcv_candles([100 + i for i in range(60)]))
    assert score > 0.0


def test_rule_signal_downtrend_negative() -> None:
    # Steady decline: oversold RSI is outweighed by bearish MACD + MA trend.
    score, _ = _rule_based_signal(_ohlcv_candles([100 - i for i in range(60)]))
    assert score < 0.0


def test_rule_signal_flat_is_neutral() -> None:
    score, _ = _rule_based_signal(_ohlcv_candles([50.0] * 60))
    assert score == 0.0


def test_rule_signal_empty_is_neutral() -> None:
    score, details = _rule_based_signal([])
    assert score == 0.0
    assert details == {}


def test_rule_signal_in_range() -> None:
    for closes in ([100 + i for i in range(60)], [100 - i for i in range(60)]):
        score, _ = _rule_based_signal(_ohlcv_candles(closes))
        assert -1.0 <= score <= 1.0


def test_rule_signal_returns_indicator_details() -> None:
    # Steady decline → oversold RSI, bearish trend, negative price-vs-SMA20.
    _, details = _rule_based_signal(_ohlcv_candles([200 - i for i in range(60)]))
    assert set(details) == {
        "rsi", "rsi_zone", "macd_cross", "macd_position", "trend", "price_vs_sma20",
        "atr", "volume_zscore",
    }
    assert details["rsi_zone"] == "перепродан"
    assert details["trend"] == "нисходящий"
    assert details["macd_position"] == "ниже сигнальной"
    assert isinstance(details["rsi"], float)
    assert details["price_vs_sma20"] < 0  # price below its SMA20 in a decline
    # ATR / volume z-score are informational LLM-only fields (not in the model input).
    assert isinstance(details["atr"], (int, float))
    assert isinstance(details["volume_zscore"], (int, float))


def test_rule_signal_short_history_safe_details() -> None:
    # < 20 candles: SMA20 unavailable → safe degraded details, no div-by-zero.
    _, details = _rule_based_signal(_ohlcv_candles([100.0, 101.0, 102.0]))
    assert details["trend"] == "смешанный"
    assert details["price_vs_sma20"] == 0.0


# ---------------------------------------------------------------------------
# Hybrid signal: _combine_signals (pure function)
# ---------------------------------------------------------------------------


def test_combine_agree_boosts_confidence() -> None:
    up, down = _combine_signals(0.8, 0.6)  # both bullish -> agree
    baseline_up = 0.6 * 0.8 + 0.4 * ((0.6 + 1) / 2)
    assert up > 0.5
    assert up >= baseline_up  # boosted by agreement
    assert up <= 0.85
    assert up + down == pytest.approx(1.0)


def test_combine_disagree_no_boost() -> None:
    # PatchTST bullish (0.7) vs rule bearish (-0.6) -> disagree, no boost.
    up, down = _combine_signals(0.7, -0.6)
    expected_up = 0.6 * 0.7 + 0.4 * ((-0.6 + 1) / 2)
    assert up == pytest.approx(expected_up)
    assert up + down == pytest.approx(1.0)


def test_combine_clamps_to_range() -> None:
    up, _ = _combine_signals(0.99, 0.99)
    assert 0.15 <= up <= 0.85


# ---------------------------------------------------------------------------
# Hybrid integration: get_prediction exposes the new fields
# ---------------------------------------------------------------------------


async def test_prediction_exposes_hybrid_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_predict(monkeypatch, 0.80, 0.20)
    details = {"rsi": 42.0, "rsi_zone": "нейтральная зона", "trend": "восходящий"}
    monkeypatch.setattr("app.services.patchtst._rule_based_signal", lambda candles: (0.5, details))
    res = await get_prediction(_CANDLES, "BTC-USDT")
    assert res["patchtst_prob"] == pytest.approx(0.80)
    assert res["rule_score"] == pytest.approx(0.5)
    assert res["signals_agree"] is True  # model UP + rule UP
    assert res["prediction"] == "UP"
    assert res["indicator_details"] == details
    assert res["source"] == "local"


async def test_neutral_fallback_has_hybrid_defaults() -> None:
    res = await get_prediction([], "BTC-USDT")
    assert res["patchtst_prob"] == 0.5
    assert res["rule_score"] == 0.0
    assert res["signals_agree"] is False
    assert res["indicator_details"] == {}
