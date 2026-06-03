// Pure helpers for the dashboard widget grid: id generation, empty-slot packing,
// size clamping against the registry, the default seed layout, and the
// localStorage cache. Extracted from Dashboard.tsx so both the page and
// useDashboardConfig (backend ↔ localStorage source switch) share one source of
// truth — no duplicated clamp/migration logic.

import { WIDGET_REGISTRY } from '../constants/widgets.registry'
import type { DashboardWidget, WidgetType, WidgetSize } from '../types/widgets.types'

export const COLS = 4
const STORAGE_KEY = 'fintrack_widgets_v4'
const LEGACY_STORAGE_KEYS = ['fintrack_widgets_v2', 'fintrack_widgets']
// v3 is migrated (not purged): kpi_portfolio -> market_ticker.
const V3_MIGRATION_KEY = 'fintrack_widgets_v3'

export function generateId(): string {
  return 'w_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function findEmptySlot(
  existing: DashboardWidget[], cols: number, w: number, h: number,
): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 }

  const occupied = new Set<string>()
  for (const ew of existing) {
    for (let cy = ew.y; cy < ew.y + ew.h; cy++) {
      for (let cx = ew.x; cx < ew.x + ew.w; cx++) {
        occupied.add(`${cx},${cy}`)
      }
    }
  }

  const maxY = existing.reduce((m, ew) => Math.max(m, ew.y + ew.h), 0) + h
  for (let row = 0; row <= maxY; row++) {
    for (let col = 0; col <= cols - w; col++) {
      let free = true
      for (let dy = 0; dy < h && free; dy++) {
        for (let dx = 0; dx < w && free; dx++) {
          if (occupied.has(`${col + dx},${row + dy}`)) free = false
        }
      }
      if (free) return { x: col, y: row }
    }
  }

  return { x: 0, y: maxY }
}

// Clamp every widget's w/h into its registry-declared [min,max] bounds and drop
// entries whose type is unknown to this build. Guards against stale localStorage
// or a backend layout produced by a different widget set.
export function clampWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets
    .filter((w) => WIDGET_REGISTRY.some((r) => r.type === w.type))
    .map((w) => {
      const def = WIDGET_REGISTRY.find((r) => r.type === w.type)
      if (!def) return w
      const cw = Math.min(Math.max(def.minW, w.w), def.maxW)
      const ch = Math.min(Math.max(def.minH, w.h), def.maxH)
      if (cw !== w.w || ch !== w.h) {
        console.debug('[dashboardLayout] clamp widget %s %dx%d -> %dx%d', w.type, w.w, w.h, cw, ch)
      }
      return { ...w, w: cw, h: ch }
    })
}

export function createDefaultWidgets(): DashboardWidget[] {
  const defaults: { type: WidgetType; size: WidgetSize }[] = [
    { type: 'market_ticker', size: { w: 3, h: 1, label: '3×1' } },
    { type: 'watchlist', size: { w: 2, h: 2, label: '2×2' } },
    { type: 'allocation', size: { w: 1, h: 2, label: '1×2' } },
    { type: 'price_chart', size: { w: 2, h: 2, label: '2×2' } },
  ]
  const result: DashboardWidget[] = []
  for (const d of defaults) {
    const pos = findEmptySlot(result, COLS, d.size.w, d.size.h)
    result.push({
      id: generateId(),
      type: d.type,
      size: d.size,
      x: pos.x, y: pos.y,
      w: d.size.w, h: d.size.h,
    })
  }
  return result
}

// --- localStorage cache -----------------------------------------------------

// Returns the saved widgets, or `null` when no config key exists at all.
// IMPORTANT: `null` (no key → seed defaults) is distinct from `[]` (user cleared
// everything → respect the empty grid). Conflating them makes "clear all" snap
// back to defaults on reload.
export function loadLocalWidgets(): DashboardWidget[] | null {
  try {
    for (const k of LEGACY_STORAGE_KEYS) {
      if (localStorage.getItem(k)) {
        console.debug('[dashboardLayout] purging legacy localStorage key %s', k)
        localStorage.removeItem(k)
      }
    }
  } catch { /* ignore */ }

  // one-time v3 -> v4 migration: rename kpi_portfolio to market_ticker.
  try {
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(V3_MIGRATION_KEY)) {
      const v3raw = localStorage.getItem(V3_MIGRATION_KEY)
      if (v3raw) {
        const v3 = JSON.parse(v3raw) as DashboardWidget[]
        if (Array.isArray(v3)) {
          const migrated = v3.map((w) => {
            if ((w.type as unknown) === 'kpi_portfolio') {
              console.debug('[dashboardLayout] migrating kpi_portfolio -> market_ticker (v3 -> v4)')
              return { ...w, type: 'market_ticker' as WidgetType }
            }
            return w
          })
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        }
      }
      localStorage.removeItem(V3_MIGRATION_KEY)
    }
  } catch (err) {
    console.warn('[dashboardLayout] v3 -> v4 migration failed:', err)
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as DashboardWidget[]
      if (Array.isArray(parsed)) return clampWidgets(parsed)
    }
  } catch { /* ignore */ }
  return null
}

export function saveLocalWidgets(widgets: DashboardWidget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
  } catch (err) {
    console.warn('[dashboardLayout] saveLocalWidgets failed:', err)
  }
}
