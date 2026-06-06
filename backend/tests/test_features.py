"""Tests for feature preparation: OHLCV extraction, indicators, the 11-column
feature matrix, and scaler normalisation with graceful fallbacks.

These are pure-function tests (no network, no async). numpy/sklearn are present
in the dev env, so the fit_transform fallback path is exercised for real.
"""

from __future__ import annotations

import pytest

from app.services.features import (
    FEATURE_ORDER,
    apply_scaler,
    build_feature_matrix,
    compute_indicators,
    extract_ohlcv,
)


# ---------------------------------------------------------------------------
# extract_ohlcv
# ---------------------------------------------------------------------------


def test_extract_ohlcv_dict_candles() -> None:
    candles = [
        {"o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 100},
        {"o": 1.5, "h": 3, "l": 1, "c": 2.5, "v": 200},
    ]
    cols = extract_ohlcv(candles)
    assert cols["open"] == [1.0, 1.5]
    assert cols["close"] == [1.5, 2.5]
    assert cols["volume"] == [100.0, 200.0]


def test_extract_ohlcv_list_candles() -> None:
    # OKX raw shape: [ts, o, h, l, c, v, ...]
    candles = [
        [1700000000000, 1, 2, 0.5, 1.5, 100],
        [1700000060000, 1.5, 3, 1, 2.5, 200],
    ]
    cols = extract_ohlcv(candles)
    assert cols["high"] == [2.0, 3.0]
    assert cols["close"] == [1.5, 2.5]
    assert cols["volume"] == [100.0, 200.0]


def test_extract_ohlcv_skips_broken_and_empty() -> None:
    assert extract_ohlcv([]) == {
        "open": [],
        "high": [],
        "low": [],
        "close": [],
        "volume": [],
    }
    # "garbage" (not dict/list) and a too-short list are skipped.
    cols = extract_ohlcv([{"o": 1, "h": 1, "l": 1, "c": 1, "v": 1}, "garbage", [1, 2]])
    assert len(cols["close"]) == 1


# ---------------------------------------------------------------------------
# compute_indicators
# ---------------------------------------------------------------------------


def test_compute_indicators_ranges_and_lengths() -> None:
    closes = [100 + i * 0.5 for i in range(60)]
    ohlcv = {
        "open": closes,
        "high": [c + 1 for c in closes],
        "low": [c - 1 for c in closes],
        "close": closes,
        "volume": [10.0] * 60,
    }
    ind = compute_indicators(ohlcv)
    n = len(closes)
    for key in ("rsi", "macd", "macd_signal", "macd_hist", "bb_width", "bb_pos"):
        assert len(ind[key]) == n, key
    assert all(0.0 <= x <= 100.0 for x in ind["rsi"])
    assert all(0.0 <= x <= 1.0 for x in ind["bb_pos"])


def test_compute_indicators_short_input_neutral() -> None:
    ohlcv = {
        "open": [1.0, 2.0],
        "high": [1.0, 2.0],
        "low": [1.0, 2.0],
        "close": [1.0, 2.0],
        "volume": [1.0, 1.0],
    }
    ind = compute_indicators(ohlcv)
    assert ind["rsi"] == [50.0, 50.0]  # warmup -> neutral RSI
    assert len(ind["bb_pos"]) == 2
    assert all(0.0 <= x <= 1.0 for x in ind["bb_pos"])


# ---------------------------------------------------------------------------
# build_feature_matrix
# ---------------------------------------------------------------------------


def test_build_feature_matrix_shape_and_order() -> None:
    candles = [
        {"o": 1 + i, "h": 2 + i, "l": 0.5 + i, "c": 1.5 + i, "v": 100 + i}
        for i in range(30)
    ]
    seq_len = 10
    matrix = build_feature_matrix(candles, seq_len)
    assert len(matrix) == seq_len
    assert len(FEATURE_ORDER) == 11
    assert all(len(row) == 11 for row in matrix)
    # Column order: open, high, low, close, volume are the first five columns.
    last = matrix[-1]
    assert last[0] == 30.0  # open  = 1   + 29
    assert last[1] == 31.0  # high  = 2   + 29
    assert last[3] == 30.5  # close = 1.5 + 29
    assert last[4] == 129.0  # volume = 100 + 29


def test_build_feature_matrix_left_pad_short() -> None:
    candles = [
        {"o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 100},
        {"o": 2, "h": 3, "l": 1, "c": 2.5, "v": 200},
    ]
    matrix = build_feature_matrix(candles, 5)
    assert len(matrix) == 5
    # Padding rows are copies of the first real row.
    assert matrix[0] == matrix[1] == matrix[2]


def test_build_feature_matrix_empty() -> None:
    assert build_feature_matrix([], 10) == []


# ---------------------------------------------------------------------------
# apply_scaler
# ---------------------------------------------------------------------------


def test_apply_scaler_fit_transform_fallback_when_no_scaler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # No scaler.pkl -> standardise on the fly (fit_transform fallback).
    monkeypatch.setattr("app.services.features.load_scaler", lambda: None)
    matrix = [[float(i + j) for j in range(11)] for i in range(20)]
    out = apply_scaler(matrix)
    assert len(out) == 20
    assert len(out[0]) == 11
    # Each column is standardised -> mean ~ 0.
    col0 = [row[0] for row in out]
    assert abs(sum(col0) / len(col0)) < 1e-6


def test_apply_scaler_degrades_on_shape_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class BadScaler:
        def transform(self, arr: object) -> object:
            raise ValueError("X has 11 features, but StandardScaler expects 1")

    monkeypatch.setattr("app.services.features.load_scaler", lambda: BadScaler())
    matrix = [[1.0] * 11 for _ in range(5)]
    out = apply_scaler(matrix)
    assert out == matrix  # unchanged — degraded to raw features


def test_apply_scaler_empty_returns_empty() -> None:
    assert apply_scaler([]) == []
