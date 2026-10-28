// Polls Razorpay for the transfer state of every unsettled, non-demo payment and applies it with the same idempotent
// function the webhook uses. Run it on a schedule (see docs/PAYMENTS.md) or from the admin dashboard, so a missed
// webhook never leaves an owner's settlement stuck. Auth: an admin's JWT, or the x-cron-secret header.
// deno-lint-ignore-file no-explicit-any
import { handle, HttpError, json, razorpay, serviceClient, userClient } from '../_shared/server.ts'

handle(async (req) => {
  const cronOk = !!Deno.env.get('CRON_SECRET') && req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')
  if (!cronOk) {
    const { data: isAdmin } = await userClient(req).rpc('is_admin')
    if (!isAdmin) throw new HttpError(403, 'Admins or the scheduler only.')
  }

  const svc = serviceClient()
  const { data: rows, error } = await svc.from('settlements')
    .select('id, status, payment:payments(provider, provider_payment_id)')
    .in('status', ['pending', 'processing']).eq('is_demo', false).limit(100)
  if (error) throw new HttpError(500, error.message)

  let checked = 0, updated = 0
  for (const row of (rows ?? []) as any[]) {
    const p = row.payment
    if (p?.provider !== 'razorpay' || !p.provider_payment_id) continue
    checked++
    const res = await razorpay(`/payments/${encodeURIComponent(p.provider_payment_id)}/transfers`)
    const t = (res.items ?? [])[0]
    if (!t) continue
    const status = t.settlement_status === 'settled' ? 'settled' : t.status === 'failed' ? 'failed' : 'processing'
    if (status === row.status) continue
    const { error: e } = await svc.rpc('payments_apply_settlement', { p_provider: 'razorpay', p_provider_payment_id: p.provider_payment_id, p_transfer_id: t.id, p_status: status })
    if (!e) updated++
  }
  return json({ checked, updated })
})
