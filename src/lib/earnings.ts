import { r2, refundSplit } from './ledger'
import { isVerifiedMoney } from './payments'
import type { Earnings, EarningsRow, Order, Payment, Rental } from './types'

const LIVE_STATUSES = ['accepted', 'active', 'overdue', 'return_requested', 'completed', 'disputed']

/**
 * Owner earnings. Only provider-verified payments count as real money; owner-recorded (manual) and demo
 * payments are tracked separately and never added to `gross`, `commission` or `net`.
 */
export function computeEarnings(userId: string, rentals: Rental[], orders: Order[], payments: Payment[]): Earnings {
  const e: Earnings = {
    gross: 0, commission: 0, net: 0, refunded: 0, pendingSettlement: 0, settled: 0,
    manualNet: 0, manualCommissionOwed: 0, expectedNet: 0, rows: [],
  }

  const byTx = new Map<string, Payment>()
  for (const p of payments) {
    if (p.owner_id !== userId) continue
    const k = `${p.tx_kind}:${p.tx_id}`
    const cur = byTx.get(k)
    if (!cur || Date.parse(p.created_at) > Date.parse(cur.created_at)) byTx.set(k, p)
  }

  const add = (kind: 'rental' | 'order', t: Rental | Order, title: string, date: string, gross: number) => {
    const fee = t.platform_fee
    const p = byTx.get(`${kind}:${t.id}`)
    let basis: EarningsRow['basis'] = 'unpaid'
    if (p && isVerifiedMoney(p)) {
      basis = 'verified'
      const refundedOwner = p.refunded_amount > 0 ? r2(p.refunded_amount - refundSplit(p.amount, p.commission_amount, 0, p.refunded_amount).commission) : 0
      const refundedCommission = r2(p.refunded_amount - refundedOwner)
      e.gross += p.amount - p.refunded_amount
      e.commission += p.commission_amount - refundedCommission
      const netAfter = p.owner_net_amount - refundedOwner
      e.net += netAfter
      e.refunded += p.refunded_amount
      if (t.settlement_status === 'settled') e.settled += netAfter
      else if (t.settlement_status === 'pending' || t.settlement_status === 'processing') e.pendingSettlement += netAfter
    } else if (t.payment_status === 'manual_received') {
      basis = 'manual'
      e.manualNet += gross - fee
      e.manualCommissionOwed += fee
    } else if (t.payment_status === 'demo_simulated') {
      basis = 'demo'
    } else {
      e.expectedNet += gross - fee
    }
    e.rows.push({
      id: t.id, kind, title, date, gross, fee, net: r2(gross - fee), txStatus: t.status,
      payment_status: t.payment_status, settlement_status: t.settlement_status, basis,
    })
  }

  for (const r of rentals) {
    if (r.owner_id === userId && LIVE_STATUSES.includes(r.status)) add('rental', r, r.listing?.title ?? 'Rental', r.start_date ?? r.created_at, r.rental_amount)
  }
  for (const o of orders) {
    if (o.seller_id === userId && ['accepted', 'completed', 'disputed'].includes(o.status)) add('order', o, o.listing?.title ?? 'Sale', o.updated_at, o.total_amount)
  }
  e.rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  for (const k of ['gross', 'commission', 'net', 'refunded', 'pendingSettlement', 'settled', 'manualNet', 'manualCommissionOwed', 'expectedNet'] as const) e[k] = r2(e[k])
  return e
}
