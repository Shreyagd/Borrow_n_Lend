// Razorpay webhook receiver. Deploy with:  supabase functions deploy payment-webhook --no-verify-jwt
// (the provider does not send a Supabase JWT; authenticity comes from the HMAC signature instead).
//
//   1. verify the signature over the RAW body       -> 400 if invalid, nothing is read from the body
//   2. log the event once by (provider, event id)   -> duplicates are acknowledged and skipped
//   3. apply the verified fact through idempotent SQL functions
//   4. 200 on success/duplicate/ignored, 500 on failure so the provider retries
// deno-lint-ignore-file no-explicit-any
import { normalizeEvent, verifyWebhookSignature } from '../_shared/razorpay.ts'
import { cors, env, handle, HttpError, serviceClient } from '../_shared/server.ts'

handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'POST only.')
  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature')
  if (!(await verifyWebhookSignature(raw, signature, env('RAZORPAY_WEBHOOK_SECRET')))) throw new HttpError(400, 'Invalid signature.')

  const eventId = req.headers.get('x-razorpay-event-id')
  if (!eventId) throw new HttpError(400, 'Missing event id.')
  const body = JSON.parse(raw)
  const ev = normalizeEvent(body)
  const svc = serviceClient()

  const { data: state, error: logErr } = await svc.rpc('payments_log_event', { p_provider: 'razorpay', p_event_id: eventId, p_type: String(body.event), p_payload: body })
  if (logErr) throw new HttpError(500, logErr.message)
  if (state === 'duplicate') return new Response('duplicate', { status: 200, headers: cors })

  try {
    if (ev.kind === 'capture') {
      const { error } = await svc.rpc('payments_apply_capture', {
        p_provider: 'razorpay', p_provider_order_id: ev.orderId, p_provider_payment_id: ev.paymentId,
        p_amount: ev.amount, p_currency: ev.currency, p_method: ev.method,
      })
      if (error) throw new Error(error.message)
    } else if (ev.kind === 'failure') {
      const { error } = await svc.rpc('payments_apply_failure', { p_provider: 'razorpay', p_provider_order_id: ev.orderId, p_reason: ev.reason })
      if (error) throw new Error(error.message)
    } else if (ev.kind === 'refund') {
      const { error } = await svc.rpc('payments_apply_refund', { p_provider: 'razorpay', p_provider_payment_id: ev.paymentId, p_provider_refund_id: ev.refundId, p_amount: ev.amount })
      if (error) throw new Error(error.message)
    } else if (ev.kind === 'transfer') {
      const { error } = await svc.rpc('payments_apply_settlement', { p_provider: 'razorpay', p_provider_payment_id: ev.paymentId, p_transfer_id: ev.transferId, p_status: ev.status })
      if (error) throw new Error(error.message)
    }
    await svc.rpc('payments_finish_event', { p_provider: 'razorpay', p_event_id: eventId, p_status: ev.kind === 'ignored' ? 'ignored' : 'processed' })
    return new Response('ok', { status: 200, headers: cors })
  } catch (e) {
    await svc.rpc('payments_finish_event', { p_provider: 'razorpay', p_event_id: eventId, p_status: 'error', p_error: String((e as Error).message) })
    throw new HttpError(500, 'Event processing failed; it will be retried.')
  }
})
