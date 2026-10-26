import { useSettings } from '../context/SettingsContext'
import type { Breakdown } from '../lib/rules'

/** Transparent price summary: what the customer pays, plus the platform fee taken from the owner's side. */
export function PriceBreakdown({ b, role = 'customer' }: { b: Breakdown; role?: 'customer' | 'owner' }) {
  const { fmt, settings } = useSettings()
  return (
    <dl className="rounded-lg border border-line bg-white p-4 text-sm">
      {b.lines.map((l) => (
        <div key={l.label} className="flex justify-between gap-4 py-1">
          <dt className="text-ink-soft">{l.label}{l.note && <span className="block text-xs text-ink-mute">{l.note}</span>}</dt>
          <dd className="font-medium">{fmt(l.amount)}</dd>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold">
        <dt>Total to pay owner</dt><dd>{fmt(b.total)}</dd>
      </div>
      <div className="mt-2 text-xs text-ink-mute">
        {role === 'owner'
          ? <>Platform fee ({settings.commission_pct}%): −{fmt(b.platformFee)} · You earn {fmt(b.ownerNet)}</>
          : <>BorrowLend’s {settings.commission_pct}% platform fee ({fmt(b.platformFee)}) is deducted from the owner’s earnings, not added to your total.</>}
      </div>
    </dl>
  )
}

export function ManualPaymentNotice() {
  return (
    <p className="rounded-lg bg-clay-light p-3 text-xs text-clay-dark">
      <strong>Manual payment (pilot):</strong> BorrowLend doesn’t process payments yet and holds no funds. After the owner accepts, you arrange payment with them directly at handover. Nothing is charged by confirming this request.
    </p>
  )
}
