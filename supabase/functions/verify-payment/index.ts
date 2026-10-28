// Called after Razorpay Checkout closes. It does NOT trust the browser: it re-fetches the payment from Razorpay
// with the server-side key and only then applies it (the same idempotent function the webhook uses).
// If the provider has not captured yet, it answers "pending" and the signed webhook completes the job.
// deno-lint-ignore-file no-explicit-any
import { fromPaise, verifyCheckoutSignature } from '../_shared/razorpay.ts'
import { env, handle, HttpError, json, razorpay, serviceClient, userClient, UUID } from '../_shared/server.ts'

handle(async (req) => {
  const body = await req.json().catch(() => ({}))
  const { kind, tx_id, razorpay_payment_id, razorpay_signature } = body
  if (!['rental', 'order'].includes(kind) || !UUID.test(String(tx_id)) || typeof razorpay_payment_id !== 'string') throw new HttpError(400, 'Invalid request.')

  // RLS: the customer can only read their own payment row.
  const col = kind === 'rental' ? 'rental_id' : 'order_id'
  const { data: pay, error } = await userClient(req).from('payments').select('id, provider_order_id, status')
    .eq(col, tx_id).in('status', ['created', 'captured']).maybeSingle()
  if (error || !pay?.provider_order_id) throw new HttpError(404, 'Payment not found.')
  if (pay.status === 'captured') return json({ status: 'captured' })

  if (razorpay_signature && !(await verifyCheckoutSignature(pay.provider_order_id, razorpay_payment_id, razorpay_signature, env('RAZORPAY_KEY_SECRET')))) {
    throw new HttpError(400, 'Payment signature did not verify.')
  }

  const p = await razorpay(`/payments/${encodeURIComponent(razorpay_payment_id)}`)
  if (p.order_id !== pay.provider_order_id) throw new HttpError(400, 'That payment belongs to a different order.')
  if (p.status !== 'captured') return json({ status: 'pending', provider_status: p.status })

  const { data, error: applyErr } = await serviceClient().rpc('payments_apply_capture', {
    p_provider: 'razorpay', p_provider_order_id: p.order_id, p_provider_payment_id: p.id,
    p_amount: fromPaise(p.amount), p_currency: String(p.currency).toUpperCase(), p_method: p.method ?? null,
  })
  if (applyErr) throw new HttpError(409, applyErr.message)
  return json({ status: data })
})
