import type { PaymentStatus, Payment, SettlementStatus } from './types'

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Payment due',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid (verified)',
  failed: 'Payment failed',
  refund_pending: 'Refund pending',
  partially_refunded: 'Partly refunded',
  refunded: 'Refunded',
  manual_received: 'Paid off-platform (unverified)',
  demo_simulated: 'Demo payment (no money moved)',
}

export const PAYMENT_TONE: Record<PaymentStatus, string> = {
  unpaid: 'pending', awaiting_payment: 'pending', paid: 'completed', failed: 'disputed', refund_pending: 'requested',
  partially_refunded: 'accepted', refunded: 'cancelled', manual_received: 'accepted', demo_simulated: 'paused',
}

export const SETTLEMENT_LABEL: Record<SettlementStatus, string> = {
  not_due: 'Not due', pending: 'Settlement pending', processing: 'Settlement processing', settled: 'Settled', failed: 'Settlement failed', reversed: 'Reversed',
}

export const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', demo: 'Demo', manual: 'Manual',
}

/** Receipt number derived from the payment id (stable, not guessable from sequence). */
export const receiptNumber = (p: Pick<Payment, 'id' | 'created_at'>) =>
  `BL-${p.created_at.slice(0, 7).replace('-', '')}-${p.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`

/** Real money that a provider has verified. Demo and manual records never count. */
export const isVerifiedMoney = (p: Pick<Payment, 'is_demo' | 'provider' | 'status'>) =>
  !p.is_demo && (p.provider === 'razorpay' || p.provider === 'cashfree') && p.status !== 'created' && p.status !== 'failed'

export const onlinePaymentsLive = (s: { payments_live: boolean; payment_provider: string }) =>
  s.payments_live && s.payment_provider !== 'manual'
