import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { api, type TxKind } from '../lib/api'
import { IS_DEMO } from '../lib/env'
import { onlinePaymentsLive } from '../lib/payments'
import type { Breakdown } from '../lib/rules'
import type { Order, PayStart, Rental } from '../lib/types'
import { PriceBreakdown } from './PriceBreakdown'
import { Modal, Spinner } from './ui'

interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayInstance { open(): void; on(event: string, cb: (r: { error?: { description?: string } }) => void): void }
declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance } }

let scriptPromise: Promise<void> | null = null
/** Razorpay Checkout is loaded only when a customer actually pays (it is the provider's hosted card/UPI form). */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment form. Check your connection and try again.')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

function breakdownOf(kind: TxKind, t: Rental | Order): Breakdown {
  const isRental = kind === 'rental'
  const total = isRental ? (t as Rental).rental_amount : (t as Order).total_amount
  return {
    commissionPct: t.commission_pct,
    lines: [
      { label: isRental ? `Rental (${(t as Rental).period_days} days)` : 'Book price', amount: total },
      { label: 'Delivery', amount: 0, note: 'Local pickup – no delivery cost' },
      ...(isRental ? [{ label: 'Deposit', amount: 0, note: 'No deposit is collected' }] : []),
    ],
    total, platformFee: t.platform_fee, ownerNet: Math.round((total - t.platform_fee) * 100) / 100,
  }
}

/**
 * Checkout. The browser only STARTS a payment and later ASKS THE SERVER to confirm it with the provider.
 * It never sets a "paid" state itself: the order is shown as paid only after server-side verification.
 */
export function PayDialog({ kind, tx, onClose, onDone }: { kind: TxKind; tx: Rental | Order; onClose: () => void; onDone: () => void }) {
  const { settings } = useSettings()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const live = onlinePaymentsLive(settings)
  const title = tx.listing?.title ?? 'your book'

  const finish = async (status: string, demo = false) => {
    if (status === 'captured' && !demo) toast('Payment verified. Your receipt is in the Payments tab.')
    else setNote('The provider has your payment and we are waiting for it to be confirmed. This page will show “Paid” once it is verified — no need to pay again.')
    onDone()
    if (status === 'captured') onClose()
  }

  const pay = async () => {
    setBusy(true); setError(''); setNote('')
    try {
      const start: PayStart = await api.payments.start(kind, tx.id)
      if (start.mode === 'demo') {
        const r = await api.payments.verify(kind, tx.id)
        toast('Demo payment simulated. No money moved and nothing is marked paid.', 'info')
        await finish(r.status, true)
        return
      }
      await loadCheckout()
      if (!window.Razorpay || !start.key_id || !start.order_id) throw new Error('The payment form is unavailable right now.')
      const rzp = new window.Razorpay({
        key: start.key_id, order_id: start.order_id, amount: Math.round(start.amount * 100), currency: start.currency,
        name: 'BorrowLend', description: title, theme: { color: '#1B3B2B' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp: RazorpayResponse) => {
          // The provider callback is only a hint. The server re-checks with the provider before anything changes.
          try {
            const r = await api.payments.verify(kind, tx.id, { payment_id: resp.razorpay_payment_id, signature: resp.razorpay_signature })
            await finish(r.status)
          } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm the payment yet.') }
          finally { setBusy(false) }
        },
      })
      rzp.on('payment.failed', (r) => { setError(r.error?.description ?? 'The payment failed. You can try again.'); setBusy(false) })
      rzp.open()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the payment.')
      setBusy(false)
    }
  }

  return (
    <Modal title={live ? 'Pay securely online' : 'Demo checkout'} onClose={() => !busy && onClose()}>
      <div className="space-y-4">
        <div><p className="font-semibold">{title}</p><p className="text-sm text-ink-soft">{kind === 'rental' ? 'Rental payment' : 'Purchase payment'} · local pickup</p></div>
        <PriceBreakdown b={breakdownOf(kind, tx)} />
        {live ? (
          <p className="rounded-lg bg-pine-light p-3 text-xs text-pine">
            Pay with UPI, debit or credit card, net banking or wallet on the provider’s secure form. BorrowLend never sees or stores your card details.
            Your payment is confirmed by our server with the provider, not by this page.
          </p>
        ) : (
          <p className="rounded-lg bg-clay-light p-3 text-xs text-clay-dark">
            <strong>DEMO — no real money moves.</strong> This simulates the payment flow, records clearly-labelled demo entries and never marks the order as paid.
          </p>
        )}
        {note && <p role="status" className="rounded-lg bg-sand p-3 text-sm text-ink">{note}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" disabled={busy} onClick={onClose}>{note ? 'Close' : 'Cancel'}</button>
          {!note && (
            <button className="btn-primary" disabled={busy || (!live && !IS_DEMO)} onClick={pay}>
              {busy && <Spinner className="border-white/40 border-t-white" />} {live ? 'Pay now' : 'Simulate payment (demo)'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
