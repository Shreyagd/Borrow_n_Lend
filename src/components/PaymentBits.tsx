import { useSettings } from '../context/SettingsContext'
import { dateShort } from '../lib/format'
import { METHOD_LABEL, PAYMENT_LABEL, PAYMENT_TONE, SETTLEMENT_LABEL, receiptNumber } from '../lib/payments'
import type { Payment, PaymentStatus, SettlementStatus } from '../lib/types'
import { Modal, StatusChip } from './ui'

export const PaymentChip = ({ status }: { status: PaymentStatus }) => <StatusChip status={PAYMENT_TONE[status]} label={PAYMENT_LABEL[status]} />

export const SettlementChip = ({ status }: { status: SettlementStatus }) =>
  status === 'not_due' ? null : <StatusChip status={status === 'settled' ? 'completed' : status === 'failed' ? 'disputed' : 'requested'} label={SETTLEMENT_LABEL[status]} />

/** A payment record is "real money" only when a provider verified it. */
export function paymentKindLabel(p: Pick<Payment, 'is_demo' | 'provider'>) {
  return p.is_demo ? 'DEMO — no money moved' : p.provider === 'manual' ? 'Manual (unverified)' : 'Verified by provider'
}

/**
 * Printable receipt (payer) or earnings statement (owner). It is a payment receipt, not a GST tax invoice:
 * tax invoicing needs a legal/accounting setup that is outside this app.
 */
export function ReceiptDialog({ payment: p, viewer, onClose }: { payment: Payment; viewer: 'payer' | 'owner'; onClose: () => void }) {
  const { fmt } = useSettings()
  const paid = p.status !== 'created' && p.status !== 'failed'
  const row = (k: string, v: string, strong = false) => (
    <div className="flex justify-between gap-4 py-1.5"><dt className="text-ink-soft">{k}</dt><dd className={strong ? 'font-bold' : 'font-medium'}>{v}</dd></div>
  )
  return (
    <Modal title={viewer === 'payer' ? 'Payment receipt' : 'Earnings statement'} onClose={onClose}>
      <div className="print-area relative space-y-4 text-sm">
        {p.is_demo && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="-rotate-12 select-none text-6xl font-extrabold tracking-widest text-clay/15">DEMO</span>
          </div>
        )}
        <div>
          <p className="font-serif text-xl font-bold text-pine">BorrowLend</p>
          <p className="text-xs text-ink-mute">No. {receiptNumber(p)} · {dateShort(p.captured_at ?? p.created_at)}</p>
        </div>
        <dl className="divide-y divide-line rounded-xl border border-line bg-white px-4">
          {row('Item', p.title ?? 'Book')}
          {row(p.tx_kind === 'rental' ? 'Rental' : 'Purchase', `${p.owner_name ?? 'Owner'} ← ${p.payer_name ?? 'Customer'}`)}
          {row('Payment method', p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—')}
          {row('Status', paid ? paymentKindLabel(p) : 'Not paid')}
          {p.provider_payment_id && row('Provider reference', p.provider_payment_id)}
        </dl>
        <dl className="divide-y divide-line rounded-xl border border-line bg-white px-4">
          {viewer === 'payer' ? (
            <>
              {row(p.tx_kind === 'rental' ? 'Rental' : 'Book price', fmt(p.amount))}
              {row('Delivery', fmt(0))}
              {p.refunded_amount > 0 && row('Refunded', `−${fmt(p.refunded_amount)}`)}
              {row('Total paid', fmt(p.amount - p.refunded_amount), true)}
            </>
          ) : (
            <>
              {row('Paid by customer', fmt(p.amount))}
              {row('Platform commission', `−${fmt(p.commission_amount)}`)}
              {p.refunded_amount > 0 && row('Refunded to customer', `−${fmt(p.refunded_amount)}`)}
              {row('Your net earnings', fmt(p.owner_net_amount), true)}
              {row('Settlement', p.settlement_status ? SETTLEMENT_LABEL[p.settlement_status] : '—')}
            </>
          )}
        </dl>
        <p className="text-xs text-ink-mute">
          {p.is_demo
            ? 'This is a demo record created in a test environment. No payment was made.'
            : 'This is a payment receipt, not a GST tax invoice. Amounts are in ' + p.currency + '.'}
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2 print:hidden">
        <button className="btn-ghost" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
      </div>
    </Modal>
  )
}
