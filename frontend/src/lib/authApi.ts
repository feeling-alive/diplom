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

export async function apiLogout(): Promise<void> {
  console.debug('[authApi] logout')
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

export async function apiMe(): Promise<AuthUser | null> {
  const res = await fetch('/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) {
    console.warn('[authApi] /auth/me failed', res.status)
    return null
  }
  return (await res.json()) as AuthUser
}
