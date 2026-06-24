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
      // `id` is also stored so the session can be optimistically rehydrated on
      // reload (see readMirroredUser) — legacy readers simply ignore it.
      localStorage.setItem(
        LS_USER,
        JSON.stringify({
          id: user.id,
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

// Optimistically reconstruct the last-known user from the localStorage mirror so a
// page reload doesn't flash the login screen while /auth/me is still in flight (and
// stays signed in if the probe fails on a transient network error). Returns null
// when nothing usable is stored. The server probe is still the source of truth.
function readMirroredUser(): AuthUser | null {
  try {
    if (localStorage.getItem(LS_AUTH) !== 'true') return null
    const raw = localStorage.getItem(LS_USER)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser> & { nickname?: string }
    if (!parsed.id || !parsed.email) return null
    return {
      id: parsed.id,
      email: parsed.email,
      username: parsed.username ?? parsed.nickname ?? '',
      avatar_url: parsed.avatar_url ?? null,
      role: parsed.role ?? 'user',
    }
  } catch {
    return null
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
        // null == confirmed 401 → really log out.
        console.debug('[useAuth] no active session (401)')
        clearUser()
      }
    } catch (err) {
      // Transient/network error — keep the current user, do NOT clear (bug #2).
      console.warn('[useAuth] refresh failed (transient) — keeping session', err)
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
    if (fetchingRef.current) {
      console.debug('[useAuth] already fetching — skip duplicate init effect')
      return
    }
    fetchingRef.current = true
    // Optimistically restore the last-known session so reload doesn't flash /login
    // before the probe resolves; the server probe below corrects it if needed.
    const mirrored = readMirroredUser()
    if (mirrored) {
      console.debug('[useAuth] optimistic hydrate from mirror', mirrored.email)
      setUserState(mirrored)
    }
    void (async () => {
      try {
        const me = await apiMe()
        // NOTE: do NOT bail on `!active`. Under React StrictMode the first mount's
        // cleanup sets active=false while the second mount is skipped via fetchingRef —
        // bailing would DISCARD a valid /auth/me result and leave the user null,
        // bouncing authenticated users (especially Google login, which has no
        // localStorage mirror to fall back on) to /login. The provider is the app
        // root, so applying the result is safe.
        if (me) {
          console.debug('[useAuth] session active', me.email)
          setUserState(me)
          mirrorToStorage(me)
        } else {
          // null == confirmed 401 → drop the optimistic session.
          console.debug('[useAuth] no active session (401)')
          setUserState(null)
          mirrorToStorage(null)
        }
      } catch (err) {
        // Transient/network error — keep the optimistic session, do NOT clear (bug #2).
        console.warn('[useAuth] init failed (transient) — keeping session', err)
      } finally {
        fetchingRef.current = false
        // Unconditional: StrictMode double-mount leaves active=false on the
        // first closure, which would keep isLoading stuck at true forever.
        setIsLoading(false)
      }
    })()
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
