// Admin logs hook with 60s auto-refresh.

import { useCallback, useEffect, useState } from 'react'
import {
  getAdminLogs,
  type AdminLogsResponse,
} from '../lib/adminApi'

export interface UseAdminLogsResult {
  data: AdminLogsResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const REFRESH_INTERVAL_MS = 60000

export function useAdminLogs(page: number = 1): UseAdminLogsResult {
  const [data, setData] = useState<AdminLogsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await getAdminLogs({ page, limit: 20 })
      console.debug('[useAdminLogs] loaded page=%s', page)
      setData(response)
      setError(null)
    } catch (err) {
      console.warn('[useAdminLogs] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await getAdminLogs({ page, limit: 20 })
        if (!active) return
        console.debug('[useAdminLogs] loaded page=%s', page)
        setData(response)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useAdminLogs] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [page])

  useEffect(() => {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const response = await getAdminLogs({ page, limit: 20 })
          console.debug('[useAdminLogs] auto-refresh page=%s', page)
          setData(response)
        } catch (err) {
          console.warn('[useAdminLogs] auto-refresh failed', err)
        }
      })()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [page])

  return { data, isLoading, error, refetch }
}
