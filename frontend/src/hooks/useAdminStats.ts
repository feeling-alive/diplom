// Admin stats hook with 60s auto-refresh.

import { useCallback, useEffect, useState } from 'react'
import {
  getAdminStats,
  type AdminStats,
} from '../lib/adminApi'

export interface UseAdminStatsResult {
  data: AdminStats | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const REFRESH_INTERVAL_MS = 60000

export function useAdminStats(): UseAdminStatsResult {
  const [data, setData] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const stats = await getAdminStats()
      console.debug('[useAdminStats] loaded')
      setData(stats)
      setError(null)
    } catch (err) {
      console.warn('[useAdminStats] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const stats = await getAdminStats()
        if (!active) return
        console.debug('[useAdminStats] loaded')
        setData(stats)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useAdminStats] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const stats = await getAdminStats()
          console.debug('[useAdminStats] auto-refresh')
          setData(stats)
        } catch (err) {
          console.warn('[useAdminStats] auto-refresh failed', err)
        }
      })()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return { data, isLoading, error, refetch }
}
