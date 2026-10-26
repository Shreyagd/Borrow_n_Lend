import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { EmptyState, ErrorState, Field, LoadingState, StatusChip } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { api } from '../../lib/api'
import { dateShort } from '../../lib/format'
import { useAsync, usePageMeta } from '../../lib/hooks'
import type { Report, Settings } from '../../lib/types'

const tabs: [string, string, boolean?][] = [
  ['/admin', 'Overview', true], ['/admin/reports', 'Reports'], ['/admin/users', 'Users'], ['/admin/listings', 'Listings'],
  ['/admin/rentals', 'Rentals'], ['/admin/orders', 'Orders'], ['/admin/settings', 'Settings'],
]

export function AdminLayout() {
  usePageMeta('Admin')
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl">Admin</h1>
      <p className="mt-1 text-sm text-ink-soft">All actions here are authorised on the server; hiding this page is not what protects it.</p>
      <nav aria-label="Admin" className="-mx-4 mb-6 mt-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {tabs.map(([to, label, end]) => (
            <li key={to}><NavLink to={to} end={end} className={({ isActive }) =>
              `block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium no-underline ${isActive ? 'border-pine text-pine-dark' : 'border-transparent text-ink-soft hover:text-ink'}`}>{label}</NavLink></li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}

function Row({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </li>
  )
}

function Async<T>({ res, children, empty }: { res: ReturnType<typeof useAsync<T[]>>; children: (d: T[]) => ReactNode; empty: string }) {
  if (res.loading && !res.data) return <LoadingState />
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />
  if (!res.data || res.data.length === 0) return <EmptyState title={empty} />
  return <ul className="space-y-2">{children(res.data)}</ul>
}

export function AdminOverview() {
  const { fmt } = useSettings()
  const res = useAsync(() => api.admin.stats(), [])
  if (res.loading) return <LoadingState />
  if (res.error || !res.data) return <ErrorState message={res.error ?? 'No data'} onRetry={res.reload} />
  const s = res.data
  const tiles: [string, string | number][] = [
    ['Users', s.users], ['Suspended users', s.suspended_users], ['Live listings', s.listings], ['Hidden listings', s.hidden_listings],
    ['Open reports', s.open_reports], ['Completed volume', fmt(s.gross_volume)], ['Platform fees (completed)', fmt(s.platform_fees)],
  ]
  const group = (title: string, m: Record<string, number>) => (
    <div className="card p-4"><h2 className="mb-2 text-lg">{title}</h2>
      {Object.keys(m).length === 0 ? <p className="text-sm text-ink-mute">None yet.</p> : (
        <ul className="flex flex-wrap gap-2">{Object.entries(m).map(([k, n]) => <li key={k} className="flex items-center gap-1.5 text-sm"><StatusChip status={k} /> {n}</li>)}</ul>)}
    </div>
  )
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([l, v]) => <li key={l} className="card p-4"><p className="font-sans text-2xl font-bold">{v}</p><p className="text-sm text-ink-soft">{l}</p></li>)}
      </ul>
      <div className="grid gap-3 md:grid-cols-2">{group('Rentals by status', s.rentals)}{group('Orders by status', s.orders)}</div>
      <p className="text-xs text-ink-mute">“Volume” counts completed transactions only. It is the agreed price, not money processed by BorrowLend (payments are manual in the pilot).</p>
    </div>
  )
}

export function AdminUsers() {
  const { user } = useAuth()
  const toast = useToast()
  const res = useAsync(() => api.admin.users(), [])
  return (
    <Async res={res} empty="No users">
      {(users) => users.map((u) => (
        <Row key={u.id} actions={u.id !== user?.id && (
          <button className={u.suspended ? 'btn-secondary btn-sm' : 'btn-danger btn-sm'} onClick={async () => {
            try { await api.admin.setUserSuspended(u.id, !u.suspended); toast(u.suspended ? 'User restored.' : 'User suspended.'); res.reload() }
            catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error') }
          }}>{u.suspended ? 'Restore' : 'Suspend'}</button>
        )}>
          <p className="font-semibold">{u.display_name} {u.role === 'admin' && <span className="chip bg-pine-light text-pine-dark">admin</span>} {u.suspended && <span className="chip bg-red-100 text-red-800">suspended</span>}</p>
          <p className="text-ink-mute">{u.city ?? 'No city'} · joined {dateShort(u.created_at)} · <span className="font-mono text-xs">{u.id.slice(0, 8)}</span></p>
        </Row>
      ))}
    </Async>
  )
}

export function AdminListings() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const res = useAsync(() => api.admin.listings(), [])
  const mod = async (id: string, v: { hidden?: boolean; flagged?: boolean }, msg: string) => {
    try { await api.admin.setListingModeration(id, v); toast(msg); res.reload() } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error') }
  }
  const filtered = res.data?.filter((l) => !q || `${l.title} ${l.author} ${l.owner?.display_name}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-3">
      <label className="sr-only" htmlFor="adm-lq">Filter listings</label>
      <input id="adm-lq" className="input max-w-sm" placeholder="Filter by title, author or owner" value={q} onChange={(e) => setQ(e.target.value)} />
      <Async res={{ ...res, data: filtered ?? null }} empty="No listings">
        {(ls) => ls.map((l) => (
          <Row key={l.id} actions={<>
            <Link className="btn-secondary btn-sm no-underline" to={`/books/${l.id}`}>View</Link>
            <button className="btn-secondary btn-sm" onClick={() => mod(l.id, { flagged: !l.flagged }, l.flagged ? 'Flag cleared.' : 'Listing flagged.')}>{l.flagged ? 'Unflag' : 'Flag'}</button>
            <button className={l.hidden ? 'btn-secondary btn-sm' : 'btn-danger btn-sm'} onClick={() => mod(l.id, { hidden: !l.hidden }, l.hidden ? 'Listing visible again.' : 'Listing hidden.')}>{l.hidden ? 'Unhide' : 'Hide'}</button>
          </>}>
            <p className="font-semibold">{l.title} <span className="font-normal text-ink-mute">by {l.author}</span></p>
            <p className="text-ink-mute">Owner: {l.owner?.display_name ?? '—'} · {dateShort(l.created_at)}</p>
            <p className="mt-1 flex flex-wrap gap-1.5"><StatusChip status={l.status} />{l.hidden && <span className="chip bg-red-100 text-red-800">hidden</span>}{l.flagged && <span className="chip bg-amber-100 text-amber-900">flagged</span>}{l.is_sample && <span className="chip bg-stone-200">sample</span>}</p>
          </Row>
        ))}
      </Async>
    </div>
  )
}

export function AdminRentals() {
  const { fmt } = useSettings()
  const res = useAsync(() => api.admin.rentals(), [])
  return (
    <Async res={res} empty="No rentals yet">
      {(rs) => rs.map((r) => (
        <Row key={r.id}>
          <p className="font-semibold">{r.listing?.title ?? 'Listing'} <StatusChip status={r.status} /></p>
          <p className="text-ink-mute">{r.borrower?.display_name} ← {r.owner?.display_name} · {r.period_days} days · {fmt(r.rental_amount)} (fee {fmt(r.platform_fee)}) · {dateShort(r.created_at)}{r.due_date ? ` · due ${dateShort(r.due_date)}` : ''}</p>
        </Row>
      ))}
    </Async>
  )
}

export function AdminOrders() {
  const { fmt } = useSettings()
  const res = useAsync(() => api.admin.orders(), [])
  return (
    <Async res={res} empty="No orders yet">
      {(os) => os.map((o) => (
        <Row key={o.id}>
          <p className="font-semibold">{o.listing?.title ?? 'Listing'} <StatusChip status={o.status} /></p>
          <p className="text-ink-mute">{o.buyer?.display_name} ← {o.seller?.display_name} · {fmt(o.total_amount)} (fee {fmt(o.platform_fee)}) · {dateShort(o.created_at)}</p>
        </Row>
      ))}
    </Async>
  )
}

function ReportRow({ r, onDone }: { r: Report; onDone: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState('')
  const [busy, setBusy] = useState(false)
  const outcomes = r.target_type === 'rental'
    ? [['active', 'Back to active loan'], ['completed', 'Mark completed (returned)'], ['cancelled', 'Cancel rental']]
    : [['accepted', 'Back to accepted'], ['completed', 'Mark completed'], ['cancelled', 'Cancel order']]
  const resolve = async (status: 'resolved' | 'dismissed') => {
    setBusy(true)
    try { await api.admin.resolveReport(r.id, status, note, outcome || undefined); toast(status === 'resolved' ? 'Report resolved.' : 'Report dismissed.'); onDone() }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error') }
    finally { setBusy(false) }
  }
  return (
    <li className="card space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${r.kind === 'dispute' ? 'bg-red-100 text-red-800' : 'bg-stone-200 text-stone-800'}`}>{r.kind}</span>
        <StatusChip status={r.status} />
        <span className="font-semibold">{r.reason}</span>
        <span className="text-ink-mute">· {r.target_type} · by {r.reporter?.display_name ?? 'user'} · {dateShort(r.created_at)}</span>
      </div>
      {r.details && <p className="whitespace-pre-line text-ink-soft">{r.details}</p>}
      {r.target_type === 'listing' && <Link to={`/books/${r.target_id}`}>View reported listing →</Link>}
      {r.status !== 'open' ? (
        <p className="text-ink-mute">Closed{r.resolution_note ? `: ${r.resolution_note}` : '.'}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {r.kind === 'dispute' && (
            <Field label="Outcome for the disputed transaction" htmlFor={`o-${r.id}`}>
              <select id={`o-${r.id}`} className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="">Choose…</option>
                {outcomes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          )}
          <Field label="Resolution note" htmlFor={`n-${r.id}`}>
            <input id={`n-${r.id}`} className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => resolve('resolved')}>Mark resolved</button>
            <button className="btn-secondary btn-sm" disabled={busy} onClick={() => resolve('dismissed')}>Dismiss</button>
          </div>
        </div>
      )}
    </li>
  )
}

export function AdminReports() {
  const res = useAsync(() => api.admin.reports(), [])
  const sorted = res.data ? [...res.data].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open')) : null
  if (res.loading && !res.data) return <LoadingState />
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />
  if (!sorted?.length) return <EmptyState title="No reports or disputes" />
  return <ul className="space-y-3">{sorted.map((r) => <ReportRow key={r.id} r={r} onDone={res.reload} />)}</ul>
}

export function AdminSettings() {
  const { settings, reload } = useSettings()
  const toast = useToast()
  const [v, setV] = useState<Settings>(settings)
  useEffect(() => setV(settings), [settings])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!(v.commission_pct >= 0 && v.commission_pct <= 50)) return setErr('Commission must be between 0 and 50.')
    if (!/^[A-Z]{3}$/.test(v.currency)) return setErr('Currency must be a 3-letter code such as INR or USD.')
    setBusy(true)
    try { await api.admin.updateSettings(v); await reload(); toast('Settings saved.') }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not save.') }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="card max-w-lg space-y-4 p-5">
      <Field label="Platform commission (%)" htmlFor="st-c" hint="Deducted from the owner’s earnings on completed transactions. Snapshotted onto each new request. The default 10% is a development assumption.">
        <input id="st-c" type="number" step="0.5" min={0} max={50} className="input" value={v.commission_pct} onChange={(e) => setV({ ...v, commission_pct: Number(e.target.value) })} />
      </Field>
      <Field label="Currency (ISO code)" htmlFor="st-cur">
        <input id="st-cur" className="input" maxLength={3} value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Launch city / area" htmlFor="st-city" hint="Shown on the home page.">
        <input id="st-city" className="input" maxLength={80} value={v.launch_city} onChange={(e) => setV({ ...v, launch_city: e.target.value })} />
      </Field>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button className="btn-primary" disabled={busy}>Save settings</button>
    </form>
  )
}
