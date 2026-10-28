import { useState } from 'react'
import { PaymentChip, ReceiptDialog, paymentKindLabel } from '../../components/PaymentBits'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { useSettings } from '../../context/SettingsContext'
import { api } from '../../lib/api'
import { dateShort } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { METHOD_LABEL, receiptNumber } from '../../lib/payments'
import type { Payment } from '../../lib/types'

/** Customer view: every payment I made, with receipts, refunds and the order's payment status. */
export function PaymentsTab() {
  const { fmt } = useSettings()
  const res = useAsync(() => api.payments.mine(), [])
  const [open, setOpen] = useState<Payment | null>(null)

  if (res.loading) return <LoadingState />
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />
  const rows = (res.data ?? []).filter((p) => p.status !== 'created')
  if (!rows.length) {
    return (
      <EmptyState title="No payments yet">
        When you pay for a rental or purchase online, the receipt and any refund appear here. Payments arranged directly with an owner are not recorded here.
      </EmptyState>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Receipts, refunds and payment status for your rentals and purchases.</p>
      <ul className="space-y-3">
        {rows.map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{p.title ?? 'Book'} <span className="text-xs font-normal text-ink-mute">· {p.tx_kind === 'rental' ? 'Rental' : 'Purchase'}</span></p>
              <p className="text-sm text-ink-soft">
                {dateShort(p.captured_at ?? p.created_at)} · {p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'} · {receiptNumber(p)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                <PaymentChip status={p.status === 'refunded' ? 'refunded' : p.status === 'partially_refunded' ? 'partially_refunded' : p.status === 'refund_pending' ? 'refund_pending' : p.is_demo ? 'demo_simulated' : 'paid'} />
                <span className="text-xs text-ink-mute">{paymentKindLabel(p)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-xl font-bold">{fmt(p.amount - p.refunded_amount)}</p>
              {p.refunded_amount > 0 && <p className="text-xs text-ink-mute">{fmt(p.refunded_amount)} refunded of {fmt(p.amount)}</p>}
              <button className="btn-secondary btn-sm mt-2" onClick={() => setOpen(p)}>View receipt</button>
            </div>
          </li>
        ))}
      </ul>
      {open && <ReceiptDialog payment={open} viewer="payer" onClose={() => setOpen(null)} />}
    </div>
  )
}

