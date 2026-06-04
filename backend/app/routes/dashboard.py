"""Dashboard layout persistence routes (prefix ``/dashboard``).

Stores the widget grid(s) for the current user in :class:`DashboardConfig`
(one row per user, JSON ``layout`` column).

Since Задача 7 the canonical stored shape is a *multi-dashboard envelope*::

    {"dashboards": [{"id": str, "name": str, "layout": [...]}], "activeId": str}

Backward compatibility (Задача 1 → 7): a row may still hold a bare widget array
from before multi-dashboard existed. ``_normalize_to_envelope`` migrates that
(and a missing row) into the envelope on read, so the frontend always receives a
consistent structure. Individual widget objects remain opaque to the backend —
the frontend clamps them against its registry.

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

# Per-dashboard widget cap and per-user dashboard cap (Задача 7: «макс 5»).
MAX_WIDGETS = 100
MAX_DASHBOARDS = 5
DEFAULT_DASHBOARD_NAME = "Основной"


# --- Schemas ----------------------------------------------------------------

class DashboardConfigResponse(BaseModel):
    """The persisted layout, always normalized to the multi-dashboard envelope."""

    layout: dict


class UpdateDashboardConfigRequest(BaseModel):
    """Payload for PUT ``/dashboard/config``. Accepts the envelope, or — for
    backward compatibility — a bare widget array (wrapped server-side)."""

    layout: list | dict | None


# --- Default layout / envelope ----------------------------------------------

def _build_default_widgets() -> list[dict]:
    """New users start with an empty dashboard — they add widgets themselves."""
    return []


def _make_dashboard(name: str, layout: list) -> dict:
    return {"id": "d_" + uuid.uuid4().hex[:12], "name": name, "layout": layout}


def _default_envelope() -> dict:
    dash = _make_dashboard(DEFAULT_DASHBOARD_NAME, _build_default_widgets())
    return {"dashboards": [dash], "activeId": dash["id"]}


def _normalize_to_envelope(stored: list | dict | None) -> dict:
    """Coerce whatever is in the DB into the canonical envelope.

    * ``None``  → freshly seeded default envelope.
    * ``list``  → legacy single-dashboard array, wrapped as «Основной».
    * envelope  → returned as-is (with a defensive activeId fallback).
    """
    if stored is None:
        return _default_envelope()
    if isinstance(stored, list):
        dash = _make_dashboard(DEFAULT_DASHBOARD_NAME, stored)
        return {"dashboards": [dash], "activeId": dash["id"]}
    if isinstance(stored, dict) and isinstance(stored.get("dashboards"), list):
        dashboards = stored["dashboards"]
        active = stored.get("activeId")
        if not any(d.get("id") == active for d in dashboards):
            active = dashboards[0]["id"] if dashboards else None
        return {"dashboards": dashboards, "activeId": active}
    # Unknown shape — reset to a safe default rather than serve garbage.
    logger.warning("[dashboard] unrecognized stored layout, reseeding default")
    return _default_envelope()


# --- Helpers ----------------------------------------------------------------

async def _get_config(db: AsyncSession, user_id) -> DashboardConfig | None:
    return (
        await db.execute(
            select(DashboardConfig).where(DashboardConfig.user_id == user_id)
        )
    ).scalar_one_or_none()


def _validate_payload(layout: list | dict | None) -> None:
    """Validate the incoming layout (widget/dashboard caps, envelope shape)."""
    if isinstance(layout, list):
        if len(layout) > MAX_WIDGETS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Слишком много виджетов (макс. {MAX_WIDGETS})",
            )
        return

    if isinstance(layout, dict) and isinstance(layout.get("dashboards"), list):
        dashboards = layout["dashboards"]
        if len(dashboards) > MAX_DASHBOARDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Слишком много дашбордов (макс. {MAX_DASHBOARDS})",
            )
        if len(dashboards) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нужен хотя бы один дашборд",
            )
        for d in dashboards:
            if not isinstance(d, dict) or "id" not in d or "name" not in d or not isinstance(d.get("layout"), list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Каждый дашборд должен иметь id, name и layout[]",
                )
            if len(d["layout"]) > MAX_WIDGETS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Слишком много виджетов в «{d.get('name')}» (макс. {MAX_WIDGETS})",
                )


# --- Routes -----------------------------------------------------------------

@router.get("/config", response_model=DashboardConfigResponse)
async def get_dashboard_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardConfigResponse:
    """Return the user's layout as a normalized envelope, seeding on first access."""
    config = await _get_config(db, current_user.id)
    if config is None:
        envelope = _default_envelope()
        db.add(DashboardConfig(user_id=current_user.id, layout=envelope))
        await db.commit()
        logger.info("[dashboard] seeded default envelope for user=%s", current_user.id)
        return DashboardConfigResponse(layout=envelope)

    envelope = _normalize_to_envelope(config.layout)
    logger.debug(
        "[dashboard] get_config user=%s dashboards=%d active=%s",
        current_user.id, len(envelope["dashboards"]), envelope.get("activeId"),
    )
    return DashboardConfigResponse(layout=envelope)


@router.put("/config", response_model=DashboardConfigResponse)
async def put_dashboard_config(
    payload: UpdateDashboardConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardConfigResponse:
    """Upsert the user's layout (envelope, or a bare array wrapped server-side)."""
    _validate_payload(payload.layout)
    envelope = _normalize_to_envelope(payload.layout)

    config = await _get_config(db, current_user.id)
    if config is None:
        db.add(DashboardConfig(user_id=current_user.id, layout=envelope))
        logger.debug("[dashboard] put_config created row user=%s", current_user.id)
    else:
        config.layout = envelope
        logger.debug("[dashboard] put_config updated row user=%s", current_user.id)

    await db.commit()
    return DashboardConfigResponse(layout=envelope)
