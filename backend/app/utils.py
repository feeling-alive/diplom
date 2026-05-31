"""Small shared helpers for the backend."""

from __future__ import annotations

import math
from typing import Any


def safe_float(value: Any, default: float = 0.0) -> float:
    """Coerce ``value`` to a finite float, falling back to ``default``.

    Guards against ``None``, non-numeric strings, and NaN/Infinity — the same
    class of bug fixed on the frontend (see useAssetPrice change% handling).
    """
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default
