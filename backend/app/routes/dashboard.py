"""Dashboard layout persistence routes (prefix ``/dashboard``).

Stores the widget grid for the current user in :class:`DashboardConfig`
(one row per user, JSON ``layout`` column). The backend treats ``layout`` as an
opaque payload owned by the frontend — it only validates the coarse shape
(list of widgets, or the multi-dashboard ``{dashboards, activeId}`` envelope
introduced in Задача 7) and never inspects individual widget fields. The
frontend clamps widget sizes against its own registry on read.

``GET /dashboard/config`` seeds a sensible default layout (4 widgets) the first
time a user has no stored config, so a freshly registered user lands on a
populated dashboard instead of an empty grid. ``PUT /dashboard/config`` upserts
the layout.

All endpoints require authentication through :func:`get_current_user`; the
dependency raises 401 when the JWT cookie is missing or invalid.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import DashboardConfig, User

logger = logging.getLogger("backend.routes.dashboard")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Maximum number of widgets a single layout may contain. A generous cap that
# guards the JSON column against pathological payloads without constraining real
# usage (the widget registry has ~30 types).
MAX_WIDGETS = 100


# --- Schemas ----------------------------------------------------------------

class DashboardConfigResponse(BaseModel):
    """The persisted layout. ``layout`` mirrors the frontend widget array (or the
    multi-dashboard envelope); the backend stays agnostic to its inner shape."""

    layout: list | dict | None


class UpdateDashboardConfigRequest(BaseModel):
    """Payload for PUT ``/dashboard/config``."""

    layout: list | dict | None


# --- Default layout ---------------------------------------------------------

def _build_default_layout() -> list[dict]:
    """Seed layout matching the frontend ``createDefaultWidgets`` (4 widgets).

    Positions are precomputed to mirror the frontend's empty-slot packing so the
    server-seeded grid looks identical to a fresh client-side default.
    """
    specs = [
        # type,           x, y, w, h
        ("market_ticker", 0, 0, 3, 1),
        ("watchlist",     0, 1, 2, 2),
        ("allocation",    3, 0, 1, 2),
        ("price_chart",   2, 2, 2, 2),
    ]
    widgets: list[dict] = []
    for widget_type, x, y, w, h in specs:
        widgets.append(
            {
                "id": "w_" + uuid.uuid4().hex[:12],
                "type": widget_type,
                "size": {"w": w, "h": h, "label": f"{w}×{h}"},
                "x": x,
                "y": y,
                "w": w,
                "h": h,
            }
        )
    return widgets


# --- Helpers ----------------------------------------------------------------

async def _get_config(db: AsyncSession, user_id) -> DashboardConfig | None:
    """Load the user's dashboard config row (async-safe explicit query)."""
    return (
        await db.execute(
            select(DashboardConfig).where(DashboardConfig.user_id == user_id)
        )
    ).scalar_one_or_none()


def _validate_layout(layout: list | dict | None) -> None:
    """Reject obviously malformed payloads (oversized widget arrays)."""
    if isinstance(layout, list) and len(layout) > MAX_WIDGETS:
        logger.warning("[dashboard] layout rejected: %d widgets (> %d)", len(layout), MAX_WIDGETS)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Слишком много виджетов (макс. {MAX_WIDGETS})",
        )


# --- Routes -----------------------------------------------------------------

@router.get("/config", response_model=DashboardConfigResponse)
async def get_dashboard_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardConfigResponse:
    """Return the user's layout, seeding a default the first time it's missing."""
    config = await _get_config(db, current_user.id)
    if config is None:
        default_layout = _build_default_layout()
        config = DashboardConfig(user_id=current_user.id, layout=default_layout)
        db.add(config)
        await db.commit()
        await db.refresh(config)
        logger.info("[dashboard] seeded default layout for user=%s", current_user.id)
        return DashboardConfigResponse(layout=default_layout)

    count = len(config.layout) if isinstance(config.layout, list) else "envelope"
    logger.debug("[dashboard] get_config user=%s widgets=%s", current_user.id, count)
    return DashboardConfigResponse(layout=config.layout)


@router.put("/config", response_model=DashboardConfigResponse)
async def put_dashboard_config(
    payload: UpdateDashboardConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardConfigResponse:
    """Upsert the user's layout (create the row if absent, else overwrite)."""
    _validate_layout(payload.layout)

    config = await _get_config(db, current_user.id)
    if config is None:
        config = DashboardConfig(user_id=current_user.id, layout=payload.layout)
        db.add(config)
        logger.debug("[dashboard] put_config created row user=%s", current_user.id)
    else:
        config.layout = payload.layout
        logger.debug("[dashboard] put_config updated row user=%s", current_user.id)

    await db.commit()
    await db.refresh(config)
    return DashboardConfigResponse(layout=config.layout)
