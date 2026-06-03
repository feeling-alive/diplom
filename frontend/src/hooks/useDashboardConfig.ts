// Owns the multi-dashboard envelope and its persistence source (Задача 1 + 7):
//   • authenticated user → backend (/dashboard/config, GET seeds a default),
//     mirrored into localStorage as an offline cache;
//   • guest → localStorage only.
//
// `widgets` / `mutate` operate on the ACTIVE dashboard so existing Dashboard grid
// code is unchanged. Dashboard-level actions (switch/add/remove/rename) edit the
// envelope. Backend writes are debounced so a drag/resize burst collapses into one
// PUT.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDashboardConfig, putDashboardConfig, type DashboardEnvelope } from '../lib/dashboardApi'
import {
  MAX_DASHBOARDS,
  createDefaultEnvelope,
  makeDashboard,
  normalizeToEnvelope,
  loadLocalEnvelope,
  saveLocalEnvelope,
} from '../lib/dashboardLayout'
import type { DashboardWidget } from '../types/widgets.types'

type Source = 'local' | 'backend'

const PUT_DEBOUNCE_MS = 600

function loadLocalOrSeed(): DashboardEnvelope {
  const saved = loadLocalEnvelope()
  if (saved) return saved
  const env = createDefaultEnvelope()
  saveLocalEnvelope(env)
  return env
}

export interface UseDashboardConfig {
  widgets: DashboardWidget[]
  isLoading: boolean
  /** Functional updater for the ACTIVE dashboard's widgets; persists the envelope. */
  mutate: (fn: (prev: DashboardWidget[]) => DashboardWidget[]) => void
  dashboards: { id: string; name: string }[]
  activeId: string
  canAddDashboard: boolean
  switchDashboard: (id: string) => void
  addDashboard: (name: string) => void
  removeDashboard: (id: string) => void
  renameDashboard: (id: string, name: string) => void
}

export function useDashboardConfig(): UseDashboardConfig {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [envelope, setEnvelope] = useState<DashboardEnvelope>(() => createDefaultEnvelope())
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
          const env = normalizeToEnvelope(layout)
          sourceRef.current = 'backend'
          setEnvelope(env)
          saveLocalEnvelope(env)
          console.debug('[useDashboardConfig] loaded from backend, dashboards=%d', env.dashboards.length)
        } catch (err) {
          if (!active) return
          console.warn('[useDashboardConfig] backend load failed, fallback localStorage:', err)
          sourceRef.current = 'local'
          setEnvelope(loadLocalOrSeed())
        }
      } else {
        sourceRef.current = 'local'
        setEnvelope(loadLocalOrSeed())
        console.debug('[useDashboardConfig] guest — loaded from localStorage')
      }
      if (active) setIsLoading(false)
    })()

    return () => { active = false }
  }, [authLoading, isAuthenticated])

  const persist = useCallback((env: DashboardEnvelope) => {
    saveLocalEnvelope(env) // always refresh the offline cache
    if (sourceRef.current !== 'backend') return
    if (putTimer.current) clearTimeout(putTimer.current)
    putTimer.current = setTimeout(() => {
      putDashboardConfig(env).catch((err) =>
        console.warn('[useDashboardConfig] backend PUT failed (cached locally):', err),
      )
    }, PUT_DEBOUNCE_MS)
  }, [])

  // Apply an envelope transform, persist the result.
  const updateEnvelope = useCallback((fn: (prev: DashboardEnvelope) => DashboardEnvelope) => {
    setEnvelope((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [persist])

  const mutate = useCallback((fn: (prev: DashboardWidget[]) => DashboardWidget[]) => {
    updateEnvelope((env) => ({
      ...env,
      dashboards: env.dashboards.map((d) =>
        d.id === env.activeId ? { ...d, layout: fn(d.layout) } : d,
      ),
    }))
  }, [updateEnvelope])

  const switchDashboard = useCallback((id: string) => {
    updateEnvelope((env) =>
      env.dashboards.some((d) => d.id === id) ? { ...env, activeId: id } : env,
    )
  }, [updateEnvelope])

  const addDashboard = useCallback((name: string) => {
    updateEnvelope((env) => {
      if (env.dashboards.length >= MAX_DASHBOARDS) return env
      const dash = makeDashboard(name.trim() || `Дашборд ${env.dashboards.length + 1}`, [])
      console.debug('[useDashboardConfig] add dashboard %s', dash.name)
      return { dashboards: [...env.dashboards, dash], activeId: dash.id }
    })
  }, [updateEnvelope])

  const removeDashboard = useCallback((id: string) => {
    updateEnvelope((env) => {
      if (env.dashboards.length <= 1) return env // never delete the last one
      const dashboards = env.dashboards.filter((d) => d.id !== id)
      const activeId = env.activeId === id ? dashboards[0].id : env.activeId
      console.debug('[useDashboardConfig] remove dashboard %s', id)
      return { dashboards, activeId }
    })
  }, [updateEnvelope])

  const renameDashboard = useCallback((id: string, name: string) => {
    updateEnvelope((env) => ({
      ...env,
      dashboards: env.dashboards.map((d) =>
        d.id === id ? { ...d, name: name.trim() || d.name } : d,
      ),
    }))
  }, [updateEnvelope])

  // Flush any pending debounced PUT on unmount.
  useEffect(() => () => {
    if (putTimer.current) clearTimeout(putTimer.current)
  }, [])

  const active = useMemo(
    () => envelope.dashboards.find((d) => d.id === envelope.activeId) ?? envelope.dashboards[0],
    [envelope],
  )

  return {
    widgets: active?.layout ?? [],
    isLoading,
    mutate,
    dashboards: envelope.dashboards.map((d) => ({ id: d.id, name: d.name })),
    activeId: envelope.activeId,
    canAddDashboard: envelope.dashboards.length < MAX_DASHBOARDS,
    switchDashboard,
    addDashboard,
    removeDashboard,
    renameDashboard,
  }
}
