import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell, CheckCheck, BellOff } from 'lucide-react'
import { StatusBadge } from './ui/StatusBadge'
import { useNotifications, type NotificationItem } from '../hooks/useNotifications'
import type { StatusLevel } from '../types'

export function NotificationBell({ onNavigate }: { onNavigate: (inspectionId: string) => void }) {
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleClick = (n: NotificationItem) => {
    if (!n.read) void markRead(n.id)
    setOpen(false)
    onNavigate(n.inspectionId)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[--color-graphite-100] bg-white text-[--color-graphite-500] transition-colors hover:text-[--color-graphite-900]"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[--color-status-critical] px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-scale-in absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-[--color-graphite-100] bg-white shadow-[0_20px_50px_rgba(18,24,31,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-[--color-graphite-100] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[--color-graphite-900]">Notifications</p>
              <p className="text-xs text-[--color-graphite-500]">{unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Tout est à jour'}</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[--color-brand-600] transition-colors hover:bg-[--color-brand-50]"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Tout lire
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[--color-graphite-500]">Chargement…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <BellOff className="h-6 w-6 text-[--color-graphite-300]" />
                <p className="text-sm font-medium text-[--color-graphite-700]">Aucune notification</p>
                <p className="text-xs text-[--color-graphite-500]">Les alertes d'équipement apparaîtront ici.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[--color-graphite-100]">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[--color-graphite-50] ${n.read ? '' : 'bg-[--color-brand-50]/50'}`}
                    >
                      <span className="mt-0.5">
                        {!n.read && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[--color-brand-600] align-middle" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[--color-graphite-900]">{n.equipmentName}</p>
                          <StatusBadge status={n.status as StatusLevel} compact />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[--color-graphite-600]">{n.message}</p>
                        <p className="mt-1 text-[11px] text-[--color-graphite-400]">
                          {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
