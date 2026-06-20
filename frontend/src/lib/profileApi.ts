// Thin fetch wrappers around the backend /users/* endpoints. All calls use
// credentials: 'include' so the HttpOnly access_token cookie is sent. Requests
// go through the Vite proxy (/users -> :8000), so they are same-origin from the
// browser's perspective. Mirrors lib/authApi.ts.

export interface ProfileData {
  id: string
  email: string
  username: string
  avatar_url: string | null
  role: string
  created_at: string
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

// --- Profile ----------------------------------------------------------------

export async function getProfile(): Promise<ProfileData> {
  console.debug('[profileApi] getProfile')
  const res = await fetch('/users/me', { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as ProfileData
}

export async function updateUsername(username: string): Promise<ProfileData> {
  console.debug('[profileApi] updateUsername', username)
  const res = await fetch('/users/me', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as ProfileData
}

export async function checkUsername(username: string): Promise<boolean> {
  console.debug('[profileApi] checkUsername', username)
  const res = await fetch(
    `/users/me/check-username?username=${encodeURIComponent(username)}`,
    { credentials: 'include' },
  )
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as { available: boolean }
  return data.available
}

export async function uploadAvatar(file: File): Promise<string> {
  console.debug('[profileApi] uploadAvatar', file.name, file.size)
  const form = new FormData()
  form.append('file', file)
  // NB: do not set Content-Type manually — the browser adds the multipart boundary.
  const res = await fetch('/users/me/avatar', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as { avatar_url: string }
  return data.avatar_url
}
