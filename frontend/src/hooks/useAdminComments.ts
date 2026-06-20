// Admin comments hook with delete mutation and keyword search.

import { useCallback, useEffect, useState } from 'react'
import {
  deleteAdminComment,
  getAdminComments,
  type AdminCommentsResponse,
} from '../lib/adminApi'

export interface UseAdminCommentsResult {
  data: AdminCommentsResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  deleteComment: (id: string) => Promise<void>
}

export function useAdminComments(page: number = 1, q: string = ''): UseAdminCommentsResult {
  const [data, setData] = useState<AdminCommentsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await getAdminComments({ page, limit: 20, q: q || undefined })
      console.debug('[useAdminComments] loaded page=%s q=%s', page, q)
      setData(response)
      setError(null)
    } catch (err) {
      console.warn('[useAdminComments] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    let active = true
    void (async () => {
      setIsLoading(true)
      try {
        const response = await getAdminComments({ page, limit: 20, q: q || undefined })
        if (!active) return
        console.debug('[useAdminComments] loaded page=%s q=%s', page, q)
        setData(response)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useAdminComments] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, q])

  const deleteComment = useCallback(async (id: string) => {
    console.debug('[useAdminComments] deleteComment id=%s', id)
    await deleteAdminComment(id)
    await refetch()
  }, [refetch])

  return { data, isLoading, error, refetch, deleteComment }
}
