// Thin fetch wrappers around the backend /auth/* endpoints.
// All calls use credentials: 'include' so the HttpOnly access_token cookie is
// sent/stored. Requests go through the Vite proxy (/auth -> :8000), so they are
// same-origin from the browser's perspective.

export interface AuthUser {
  id: string
  email: string
  username: string
  avatar_url: string | null
  role: string
}

async function parseError(res: Response): Promise<string> {
  // FastAPI returns { detail: "..." } for HTTPException.
  try {
    const data = (await res.json()) as { detail?: unknown }
    if (typeof data.detail === 'string') return data.detail
  } catch {
    // non-JSON body
  }
  return `Ошибка ${res.status}`
}

export async function apiRegister(
  email: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  console.debug('[authApi] register', email, username)
  const res = await fetch('/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AuthUser
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  console.debug('[authApi] login', email)
  const res = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AuthUser
}

export async function apiForgotPassword(email: string): Promise<{ message: string }> {
  console.debug('[authApi] forgotPassword', email)
  const res = await fetch('/auth/forgot-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as { message: string }
}

export async function apiResetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ message: string }> {
  console.debug('[authApi] resetPassword', email, 'code present=', Boolean(code))
  const res = await fetch('/auth/reset-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as { message: string }
}

export async function apiLogout(): Promise<void> {
  console.debug('[authApi] logout')
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

// Resolve the current session.
//   - returns AuthUser  → session is valid
//   - returns null      → confirmed unauthenticated (HTTP 401)
//   - THROWS            → transient/unknown (network error or non-401 HTTP failure)
// Callers MUST treat a throw as "don't know" and keep the existing user — only a
// returned null means the user should be logged out. Conflating network errors with
// 401 was the root cause of getting kicked to /login on reload (bug #2).
export async function apiMe(): Promise<AuthUser | null> {
  let res: Response
  try {
    res = await fetch('/auth/me', { credentials: 'include' })
  } catch (err) {
    // Network failure / proxy down — transient, NOT a logout signal.
    console.warn('[authApi] /auth/me network error', err)
    throw err
  }
  if (res.status === 401) {
    console.debug('[authApi] /auth/me 401 — no session')
    return null
  }
  if (!res.ok) {
    // 5xx / proxy hiccup — transient, do not interpret as logged out.
    console.warn('[authApi] /auth/me failed', res.status)
    throw new Error(`/auth/me failed: ${res.status}`)
  }
  return (await res.json()) as AuthUser
}
