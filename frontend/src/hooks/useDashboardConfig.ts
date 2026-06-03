// Owns dashboard widget state and its persistence source:
//   • authenticated user → backend (/dashboard/config, GET seeds a default),
//     mirrored into localStorage as an offline cache;
//   • guest → localStorage only (seed defaults on first visit, respect an
//     empty grid once the user has cleared everything).
//
// Mutations go through `mutate(fn)` (a functional updater, like setState) which
// persists to the active source. Backend writes are debounced so a drag/resize
// burst collapses into one PUT.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDashboardConfig, putDashboardConfig } from '../lib/dashboardApi'
import {
  clampWidgets,
  createDefaultWidgets,
  loadLocalWidgets,
  saveLocalWidgets,
} from '../lib/dashboardLayout'
import type { DashboardWidget } from '../types/widgets.types'

type Source = 'local' | 'backend'

const PUT_DEBOUNCE_MS = 600

// Coerce a backend `layout` payload into a widget array. A plain array is
// clamped; anything else (null / multi-dashboard envelope, handled later) seeds
// the default grid so the user never lands on a broken empty dashboard.
function coerceBackendLayout(layout: unknown): DashboardWidget[] {
  if (Array.isArray(layout)) return clampWidgets(layout as DashboardWidget[])
  console.debug('[useDashboardConfig] backend layout not an array — seeding defaults')
  return createDefaultWidgets()
}

// Guest source: saved widgets, or a freshly seeded (and persisted) default the
// very first time. `null` from loadLocalWidgets means "no key" → seed; `[]`
// means "user cleared all" → respect.
function loadLocalOrSeed(): DashboardWidget[] {
  const saved = loadLocalWidgets()
  if (saved !== null) return saved
  const defaults = createDefaultWidgets()
  saveLocalWidgets(defaults)
  return defaults
}

export interface UseDashboardConfig {
  widgets: DashboardWidget[]
  isLoading: boolean
  /** Functional updater; persists the result to the active source. */
  mutate: (fn: (prev: DashboardWidget[]) => DashboardWidget[]) => void
}

export function useDashboardConfig(): UseDashboardConfig {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const sourceRef = useRef<Source>('local')
  const putTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load, re-run when the auth state resolves/changes.
  useEffect(() => {
    if (authLoading) return
    let active = true

    void (async () => {
      if (isAuthenticated) {
        try {
          const layout = await getDashboardConfig()
          if (!active) return
          const w = coerceBackendLayout(layout)
          sourceRef.current = 'backend'
          setWidgets(w)
          saveLocalWidgets(w) // keep the offline cache fresh
          console.debug('[useDashboardConfig] loaded from backend, widgets=%d', w.length)
        } catch (err) {
          if (!active) return
          console.warn('[useDashboardConfig] backend load failed, falling back to localStorage:', err)
          sourceRef.current = 'local'
          setWidgets(loadLocalOrSeed())
        }
      } else {
        sourceRef.current = 'local'
        setWidgets(loadLocalOrSeed())
        console.debug('[useDashboardConfig] guest — loaded from localStorage')
      }
      if (active) setIsLoading(false)
    })()

    return () => {
      active = false
    }
  }, [authLoading, isAuthenticated])

  const persist = useCallback((next: DashboardWidget[]) => {
    // Always refresh the localStorage cache (offline fallback for backed users).
    saveLocalWidgets(next)
    if (sourceRef.current !== 'backend') return

    if (putTimer.current) clearTimeout(putTimer.current)
    putTimer.current = setTimeout(() => {
      putDashboardConfig(next).catch((err) =>
        console.warn('[useDashboardConfig] backend PUT failed (cached locally):', err),
      )
    }, PUT_DEBOUNCE_MS)
  }, [])

  const mutate = useCallback((fn: (prev: DashboardWidget[]) => DashboardWidget[]) => {
    setWidgets((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [persist])

  // Flush any pending debounced PUT on unmount.
  useEffect(() => () => {
    if (putTimer.current) clearTimeout(putTimer.current)
  }, [])

  return { widgets, isLoading, mutate }
}
