export type ListingType = 'rent' | 'sale' | 'both'
export type Condition = 'new' | 'like_new' | 'good' | 'acceptable'
export type ListingStatus = 'active' | 'paused' | 'unavailable' | 'removed'
export type RentalStatus =
  | 'requested' | 'accepted' | 'declined' | 'cancelled' | 'active'
  | 'return_requested' | 'completed' | 'overdue' | 'disputed'
export type OrderStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'completed' | 'disputed'
export type PaymentStatus = 'pending' | 'received'

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
  deposit_amount: number
  status: RentalStatus
  payment_status: PaymentStatus
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
  delivery_fee: number
  total_amount: number
  status: OrderStatus
  payment_status: PaymentStatus
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
  commission_pct: number
  currency: string
  launch_city: string
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
}

export interface EarningsRow {
  id: string
  kind: 'rental' | 'order'
  title: string
  date: string
  gross: number
  fee: number
  net: number
  status: string
  payment_status: PaymentStatus
}
export interface Earnings {
  gross: number
  fees: number
  net: number
  pending_net: number
  rows: EarningsRow[]
}
