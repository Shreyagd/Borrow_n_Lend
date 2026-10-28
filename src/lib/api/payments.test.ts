import { beforeEach, describe, expect, it } from 'vitest'
import { checkInvariant, captureEntries, refundEntries, refundSplit } from '../ledger'
import { computeEarnings } from '../earnings'
import { rentalBreakdown, saleBreakdown } from '../rules'
import { demoApi as api } from './demoApi'
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from './demoSeed'

const login = (who: string) => api.auth.signIn(`${who}@borrowlend.demo`, DEMO_PASSWORD)
const L = 'l-sample-1' // Asha's book: rent 40/week (7/14/21 days) or buy 180

beforeEach(() => { api.demo!.reset() })

describe('commission rules', () => {
  it('charges 15% on rentals and 10% on sales by default, snapshotted per transaction', async () => {
    const s = await api.settings.get()
    expect(s.rental_commission_pct).toBe(15)
    expect(s.sale_commission_pct).toBe(10)
    expect(s.payments_live).toBe(false)
    await login('ravi')
    const r = await api.rentals.request(L, 14) // 80
    expect(r.rental_amount).toBe(80)
    expect(r.platform_fee).toBe(12)
    expect(r.commission_pct).toBe(15)
    const o = await api.orders.create('l-sample-2') // sale 260
    expect(o.platform_fee).toBe(26)
    expect(o.commission_pct).toBe(10)
    expect(o.total_amount - o.platform_fee).toBe(234)
  })

  it('shows the same split in the breakdown the customer sees', () => {
    const rb = rentalBreakdown({ rental_price: 40 }, 14, 15)
    expect([rb.total, rb.platformFee, rb.ownerNet, rb.commissionPct]).toEqual([80, 12, 68, 15])
    const sb = saleBreakdown({ sale_price: 180 }, 10)
    expect([sb.total, sb.platformFee, sb.ownerNet]).toEqual([180, 18, 162])
  })

  it('a rate change only affects new transactions and only admins can change rates', async () => {
    await login('ravi')
    const before = await api.rentals.request(L, 7)
    await login('asha')
    await expect(api.admin.updateSettings({ rental_commission_pct: 1, sale_commission_pct: 1, currency: 'INR', launch_city: '', payment_provider: 'manual', payments_live: false })).rejects.toThrow(/Admins only/)
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    await api.admin.updateSettings({ rental_commission_pct: 20, sale_commission_pct: 12, currency: 'INR', launch_city: '', payment_provider: 'manual', payments_live: false })
    await login('meera')
    const after = await api.rentals.request('l-sample-2', 7) // Atomic Habits: 60/week
    expect(after.platform_fee).toBe(12) // 20% of 60
    await login('ravi')
    expect((await api.rentals.mine()).find((x) => x.id === before.id)!.commission_pct).toBe(15)
  })

  it('rejects out-of-range rates and refuses to enable live payments in demo mode', async () => {
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const base = { rental_commission_pct: 15, sale_commission_pct: 10, currency: 'INR', launch_city: '', payment_provider: 'manual' as const, payments_live: false }
    await expect(api.admin.updateSettings({ ...base, rental_commission_pct: 90 })).rejects.toThrow(/between 0 and 50/)
    await expect(api.admin.updateSettings({ ...base, payment_provider: 'razorpay', payments_live: true })).rejects.toThrow(/demo mode/i)
  })
})

describe('ledger arithmetic', () => {
  it('captures into a balanced ledger and keeps it balanced through partial refunds', () => {
    const cap = captureEntries('p1', 80, 12)
    expect(cap.map((e) => e.amount)).toEqual([80, 12, 68])
    expect(checkInvariant(cap).ok).toBe(true)
    const r1 = refundEntries('r1', 80, 12, 0, 33.33)
    const r2 = refundEntries('r2', 80, 12, 33.33, 46.67)
    const all = [...cap, ...r1, ...r2]
    expect(checkInvariant(all).ok).toBe(true)
    // after two refunds adding up to the whole payment, the commission is fully reversed (no rounding drift)
    const commission = all.filter((e) => e.entry_type === 'platform_commission' || e.entry_type === 'commission_reversal').reduce((t, e) => t + e.amount, 0)
    expect(Math.round(commission * 100)).toBe(0)
    expect(refundSplit(80, 12, 0, 80)).toEqual({ commission: 12, owner: 68 })
  })
})

describe('payment flow in demo mode', () => {
  async function acceptedRental() {
    await login('ravi')
    const r = await api.rentals.request(L, 14)
    await login('asha')
    await api.rentals.respond(r.id, true)
    await login('ravi')
    return r
  }

  it('never marks anything paid and never counts demo money as revenue', async () => {
    const r = await acceptedRental()
    const start = await api.payments.start('rental', r.id)
    expect(start.mode).toBe('demo')
    expect([start.amount, start.commission, start.owner_net]).toEqual([80, 12, 68])
    expect((await api.rentals.mine()).find((x) => x.id === r.id)!.payment_status).toBe('awaiting_payment')
    expect((await api.payments.verify('rental', r.id)).status).toBe('captured')
    const after = (await api.rentals.mine()).find((x) => x.id === r.id)!
    expect(after.payment_status).toBe('demo_simulated') // not "paid"
    expect(after.settlement_status).toBe('pending')

    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const stats = await api.admin.stats()
    expect(stats.platform_fees).toBe(0)
    expect(stats.gross_volume).toBe(0)
    const rec = await api.admin.reconciliation()
    expect(rec.totals.demo_gross).toBe(80)
    expect(rec.totals.commission_revenue).toBe(0)
    expect(rec.issues).toEqual([])
  })

  it('is idempotent: paying or verifying twice creates one payment and one set of ledger entries', async () => {
    const r = await acceptedRental()
    const a = await api.payments.start('rental', r.id)
    const b = await api.payments.start('rental', r.id)
    expect(b.payment_id).toBe(a.payment_id)
    await api.payments.verify('rental', r.id)
    await api.payments.verify('rental', r.id)
    await expect(api.payments.start('rental', r.id)).rejects.toThrow(/already been paid/)
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    expect(await api.admin.payments()).toHaveLength(1)
    const ledger = await api.admin.ledger()
    expect(ledger.map((e) => e.entry_type).sort()).toEqual(['gross_captured', 'owner_earning', 'platform_commission'])
  })

  it('only the payer can pay, and only accepted transactions can be paid', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 7)
    await expect(api.payments.start('rental', r.id)).rejects.toThrow(/not ready/)
    await login('asha')
    await api.rentals.respond(r.id, true)
    await expect(api.payments.start('rental', r.id)).rejects.toThrow(/not found/i) // the owner is not the payer
    await login('meera')
    await expect(api.payments.verify('rental', r.id)).rejects.toThrow()
  })

  it('refunds a share of the commission, keeps the ledger balanced and reconciles clean', async () => {
    const r = await acceptedRental()
    await api.payments.start('rental', r.id)
    await api.payments.verify('rental', r.id)
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const [p] = await api.admin.payments()
    await expect(api.admin.refund(p.id, 999, 'too much')).rejects.toThrow(/exceeds/)
    await api.admin.refund(p.id, 40, 'half back')
    let rec = await api.admin.reconciliation()
    expect(rec.issues).toEqual([])
    await api.admin.refund(p.id, 40, 'rest')
    rec = await api.admin.reconciliation()
    expect(rec.issues).toEqual([])
    const [after] = await api.admin.payments()
    expect([after.status, after.refunded_amount]).toEqual(['refunded', 80])
    const ledger = await api.admin.ledger()
    expect(ledger.filter((e) => e.entry_type === 'commission_reversal').reduce((t, e) => t + e.amount, 0)).toBeCloseTo(-12, 2)
    await expect(api.admin.refund(p.id, 1, 'again')).rejects.toThrow(/cannot be refunded/)
  })

  it('settlement pays the owner out once and the ledger records a single payout', async () => {
    const r = await acceptedRental()
    await api.payments.start('rental', r.id)
    await api.payments.verify('rental', r.id)
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const [p] = await api.admin.payments()
    await api.demo!.settle(p.id)
    await expect(api.demo!.settle(p.id)).rejects.toThrow(/Nothing to settle/)
    expect((await api.admin.ledger()).filter((e) => e.entry_type === 'owner_payout')).toHaveLength(1)
    expect((await api.admin.reconciliation()).issues).toEqual([])
  })

  it('keeps the books balanced when a refund follows settlement (demo)', async () => {
    const r = await acceptedRental()
    await api.payments.start('rental', r.id)
    await api.payments.verify('rental', r.id)
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const [p] = await api.admin.payments()
    await api.demo!.settle(p.id)
    await api.admin.refund(p.id, 80, 'late refund')
    const rec = await api.admin.reconciliation()
    expect(rec.issues).toEqual([]) // demo money is never flagged for real-world transfer reversals; the ledger still balances
  })

  it('non-admins cannot read the ledger, refund, or run reconciliation', async () => {
    await login('asha')
    await expect(api.admin.ledger()).rejects.toThrow(/Admins only/)
    await expect(api.admin.refund('x', 1, '')).rejects.toThrow(/Admins only/)
    await expect(api.admin.reconciliation()).rejects.toThrow(/Admins only/)
    await expect(api.admin.setPayoutAccount('u-asha', 'razorpay', 'acc_1', 'active')).rejects.toThrow(/Admins only/)
  })
})

describe('manual (off-platform) payments', () => {
  it('are an unverified owner note: never "paid", never revenue, and the commission is only accrued', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 14)
    await login('asha')
    await api.rentals.respond(r.id, true)
    await expect(api.transactions.markPaymentReceived('rental', r.id)).resolves.toBeUndefined()
    const mine = (await api.rentals.mine()).find((x) => x.id === r.id)!
    expect(mine.payment_status).toBe('manual_received')
    // only the owner can note it, and only once
    await login('ravi')
    await expect(api.transactions.markPaymentReceived('rental', r.id)).rejects.toThrow()
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const stats = await api.admin.stats()
    expect(stats.platform_fees).toBe(0)
    expect(stats.manual_commission_accrued).toBe(12)
  })

  it('earnings keep verified, manual and expected money apart', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 14)
    await login('asha')
    await api.rentals.respond(r.id, true)
    let e = computeEarnings('u-asha', await api.rentals.mine(), await api.orders.mine(), await api.payments.forOwner())
    expect([e.net, e.expectedNet, e.manualNet]).toEqual([0, 68, 0])
    await api.transactions.markPaymentReceived('rental', r.id)
    e = computeEarnings('u-asha', await api.rentals.mine(), await api.orders.mine(), await api.payments.forOwner())
    expect([e.net, e.expectedNet, e.manualNet, e.manualCommissionOwed]).toEqual([0, 0, 68, 12])
  })
})
