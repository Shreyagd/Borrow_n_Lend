import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useAsync } from '../lib/hooks'

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const { data, reload } = useAsync(() => api.notifications.list(), [])
  const unread = (data ?? []).filter((n) => !n.read_at).length

  useEffect(() => {
    const t = setInterval(reload, 30_000)
    return () => clearInterval(t)
  }, [reload])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-ghost btn-sm relative"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); if (!open) reload() }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-dark px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button className="text-xs font-medium text-pine underline" onClick={async () => { await api.notifications.markRead('all'); reload() }}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {(data ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-mute">No notifications yet.</li>}
            {(data ?? []).map((n) => (
              <li key={n.id}>
                <button
                  className={`block w-full px-4 py-3 text-left hover:bg-pine-light ${n.read_at ? '' : 'bg-clay-light/50'}`}
                  onClick={async () => {
                    setOpen(false)
                    if (!n.read_at) await api.notifications.markRead(n.id).catch(() => {})
                    reload()
                    if (n.link) nav(n.link)
                  }}
                >
                  <span className="block text-sm font-semibold">{n.title}</span>
                  {n.body && <span className="block text-sm text-ink-soft">{n.body}</span>}
                  <span className="block text-xs text-ink-mute">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
