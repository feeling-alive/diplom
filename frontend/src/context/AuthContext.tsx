// Auth session via React Context (the one cross-cutting global state allowed by
// ARCHITECTURE for the auth user). Replaces the old mock-localStorage auth.
//
// Back-compat: the provider MIRRORS state into the legacy localStorage keys
// (`fintrack_is_authenticated`, `fintrack_user`) because components we are asked
// NOT to touch (AppSidebar display, AdminRoute, ProfilePage) still read them.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { apiLogout, apiMe, type AuthUser } from '../lib/authApi'

const LS_AUTH = 'fintrack_is_authenticated'
const LS_USER = 'fintrack_user'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: AuthUser) => void
  updateUser: (partial: Partial<AuthUser>) => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mirrorToStorage(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(LS_AUTH, 'true')
      // Keep `username` for new readers and `nickname` for legacy ones.
      localStorage.setItem(
        LS_USER,
        JSON.stringify({
          nickname: user.username,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
        }),
      )
    } else {
      localStorage.removeItem(LS_AUTH)
      localStorage.removeItem(LS_USER)
    }
  } catch {
    // storage may be unavailable (private mode) — non-fatal
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Guard against concurrent apiMe() calls (e.g. React StrictMode double-mount in dev
  // fires the init useEffect twice, sending two /auth/me requests simultaneously).
  const fetchingRef = useRef(false)

  const setUser = useCallback((next: AuthUser) => {
    console.debug('[useAuth] setUser', next.email)
    setUserState(next)
    mirrorToStorage(next)
  }, [])

  // Patch a few fields (e.g. username/avatar_url after a profile edit) without a
  // round-trip to /auth/me. Context-native analogue of the Redux `updateUser`
  // requested in the spec — keeps the sidebar/header in sync instantly.
  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    console.debug('[useAuth] updateUser', partial)
    setUserState((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...partial }
      mirrorToStorage(next)
      return next
    })
  }, [])

  const clearUser = useCallback(() => {
    setUserState(null)
    mirrorToStorage(null)
  }, [])

  const refresh = useCallback(async () => {
    if (fetchingRef.current) {
      console.debug('[useAuth] already fetching — skip duplicate refresh()')
      return
    }
    fetchingRef.current = true
    setIsLoading(true)
    try {
      const me = await apiMe()
      if (me) {
        console.debug('[useAuth] session active', me.email)
        setUserState(me)
        mirrorToStorage(me)
      } else {
        console.debug('[useAuth] no active session')
        clearUser()
      }
    } catch (err) {
      console.warn('[useAuth] refresh failed', err)
      clearUser()
    } finally {
      fetchingRef.current = false
      setIsLoading(false)
    }
  }, [clearUser])

  const logout = useCallback(async () => {
    console.debug('[useAuth] logout')
    try {
      await apiLogout()
    } catch (err) {
      console.warn('[useAuth] logout request failed', err)
    } finally {
      clearUser()
    }
  }, [clearUser])

  // Initial session probe on mount. All setState calls happen AFTER an await, so
  // this does not synchronously set state within the effect body.
  useEffect(() => {
    let active = true
    if (fetchingRef.current) {
      console.debug('[useAuth] already fetching — skip duplicate init effect')
      return
    }
    fetchingRef.current = true
    void (async () => {
      try {
        const me = await apiMe()
        if (!active) return
        if (me) {
          console.debug('[useAuth] session active', me.email)
          setUserState(me)
          mirrorToStorage(me)
        } else {
          console.debug('[useAuth] no active session')
          setUserState(null)
          mirrorToStorage(null)
        }
      } catch (err) {
        if (active) {
          console.warn('[useAuth] init failed', err)
          setUserState(null)
          mirrorToStorage(null)
        }
      } finally {
        fetchingRef.current = false
        if (active) setIsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    setUser,
    updateUser,
    logout,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
}
