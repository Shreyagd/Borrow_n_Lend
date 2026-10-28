// Admin-only. Requests a refund from the provider. The ledger and the transaction change ONLY when the provider's
// signed `refund.processed` webhook arrives (payments_apply_refund), so a refund is never recorded optimistically.
// deno-lint-ignore-file no-explicit-any
import { toPaise } from '../_shared/razorpay.ts'
import { handle, HttpError, json, razorpay, serviceClient, userClient, UUID } from '../_shared/server.ts'

handle(async (req) => {
  const { payment_id, amount, reason } = await req.json().catch(() => ({}))
  if (!UUID.test(String(payment_id)) || !(Number(amount) > 0)) throw new HttpError(400, 'Invalid request.')

  const user = userClient(req)
  const { data: isAdmin } = await user.rpc('is_admin')
  if (!isAdmin) throw new HttpError(403, 'Admins only.')

  const svc = serviceClient()
  const { data: pay, error } = await user.from('payments').select('id, provider, provider_payment_id, status').eq('id', payment_id).single()
  if (error || !pay) throw new HttpError(404, 'Payment not found.')
  if (pay.provider !== 'razorpay' || !pay.provider_payment_id) throw new HttpError(400, 'Only provider payments can be refunded here.')

  const { error: markErr } = await svc.rpc('payments_mark_refund_pending', { p_payment: payment_id, p_amount: Number(amount) })
  if (markErr) throw new HttpError(400, markErr.message)

  try {
    const refund = await razorpay(`/payments/${encodeURIComponent(pay.provider_payment_id)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount: toPaise(Number(amount)), speed: 'normal', notes: { reason: String(reason ?? '').slice(0, 200), payment_id } }),
    })
    return json({ refund_id: refund.id, status: refund.status })
  } catch (e) {
    await svc.rpc('payments_clear_refund_pending', { p_payment: payment_id }) // provider rejected it: undo the pending flag
    throw e
  }
})
