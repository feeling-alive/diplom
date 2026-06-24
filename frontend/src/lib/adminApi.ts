// Admin API functions with native fetch + credentials, following authApi.ts pattern.
// All functions log with console.debug('[adminApi] ...').

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown }
    if (typeof data.detail === 'string') return data.detail
  } catch {
    /* non-JSON */
  }
  return `Ошибка ${res.status}`
}

export interface AdminStats {
  total_users: number
  new_users_7d: number
  total_news: number
  last_news_fetch: string | null
  // Extended metrics (bug #3)
  active_users: number
  blocked_users: number
  total_comments: number
  total_reactions: number
  ai_chat_sessions: number
  last_activity: string | null
}

export interface AdminUser {
  id: string
  username: string
  email: string
  role: string
  avatar_url: string | null
  created_at: string
  is_active: boolean
  last_login: string | null
}

export interface AdminUsersResponse {
  items: AdminUser[]
  total: number
}

export interface AdminCommentReply {
  id: string
  text: string
  author: { username: string; avatar_url: string | null }
  created_at: string
}

export interface AdminComment {
  id: string
  text: string
  author: { username: string; avatar_url: string | null }
  article_url: string
  article_id: string | null
  created_at: string
  replies: AdminCommentReply[]
}

export interface AdminCommentsResponse {
  items: AdminComment[]
  total: number
}

export interface AdminLog {
  id: string
  admin_username: string
  action: string
  target_type: string
  target_id: string
  details: string | null
  created_at: string
}

export interface AdminLogsResponse {
  items: AdminLog[]
  total: number
}

export type ApiKeyStatus = Record<string, string>

export interface AdminApiKeyTestResult {
  success: boolean
  message: string
}

export async function getAdminStats(): Promise<AdminStats> {
  console.debug('[adminApi] getAdminStats')
  const res = await fetch('/admin/stats', { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminStats
}

export async function getAdminUsers(params: {
  search?: string
  role?: string
  page?: number
  limit?: number
}): Promise<AdminUsersResponse> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.role) q.set('role', params.role)
  if (params.page != null) q.set('page', String(params.page))
  if (params.limit != null) q.set('limit', String(params.limit))
  console.debug('[adminApi] getAdminUsers', Object.fromEntries(q))
  const res = await fetch(`/admin/users?${q}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminUsersResponse
}

export async function patchAdminUser(
  id: string,
  body: { role?: string; is_blocked?: boolean },
): Promise<AdminUser> {
  console.debug('[adminApi] patchAdminUser id=%s body=%o', id, body)
  const res = await fetch(`/admin/users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminUser
}

export async function deleteAdminUser(id: string): Promise<void> {
  console.debug('[adminApi] deleteAdminUser id=%s', id)
  const res = await fetch(`/admin/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function createAdminUser(body: {
  email: string
  username: string
  password: string
}): Promise<AdminUser> {
  console.debug('[adminApi] createAdminUser email=%s', body.email)
  const res = await fetch('/admin/users/create-admin', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminUser
}

export async function getAdminComments(params: {
  page?: number
  limit?: number
  q?: string
}): Promise<AdminCommentsResponse> {
  const qs = new URLSearchParams()
  if (params.page != null) qs.set('page', String(params.page))
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.q) qs.set('q', params.q)
  console.debug('[adminApi] getAdminComments page=%s q=%s', params.page, params.q)
  const res = await fetch(`/admin/comments?${qs}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminCommentsResponse
}

export async function deleteAdminComment(id: string): Promise<void> {
  console.debug('[adminApi] deleteAdminComment id=%s', id)
  const res = await fetch(`/admin/comments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getAdminApiKeys(): Promise<ApiKeyStatus> {
  console.debug('[adminApi] getAdminApiKeys')
  const res = await fetch('/admin/api-keys', { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as ApiKeyStatus
}

export async function saveAdminApiKeys(body: Record<string, string>): Promise<void> {
  console.debug('[adminApi] saveAdminApiKeys services=%o', Object.keys(body))
  const res = await fetch('/admin/api-keys', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function testAdminApiKey(
  service: string,
  key?: string,
): Promise<AdminApiKeyTestResult> {
  // Send the typed key when the admin entered one; otherwise send an empty body
  // so the backend tests the resolved key (DB→.env).
  console.debug('[adminApi] testAdminApiKey service=%s typed=%s', service, Boolean(key))
  const res = await fetch(`/admin/api-keys/test/${service}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key ?? '' }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminApiKeyTestResult
}

export async function getAdminLogs(params: {
  page?: number
  limit?: number
}): Promise<AdminLogsResponse> {
  const q = new URLSearchParams()
  if (params.page != null) q.set('page', String(params.page))
  if (params.limit != null) q.set('limit', String(params.limit))
  console.debug('[adminApi] getAdminLogs page=%s', params.page)
  const res = await fetch(`/admin/logs?${q}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AdminLogsResponse
}
