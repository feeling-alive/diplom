// Admin users hook with filtering and mutations.

import { useCallback, useEffect, useState } from 'react'
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  patchAdminUser,
  type AdminUser,
  type AdminUsersResponse,
} from '../lib/adminApi'

export interface UseAdminUsersFilters {
  search?: string
  role?: string
}

export interface UseAdminUsersResult {
  data: AdminUsersResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  patchUser: (id: string, body: { role?: string; is_blocked?: boolean }) => Promise<AdminUser>
  deleteUser: (id: string) => Promise<void>
  createAdmin: (body: { email: string; username: string; password: string }) => Promise<AdminUser>
}

export function useAdminUsers(filters: UseAdminUsersFilters = {}, page: number = 1): UseAdminUsersResult {
  const [data, setData] = useState<AdminUsersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await getAdminUsers({ ...filters, page, limit: 20 })
      console.debug('[useAdminUsers] loaded page=%s', page)
      setData(response)
      setError(null)
    } catch (err) {
      console.warn('[useAdminUsers] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [filters, page])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await getAdminUsers({ ...filters, page, limit: 20 })
        if (!active) return
        console.debug('[useAdminUsers] loaded page=%s', page)
        setData(response)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useAdminUsers] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [page, filters.search, filters.role])  // eslint-disable-line react-hooks/exhaustive-deps

  const patchUser = useCallback(async (
    id: string,
    body: { role?: string; is_blocked?: boolean },
  ) => {
    console.debug('[useAdminUsers] patchUser id=%s', id)
    const updated = await patchAdminUser(id, body)
    await refetch()
    return updated
  }, [refetch])

  const deleteUser = useCallback(async (id: string) => {
    console.debug('[useAdminUsers] deleteUser id=%s', id)
    await deleteAdminUser(id)
    await refetch()
  }, [refetch])

  const createAdmin = useCallback(async (body: { email: string; username: string; password: string }) => {
    console.debug('[useAdminUsers] createAdmin email=%s', body.email)
    const created = await createAdminUser(body)
    await refetch()
    return created
  }, [refetch])

  return { data, isLoading, error, refetch, patchUser, deleteUser, createAdmin }
}
