import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/storage'

export interface NotificationItem {
  id: string
  equipmentId: string
  equipmentName: string
  inspectionId: string
  status: 'warning' | 'critical' | string
  message: string
  read: boolean
  createdAt: string
}

const POLL_MS = 30_000

/**
 * Loads the current user's notifications and keeps them fresh: immediate fetch
 * on mount, a 30s poll, and a refetch whenever the tab regains focus. Fetches
 * the full recent list (read + unread) so the panel shows history; the unread
 * badge count is derived from it.
 */
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setItems(await apiFetch<NotificationItem[]>('/api/notifications'))
    } catch (err) {
      console.error('[notifications] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const interval = setInterval(() => void reload(), POLL_MS)
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  const unreadCount = items.reduce((n, item) => (item.read ? n : n + 1), 0)

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      try {
        await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      } catch (err) {
        console.error('[notifications] markRead failed', err)
        void reload()
      }
    },
    [reload],
  )

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' })
    } catch (err) {
      console.error('[notifications] markAllRead failed', err)
      void reload()
    }
  }, [reload])

  return { items, unreadCount, loading, reload, markRead, markAllRead }
}
