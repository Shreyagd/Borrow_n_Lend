import { useState, type FormEvent } from 'react'
import { PaymentChip, ReceiptDialog, SettlementChip, paymentKindLabel } from '../../components/PaymentBits'
import { EmptyState, ErrorState, Field, LoadingState, Modal, Spinner, StatusChip } from '../../components/ui'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { api } from '../../lib/api'
import { IS_DEMO } from '../../lib/env'
import { dateShort } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { METHOD_LABEL, receiptNumber } from '../../lib/payments'
import type { Payment, PaymentStatus } from '../../lib/types'

const statusOf = (p: Payment): PaymentStatus =>
  p.status === 'refunded' ? 'refunded' : p.status === 'partially_refunded' ? 'partially_refunded' : p.status === 'refund_pending' ? 'refund_pending'
    : p.status === 'failed' ? 'failed' : p.status === 'created' ? 'awaiting_payment' : p.is_demo ? 'demo_simulated' : 'paid'

function RefundDialog({ p, onClose, onDone }: { p: Payment; onClose: () => void; onDone: () => void }) {
  const { fmt } = useSettings()
  const toast = useToast()
  const max = Math.round((p.amount - p.refunded_amount) * 100) / 100
  const [amount, setAmount] = useState(String(max))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0) || n > max) return setError(`Enter an amount between 0.01 and ${max}.`)
    setBusy(true); setError('')
    try {
      await api.admin.refund(p.id, n, reason)
      toast(p.is_demo ? 'Demo refund recorded.' : 'Refund requested. The ledger updates when the provider confirms it.')
      onDone(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Refund failed.') }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Refund payment" onClose={() => !busy && onClose()}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">{p.title} · paid {fmt(p.amount)}{p.refunded_amount > 0 ? ` · already refunded ${fmt(p.refunded_amount)}` : ''}</p>
        <Field label={`Amount to refund (max ${fmt(max)})`} htmlFor="rf-amt"><input id="rf-amt" type="number" step="0.01" min="0.01" max={max} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reason (kept with the refund)" htmlFor="rf-reason"><input id="rf-reason" className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="rounded-lg bg-sand p-3 text-xs text-ink-soft">
          The platform commission is refunded in proportion, and the owner’s earnings are reduced by the rest. If the owner was already paid out, the
          reconciliation report will flag it so the transfer can be reversed with the provider.
        </p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-danger" disabled={busy}>{busy && <Spinner />} Issue refund</button>
        </div>
      </form>
    </Modal>
  )
}

function PayoutAccounts() {
  const toast = useToast()
  const accounts = useAsync(() => api.admin.payoutAccounts(), [])
  const users = useAsync(() => api.admin.users(), [])
  const [owner, setOwner] = useState('')
  const [provider, setProvider] = useState<'razorpay' | 'cashfree'>('razorpay')
  const [acct, setAcct] = useState('')
  const [status, setStatus] = useState<'not_started' | 'pending' | 'active' | 'rejected'>('pending')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try { await api.admin.setPayoutAccount(owner, provider, acct, status); toast('Payout account saved.'); setAcct(''); accounts.reload() }
    catch (err) { toast(err instanceof Error ? err.message : 'Could not save.', 'error') }
  }
  return (
    <section aria-labelledby="po" className="space-y-3">
      <h2 id="po" className="text-xl">Payout accounts</h2>
      <p className="text-sm text-ink-soft">
        An owner can receive online payments only when they have an <strong>active</strong> linked/vendor account with the provider (created and KYC-verified
        in the provider’s dashboard). Record the provider’s account id here after verification.
      </p>
      <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-5">
        <div className="sm:col-span-2"><label className="label" htmlFor="po-owner">Owner</label>
          <select id="po-owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)} required>
            <option value="">Choose…</option>{(users.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select></div>
        <div><label className="label" htmlFor="po-prov">Provider</label>
          <select id="po-prov" className="input" value={provider} onChange={(e) => setProvider(e.target.value as 'razorpay' | 'cashfree')}><option value="razorpay">Razorpay</option><option value="cashfree">Cashfree</option></select></div>
        <div><label className="label" htmlFor="po-acct">Account id</label><input id="po-acct" className="input" placeholder="acc_…" value={acct} onChange={(e) => setAcct(e.target.value)} /></div>
        <div><label className="label" htmlFor="po-status">Status</label>
          <select id="po-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="not_started">Not started</option><option value="pending">Pending KYC</option><option value="active">Active</option><option value="rejected">Rejected</option></select></div>
        <div className="sm:col-span-5"><button className="btn-primary btn-sm">Save payout account</button></div>
      </form>
      {accounts.loading ? <LoadingState /> : (accounts.data ?? []).length === 0 ? <p className="text-sm text-ink-mute">No payout accounts recorded yet.</p> : (
        <ul className="space-y-2">{(accounts.data ?? []).map((a) => (
          <li key={a.owner_id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><strong>{a.owner_name ?? a.owner_id.slice(0, 8)}</strong> · {a.provider} · <code>{a.provider_account_id ?? '—'}</code></span>
            <StatusChip status={a.status === 'active' ? 'completed' : a.status === 'rejected' ? 'disputed' : 'requested'} label={a.status.replace('_', ' ')} />
          </li>
        ))}</ul>
      )}
    </section>
  )
}

export function AdminPayments() {
  const { fmt, settings } = useSettings()
  const toast = useToast()
  const pays = useAsync(() => api.admin.payments(), [])
  const rec = useAsync(() => api.admin.reconciliation(), [])
  const ledger = useAsync(() => api.admin.ledger(100), [])
  const [refund, setRefund] = useState<Payment | null>(null)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [busy, setBusy] = useState(false)
  const reloadAll = () => { pays.reload(); rec.reload(); ledger.reload() }

  const syncProvider = async () => {
    setBusy(true)
    try { const r = await api.admin.reconcileSettlements(); toast(`Checked ${r.checked} settlements, updated ${r.updated}.`); reloadAll() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not reach the provider.', 'error') }
    finally { setBusy(false) }
  }
  const settleDemo = async (id: string) => {
    try { await api.demo?.settle(id); toast('Demo settlement recorded.', 'info'); reloadAll() } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error') }
  }

  const t = rec.data?.totals
  const tiles: [string, number, string][] = t ? [
    ['Gross captured', t.gross_captured, 'Provider-verified payments'],
    ['Commission revenue', t.commission_revenue, 'Net of refund reversals'],
    ['Owner earnings', t.owner_earned, 'Owed to owners, net'],
    ['Paid out', t.owner_paid_out, 'Settled to owners'],
    ['Pending settlement', t.pending_settlement, 'Captured, not yet settled'],
    ['Refunded', t.refunded, 'Returned to customers'],
  ] : []

  return (
    <div className="space-y-10">
      <section aria-labelledby="mode" className="card space-y-1 p-4 text-sm">
        <h2 id="mode" className="text-lg">Payment mode</h2>
        <p className="text-ink-soft">
          Provider: <strong>{settings.payment_provider}</strong> · Live online payments: <strong>{settings.payments_live ? 'ON' : 'OFF'}</strong> · Commission: rentals {settings.rental_commission_pct}%, sales {settings.sale_commission_pct}%.
        </p>
        <p className="text-xs text-ink-mute">
          {IS_DEMO ? 'Demo mode: nothing here is real money. Demo records are listed separately and never counted in revenue.'
            : settings.payments_live ? 'Revenue below is derived from the append-only ledger of provider-verified payments.'
              : 'Online payments are off. Owner-recorded (manual) payments are unverified and never count as revenue; the commission on them is shown as “accrued, not collected”.'}
        </p>
      </section>

      <section aria-labelledby="rev" className="space-y-3">
        <h2 id="rev" className="text-xl">Revenue &amp; settlement</h2>
        {rec.loading && !rec.data ? <LoadingState /> : rec.error ? <ErrorState message={rec.error} onRetry={rec.reload} /> : t && (
          <>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {tiles.map(([l, v, h]) => <li key={l} className="card p-4"><p className="font-serif text-2xl font-bold">{fmt(v)}</p><p className="text-sm text-ink-soft">{l}</p><p className="text-xs text-ink-mute">{h}</p></li>)}
            </ul>
            <p className="text-sm text-ink-soft">
              Demo volume (not real): <strong>{fmt(t.demo_gross)}</strong> · Manual-payment commission accrued, <em>not collected</em>: <strong>{fmt(t.manual_commission_accrued)}</strong>
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="recon" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recon" className="text-xl">Reconciliation</h2>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={reloadAll}>Re-run checks</button>
            {!IS_DEMO && <button className="btn-secondary btn-sm" disabled={busy} onClick={syncProvider}>{busy && <Spinner />} Sync settlements with provider</button>}
          </div>
        </div>
        {rec.data && (rec.data.issues.length === 0
          ? <p className="rounded-lg bg-sage-light p-3 text-sm text-[#23694a]">✓ No discrepancies: every captured payment has a balanced ledger that matches the payment, the order status and settlements.</p>
          : <ul className="space-y-2">{rec.data.issues.map((i, n) => (
            <li key={n} className={`rounded-lg border p-3 text-sm ${i.severity === 'error' ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
              <strong className="uppercase">{i.severity}</strong> · <code>{i.code}</code> — {i.message} {i.ref && <span className="text-xs opacity-70">({i.ref.slice(0, 8)})</span>}
            </li>
          ))}</ul>)}
        {rec.data && <p className="text-xs text-ink-mute">Generated {new Date(rec.data.generated_at).toLocaleString()}</p>}
      </section>

      <section aria-labelledby="tx" className="space-y-3">
        <h2 id="tx" className="text-xl">Transactions</h2>
        {pays.loading && !pays.data ? <LoadingState /> : pays.error ? <ErrorState message={pays.error} onRetry={pays.reload} /> : (pays.data ?? []).length === 0 ? (
          <EmptyState title="No payments yet">Online and demo payments appear here once customers pay.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {(pays.data ?? []).map((p) => (
              <li key={p.id} className="card space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.title ?? 'Book'} <span className="font-normal text-ink-mute">· {p.tx_kind} · {receiptNumber(p)}</span></p>
                    <p className="text-ink-soft">{p.payer_name} → {p.owner_name} · {dateShort(p.captured_at ?? p.created_at)} · {p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'} · {p.provider}</p>
                  </div>
                  <div className="text-right"><p className="font-serif text-lg font-bold">{fmt(p.amount)}</p><p className="text-xs text-ink-mute">commission {fmt(p.commission_amount)} · owner {fmt(p.owner_net_amount)}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PaymentChip status={statusOf(p)} />
                  {p.settlement_status && <SettlementChip status={p.settlement_status} />}
                  <span className="text-xs text-ink-mute">{paymentKindLabel(p)}</span>
                  {p.refunded_amount > 0 && <span className="text-xs text-ink-mute">· refunded {fmt(p.refunded_amount)}</span>}
                  {p.failure_reason && <span className="text-xs text-red-700">· {p.failure_reason}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => setReceipt(p)}>Receipt</button>
                  {['captured', 'partially_refunded'].includes(p.status) && <button className="btn-danger btn-sm" onClick={() => setRefund(p)}>Refund</button>}
                  {IS_DEMO && p.is_demo && p.settlement_status === 'pending' && <button className="btn-secondary btn-sm" onClick={() => settleDemo(p.id)}>Simulate settlement (demo)</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PayoutAccounts />

      <section aria-labelledby="led" className="space-y-3">
        <h2 id="led" className="text-xl">Ledger (latest 100)</h2>
        <p className="text-sm text-ink-soft">Append-only. Entries can’t be edited or deleted; corrections are new entries.</p>
        {ledger.data && ledger.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="border-b border-line text-ink-mute"><tr><th className="py-2 pr-3">#</th><th className="pr-3">When</th><th className="pr-3">Entry</th><th className="pr-3">Amount</th><th className="pr-3">Tx</th><th>Flag</th></tr></thead>
              <tbody>{ledger.data.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="py-1.5 pr-3 font-mono">{e.seq}</td><td className="pr-3">{dateShort(e.created_at)}</td><td className="pr-3">{e.entry_type.replace(/_/g, ' ')}</td>
                  <td className={`pr-3 font-semibold ${e.amount < 0 ? 'text-red-700' : ''}`}>{fmt(e.amount)}</td><td className="pr-3 font-mono">{e.tx_kind}:{e.tx_id.slice(0, 6)}</td>
                  <td>{e.is_demo ? <span className="chip bg-ink/80 text-white">demo</span> : ''}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>

      {refund && <RefundDialog p={refund} onClose={() => setRefund(null)} onDone={reloadAll} />}
      {receipt && <ReceiptDialog payment={receipt} viewer="owner" onClose={() => setReceipt(null)} />}
    </div>
  )
}
