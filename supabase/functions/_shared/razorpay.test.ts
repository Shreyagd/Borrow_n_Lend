import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildOrderPayload, normalizeEvent, timingSafeEqual, toPaise, verifyCheckoutSignature, verifyWebhookSignature } from './razorpay'

const sign = (secret: string, msg: string) => createHmac('sha256', secret).update(msg).digest('hex')

describe('signatures', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: {} })
  it('accepts a correct webhook signature and rejects tampering or missing headers', async () => {
    const sig = sign('whsec', body)
    expect(await verifyWebhookSignature(body, sig, 'whsec')).toBe(true)
    expect(await verifyWebhookSignature(body + ' ', sig, 'whsec')).toBe(false) // body changed
    expect(await verifyWebhookSignature(body, sig, 'other-secret')).toBe(false)
    expect(await verifyWebhookSignature(body, null, 'whsec')).toBe(false)
    expect(await verifyWebhookSignature(body, sig, '')).toBe(false)
  })
  it('verifies the checkout callback signature over order_id|payment_id', async () => {
    const sig = sign('keysecret', 'order_A|pay_B')
    expect(await verifyCheckoutSignature('order_A', 'pay_B', sig, 'keysecret')).toBe(true)
    expect(await verifyCheckoutSignature('order_A', 'pay_C', sig, 'keysecret')).toBe(false)
  })
  it('compares in constant time and handles length differences', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('order payload', () => {
  it('sends paise, one Route transfer to the owner, and keeps the commission on the platform', () => {
    const o = buildOrderPayload({ paymentId: 'p1', txKind: 'rental', txId: 't1', amount: 120.5, ownerNet: 102.43, currency: 'INR', ownerAccountId: 'acc_X' })
    expect(o.amount).toBe(12050)
    expect(o.partial_payment).toBe(false)
    expect(o.transfers).toHaveLength(1)
    expect(o.transfers[0]).toMatchObject({ account: 'acc_X', amount: 10243, on_hold: false })
    expect(o.transfers[0].amount).toBeLessThanOrEqual(o.amount)
    expect(toPaise(0.1 + 0.2)).toBe(30)
  })
})

describe('event normalisation', () => {
  it('maps captures, failures, refunds and transfers; ignores the rest', () => {
    expect(normalizeEvent({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 8000, currency: 'inr', method: 'upi' } } } }))
      .toEqual({ kind: 'capture', orderId: 'order_1', paymentId: 'pay_1', amount: 80, currency: 'INR', method: 'upi' })
    expect(normalizeEvent({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', error_description: 'bank declined' } } } }))
      .toEqual({ kind: 'failure', orderId: 'order_1', paymentId: 'pay_1', reason: 'bank declined' })
    expect(normalizeEvent({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 2500 } } } }))
      .toEqual({ kind: 'refund', paymentId: 'pay_1', refundId: 'rfnd_1', amount: 25 })
    expect(normalizeEvent({ event: 'transfer.processed', payload: { transfer: { entity: { id: 'trf_1', source: 'pay_1', settlement_status: 'pending' } } } }))
      .toEqual({ kind: 'transfer', paymentId: 'pay_1', transferId: 'trf_1', status: 'processing' })
    expect(normalizeEvent({ event: 'transfer.failed', payload: { transfer: { entity: { id: 'trf_1', source: 'pay_1' } } } }))
      .toMatchObject({ kind: 'transfer', status: 'failed' })
    expect(normalizeEvent({ event: 'order.paid', payload: {} })).toEqual({ kind: 'ignored', type: 'order.paid' })
    expect(normalizeEvent({ event: 'payment.captured', payload: {} })).toMatchObject({ kind: 'ignored' }) // malformed
  })
})
