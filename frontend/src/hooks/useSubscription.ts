// Subscription hook. Auth-backed (no `useMock` flag, same as useProfile). Wraps
// lib/profileApi.ts. After upgrade/cancel the local status is refreshed; the
// caller (e.g. ProfilePage) should also refetch the profile so the embedded
// ai_requests/limit and plan badge stay in sync — see the returned `refetch`.

import { useCallback, useEffect, useState } from 'react'
import {
  cancelSubscription as apiCancel,
  getSubscriptionStatus,
  upgradeSubscription as apiUpgrade,
  type SubscriptionStatus,
} from '../lib/profileApi'

export interface UseSubscriptionResult {
  data: SubscriptionStatus | null
  isLoading: boolean
  error: Error | null
  busy: boolean
  refetch: () => Promise<void>
  upgradeToPremium: () => Promise<void>
  cancel: () => Promise<void>
}

export function useSubscription(): UseSubscriptionResult {
  const [data, setData] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const status = await getSubscriptionStatus()
      console.debug('[useSubscription] loaded', status.plan)
      setData(status)
      setError(null)
    } catch (err) {
      console.warn('[useSubscription] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load. State is set only AFTER an await, so the effect never sets
  // state synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const status = await getSubscriptionStatus()
        if (!active) return
        console.debug('[useSubscription] loaded', status.plan)
        setData(status)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useSubscription] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const upgradeToPremium = useCallback(async () => {
    console.debug('[useSubscription] upgradeToPremium')
    setBusy(true)
    try {
      const status = await apiUpgrade()
      setData(status)
    } finally {
      setBusy(false)
    }
  }, [])

  const cancel = useCallback(async () => {
    console.debug('[useSubscription] cancel')
    setBusy(true)
    try {
      const status = await apiCancel()
      setData(status)
    } finally {
      setBusy(false)
    }
  }, [])

  return { data, isLoading, error, busy, refetch, upgradeToPremium, cancel }
}
