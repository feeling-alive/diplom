// Thin fetch wrappers around the backend /dashboard/config endpoints.
// Calls use credentials: 'include' so the HttpOnly access_token cookie is sent,
// and go through the Vite proxy (/dashboard -> :8000) → same-origin. Mirrors
// lib/profileApi.ts.
//
// The `layout` payload is treated opaquely on the wire (array of widgets now, or
// the multi-dashboard envelope later — Задача 7). Callers own the shape.

import type { DashboardWidget } from '../types/widgets.types'

// What the backend stores/returns under `layout`. A plain widget array today;
// `unknown`-friendly object envelope is reserved for the multi-dashboard work.
export type DashboardLayout = DashboardWidget[] | Record<string, unknown> | null

interface DashboardConfigResponse {
  layout: DashboardLayout
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown }
    if (typeof data.detail === 'string') return data.detail
  } catch {
    // non-JSON body
  }
  return `Ошибка ${res.status}`
}

export async function getDashboardConfig(): Promise<DashboardLayout> {
  console.debug('[dashboardApi] getDashboardConfig')
  const res = await fetch('/dashboard/config', { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as DashboardConfigResponse
  return data.layout
}

export async function putDashboardConfig(layout: DashboardLayout): Promise<DashboardLayout> {
  console.debug('[dashboardApi] putDashboardConfig', Array.isArray(layout) ? `${layout.length} widgets` : 'envelope')
  const res = await fetch('/dashboard/config', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as DashboardConfigResponse
  return data.layout
}
