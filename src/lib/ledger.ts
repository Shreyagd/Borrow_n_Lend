// Ledger arithmetic for marketplace payments. The SQL functions in supabase/migrations/0004_payments.sql
// implement exactly the same rules; the demo backend and the tests use these.
//
// Entry signs (all amounts positive for money received, negative for reversals/outflows):
//   gross_captured      +gross        (payer paid the platform account)
//   platform_commission +commission   (platform revenue)
//   owner_earning       +net          (owed to the owner)
//   refund_gross        -refund
//   commission_reversal -part         (platform gives back its share of a refund)
//   owner_earning_reversal -part
//   owner_payout        -amount       (owner settled; payable decreases)
//
// Invariant per payment:  gross_captured + refund_gross
//                      == platform_commission + commission_reversal + owner_earning + owner_earning_reversal

import type { LedgerEntryType } from './types'

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface EntryDraft {
  entry_type: LedgerEntryType
  amount: number
  party: 'payer' | 'platform' | 'owner'
  /** idempotency key: re-applying the same event can never create a second entry */
  key: string
}

export function captureEntries(paymentId: string, gross: number, commission: number): EntryDraft[] {
  return [
    { entry_type: 'gross_captured', amount: r2(gross), party: 'payer', key: `cap:${paymentId}:gross` },
    { entry_type: 'platform_commission', amount: r2(commission), party: 'platform', key: `cap:${paymentId}:commission` },
    { entry_type: 'owner_earning', amount: r2(gross - commission), party: 'owner', key: `cap:${paymentId}:owner` },
  ]
}

/** Splits a refund between commission and owner earnings in the original proportion (cumulative, so rounding never drifts). */
export function refundSplit(gross: number, commission: number, alreadyRefunded: number, refund: number) {
  const target = r2(((alreadyRefunded + refund) * commission) / gross)
  const prev = r2((alreadyRefunded * commission) / gross)
  const commissionPart = r2(target - prev)
  return { commission: commissionPart, owner: r2(refund - commissionPart) }
}

export function refundEntries(refundRef: string, gross: number, commission: number, alreadyRefunded: number, refund: number): EntryDraft[] {
  const s = refundSplit(gross, commission, alreadyRefunded, refund)
  return [
    { entry_type: 'refund_gross', amount: -r2(refund), party: 'payer', key: `ref:${refundRef}:gross` },
    { entry_type: 'commission_reversal', amount: -s.commission, party: 'platform', key: `ref:${refundRef}:commission` },
    { entry_type: 'owner_earning_reversal', amount: -s.owner, party: 'owner', key: `ref:${refundRef}:owner` },
  ]
}

export function payoutEntry(settlementId: string, amount: number): EntryDraft {
  return { entry_type: 'owner_payout', amount: -r2(amount), party: 'owner', key: `payout:${settlementId}` }
}

/** Double-entry check for one payment's entries. `diff` must be 0. */
export function checkInvariant(entries: { entry_type: LedgerEntryType; amount: number }[]): { ok: boolean; diff: number } {
  const sum = (types: LedgerEntryType[]) => entries.filter((e) => types.includes(e.entry_type)).reduce((t, e) => t + e.amount, 0)
  const inflow = sum(['gross_captured', 'refund_gross'])
  const split = sum(['platform_commission', 'commission_reversal', 'owner_earning', 'owner_earning_reversal'])
  const diff = r2(inflow - split)
  return { ok: Math.abs(diff) < 0.005, diff }
}
