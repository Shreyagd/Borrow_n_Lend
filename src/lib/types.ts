export type ListingType = 'rent' | 'sale' | 'both'
export type Condition = 'new' | 'like_new' | 'good' | 'acceptable'
export type ListingStatus = 'active' | 'paused' | 'unavailable' | 'removed'
export type RentalStatus =
  | 'requested' | 'accepted' | 'declined' | 'cancelled' | 'active'
  | 'return_requested' | 'completed' | 'overdue' | 'disputed'
export type OrderStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'completed' | 'disputed'
/**
 * `paid` is set ONLY by server-side provider verification (signed webhook / provider API fetch).
 * `manual_received` is an owner's unverified note that money changed hands off-platform.
 * `demo_simulated` never represents real money.
 */
export type PaymentStatus =
  | 'unpaid' | 'awaiting_payment' | 'paid' | 'failed' | 'refund_pending' | 'partially_refunded' | 'refunded'
  | 'manual_received' | 'demo_simulated'
export type SettlementStatus = 'not_due' | 'pending' | 'processing' | 'settled' | 'failed' | 'reversed'
export type PaymentProvider = 'manual' | 'razorpay' | 'cashfree'
export type TxKindT = 'rental' | 'order'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  city: string | null
  role: 'user' | 'admin'
  suspended: boolean
  created_at: string
}
export type ProfileMini = Pick<Profile, 'id' | 'display_name' | 'city'>

export interface Listing {
  id: string
  owner_id: string
  title: string
  author: string
  isbn: string | null
  category: string
  description: string | null
  condition: Condition
  image_urls: string[]
  listing_type: ListingType
  rental_price: number | null // price per 7 days
  rental_period_options: number[] // days
  sale_price: number | null
  pickup_area: string
  status: ListingStatus
  hidden: boolean
  flagged: boolean
  created_at: string
  updated_at: string
  /** Demo mode only: marks seeded sample content. */
  is_sample?: boolean
  owner?: ProfileMini
}

export interface ListingPrivate {
  exact_address: string | null
  handover_notes: string | null
}

export interface ListingInput {
  title: string
  author: string
  isbn: string
  category: string
  description: string
  condition: Condition
  image_urls: string[]
  listing_type: ListingType
  rental_price: number | null
  rental_period_options: number[]
  sale_price: number | null
  pickup_area: string
  exact_address: string
  handover_notes: string
  status: 'active' | 'paused'
}

export type ListingSummary = Pick<Listing, 'id' | 'title' | 'author' | 'image_urls' | 'pickup_area' | 'category'>

export interface Rental {
  id: string
  listing_id: string
  owner_id: string
  borrower_id: string
  period_days: number
  start_date: string | null
  due_date: string | null
  rental_amount: number
  platform_fee: number
  commission_pct: number
  deposit_amount: number
  status: RentalStatus
  payment_status: PaymentStatus
  settlement_status: SettlementStatus
  decline_reason: string | null
  owner_handover_confirmed_at: string | null
  borrower_handover_confirmed_at: string | null
  return_requested_at: string | null
  return_confirmed_at: string | null
  created_at: string
  updated_at: string
  listing?: ListingSummary | null
  owner?: ProfileMini | null
  borrower?: ProfileMini | null
  reviewed?: boolean
}

export interface Order {
  id: string
  listing_id: string
  seller_id: string
  buyer_id: string
  item_price: number
  platform_fee: number
  commission_pct: number
  delivery_fee: number
  total_amount: number
  status: OrderStatus
  payment_status: PaymentStatus
  settlement_status: SettlementStatus
  handover_method: 'local_pickup'
  decline_reason: string | null
  seller_confirmed_at: string | null
  buyer_confirmed_at: string | null
  created_at: string
  updated_at: string
  listing?: ListingSummary | null
  seller?: ProfileMini | null
  buyer?: ProfileMini | null
  reviewed?: boolean
}

export interface HandoverInfo {
  exact_address: string | null
  handover_notes: string | null
  counterparty_phone: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export type ReportTarget = 'listing' | 'user' | 'rental' | 'order'
export interface Report {
  id: string
  reporter_id: string
  target_type: ReportTarget
  target_id: string
  kind: 'report' | 'dispute'
  reason: string
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  resolution_note: string | null
  created_at: string
  reporter?: ProfileMini | null
}

export interface PublicReview {
  id: string
  rating: number
  comment: string
  reviewer_name: string
  created_at: string
  /** Demo mode only: seeded sample review. */
  is_sample?: boolean
}
export interface ReviewSummary {
  avg: number
  count: number
  /** share of reviews rated 4 or 5, 0-100 */
  positivePct: number
}

export interface Settings {
  /** Server-controlled. Read-only in the browser; only admins can change it (RLS). */
  rental_commission_pct: number
  sale_commission_pct: number
  currency: string
  launch_city: string
  payment_provider: PaymentProvider
  /** True only after provider approval + credentials are configured. */
  payments_live: boolean
}

export type PaymentRecordStatus = 'created' | 'captured' | 'failed' | 'refund_pending' | 'partially_refunded' | 'refunded'
export interface Payment {
  id: string
  tx_kind: TxKindT
  tx_id: string
  payer_id: string
  owner_id: string
  provider: 'razorpay' | 'cashfree' | 'manual' | 'demo'
  provider_order_id: string | null
  provider_payment_id: string | null
  method: string | null
  /** Gross amount the customer pays. */
  amount: number
  currency: string
  commission_amount: number
  owner_net_amount: number
  refunded_amount: number
  status: PaymentRecordStatus
  is_demo: boolean
  failure_reason: string | null
  created_at: string
  captured_at: string | null
  // joined for display
  title?: string
  payer_name?: string
  owner_name?: string
  settlement_status?: SettlementStatus
}

export type LedgerEntryType =
  | 'gross_captured' | 'platform_commission' | 'owner_earning'
  | 'refund_gross' | 'commission_reversal' | 'owner_earning_reversal' | 'owner_payout'
export interface LedgerEntry {
  id: string
  seq: number
  tx_kind: TxKindT
  tx_id: string
  payment_id: string | null
  entry_type: LedgerEntryType
  user_id: string | null
  amount: number
  currency: string
  is_demo: boolean
  memo: string | null
  created_at: string
  idempotency_key?: string
}

export interface PayoutAccount {
  owner_id: string
  owner_name?: string
  provider: 'razorpay' | 'cashfree'
  provider_account_id: string | null
  status: 'not_started' | 'pending' | 'active' | 'rejected'
  updated_at: string
}

export interface PayStart {
  mode: 'demo' | 'provider'
  provider: 'razorpay' | 'cashfree' | 'demo'
  payment_id: string
  amount: number
  currency: string
  commission: number
  owner_net: number
  /** provider checkout parameters (never contains secrets) */
  order_id?: string
  key_id?: string
}

export interface ReconciliationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  ref?: string
}
export interface ReconciliationReport {
  generated_at: string
  totals: {
    gross_captured: number
    refunded: number
    commission_revenue: number
    owner_earned: number
    owner_paid_out: number
    pending_settlement: number
    demo_gross: number
    manual_commission_accrued: number
  }
  issues: ReconciliationIssue[]
}

export interface ListingFilters {
  q: string
  category: string
  type: '' | 'rent' | 'sale'
  conditions: Condition[]
  minPrice: number | null
  maxPrice: number | null
  area: string
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc'
  page: number
}

export interface Page<T> {
  items: T[]
  total: number
}

export interface AdminStats {
  users: number
  suspended_users: number
  listings: number
  hidden_listings: number
  rentals: Record<string, number>
  orders: Record<string, number>
  open_reports: number
  gross_volume: number
  platform_fees: number
  refunded_total?: number
  pending_settlement?: number
  manual_commission_accrued?: number
}

export interface EarningsRow {
  id: string
  kind: 'rental' | 'order'
  title: string
  date: string
  gross: number
  fee: number
  net: number
  txStatus: string
  payment_status: PaymentStatus
  settlement_status: SettlementStatus
  /** provider-verified money vs. an unverified/demo record */
  basis: 'verified' | 'manual' | 'demo' | 'unpaid'
}
export interface Earnings {
  /** Provider-verified payments only (real money). */
  gross: number
  commission: number
  net: number
  refunded: number
  pendingSettlement: number
  settled: number
  /** Completed deals the owner marked as paid off-platform. Unverified; commission is owed, not collected. */
  manualNet: number
  manualCommissionOwed: number
  /** Expected earnings from deals not yet paid. */
  expectedNet: number
  rows: EarningsRow[]
}
