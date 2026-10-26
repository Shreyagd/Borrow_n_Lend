import type { Earnings, Order, Rental } from './types'

/** Earnings from completed rentals/orders where `userId` is the owner/seller. Fee is deducted from the owner's side. */
export function computeEarnings(userId: string, rentals: Rental[], orders: Order[]): Earnings {
  const rows: Earnings['rows'] = []
  for (const r of rentals) {
    if (r.owner_id !== userId || !['active', 'overdue', 'return_requested', 'completed'].includes(r.status)) continue
    rows.push({
      id: r.id, kind: 'rental', title: r.listing?.title ?? 'Rental', date: r.start_date ?? r.created_at,
      gross: r.rental_amount, fee: r.platform_fee, net: r.rental_amount - r.platform_fee, status: r.status, payment_status: r.payment_status,
    })
  }
  for (const o of orders) {
    if (o.seller_id !== userId || o.status !== 'completed') continue
    rows.push({
      id: o.id, kind: 'order', title: o.listing?.title ?? 'Sale', date: o.updated_at,
      gross: o.total_amount, fee: o.platform_fee, net: o.total_amount - o.platform_fee, status: o.status, payment_status: o.payment_status,
    })
  }
  rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const done = rows.filter((r) => r.status === 'completed')
  const sum = (xs: typeof rows, k: 'gross' | 'fee' | 'net') => Math.round(xs.reduce((t, r) => t + r[k], 0) * 100) / 100
  return {
    gross: sum(done, 'gross'), fees: sum(done, 'fee'), net: sum(done, 'net'),
    pending_net: sum(rows.filter((r) => r.status !== 'completed'), 'net'), rows,
  }
}
