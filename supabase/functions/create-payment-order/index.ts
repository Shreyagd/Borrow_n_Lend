// Creates (or returns the existing) provider order for a rental/order the signed-in customer owes.
// The amount, owner and commission come from the database (payments_prepare), never from the request body.
// deno-lint-ignore-file no-explicit-any
import { buildOrderPayload } from '../_shared/razorpay.ts'
import { env, handle, HttpError, json, razorpay, serviceClient, userClient, UUID } from '../_shared/server.ts'

handle(async (req) => {
  const { kind, tx_id } = await req.json().catch(() => ({}))
  if (!['rental', 'order'].includes(kind) || !UUID.test(String(tx_id))) throw new HttpError(400, 'Invalid request.')

  const { data: prep, error } = await userClient(req).rpc('payments_prepare', { p_kind: kind, p_tx: tx_id })
  if (error) throw new HttpError(400, error.message)
  if (prep.provider !== 'razorpay') throw new HttpError(501, `The ${prep.provider} integration is not implemented yet.`)

  const svc = serviceClient()
  let orderId: string | null = prep.provider_order_id
  if (!orderId) {
    const order = await razorpay('/orders', {
      method: 'POST',
      body: JSON.stringify(buildOrderPayload({
        paymentId: prep.payment_id, txKind: prep.tx_kind, txId: prep.tx_id, amount: Number(prep.amount),
        ownerNet: Number(prep.owner_net), currency: prep.currency, ownerAccountId: prep.owner_account_id,
      })),
    })
    const { error: attachErr } = await svc.rpc('payments_attach_provider_order', { p_payment: prep.payment_id, p_provider_order_id: order.id })
    if (attachErr) {
      // A concurrent request created the order first: use that one.
      const { data: again } = await userClient(req).rpc('payments_prepare', { p_kind: kind, p_tx: tx_id })
      if (!again?.provider_order_id) throw new HttpError(500, 'Could not link the payment order.')
      orderId = again.provider_order_id
    } else {
      orderId = order.id
    }
  }

  return json({
    mode: 'provider', provider: 'razorpay', payment_id: prep.payment_id, order_id: orderId,
    key_id: env('RAZORPAY_KEY_ID'), // publishable key id only; the secret never leaves the server
    amount: Number(prep.amount), currency: prep.currency, commission: Number(prep.commission), owner_net: Number(prep.owner_net),
  })
})
