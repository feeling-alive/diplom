// Profile data hook. Unlike the market-data hooks, this is an auth-backed
// resource, so it does NOT take a `useMock` flag — it follows the auth feature's
// precedent (authApi / AuthContext are also mock-free). Single channel to the
// backend is lib/profileApi.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkUsername as apiCheckUsername,
  getProfile,
  updateUsername as apiUpdateUsername,
  uploadAvatar as apiUploadAvatar,
  type ProfileData,
} from '../lib/profileApi'

export interface UsernameCheck {
  checking: boolean
  available: boolean | null // null = not checked yet / empty input
}

export interface UseProfileResult {
  data: ProfileData | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  updateUsername: (username: string) => Promise<ProfileData>
  uploadAvatar: (file: File) => Promise<string>
  usernameCheck: UsernameCheck
  checkUsernameDebounced: (username: string) => void
}

const CHECK_DEBOUNCE_MS = 500

export function useProfile(): UseProfileResult {
  const [data, setData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>({
    checking: false,
    available: null,
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const profile = await getProfile()
      console.debug('[useProfile] loaded', profile.username)
      setData(profile)
      setError(null)
    } catch (err) {
      console.warn('[useProfile] load failed', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load. Mirrors AuthContext: state is only set AFTER an await, so the
  // effect never sets state synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const profile = await getProfile()
        if (!active) return
        console.debug('[useProfile] loaded', profile.username)
        setData(profile)
        setError(null)
      } catch (err) {
        if (active) {
          console.warn('[useProfile] load failed', err)
          setError(err as Error)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => {
      active = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const updateUsername = useCallback(async (username: string) => {
    console.debug('[useProfile] updateUsername', username)
    const updated = await apiUpdateUsername(username)
    setData(updated)
    return updated
  }, [])

  const uploadAvatar = useCallback(async (file: File) => {
    console.debug('[useProfile] uploadAvatar', file.name)
    const avatarUrl = await apiUploadAvatar(file)
    setData((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev))
    return avatarUrl
  }, [])

  const checkUsernameDebounced = useCallback(
    (username: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      // The current username is always "available" and needs no round-trip.
      if (!username || username === data?.username) {
        setUsernameCheck({ checking: false, available: null })
        return
      }

      setUsernameCheck({ checking: true, available: null })
      debounceRef.current = setTimeout(async () => {
        try {
          const available = await apiCheckUsername(username)
          console.debug('[useProfile] checkUsername', username, available)
          setUsernameCheck({ checking: false, available })
        } catch (err) {
          console.warn('[useProfile] checkUsername failed', err)
          setUsernameCheck({ checking: false, available: null })
        }
      }, CHECK_DEBOUNCE_MS)
    },
    [data?.username],
  )

  return {
    data,
    isLoading,
    error,
    refetch,
    updateUsername,
    uploadAvatar,
    usernameCheck,
    checkUsernameDebounced,
  }
}
