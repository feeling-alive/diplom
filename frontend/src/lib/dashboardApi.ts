// Thin fetch wrappers around the backend /dashboard/config endpoints.
// Calls use credentials: 'include' so the HttpOnly access_token cookie is sent,
// and go through the Vite proxy (/dashboard -> :8000) → same-origin. Mirrors
// lib/profileApi.ts.
//
// Since Задача 7 the canonical shape is the multi-dashboard envelope. The backend
// also accepts a bare widget array (wrapped server-side) for backward compat.

import type { DashboardWidget } from '../types/widgets.types'

export interface DashboardEntry {
  id: string
  name: string
  layout: DashboardWidget[]
}

export interface DashboardEnvelope {
  dashboards: DashboardEntry[]
  activeId: string
}

// What the backend stores/returns under `layout`: the envelope (canonical), or a
// legacy bare array, or null.
export type DashboardLayout = DashboardWidget[] | DashboardEnvelope | null

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
  console.debug('[dashboardApi] putDashboardConfig')
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
