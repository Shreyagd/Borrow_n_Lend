import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BookCover } from '../components/BookCover'
import { PaymentNotice, PriceBreakdown } from '../components/PriceBreakdown'
import { ReportDialog } from '../components/ReportDialog'
import { BackLink, EmptyState, ErrorState, LoadingState, Modal, Spinner, StatusChip } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { conditionLabel } from '../lib/constants'
import { dateShort } from '../lib/format'
import { useAsync, usePageMeta } from '../lib/hooks'
import { addDays, rentalBreakdown, saleBreakdown, todayISO } from '../lib/rules'

export default function BookDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { fmt, settings } = useSettings()
  const toast = useToast()
  const nav = useNavigate()
  const loc = useLocation()
  const res = useAsync(() => api.listings.get(id), [id])
  const l = res.data
  const rating = useAsync(() => (l ? api.profiles.rating(l.owner_id) : Promise.resolve(null)), [l?.owner_id])
  const [img, setImg] = useState(0)
  const [days, setDays] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<'rent' | 'buy' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(false)

  usePageMeta(l ? `${l.title} by ${l.author}` : 'Book', l ? `${l.title} by ${l.author}. ${l.description ?? ''}`.trim() : undefined)
  useEffect(() => { if (l && days == null && l.rental_period_options.length) setDays(l.rental_period_options[0]) }, [l, days])

  if (res.loading) return <LoadingState label="Loading book…" />
  if (res.error) return <div className="container-page py-8"><ErrorState message={res.error} onRetry={res.reload} /></div>
  if (!l) {
    return (
      <div className="container-page py-8">
        <EmptyState title="Book not found" action={<Link to="/browse" className="btn-primary no-underline text-white">Browse books</Link>}>
          This listing may have been removed or is not available.
        </EmptyState>
      </div>
    )
  }

  const isOwner = user?.id === l.owner_id
  const canRent = l.listing_type !== 'sale' && l.rental_price != null
  const canBuy = l.listing_type !== 'rent' && l.sale_price != null
  const available = l.status === 'active'
  const rb = canRent && days ? rentalBreakdown(l, days, settings.rental_commission_pct) : null
  const sb = canBuy ? saleBreakdown(l, settings.sale_commission_pct) : null

  const submit = async () => {
    setBusy(true); setError('')
    try {
      if (confirm === 'rent' && days) {
        await api.rentals.request(l.id, days)
        toast('Rental request sent. The owner will review it.')
        nav('/dashboard/borrowings')
      } else if (confirm === 'buy') {
        await api.orders.create(l.id)
        toast('Purchase request sent. The seller will review it.')
        nav('/dashboard/purchases')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.')
    } finally { setBusy(false) }
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link copied.') } catch { toast('Copy failed. Copy the address bar link instead.', 'error') }
  }

  const unavailableMsg = l.status === 'paused'
    ? 'The owner has paused this listing.'
    : l.status === 'unavailable' ? 'This book is currently on loan, reserved, or sold.' : 'This listing is no longer available.'

  return (
    <div className="container-page py-8">
      <BackLink to="/browse">Back to browse</BackLink>
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr] lg:gap-12">
        <div>
          <div className="relative mx-auto max-w-xs md:max-w-none">
            <BookCover title={l.title} author={l.author} src={l.image_urls[img]} eager />
            {l.is_sample && <span className="chip absolute left-2 top-2 bg-ink/80 text-white">Sample listing</span>}
          </div>
          {l.image_urls.length > 1 && (
            <div className="mx-auto mt-3 flex max-w-xs gap-2 md:max-w-none">
              {l.image_urls.map((u, i) => (
                <button key={u.slice(-24) + i} onClick={() => setImg(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === img}
                  className={`w-16 overflow-hidden rounded border-2 ${i === img ? 'border-pine' : 'border-transparent'}`}>
                  <img src={u} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-pine-light text-pine-dark">{l.category}</span>
            <span className="chip bg-stone-200 text-stone-800">{conditionLabel(l.condition)}</span>
            {l.status !== 'active' && <StatusChip status={l.status} />}
            {isOwner && l.hidden && <span className="chip bg-red-100 text-red-800">Hidden by admin</span>}
          </div>
          <h1 className="mt-3 [overflow-wrap:anywhere]">{l.title}</h1>
          <p className="mt-1 text-lg text-ink-soft">by {l.author}</p>
          {l.isbn && <p className="mt-1 text-sm text-ink-mute">ISBN {l.isbn}</p>}
          {l.description && <p className="mt-5 whitespace-pre-line text-ink-soft [overflow-wrap:anywhere]">{l.description}</p>}

          <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-mute">Pickup area</dt><dd className="font-medium">{l.pickup_area}</dd><dd className="text-xs text-ink-mute">Exact address is shared only after the owner accepts.</dd></div>
            <div><dt className="text-ink-mute">Handover</dt><dd className="font-medium">Local pickup</dd><dd className="text-xs text-ink-mute">Delivery isn’t available yet.</dd></div>
            <div><dt className="text-ink-mute">Listed</dt><dd className="font-medium">{dateShort(l.created_at)}</dd></div>
            <div>
              <dt className="text-ink-mute">Listed by</dt>
              <dd className="font-medium">{l.owner?.display_name ?? 'Member'}{l.owner?.city ? ` · ${l.owner.city}` : ''}</dd>
              {rating.data && rating.data.count > 0 && <dd className="text-xs text-ink-mute">★ {rating.data.avg.toFixed(1)} ({rating.data.count} review{rating.data.count === 1 ? '' : 's'})</dd>}
            </div>
          </dl>

          <section className="card mt-8 p-5" aria-labelledby="actions">
            <h2 id="actions" className="sr-only">Rent or buy</h2>
            {isOwner ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">This is your listing.</p>
                <Link to={`/list/${l.id}`} className="btn-primary no-underline text-white">Edit listing</Link>
              </div>
            ) : !available ? (
              <p className="text-ink-soft">{unavailableMsg}</p>
            ) : (
              <div className="space-y-6">
                {canRent && (
                  <div>
                    <h3>Rent</h3>
                    <p className="text-sm text-ink-soft">{fmt(l.rental_price!)} per week · choose how long you need it</p>
                    <fieldset className="mt-3">
                      <legend className="sr-only">Rental period</legend>
                      <div className="flex flex-wrap gap-2">
                        {l.rental_period_options.map((d) => (
                          <label key={d} className={`btn-secondary cursor-pointer ${days === d ? '!border-pine !bg-pine-light' : ''}`}>
                            <input type="radio" name="period" className="sr-only" checked={days === d} onChange={() => setDays(d)} />
                            {d} days
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {rb && days && (
                      <p className="mt-3 text-sm">
                        <strong>{fmt(rb.total)}</strong> for {days} days · due back about <strong>{dateShort(addDays(todayISO(), days))}</strong> if handed over today
                      </p>
                    )}
                    <div className="mt-3">
                      {user ? (
                        <button className="btn-primary" disabled={!days} onClick={() => { setError(''); setConfirm('rent') }}>Request to borrow</button>
                      ) : (
                        <Link to="/auth" state={{ from: loc.pathname }} className="btn-primary no-underline text-white">Sign in to borrow</Link>
                      )}
                    </div>
                  </div>
                )}
                {canRent && canBuy && <hr className="border-line" />}
                {canBuy && (
                  <div>
                    <h3>Buy</h3>
                    <p className="text-sm text-ink-soft">{fmt(l.sale_price!)} · pre-owned, {conditionLabel(l.condition).toLowerCase()} condition</p>
                    <div className="mt-3">
                      {user ? (
                        <button className="btn-accent" onClick={() => { setError(''); setConfirm('buy') }}>Request to buy</button>
                      ) : (
                        <Link to="/auth" state={{ from: loc.pathname }} className="btn-accent no-underline text-white">Sign in to buy</Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mt-6 space-y-2 text-sm text-ink-soft" aria-labelledby="terms">
            <h2 id="terms" className="text-lg">Terms at a glance</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>The owner must accept your request before anything is arranged.</li>
              <li>Rental starts when <em>both</em> of you confirm the handover; the due date is counted from that day.</li>
              <li>Return the book in the condition you received it. The owner confirms the return to complete the rental.</li>
              <li>No deposit is collected and no late or damage fees are charged automatically. Problems go through our dispute process.</li>
              <li>Payment is arranged directly between you and the owner for now. <Link to="/policies">Read the full policy (draft)</Link>.</li>
            </ul>
          </section>

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={copyLink}>Copy link</button>
            {user && !isOwner && <button className="btn-ghost btn-sm" onClick={() => setReport(true)}>Report this listing</button>}
          </div>
        </div>
      </div>

      {confirm && (
        <Modal title={confirm === 'rent' ? 'Confirm rental request' : 'Confirm purchase request'} onClose={() => !busy && setConfirm(null)}>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">{l.title}</p>
              <p className="text-sm text-ink-soft">{l.author} · {conditionLabel(l.condition)} · Local pickup</p>
            </div>
            {confirm === 'rent' && rb && <PriceBreakdown b={rb} />}
            {confirm === 'buy' && sb && <PriceBreakdown b={sb} />}
            <PaymentNotice />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={submit}>
                {busy && <Spinner className="border-white/40 border-t-white" />} Send request
              </button>
            </div>
          </div>
        </Modal>
      )}
      {report && <ReportDialog targetType="listing" targetId={l.id} onClose={() => setReport(false)} />}
    </div>
  )
}
