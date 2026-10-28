// Pure Razorpay helpers (Web APIs only, no Deno globals) so they can be unit-tested in Node/vitest.
// Written against Razorpay's public docs (Orders, Route transfers, Webhooks). NOT yet exercised against a live
// Razorpay account: verify every field against the current docs before going live. See docs/PAYMENTS.md.

export const toPaise = (amount: number): number => Math.round(amount * 100)
export const fromPaise = (paise: number): number => Math.round(paise) / 100

const enc = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time string comparison (avoids leaking how many leading characters matched). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** Webhook: HMAC-SHA256 of the RAW request body with the webhook secret, compared to the X-Razorpay-Signature header. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): Promise<boolean> {
  if (!signature || !webhookSecret) return false
  return timingSafeEqual(await hmacHex(webhookSecret, rawBody), signature.trim().toLowerCase())
}

/** Checkout callback: HMAC-SHA256 of `${order_id}|${payment_id}` with the API key secret. Never a substitute for the webhook. */
export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string | null, keySecret: string): Promise<boolean> {
  if (!signature || !keySecret) return false
  return timingSafeEqual(await hmacHex(keySecret, `${orderId}|${paymentId}`), signature.trim().toLowerCase())
}

export interface OrderPayloadInput {
  paymentId: string
  txKind: 'rental' | 'order'
  txId: string
  amount: number
  ownerNet: number
  currency: string
  ownerAccountId: string
}

/**
 * Razorpay order with a Route transfer to the owner's linked account. The platform keeps (amount - ownerNet) as its
 * commission; Razorpay's own fees are charged to the platform account, not added to the customer's total.
 * `partial_payment: false` and the transfer amount <= order amount are Route prerequisites.
 */
export function buildOrderPayload(i: OrderPayloadInput) {
  const notes = { payment_id: i.paymentId, tx_kind: i.txKind, tx_id: i.txId }
  return {
    amount: toPaise(i.amount),
    currency: i.currency,
    receipt: i.paymentId, // our payments.id, <= 40 chars
    partial_payment: false,
    notes,
    transfers: [
      { account: i.ownerAccountId, amount: toPaise(i.ownerNet), currency: i.currency, notes, on_hold: false },
    ],
  }
}

export type NormalizedEvent =
  | { kind: 'capture'; orderId: string; paymentId: string; amount: number; currency: string; method: string | null }
  | { kind: 'failure'; orderId: string; paymentId: string; reason: string }
  | { kind: 'refund'; paymentId: string; refundId: string; amount: number }
  | { kind: 'transfer'; paymentId: string; transferId: string; status: 'processing' | 'settled' | 'failed' }
  | { kind: 'ignored'; type: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Maps a Razorpay webhook body to one of a few provider-neutral facts. Unknown events are ignored, never guessed. */
export function normalizeEvent(body: any): NormalizedEvent {
  const type = String(body?.event ?? '')
  const e = body?.payload
  try {
    switch (type) {
      case 'payment.captured': {
        const p = e.payment.entity
        return { kind: 'capture', orderId: p.order_id, paymentId: p.id, amount: fromPaise(p.amount), currency: String(p.currency).toUpperCase(), method: p.method ?? null }
      }
      case 'payment.failed': {
        const p = e.payment.entity
        return { kind: 'failure', orderId: p.order_id, paymentId: p.id, reason: p.error_description ?? p.error_reason ?? 'payment failed' }
      }
      case 'refund.processed': {
        const r = e.refund.entity
        return { kind: 'refund', paymentId: r.payment_id, refundId: r.id, amount: fromPaise(r.amount) }
      }
      case 'transfer.processed': {
        const t = e.transfer.entity
        return { kind: 'transfer', paymentId: t.source, transferId: t.id, status: t.settlement_status === 'settled' ? 'settled' : 'processing' }
      }
      case 'transfer.failed': {
        const t = e.transfer.entity
        return { kind: 'transfer', paymentId: t.source, transferId: t.id, status: 'failed' }
      }
      default:
        return { kind: 'ignored', type }
    }
  } catch {
    return { kind: 'ignored', type: `${type}:malformed` }
  }
}
