import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'

export interface AppNotification {
  id: string
  type: 'comment_reply' | 'reaction'
  message: string
  link: string
  is_read: boolean
  created_at: string
  sender_username: string | null
  sender_avatar_url: string | null
}

export function useNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) throw new Error(`notifications ${res.status}`)
      const data: AppNotification[] = await res.json()
      console.debug('[useNotifications] fetched count=%d unread=%d', data.length, data.filter(n => !n.is_read).length)
      return data
    },
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 30_000,
  })

  const unreadCount = query.data?.filter(n => !n.is_read).length ?? 0

  async function markAllRead() {
    console.debug('[useNotifications] markAllRead')
    await fetch('/api/notifications/read-all', { method: 'POST' })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function markRead(notifId: string) {
    console.debug('[useNotifications] markRead id=%s', notifId)
    await fetch(`/api/notifications/${notifId}/read`, { method: 'POST' })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return { ...query, unreadCount, markAllRead, markRead }
}
