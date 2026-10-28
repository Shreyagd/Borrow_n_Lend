import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../../components/BookCover'
import { TransactionCard, type Tx } from '../../components/TransactionCard'
import { EmptyState, Modal, StatusChip } from '../../components/ui'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { api } from '../../lib/api'
import { computeEarnings } from '../../lib/earnings'
import { useAsync } from '../../lib/hooks'
import { onlinePaymentsLive } from '../../lib/payments'
import { PaymentChip, ReceiptDialog, SettlementChip } from '../../components/PaymentBits'
import { dateShort } from '../../lib/format'
import { useDash } from './DashboardLayout'
import type { Listing } from '../../lib/types'

const TERMINAL = ['declined', 'cancelled', 'completed']

function TxList({ items, me, reload, empty }: { items: Tx[]; me: string; reload: () => void; empty: React.ReactNode }) {
  const t = (x: Tx) => (x.kind === 'rental' ? x.rental : x.order)
  const open = items.filter((x) => !TERMINAL.includes(t(x).status))
  const past = items.filter((x) => TERMINAL.includes(t(x).status))
  if (items.length === 0) return <>{empty}</>
  return (
    <div className="space-y-8">
      {open.length > 0 && (
        <section aria-label="In progress" className="space-y-3">
          <h2 className="text-xl">In progress</h2>
          {open.map((x) => <TransactionCard key={x.kind + t(x).id} tx={x} me={me} onChange={reload} />)}
        </section>
      )}
      {past.length > 0 && (
        <section aria-label="History" className="space-y-3">
          <h2 className="text-xl">History</h2>
          {past.map((x) => <TransactionCard key={x.kind + t(x).id} tx={x} me={me} onChange={reload} />)}
        </section>
      )}
    </div>
  )
}

export function Requests() {
  const { me, rentals, orders, reload } = useDash()
  const items: Tx[] = [
    ...rentals.filter((r) => r.owner_id === me).map((rental) => ({ kind: 'rental' as const, rental })),
    ...orders.filter((o) => o.seller_id === me).map((order) => ({ kind: 'order' as const, order })),
  ].sort((a, b) => Date.parse((b.kind === 'rental' ? b.rental : b.order).created_at) - Date.parse((a.kind === 'rental' ? a.rental : a.order).created_at))
  return (
    <TxList items={items} me={me} reload={reload}
      empty={<EmptyState title="No requests yet" action={<Link to="/list" className="btn-primary no-underline text-white">List a book</Link>}>
        When someone asks to borrow or buy one of your books, it shows up here.</EmptyState>} />
  )
}

export function Borrowings() {
  const { me, rentals, reload } = useDash()
  const items: Tx[] = rentals.filter((r) => r.borrower_id === me).map((rental) => ({ kind: 'rental', rental }))
  return (
    <TxList items={items} me={me} reload={reload}
      empty={<EmptyState title="You haven’t borrowed anything yet" action={<Link to="/browse?type=rent" className="btn-primary no-underline text-white">Find a book to rent</Link>}>
        Your rental requests, due dates and returns will appear here.</EmptyState>} />
  )
}

export function Purchases() {
  const { me, orders, reload } = useDash()
  const items: Tx[] = orders.filter((o) => o.buyer_id === me).map((order) => ({ kind: 'order', order }))
  return (
    <TxList items={items} me={me} reload={reload}
      empty={<EmptyState title="No purchases yet" action={<Link to="/browse?type=sale" className="btn-primary no-underline text-white">Find a book to buy</Link>}>
        Your orders and their status will appear here.</EmptyState>} />
  )
}

export function MyListings() {
  const { listings, rentals, orders, reload, me } = useDash()
  const { fmt } = useSettings()
  const toast = useToast()
  const [removing, setRemoving] = useState<Listing | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (id: string, status: 'active' | 'paused' | 'removed', msg: string) => {
    setBusy(id)
    try { await api.listings.setStatus(id, status); toast(msg); reload() }
    catch (e) { toast(e instanceof Error ? e.message : 'Action failed.', 'error') }
    finally { setBusy(null) }
  }

  if (listings.length === 0) {
    return <EmptyState title="You haven’t listed a book yet" action={<Link to="/list" className="btn-primary no-underline text-white">List a book</Link>}>
      List a book you’ve finished with and start earning.</EmptyState>
  }
  return (
    <div>
      <div className="mb-4 flex justify-end"><Link to="/list" className="btn-primary no-underline text-white">+ List a book</Link></div>
      <ul className="space-y-3">
        {listings.map((l) => {
          const pending = rentals.filter((r) => r.listing_id === l.id && r.owner_id === me && r.status === 'requested').length
            + orders.filter((o) => o.listing_id === l.id && o.seller_id === me && o.status === 'requested').length
          return (
            <li key={l.id} className="card flex gap-4 p-4">
              <div className="w-16 shrink-0 sm:w-20"><BookCover size="sm" title={l.title} author={l.author} src={l.image_urls[0]} /></div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base"><Link to={`/books/${l.id}`} className="text-ink no-underline hover:underline">{l.title}</Link></h3>
                  <StatusChip status={l.status} label={l.status === 'active' ? 'Live' : l.status === 'unavailable' ? 'On loan / reserved / sold' : l.status} />
                  {l.hidden && <span className="chip bg-red-100 text-red-800">Hidden by admin</span>}
                  {l.flagged && <span className="chip bg-amber-100 text-amber-900">Flagged</span>}
                </div>
                <p className="text-sm text-ink-soft">{l.author} · listed {dateShort(l.created_at)}</p>
                <p className="text-sm font-medium text-pine">
                  {l.rental_price != null && <>{fmt(l.rental_price)}/week</>}
                  {l.rental_price != null && l.sale_price != null && ' · '}
                  {l.sale_price != null && <>{fmt(l.sale_price)} to buy</>}
                </p>
                {pending > 0 && <p className="text-sm"><Link to="/dashboard/requests" className="font-semibold text-clay-dark">{pending} request{pending > 1 ? 's' : ''} waiting →</Link></p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to={`/list/${l.id}`} className="btn-secondary btn-sm no-underline">Edit</Link>
                  {l.status === 'active' && <button className="btn-secondary btn-sm" disabled={busy === l.id} onClick={() => act(l.id, 'paused', 'Listing paused.')}>Pause</button>}
                  {l.status === 'paused' && <button className="btn-secondary btn-sm" disabled={busy === l.id} onClick={() => act(l.id, 'active', 'Listing is live again.')}>Resume</button>}
                  <button className="btn-danger btn-sm" disabled={busy === l.id} onClick={() => setRemoving(l)}>Remove</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {removing && (
        <Modal title="Remove this listing?" onClose={() => setRemoving(null)}>
          <p className="text-sm text-ink-soft">“{removing.title}” will be taken down and pending requests declined. Transaction history is kept. You can’t remove a book that’s currently on loan or reserved.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setRemoving(null)}>Keep listing</button>
            <button className="btn-danger" onClick={async () => { const l = removing; setRemoving(null); await act(l.id, 'removed', 'Listing removed.') }}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Earnings() {
  const { me, rentals, orders, received } = useDash()
  const { fmt, settings } = useSettings()
  const e = computeEarnings(me, rentals, orders, received)
  const payout = useAsync(() => api.payments.payoutAccount(), [])
  const live = onlinePaymentsLive(settings)
  const tiles: [string, number, string?][] = [
    ['Gross paid (verified)', e.gross, 'What customers paid online, net of refunds'],
    ['Platform commission', e.commission, `Rentals ${settings.rental_commission_pct}% · sales ${settings.sale_commission_pct}%`],
    ['Net earnings', e.net, 'Gross minus commission'],
    ['Pending settlement', e.pendingSettlement, 'Paid by the customer, not yet in your account'],
    ['Paid out', e.settled, 'Settled to your payout account'],
    ['Refunded', e.refunded, 'Returned to customers'],
  ]
  const [receipt, setReceipt] = useState<string | null>(null)
  const receiptPayment = received.find((p) => p.id === receipt) ?? null
  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([l, v, hint]) => (
          <li key={l} className="card p-4"><p className="text-sm text-ink-soft">{l}</p><p className="font-serif text-2xl font-bold">{fmt(v)}</p>{hint && <p className="text-xs text-ink-mute">{hint}</p>}</li>
        ))}
      </ul>

      <div className="card space-y-1 p-4 text-sm">
        <p className="font-semibold">Payout account</p>
        {payout.data
          ? <p className="text-ink-soft">{payout.data.provider} · <strong>{payout.data.status}</strong>{payout.data.status !== 'active' && ' — online payments to you stay disabled until this is active.'}</p>
          : <p className="text-ink-soft">Not set up. {live ? 'Online payments for your books are unavailable until BorrowLend support links your payout account.' : 'Online payouts are not live yet; payment is arranged directly with the customer.'}</p>}
      </div>

      {(e.manualNet > 0 || e.expectedNet > 0) && (
        <p className="rounded-lg bg-clay-light p-3 text-sm text-clay-dark">
          {e.manualNet > 0 && <>You recorded {fmt(e.manualNet)} as paid off-platform. This is unverified, so it isn’t counted above, and the {fmt(e.manualCommissionOwed)} commission on it has not been collected. </>}
          {e.expectedNet > 0 && <>{fmt(e.expectedNet)} is expected from accepted deals that are not paid yet.</>}
        </p>
      )}

      {e.rows.length === 0 ? (
        <EmptyState title="No earnings yet">Accepted rentals and sales appear here with their payment and settlement status.</EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">Earnings history</caption>
              <thead className="border-b border-line text-ink-mute"><tr><th className="py-2 pr-4">Item</th><th className="pr-4">Type</th><th className="pr-4">Date</th><th className="pr-4">Gross</th><th className="pr-4">Commission</th><th className="pr-4">Net</th><th>Payment</th><th /></tr></thead>
              <tbody>
                {e.rows.map((r) => {
                  const pay = received.find((p) => p.tx_id === r.id && p.status !== 'created')
                  return (
                    <tr key={r.kind + r.id} className="border-b border-line/60">
                      <td className="py-2.5 pr-4 font-medium">{r.title}</td><td className="pr-4 capitalize">{r.kind}</td><td className="pr-4">{dateShort(r.date)}</td>
                      <td className="pr-4">{fmt(r.gross)}</td><td className="pr-4">−{fmt(r.fee)}</td><td className="pr-4 font-semibold">{fmt(r.net)}</td>
                      <td className="space-x-1"><PaymentChip status={r.payment_status} /><SettlementChip status={r.settlement_status} /></td>
                      <td>{pay && <button className="text-xs font-semibold text-pine underline" onClick={() => setReceipt(pay.id)}>Statement</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 sm:hidden">
            {e.rows.map((r) => (
              <li key={r.kind + r.id} className="card p-3 text-sm">
                <div className="flex justify-between gap-2"><span className="font-medium">{r.title}</span><span className="font-semibold">{fmt(r.net)}</span></div>
                <p className="text-ink-mute capitalize">{r.kind} · {dateShort(r.date)} · {fmt(r.gross)} − {fmt(r.fee)} commission</p>
                <p className="mt-1 space-x-1"><PaymentChip status={r.payment_status} /><SettlementChip status={r.settlement_status} /></p>
              </li>
            ))}
          </ul>
        </>
      )}
      {receiptPayment && <ReceiptDialog payment={receiptPayment} viewer="owner" onClose={() => setReceipt(null)} />}
    </div>
  )
}
