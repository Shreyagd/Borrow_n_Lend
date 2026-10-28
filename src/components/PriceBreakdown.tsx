import { useSettings } from '../context/SettingsContext'
import { IS_DEMO } from '../lib/env'
import { onlinePaymentsLive } from '../lib/payments'
import type { Breakdown } from '../lib/rules'

/**
 * Transparent price summary. The customer pays the listed price; BorrowLend's commission is taken from the
 * owner's side, so it is shown but never added to the customer's total. Delivery and deposit lines are explicit.
 */
export function PriceBreakdown({ b, role = 'customer' }: { b: Breakdown; role?: 'customer' | 'owner' }) {
  const { fmt } = useSettings()
  return (
    <dl className="rounded-xl border border-line bg-white p-4 text-sm">
      {b.lines.map((l) => (
        <div key={l.label} className="flex justify-between gap-4 py-1">
          <dt className="text-ink-soft">{l.label}{l.note && <span className="block text-xs text-ink-mute">{l.note}</span>}</dt>
          <dd className="font-medium">{fmt(l.amount)}</dd>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
        <dt>{role === 'customer' ? 'Total you pay' : 'Total paid by the customer'}</dt><dd>{fmt(b.total)}</dd>
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-ink-mute">
        {role === 'owner' ? (
          <>
            <p>Platform commission ({b.commissionPct}%): −{fmt(b.platformFee)}</p>
            <p className="font-semibold text-pine">You earn {fmt(b.ownerNet)}</p>
          </>
        ) : (
          <p>
            BorrowLend’s {b.commissionPct}% commission ({fmt(b.platformFee)}) is deducted from the owner’s earnings. It is not added to your total, and no
            payment-gateway fee is added either.
          </p>
        )}
      </div>
    </dl>
  )
}

/** Honest description of how payment works right now. */
export function PaymentNotice() {
  const { settings } = useSettings()
  const live = onlinePaymentsLive(settings)
  return (
    <p className="rounded-lg bg-clay-light p-3 text-xs text-clay-dark">
      {live ? (
        <>
          <strong>Secure online payment:</strong> after the owner accepts, you pay through our payment provider (UPI, cards, net banking and wallets as offered at checkout).
          BorrowLend never sees or stores your card details. Sending this request does not charge you.
        </>
      ) : (
        <>
          <strong>{IS_DEMO ? 'Demo mode — no real payments:' : 'Manual payment (pilot):'}</strong>{' '}
          {IS_DEMO
            ? 'you can try a simulated checkout after the owner accepts; no money moves and nothing is marked paid.'
            : 'BorrowLend does not process payments or hold funds yet. After the owner accepts, you arrange payment with them directly. Nothing is charged by sending this request.'}
        </>
      )}
    </p>
  )
}

/** @deprecated kept for older imports; use PaymentNotice. */
export const ManualPaymentNotice = PaymentNotice
