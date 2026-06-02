// Thin fetch wrappers around the backend /users/* and /subscription/* endpoints.
// All calls use credentials: 'include' so the HttpOnly access_token cookie is
// sent. Requests go through the Vite proxy (/users, /subscription -> :8000), so
// they are same-origin from the browser's perspective. Mirrors lib/authApi.ts.

export type PlanId = 'free' | 'premium'

export interface SubscriptionInfo {
  plan: PlanId
  expires_at: string | null
  ai_requests_used: number
  ai_requests_limit: number
}

export interface ProfileData {
  id: string
  email: string
  username: string
  avatar_url: string | null
  role: string
  created_at: string
  subscription: SubscriptionInfo
}

export interface SubscriptionFeatures {
  ai_requests_per_day: number
  ai_requests_used_today: number
  advanced_charts: boolean
  export_data: boolean
  priority_updates: boolean
}

export interface SubscriptionStatus {
  plan: PlanId
  expires_at: string | null
  features: SubscriptionFeatures
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

// --- Subscription -----------------------------------------------------------

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  console.debug('[profileApi] getSubscriptionStatus')
  const res = await fetch('/subscription/status', { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as SubscriptionStatus
}

export async function upgradeSubscription(): Promise<SubscriptionStatus> {
  console.debug('[profileApi] upgradeSubscription')
  const res = await fetch('/subscription/upgrade', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as SubscriptionStatus
}

export async function cancelSubscription(): Promise<SubscriptionStatus> {
  console.debug('[profileApi] cancelSubscription')
  const res = await fetch('/subscription/cancel', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as SubscriptionStatus
}
