// Admin API keys hook with save and test mutations.

import { useCallback, useEffect, useState } from 'react'
import {
  getAdminApiKeys,
  saveAdminApiKeys,
  testAdminApiKey,
  type AdminApiKeyTestResult,
  type ApiKeyStatus,
} from '../lib/adminApi'

export interface UseAdminApiKeysResult {
  keys: ApiKeyStatus
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  saveKeys: (body: Record<string, string>) => Promise<void>
  testKey: (service: string) => Promise<AdminApiKeyTestResult>
  testingService: string | null
}

export function useAdminApiKeys(): UseAdminApiKeysResult {
  const [keys, setKeys] = useState<ApiKeyStatus>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [testingService, setTestingService] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAdminApiKeys()
      console.debug('[useAdminApiKeys] loaded %d keys', Object.keys(data).length)
      setKeys(data)
      setError(null)
    } catch (err) {
      console.warn('[useAdminApiKeys] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = await getAdminApiKeys()
        if (!active) return
        console.debug('[useAdminApiKeys] loaded %d keys', Object.keys(data).length)
        setKeys(data)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useAdminApiKeys] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const saveKeys = useCallback(async (body: Record<string, string>) => {
    console.debug('[useAdminApiKeys] saveKeys services=%o', Object.keys(body))
    await saveAdminApiKeys(body)
    await refetch()
  }, [refetch])

  const testKey = useCallback(async (service: string): Promise<AdminApiKeyTestResult> => {
    console.debug('[useAdminApiKeys] testKey service=%s', service)
    setTestingService(service)
    try {
      const result = await testAdminApiKey(service)
      console.debug('[useAdminApiKeys] testKey result=%o', result)
      return result
    } finally {
      setTestingService(null)
    }
  }, [])

  return { keys, isLoading, error, refetch, saveKeys, testKey, testingService }
}
