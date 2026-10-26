import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="presentation"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-pine/30 border-t-pine ${className}`}
    />
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-ink-soft">
      <Spinner /> <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card mx-auto my-6 max-w-lg px-6 py-10 text-center">
      <p className="font-sans text-xl font-bold">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto my-6 max-w-lg rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry && <button className="btn-secondary mt-4" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <button className="btn-ghost btn-sm -mr-2 -mt-1" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const CHIP: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-900',
  accepted: 'bg-sky-100 text-sky-900',
  active: 'bg-pine-light text-pine-dark',
  return_requested: 'bg-sky-100 text-sky-900',
  completed: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-stone-200 text-stone-700',
  cancelled: 'bg-stone-200 text-stone-700',
  overdue: 'bg-red-100 text-red-800',
  disputed: 'bg-red-100 text-red-800',
  paused: 'bg-stone-200 text-stone-700',
  unavailable: 'bg-clay-light text-clay-dark',
  removed: 'bg-stone-200 text-stone-700',
  open: 'bg-amber-100 text-amber-900',
  resolved: 'bg-emerald-100 text-emerald-900',
  dismissed: 'bg-stone-200 text-stone-700',
  pending: 'bg-amber-100 text-amber-900',
  received: 'bg-emerald-100 text-emerald-900',
}
export function StatusChip({ status, label }: { status: string; label?: string }) {
  return <span className={`chip ${CHIP[status] ?? 'bg-stone-200 text-stone-700'}`}>{label ?? status.replace(/_/g, ' ')}</span>
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
      <span className="text-sm text-ink-soft">Page {page} of {pages}</span>
      <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
    </nav>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {children}
    </div>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="mb-4 inline-block text-sm font-medium">← {children}</Link>
}
