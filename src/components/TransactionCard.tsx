import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { api, type TxKind } from '../lib/api'
import { ORDER_STATUS_LABEL, RENTAL_STATUS_LABEL } from '../lib/constants'
import { dateShort } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { daysUntil } from '../lib/rules'
import type { Order, Rental } from '../lib/types'
import { BookCover } from './BookCover'
import { ReportDialog } from './ReportDialog'
import { Field, Modal, Spinner, StatusChip } from './ui'

export type Tx = { kind: 'rental'; rental: Rental } | { kind: 'order'; order: Order }

const HANDOVER_VISIBLE = ['accepted', 'active', 'return_requested', 'overdue', 'disputed']

function HandoverPanel({ kind, id, area }: { kind: TxKind; id: string; area?: string }) {
  const info = useAsync(() => api.transactions.handoverInfo(kind, id), [kind, id])
  return (
    <div className="rounded-lg border border-pine/30 bg-pine-light/60 p-3 text-sm">
      <p className="font-semibold text-pine-dark">Handover details</p>
      {info.loading && <p className="text-ink-mute">Loading…</p>}
      {info.error && <p className="text-red-700">{info.error}</p>}
      {info.data && (
        <ul className="mt-1 space-y-0.5 text-ink-soft">
          <li>Method: local pickup{area ? ` (${area})` : ''}</li>
          <li>Address / meeting point: {info.data.exact_address ?? <em>not provided — message the owner via phone if shared</em>}</li>
          {info.data.handover_notes && <li>Notes: {info.data.handover_notes}</li>}
          <li>Other person’s phone: {info.data.counterparty_phone ?? <em>not shared</em>}</li>
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-mute">Manual process: agree a time, meet, then each of you taps “Confirm handover”.</p>
    </div>
  )
}

function ReviewDialog({ kind, id, onClose, onDone }: { kind: TxKind; id: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.transactions.review(kind, id, rating, comment); toast('Thanks for your review!'); onDone(); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save review.') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Leave a review" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Rating" htmlFor="rv-rating">
          <select id="rv-rating" className="input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n})</option>)}
          </select>
        </Field>
        <Field label="Comment (optional)" htmlFor="rv-comment">
          <textarea id="rv-comment" rows={3} maxLength={500} className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>Submit review</button>
        </div>
      </form>
    </Modal>
  )
}

function DeclineDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="Decline this request?" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Reason (optional, shared with the requester)" htmlFor="dc-reason">
          <input id="dc-reason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Keep</button>
          <button className="btn-danger" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(reason); onClose() } finally { setBusy(false) } }}>Decline request</button>
        </div>
      </div>
    </Modal>
  )
}

export function TransactionCard({ tx, me, onChange }: { tx: Tx; me: string; onChange: () => void }) {
  const toast = useToast()
  const { fmt } = useSettings()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'decline' | 'dispute' | 'review' | 'report' | null>(null)

  const isRental = tx.kind === 'rental'
  const t = isRental ? tx.rental : tx.order
  const kind: TxKind = tx.kind
  const providerId = isRental ? tx.rental.owner_id : tx.order.seller_id
  const isProvider = providerId === me
  const other = isRental ? (isProvider ? tx.rental.borrower : tx.rental.owner) : (isProvider ? tx.order.buyer : tx.order.seller)
  const otherId = isRental ? (isProvider ? tx.rental.borrower_id : tx.rental.owner_id) : (isProvider ? tx.order.buyer_id : tx.order.seller_id)
  const status = t.status
  const statusLabel = isRental ? RENTAL_STATUS_LABEL[tx.rental.status] : ORDER_STATUS_LABEL[tx.order.status]
  const total = isRental ? tx.rental.rental_amount : tx.order.total_amount
  const fee = t.platform_fee
  const listing = t.listing

  const myHandoverDone = isRental
    ? (isProvider ? tx.rental.owner_handover_confirmed_at : tx.rental.borrower_handover_confirmed_at)
    : (isProvider ? tx.order.seller_confirmed_at : tx.order.buyer_confirmed_at)
  const otherHandoverDone = isRental
    ? (isProvider ? tx.rental.borrower_handover_confirmed_at : tx.rental.owner_handover_confirmed_at)
    : (isProvider ? tx.order.buyer_confirmed_at : tx.order.seller_confirmed_at)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok); onChange() }
    catch (e) { toast(e instanceof Error ? e.message : 'Action failed.', 'error'); onChange() }
    finally { setBusy(false) }
  }

  const r = isRental ? tx.rental : null
  const dueIn = r?.due_date ? daysUntil(r.due_date) : null
  const showHandover = isRental ? HANDOVER_VISIBLE.includes(status) : ['accepted', 'disputed'].includes(status)
  const canDispute = isRental ? ['active', 'return_requested', 'overdue'].includes(status) : status === 'accepted'

  const buttons: React.ReactNode[] = []
  const btn = (key: string, label: string, onClick: () => void, cls = 'btn-primary btn-sm') =>
    buttons.push(<button key={key} className={cls} disabled={busy} onClick={onClick}>{label}</button>)

  if (status === 'requested') {
    if (isProvider) {
      btn('acc', 'Accept', () => run(() => (isRental ? api.rentals.respond(t.id, true) : api.orders.respond(t.id, true)), 'Request accepted.'))
      btn('dec', 'Decline', () => setDialog('decline'), 'btn-danger btn-sm')
    } else {
      btn('can', 'Cancel request', () => run(() => (isRental ? api.rentals.cancel(t.id) : api.orders.cancel(t.id)), 'Request cancelled.'), 'btn-secondary btn-sm')
    }
  }
  if (status === 'accepted') {
    if (!myHandoverDone) btn('ho', 'Confirm handover', () => run(() => (isRental ? api.rentals.confirmHandover(t.id) : api.orders.confirmHandover(t.id)), 'Handover confirmed.'))
    if (isProvider && t.payment_status === 'pending') btn('pay', 'Mark payment received', () => run(() => api.transactions.markPaymentReceived(kind, t.id), 'Marked as received.'), 'btn-secondary btn-sm')
    btn('can', 'Cancel', () => run(() => (isRental ? api.rentals.cancel(t.id) : api.orders.cancel(t.id)), 'Cancelled.'), 'btn-secondary btn-sm')
  }
  if (isRental && ['active', 'overdue'].includes(status)) {
    if (!isProvider) btn('ret', 'Request return', () => run(() => api.rentals.requestReturn(t.id), 'Return requested.'))
    if (isProvider) btn('cr', 'Confirm book returned', () => run(() => api.rentals.confirmReturn(t.id), 'Return confirmed. Rental complete.'))
  }
  if (isRental && status === 'return_requested' && isProvider) btn('cr', 'Confirm book returned', () => run(() => api.rentals.confirmReturn(t.id), 'Return confirmed. Rental complete.'))
  if (isProvider && t.payment_status === 'pending' && ['active', 'overdue', 'return_requested', 'completed'].includes(status) && (isRental || status === 'completed')) {
    btn('pay2', 'Mark payment received', () => run(() => api.transactions.markPaymentReceived(kind, t.id), 'Marked as received.'), 'btn-secondary btn-sm')
  }
  if (status === 'completed' && !t.reviewed) btn('rv', 'Leave a review', () => setDialog('review'), 'btn-secondary btn-sm')
  if (canDispute) btn('dp', 'Open dispute', () => setDialog('dispute'), 'btn-danger btn-sm')

  return (
    <article className="card flex gap-4 p-4" aria-label={listing?.title ?? 'Transaction'}>
      <div className="w-16 shrink-0 sm:w-20">
        <BookCover size="sm" title={listing?.title ?? 'Book'} author={listing?.author} src={listing?.image_urls[0]} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base">
              {listing ? <Link to={`/books/${listing.id}`} className="text-ink no-underline hover:underline">{listing.title}</Link> : 'Listing no longer available'}
            </h3>
            <p className="text-sm text-ink-soft">
              {isRental ? (isProvider ? 'Lent to' : 'Borrowed from') : (isProvider ? 'Sold to' : 'Bought from')}{' '}
              <strong>{other?.display_name ?? 'a member'}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={status} label={statusLabel} />
          </div>
        </div>

        <p className="text-sm text-ink-soft">
          {isRental ? `${tx.rental.period_days}-day rental · ` : 'Purchase · '}
          {isProvider ? <>You earn <strong>{fmt(total - fee)}</strong> <span className="text-ink-mute">({fmt(total)} − {fmt(fee)} fee)</span></> : <>Total <strong>{fmt(total)}</strong></>}
          {' · '}
          <span title="Payment is arranged directly between users (no payment processor in the pilot)">
            payment {t.payment_status === 'received' ? 'marked received' : 'pending (manual)'}
          </span>
        </p>

        {r && r.start_date && r.due_date && (
          <p className="text-sm">
            Started {dateShort(r.start_date)} · <strong className={status === 'overdue' ? 'text-red-700' : ''}>Due {dateShort(r.due_date)}</strong>
            {dueIn != null && !['completed', 'cancelled'].includes(status) && (
              <span className={status === 'overdue' || dueIn < 0 ? 'text-red-700' : 'text-ink-mute'}>
                {' '}({dueIn < 0 ? `${-dueIn} day${dueIn === -1 ? '' : 's'} overdue` : dueIn === 0 ? 'due today' : `${dueIn} day${dueIn === 1 ? '' : 's'} left`})
              </span>
            )}
          </p>
        )}
        {status === 'accepted' && (
          <p className="text-sm text-ink-soft">
            Handover: you {myHandoverDone ? '✓ confirmed' : 'haven’t confirmed'} · other person {otherHandoverDone ? '✓ confirmed' : 'hasn’t confirmed'}.
            {isRental && ' The due date is set once both of you confirm.'}
          </p>
        )}
        {t.decline_reason && ['declined'].includes(status) && <p className="text-sm text-ink-soft">Reason: “{t.decline_reason}”</p>}
        {status === 'disputed' && <p className="text-sm text-red-700">A dispute is open. An admin will review it and record an outcome.</p>}
        {showHandover && <HandoverPanel kind={kind} id={t.id} area={listing?.pickup_area} />}

        {(buttons.length > 0 || (listing && ['completed', 'disputed'].includes(status))) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {busy && <Spinner />}
            {buttons}
            <button className="text-xs font-medium text-ink-mute underline" onClick={() => setDialog('report')}>Report {other?.display_name?.split(' ')[0] ?? 'user'}</button>
          </div>
        )}
        <p className="text-xs text-ink-mute">Requested {dateShort(t.created_at)}</p>
      </div>

      {dialog === 'decline' && (
        <DeclineDialog onClose={() => setDialog(null)} onConfirm={async (reason) => {
          await run(() => (isRental ? api.rentals.respond(t.id, false, reason) : api.orders.respond(t.id, false, reason)), 'Request declined.')
        }} />
      )}
      {dialog === 'dispute' && <ReportDialog kind="dispute" targetType={kind} targetId={t.id} onClose={() => setDialog(null)} onDone={onChange} />}
      {dialog === 'report' && <ReportDialog targetType="user" targetId={otherId} heading={`Report ${other?.display_name ?? 'this user'}`} onClose={() => setDialog(null)} />}
      {dialog === 'review' && <ReviewDialog kind={kind} id={t.id} onClose={() => setDialog(null)} onDone={onChange} />}
    </article>
  )
}
