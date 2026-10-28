// Browser-only demo backend. Mirrors the rules enforced by Postgres in supabase/migrations/0002_functions.sql
// (ownership checks, overlap prevention, state machine). Data lives in localStorage and is NOT secure or shared:
// it exists only so the app can be explored and tested before Supabase credentials are configured.
import { PAGE_SIZE } from '../constants'
import { captureEntries, payoutEntry, r2, refundEntries, refundSplit, checkInvariant, type EntryDraft } from '../ledger'
import { addDays, normalizeListingInput, platformFee, rentalAmount, todayISO } from '../rules'
import type {
  AdminStats, HandoverInfo, LedgerEntry, Listing, ListingFilters, ListingInput, ListingPrivate, Notification, Order,
  PayStart, Payment, PayoutAccount, PaymentStatus, Profile, ProfileMini, PublicReview, ReconciliationIssue, ReconciliationReport,
  Rental, Report, ReviewSummary, Settings, SettlementStatus,
} from '../types'
import { blobToDataUrl, compressImage } from '../image'
import { DEMO_PASSWORD, seedAccounts, seedListings, seedReviews, type DemoAccount, type DemoReview } from './demoSeed'
import type { Api, TxKind } from './types'

export { DEMO_PASSWORD }

interface DemoSettlement {
  id: string
  tx_kind: TxKind
  tx_id: string
  payment_id: string
  owner_id: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'settled' | 'failed' | 'reversed'
  is_demo: boolean
  settled_at: string | null
  created_at: string
}

interface State {
  payments: Payment[]
  ledger: LedgerEntry[]
  settlements: DemoSettlement[]
  payoutAccounts: PayoutAccount[]
  accounts: DemoAccount[]
  listings: Listing[]
  listingPrivate: Record<string, ListingPrivate>
  rentals: Rental[]
  orders: Order[]
  reviews: DemoReview[]
  reports: Report[]
  notifications: Notification[]
  settings: Settings
  sessionUserId: string | null
}

const KEY = 'borrowlend-demo-v1'
let memory: string | null = null // fallback when localStorage is unavailable (tests, private mode)
const listeners = new Set<() => void>()

function store(): Storage | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}
function seed(): State {
  const { listings, priv } = seedListings()
  return {
    accounts: seedAccounts(), listings, listingPrivate: priv, rentals: [], orders: [], reviews: seedReviews(), reports: [],
    notifications: [], sessionUserId: null, payments: [], ledger: [], settlements: [], payoutAccounts: [],
    settings: { rental_commission_pct: 15, sale_commission_pct: 10, currency: 'INR', launch_city: 'Sample City', payment_provider: 'manual', payments_live: false },
  }
}
/** Upgrades demo data saved by an older version of the app (before payments existed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(s: any): State {
  s.payments ??= []; s.ledger ??= []; s.settlements ??= []; s.payoutAccounts ??= []
  const old = s.settings?.commission_pct
  s.settings = {
    rental_commission_pct: s.settings?.rental_commission_pct ?? 15,
    sale_commission_pct: s.settings?.sale_commission_pct ?? (typeof old === 'number' ? old : 10),
    currency: s.settings?.currency ?? 'INR', launch_city: s.settings?.launch_city ?? '',
    payment_provider: 'manual', payments_live: false,
  }
  for (const r of s.rentals ?? []) {
    r.payment_status = r.payment_status === 'received' ? 'manual_received' : r.payment_status === 'pending' ? 'unpaid' : r.payment_status ?? 'unpaid'
    r.settlement_status ??= 'not_due'
    r.commission_pct ??= r.rental_amount ? r2((r.platform_fee * 100) / r.rental_amount) : 0
  }
  for (const o of s.orders ?? []) {
    o.payment_status = o.payment_status === 'received' ? 'manual_received' : o.payment_status === 'pending' ? 'unpaid' : o.payment_status ?? 'unpaid'
    o.settlement_status ??= 'not_due'
    o.commission_pct ??= o.total_amount ? r2((o.platform_fee * 100) / o.total_amount) : 0
  }
  return s as State
}

function read(): State {
  let raw: string | null
  try { raw = store()?.getItem(KEY) ?? memory } catch { raw = memory }
  if (raw) { try { return normalize(JSON.parse(raw)) } catch { /* fall through to reseed */ } }
  const s = seed()
  write(s, false)
  return s
}
function write(s: State, emit = true) {
  const raw = JSON.stringify(s)
  memory = raw
  try { store()?.setItem(KEY, raw) } catch { /* quota or blocked: memory fallback keeps working */ }
  if (emit) listeners.forEach((l) => l())
}

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

// ───────────── shared helpers (mirror SQL helpers) ─────────────
const BLOCKING_R = ['accepted', 'active', 'return_requested', 'overdue', 'disputed']
const BLOCKING_O = ['accepted', 'completed', 'disputed']

function account(s: State, id: string | null) { return s.accounts.find((a) => a.id === id) }
function activeUser(s: State): DemoAccount {
  const a = account(s, s.sessionUserId)
  if (!a) throw new Error('Please sign in first.')
  if (a.profile.suspended) throw new Error('Your account is suspended. Please contact support.')
  return a
}
function requireAdmin(s: State): DemoAccount {
  const a = activeUser(s)
  if (a.profile.role !== 'admin') throw new Error('Admins only.')
  return a
}
function mini(s: State, id: string): ProfileMini | null {
  const a = account(s, id)
  return a ? { id: a.id, display_name: a.profile.display_name, city: a.profile.city } : null
}
function notify(s: State, userId: string, type: string, title: string, body: string, link: string) {
  s.notifications.unshift({ id: uuid(), user_id: userId, type, title, body, link, read_at: null, created_at: now() })
}
const busy = (s: State, lid: string) =>
  s.rentals.some((r) => r.listing_id === lid && BLOCKING_R.includes(r.status)) ||
  s.orders.some((o) => o.listing_id === lid && BLOCKING_O.includes(o.status))
function sync(s: State, lid: string) {
  const l = s.listings.find((x) => x.id === lid)
  if (!l) return
  const b = busy(s, lid)
  if (b && l.status === 'active') l.status = 'unavailable'
  else if (!b && l.status === 'unavailable') l.status = 'active'
}
function ownerOk(s: State, l: Listing) { return !!account(s, l.owner_id) && !account(s, l.owner_id)!.profile.suspended }
function publiclyVisible(s: State, l: Listing) { return l.status !== 'removed' && !l.hidden && ownerOk(s, l) }
function summary(s: State, lid: string) {
  const l = s.listings.find((x) => x.id === lid)
  return l ? { id: l.id, title: l.title, author: l.author, image_urls: l.image_urls, pickup_area: l.pickup_area, category: l.category } : null
}
function withOwner(s: State, l: Listing): Listing {
  return { ...clone(l), owner: mini(s, l.owner_id) ?? undefined }
}
function decorateRental(s: State, r: Rental, meId?: string): Rental {
  return {
    ...clone(r), listing: summary(s, r.listing_id), owner: mini(s, r.owner_id), borrower: mini(s, r.borrower_id),
    reviewed: meId ? s.reviews.some((v) => v.rental_id === r.id && v.reviewer_id === meId) : undefined,
  }
}
function decorateOrder(s: State, o: Order, meId?: string): Order {
  return {
    ...clone(o), listing: summary(s, o.listing_id), seller: mini(s, o.seller_id), buyer: mini(s, o.buyer_id),
    reviewed: meId ? s.reviews.some((v) => v.order_id === o.id && v.reviewer_id === meId) : undefined,
  }
}
function rateLimit(items: { created_at: string }[], max: number, msg: string) {
  const cutoff = Date.now() - 3_600_000
  if (items.filter((i) => Date.parse(i.created_at) > cutoff).length >= max) throw new Error(msg)
}
function findRental(s: State, id: string) {
  const r = s.rentals.find((x) => x.id === id)
  if (!r) throw new Error('Rental not found.')
  return r
}
function findOrder(s: State, id: string) {
  const o = s.orders.find((x) => x.id === id)
  if (!o) throw new Error('Order not found.')
  return o
}

function listingFromInput(base: Partial<Listing>, i: ListingInput): Partial<Listing> {
  const n = normalizeListingInput(i)
  return {
    ...base,
    title: n.title, author: n.author, isbn: n.isbn || null, category: n.category,
    description: n.description.trim() || null, condition: n.condition, image_urls: n.image_urls.slice(0, 5),
    listing_type: n.listing_type, rental_price: n.rental_price, rental_period_options: n.rental_period_options,
    sale_price: n.sale_price, pickup_area: n.pickup_area,
  }
}
function assertListingValid(l: Partial<Listing>) {
  if (!l.title || !l.author || !l.category || !l.pickup_area || l.pickup_area.length < 2) throw new Error('Please fill in all required fields.')
  if (l.listing_type !== 'sale' && (!l.rental_price || l.rental_price <= 0 || !l.rental_period_options?.length)) throw new Error('Rental price and period are required.')
  if (l.listing_type !== 'rent' && (!l.sale_price || l.sale_price <= 0)) throw new Error('Sale price is required.')
}

function score(l: Listing, q: string): number {
  const t = q.toLowerCase()
  let n = 0
  if (l.title.toLowerCase().includes(t)) n += 3
  if (l.isbn?.toLowerCase().includes(t)) n += 3
  if (l.author.toLowerCase().includes(t)) n += 2
  if (l.category.toLowerCase().includes(t) || l.description?.toLowerCase().includes(t)) n += 1
  return n
}

// ───────────── payments helpers (mirror the SQL in 0004_payments.sql) ─────────────
const byNewest = (a: { created_at: string }, b: { created_at: string }) => Date.parse(b.created_at) - Date.parse(a.created_at)
const txOf = (s: State, kind: TxKind, id: string): Rental | Order => (kind === 'rental' ? findRental(s, id) : findOrder(s, id))
const partiesOf = (kind: TxKind, t: Rental | Order) =>
  kind === 'rental' ? { payerId: (t as Rental).borrower_id, ownerId: (t as Rental).owner_id } : { payerId: (t as Order).buyer_id, ownerId: (t as Order).seller_id }
const grossOf = (kind: TxKind, t: Rental | Order) => (kind === 'rental' ? (t as Rental).rental_amount : (t as Order).total_amount)

/** Appends ledger entries; an entry whose idempotency key already exists is skipped (re-applying an event is harmless). */
function addLedger(s: State, p: Payment, drafts: EntryDraft[]) {
  for (const d of drafts) {
    if (s.ledger.some((e) => e.idempotency_key === d.key)) continue
    s.ledger.push({
      id: uuid(), seq: s.ledger.length + 1, tx_kind: p.tx_kind, tx_id: p.tx_id, payment_id: p.id, entry_type: d.entry_type,
      user_id: d.party === 'payer' ? p.payer_id : d.party === 'owner' ? p.owner_id : null, amount: d.amount, currency: p.currency,
      is_demo: p.is_demo, memo: null, created_at: now(), idempotency_key: d.key,
    })
  }
}
function decoratePayment(s: State, p: Payment): Payment {
  const t = p.tx_kind === 'rental' ? s.rentals.find((x) => x.id === p.tx_id) : s.orders.find((x) => x.id === p.tx_id)
  return {
    ...clone(p), title: t ? summary(s, t.listing_id)?.title : undefined, payer_name: account(s, p.payer_id)?.profile.display_name,
    owner_name: account(s, p.owner_id)?.profile.display_name, settlement_status: (t?.settlement_status ?? 'not_due') as SettlementStatus,
  }
}
function setTxPayment(s: State, p: Payment, status?: PaymentStatus, settlement?: SettlementStatus) {
  const t = p.tx_kind === 'rental' ? s.rentals.find((x) => x.id === p.tx_id) : s.orders.find((x) => x.id === p.tx_id)
  if (!t) return
  if (status) t.payment_status = status
  if (settlement) t.settlement_status = settlement
}

export const demoApi: Api = {
  mode: 'demo',

  auth: {
    async getUser() {
      const s = read()
      const a = account(s, s.sessionUserId)
      return a ? { id: a.id, email: a.email } : null
    },
    async signUp(email, password, displayName) {
      const s = read()
      const e = email.trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('Enter a valid email address.')
      if (password.length < 6) throw new Error('Password must be at least 6 characters.')
      if (s.accounts.some((a) => a.email === e)) throw new Error('An account with this email already exists.')
      const id = uuid()
      s.accounts.push({
        id, email: e, password, phone: null,
        profile: { id, display_name: displayName.trim().slice(0, 60) || e.split('@')[0], avatar_url: null, city: null, role: 'user', suspended: false, created_at: now() },
      })
      s.sessionUserId = id
      write(s)
      return { needsConfirmation: false }
    },
    async signIn(email, password) {
      const s = read()
      const a = s.accounts.find((x) => x.email === email.trim().toLowerCase())
      if (!a || a.password !== password) throw new Error('Invalid email or password.')
      s.sessionUserId = a.id
      write(s)
    },
    async signOut() {
      const s = read()
      s.sessionUserId = null
      write(s)
    },
    onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb) } },
  },

  profiles: {
    async mine() {
      const s = read()
      const a = account(s, s.sessionUserId)
      return a ? { profile: clone(a.profile), phone: a.phone } : null
    },
    async updateMine(v) {
      const s = read()
      const a = activeUser(s)
      if (!v.display_name.trim()) throw new Error('Display name is required.')
      a.profile.display_name = v.display_name.trim().slice(0, 60)
      a.profile.city = v.city.trim().slice(0, 80) || null
      a.phone = v.phone.trim().slice(0, 20) || null
      write(s)
    },
    async rating(userId) {
      const rs = read().reviews.filter((r) => r.reviewee_id === userId)
      return { count: rs.length, avg: rs.length ? rs.reduce((t, r) => t + r.rating, 0) / rs.length : 0 }
    },
  },

  settings: { async get() { return clone(read().settings) } },

  listings: {
    async search(f: ListingFilters) {
      const s = read()
      const q = f.q.trim().toLowerCase()
      const area = f.area.trim().toLowerCase()
      let rows = s.listings.filter((l) => l.status === 'active' && publiclyVisible(s, l))
      if (q) rows = rows.filter((l) => score(l, q) > 0)
      if (f.category) rows = rows.filter((l) => l.category === f.category)
      if (f.type === 'rent') rows = rows.filter((l) => l.listing_type !== 'sale')
      if (f.type === 'sale') rows = rows.filter((l) => l.listing_type !== 'rent')
      if (f.conditions.length) rows = rows.filter((l) => f.conditions.includes(l.condition))
      if (area) rows = rows.filter((l) => l.pickup_area.toLowerCase().includes(area))
      if (f.minPrice != null || f.maxPrice != null) {
        const inRange = (p: number | null) => p != null && (f.minPrice == null || p >= f.minPrice) && (f.maxPrice == null || p <= f.maxPrice)
        rows = rows.filter((l) => {
          if (f.type === 'rent') return inRange(l.rental_price)
          if (f.type === 'sale') return inRange(l.sale_price)
          return inRange(l.rental_price) || inRange(l.sale_price)
        })
      }
      const price = (l: Listing) => Math.min(l.rental_price ?? Infinity, l.sale_price ?? Infinity)
      const byNew = (a: Listing, b: Listing) => Date.parse(b.created_at) - Date.parse(a.created_at)
      if (f.sort === 'price_asc') rows.sort((a, b) => price(a) - price(b) || byNew(a, b))
      else if (f.sort === 'price_desc') rows.sort((a, b) => price(b) - price(a) || byNew(a, b))
      else if (f.sort === 'relevance' && q) rows.sort((a, b) => score(b, q) - score(a, q) || byNew(a, b))
      else rows.sort(byNew)
      const from = (Math.max(1, f.page) - 1) * PAGE_SIZE
      return { total: rows.length, items: rows.slice(from, from + PAGE_SIZE).map((l) => withOwner(s, l)) }
    },
    async recent(n) {
      const s = read()
      return s.listings.filter((l) => l.status === 'active' && publiclyVisible(s, l))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, n).map((l) => withOwner(s, l))
    },
    async get(id) {
      const s = read()
      const l = s.listings.find((x) => x.id === id)
      if (!l) return null
      const me = account(s, s.sessionUserId)
      const participant = !!me && (s.rentals.some((r) => r.listing_id === id && r.borrower_id === me.id) || s.orders.some((o) => o.listing_id === id && o.buyer_id === me.id))
      if (publiclyVisible(s, l) || me?.id === l.owner_id || me?.profile.role === 'admin' || participant) return withOwner(s, l)
      return null
    },
    async getPrivate(id) {
      const s = read()
      const me = account(s, s.sessionUserId)
      const l = s.listings.find((x) => x.id === id)
      if (!me || !l || (l.owner_id !== me.id && me.profile.role !== 'admin')) return null
      return clone(s.listingPrivate[id] ?? { exact_address: null, handover_notes: null })
    },
    async mine() {
      const s = read()
      const a = activeUser(s)
      return s.listings.filter((l) => l.owner_id === a.id && l.status !== 'removed').map((l) => withOwner(s, l))
        .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))
    },
    async create(input) {
      const s = read()
      const a = activeUser(s)
      const dayAgo = Date.now() - 86_400_000
      if (s.listings.filter((l) => l.owner_id === a.id && Date.parse(l.created_at) > dayAgo).length >= 20) {
        throw new Error('Daily listing limit reached. Please try again tomorrow.')
      }
      const l = listingFromInput({
        id: uuid(), owner_id: a.id, status: input.status === 'paused' ? 'paused' : 'active', hidden: false, flagged: false,
        created_at: now(), updated_at: now(),
      }, input)
      assertListingValid(l)
      s.listings.push(l as Listing)
      s.listingPrivate[l.id!] = { exact_address: input.exact_address.trim() || null, handover_notes: input.handover_notes.trim() || null }
      write(s)
      return withOwner(s, l as Listing)
    },
    async update(id, input) {
      const s = read()
      const a = activeUser(s)
      const idx = s.listings.findIndex((l) => l.id === id && l.owner_id === a.id)
      if (idx < 0) throw new Error('Listing not found.')
      const cur = s.listings[idx]
      const next = listingFromInput({ ...cur, updated_at: now() }, input) as Listing
      assertListingValid(next)
      if (cur.status !== 'removed') {
        next.status = input.status === 'paused' ? 'paused' : 'active'
        if (next.status === 'active' && busy(s, id)) next.status = 'unavailable'
      }
      s.listings[idx] = next
      s.listingPrivate[id] = { exact_address: input.exact_address.trim() || null, handover_notes: input.handover_notes.trim() || null }
      write(s)
      return withOwner(s, next)
    },
    async setStatus(id, status) {
      const s = read()
      const a = activeUser(s)
      const l = s.listings.find((x) => x.id === id && x.owner_id === a.id)
      if (!l) throw new Error('Listing not found.')
      if (status === 'removed') {
        const inProgress = s.rentals.some((r) => r.listing_id === id && BLOCKING_R.includes(r.status)) ||
          s.orders.some((o) => o.listing_id === id && ['accepted', 'disputed'].includes(o.status))
        if (inProgress) throw new Error('Finish or cancel the current rental/order before removing this listing.')
        s.rentals.filter((r) => r.listing_id === id && r.status === 'requested').forEach((r) => { r.status = 'declined'; r.decline_reason = 'Listing was removed' })
        s.orders.filter((o) => o.listing_id === id && o.status === 'requested').forEach((o) => { o.status = 'declined'; o.decline_reason = 'Listing was removed' })
        l.status = 'removed'
      } else if (status === 'active') {
        l.status = busy(s, id) ? 'unavailable' : 'active'
      } else {
        l.status = 'paused'
      }
      l.updated_at = now()
      write(s)
    },
    async uploadImage(file) {
      activeUser(read())
      return blobToDataUrl(await compressImage(file, 700, 0.75)) // demo keeps images small (localStorage quota)
    },
  },

  rentals: {
    async mine() {
      const s = read()
      const a = activeUser(s)
      return s.rentals.filter((r) => r.owner_id === a.id || r.borrower_id === a.id)
        .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).map((r) => decorateRental(s, r, a.id))
    },
    async request(listingId, days) {
      const s = read()
      const a = activeUser(s)
      rateLimit(s.rentals.filter((r) => r.borrower_id === a.id), 10, 'Too many requests. Please try again later.')
      const l = s.listings.find((x) => x.id === listingId)
      if (!l || l.hidden || l.status !== 'active' || !ownerOk(s, l)) throw new Error('This book is not available right now.')
      if (l.owner_id === a.id) throw new Error('You cannot borrow your own book.')
      if (l.listing_type === 'sale' || !l.rental_period_options.includes(days)) throw new Error('That rental period is not offered for this book.')
      if (busy(s, l.id)) throw new Error('This book is currently reserved or on loan.')
      if (s.rentals.some((r) => r.listing_id === l.id && r.borrower_id === a.id && r.status === 'requested')) throw new Error('You already have a pending request for this book.')
      const amount = rentalAmount(l.rental_price!, days)
      const r: Rental = {
        id: uuid(), listing_id: l.id, owner_id: l.owner_id, borrower_id: a.id, period_days: days, start_date: null, due_date: null,
        rental_amount: amount, platform_fee: platformFee(amount, s.settings.rental_commission_pct), commission_pct: s.settings.rental_commission_pct,
        deposit_amount: 0, settlement_status: 'not_due', status: 'requested', payment_status: 'unpaid', decline_reason: null, owner_handover_confirmed_at: null,
        borrower_handover_confirmed_at: null, return_requested_at: null, return_confirmed_at: null, created_at: now(), updated_at: now(),
      }
      s.rentals.push(r)
      notify(s, l.owner_id, 'rental_requested', 'New rental request', `Someone wants to borrow "${l.title}" for ${days} days.`, '/dashboard/requests')
      write(s)
      return decorateRental(s, r, a.id)
    },
    async respond(id, accept, reason) {
      const s = read()
      const a = activeUser(s)
      const r = findRental(s, id)
      if (r.owner_id !== a.id) throw new Error('Request not found.')
      if (r.status !== 'requested') throw new Error('This request was already answered or cancelled.')
      const l = s.listings.find((x) => x.id === r.listing_id)!
      if (accept) {
        if (l.status !== 'active' || l.hidden || busy(s, l.id)) throw new Error('This book is no longer available to lend.')
        r.status = 'accepted'
        s.rentals.filter((o) => o.listing_id === l.id && o.status === 'requested' && o.id !== r.id).forEach((o) => {
          o.status = 'declined'; o.decline_reason = 'The owner accepted another request'
          notify(s, o.borrower_id, 'rental_declined', 'Request declined', `"${l.title}" was lent to someone else.`, '/dashboard/borrowings')
        })
        sync(s, l.id)
        notify(s, r.borrower_id, 'rental_accepted', 'Request accepted', `Your request for "${l.title}" was accepted. See handover details.`, '/dashboard/borrowings')
      } else {
        r.status = 'declined'
        r.decline_reason = reason?.trim().slice(0, 300) || null
        notify(s, r.borrower_id, 'rental_declined', 'Request declined', `Your request for "${l.title}" was declined.`, '/dashboard/borrowings')
      }
      r.updated_at = now()
      write(s)
      return decorateRental(s, r, a.id)
    },
    async cancel(id) {
      const s = read()
      const a = activeUser(s)
      const r = findRental(s, id)
      if (![r.owner_id, r.borrower_id].includes(a.id)) throw new Error('Rental not found.')
      if (!(r.status === 'requested' && a.id === r.borrower_id) && r.status !== 'accepted') {
        throw new Error('This rental can no longer be cancelled. Open a dispute if there is a problem.')
      }
      r.status = 'cancelled'; r.updated_at = now()
      sync(s, r.listing_id)
      notify(s, a.id === r.owner_id ? r.borrower_id : r.owner_id, 'rental_cancelled', 'Rental cancelled', 'A rental was cancelled.', '/dashboard')
      write(s)
      return decorateRental(s, r, a.id)
    },
    async confirmHandover(id) {
      const s = read()
      const a = activeUser(s)
      const r = findRental(s, id)
      if (![r.owner_id, r.borrower_id].includes(a.id)) throw new Error('Rental not found.')
      if (r.status !== 'accepted') throw new Error('Handover can only be confirmed on an accepted rental.')
      if (a.id === r.owner_id) r.owner_handover_confirmed_at ??= now()
      else r.borrower_handover_confirmed_at ??= now()
      if (r.owner_handover_confirmed_at && r.borrower_handover_confirmed_at) {
        r.status = 'active'; r.start_date = todayISO(); r.due_date = addDays(todayISO(), r.period_days)
      }
      r.updated_at = now()
      notify(s, a.id === r.owner_id ? r.borrower_id : r.owner_id, 'handover_confirmed', 'Handover confirmed',
        r.status === 'active' ? `Rental started. Due ${r.due_date}` : 'The other party confirmed the handover. Please confirm yours.', '/dashboard')
      write(s)
      return decorateRental(s, r, a.id)
    },
    async requestReturn(id) {
      const s = read()
      const a = activeUser(s)
      const r = findRental(s, id)
      if (r.borrower_id !== a.id) throw new Error('Rental not found.')
      if (!['active', 'overdue'].includes(r.status)) throw new Error('Only an active rental can be returned.')
      r.status = 'return_requested'; r.return_requested_at = now(); r.updated_at = now()
      notify(s, r.owner_id, 'return_requested', 'Return requested', 'The borrower says the book is on its way back. Confirm when you have it.', '/dashboard/requests')
      write(s)
      return decorateRental(s, r, a.id)
    },
    async confirmReturn(id) {
      const s = read()
      const a = activeUser(s)
      const r = findRental(s, id)
      if (r.owner_id !== a.id) throw new Error('Rental not found.')
      if (!['active', 'overdue', 'return_requested'].includes(r.status)) throw new Error('This rental is not currently out on loan.')
      r.status = 'completed'; r.return_confirmed_at = now(); r.updated_at = now()
      sync(s, r.listing_id)
      notify(s, r.borrower_id, 'rental_completed', 'Rental completed', 'The owner confirmed the return. Thanks for borrowing!', '/dashboard/borrowings')
      write(s)
      return decorateRental(s, r, a.id)
    },
    async markOverdue() {
      const s = read()
      if (!s.sessionUserId) return
      let changed = false
      s.rentals.forEach((r) => {
        if (r.status === 'active' && r.due_date && r.due_date < todayISO()) { r.status = 'overdue'; changed = true }
      })
      if (changed) write(s)
    },
  },

  orders: {
    async mine() {
      const s = read()
      const a = activeUser(s)
      return s.orders.filter((o) => o.seller_id === a.id || o.buyer_id === a.id)
        .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).map((o) => decorateOrder(s, o, a.id))
    },
    async create(listingId) {
      const s = read()
      const a = activeUser(s)
      rateLimit(s.orders.filter((o) => o.buyer_id === a.id), 10, 'Too many requests. Please try again later.')
      const l = s.listings.find((x) => x.id === listingId)
      if (!l || l.hidden || l.status !== 'active' || !ownerOk(s, l)) throw new Error('This book is not available right now.')
      if (l.owner_id === a.id) throw new Error('You cannot buy your own book.')
      if (l.listing_type === 'rent') throw new Error('This book is not for sale.')
      if (busy(s, l.id)) throw new Error('This book is currently reserved or on loan.')
      if (s.orders.some((o) => o.listing_id === l.id && o.buyer_id === a.id && o.status === 'requested')) throw new Error('You already have a pending order for this book.')
      const o: Order = {
        id: uuid(), listing_id: l.id, seller_id: l.owner_id, buyer_id: a.id, item_price: l.sale_price!,
        platform_fee: platformFee(l.sale_price!, s.settings.sale_commission_pct), commission_pct: s.settings.sale_commission_pct, delivery_fee: 0,
        total_amount: l.sale_price!, settlement_status: 'not_due', status: 'requested', payment_status: 'unpaid', handover_method: 'local_pickup', decline_reason: null,
        seller_confirmed_at: null, buyer_confirmed_at: null, created_at: now(), updated_at: now(),
      }
      s.orders.push(o)
      notify(s, l.owner_id, 'order_requested', 'New purchase request', `Someone wants to buy "${l.title}".`, '/dashboard/requests')
      write(s)
      return decorateOrder(s, o, a.id)
    },
    async respond(id, accept, reason) {
      const s = read()
      const a = activeUser(s)
      const o = findOrder(s, id)
      if (o.seller_id !== a.id) throw new Error('Order not found.')
      if (o.status !== 'requested') throw new Error('This order was already answered or cancelled.')
      const l = s.listings.find((x) => x.id === o.listing_id)!
      if (accept) {
        if (l.status !== 'active' || l.hidden || busy(s, l.id)) throw new Error('This book is no longer available to sell.')
        o.status = 'accepted'
        s.orders.filter((x) => x.listing_id === l.id && x.status === 'requested' && x.id !== o.id).forEach((x) => {
          x.status = 'declined'; x.decline_reason = 'The seller accepted another order'
          notify(s, x.buyer_id, 'order_declined', 'Order declined', `"${l.title}" was sold to someone else.`, '/dashboard/purchases')
        })
        sync(s, l.id)
        notify(s, o.buyer_id, 'order_accepted', 'Order accepted', `Your order for "${l.title}" was accepted. See handover details.`, '/dashboard/purchases')
      } else {
        o.status = 'declined'; o.decline_reason = reason?.trim().slice(0, 300) || null
        notify(s, o.buyer_id, 'order_declined', 'Order declined', `Your order for "${l.title}" was declined.`, '/dashboard/purchases')
      }
      o.updated_at = now()
      write(s)
      return decorateOrder(s, o, a.id)
    },
    async cancel(id) {
      const s = read()
      const a = activeUser(s)
      const o = findOrder(s, id)
      if (![o.seller_id, o.buyer_id].includes(a.id)) throw new Error('Order not found.')
      if (!(o.status === 'requested' && a.id === o.buyer_id) && o.status !== 'accepted') {
        throw new Error('This order can no longer be cancelled. Open a dispute if there is a problem.')
      }
      o.status = 'cancelled'; o.updated_at = now()
      sync(s, o.listing_id)
      notify(s, a.id === o.seller_id ? o.buyer_id : o.seller_id, 'order_cancelled', 'Order cancelled', 'An order was cancelled.', '/dashboard')
      write(s)
      return decorateOrder(s, o, a.id)
    },
    async confirmHandover(id) {
      const s = read()
      const a = activeUser(s)
      const o = findOrder(s, id)
      if (![o.seller_id, o.buyer_id].includes(a.id)) throw new Error('Order not found.')
      if (o.status !== 'accepted') throw new Error('Handover can only be confirmed on an accepted order.')
      if (a.id === o.seller_id) o.seller_confirmed_at ??= now()
      else o.buyer_confirmed_at ??= now()
      if (o.seller_confirmed_at && o.buyer_confirmed_at) { o.status = 'completed'; sync(s, o.listing_id) }
      o.updated_at = now()
      notify(s, a.id === o.seller_id ? o.buyer_id : o.seller_id, 'order_handover', 'Handover confirmed',
        o.status === 'completed' ? 'The purchase is complete.' : 'The other party confirmed the handover. Please confirm yours.', '/dashboard')
      write(s)
      return decorateOrder(s, o, a.id)
    },
  },

  transactions: {
    async handoverInfo(kind: TxKind, id): Promise<HandoverInfo> {
      const s = read()
      const a = activeUser(s)
      const none: HandoverInfo = { exact_address: null, handover_notes: null, counterparty_phone: null }
      if (kind === 'rental') {
        const r = findRental(s, id)
        if (![r.owner_id, r.borrower_id].includes(a.id) || !BLOCKING_R.includes(r.status)) return none
        const other = account(s, a.id === r.owner_id ? r.borrower_id : r.owner_id)
        const p = s.listingPrivate[r.listing_id]
        return { exact_address: p?.exact_address ?? null, handover_notes: p?.handover_notes ?? null, counterparty_phone: other?.phone ?? null }
      }
      const o = findOrder(s, id)
      if (![o.seller_id, o.buyer_id].includes(a.id) || !['accepted', 'disputed'].includes(o.status)) return none
      const other = account(s, a.id === o.seller_id ? o.buyer_id : o.seller_id)
      const p = s.listingPrivate[o.listing_id]
      return { exact_address: p?.exact_address ?? null, handover_notes: p?.handover_notes ?? null, counterparty_phone: other?.phone ?? null }
    },
    async markPaymentReceived(kind, id) {
      const s = read()
      const a = activeUser(s)
      if (s.settings.payments_live && s.settings.payment_provider !== 'manual') {
        throw new Error('Online payments are enabled. Payment is confirmed automatically once the provider verifies it.')
      }
      const open = ['unpaid', 'failed', 'awaiting_payment']
      if (kind === 'rental') {
        const r = findRental(s, id)
        if (r.owner_id !== a.id || !open.includes(r.payment_status) || !['accepted', 'active', 'return_requested', 'overdue', 'completed'].includes(r.status)) throw new Error('Transaction not found or not ready for payment confirmation.')
        r.payment_status = 'manual_received' // an owner's unverified note; never 'paid', never revenue
      } else {
        const o = findOrder(s, id)
        if (o.seller_id !== a.id || !open.includes(o.payment_status) || !['accepted', 'completed'].includes(o.status)) throw new Error('Transaction not found or not ready for payment confirmation.')
        o.payment_status = 'manual_received'
      }
      write(s)
    },
    async review(kind, id, rating, comment) {
      const s = read()
      const a = activeUser(s)
      if (rating < 1 || rating > 5) throw new Error('Rating must be 1 to 5.')
      const t = kind === 'rental' ? findRental(s, id) : findOrder(s, id)
      const [x, y] = kind === 'rental' ? [(t as Rental).owner_id, (t as Rental).borrower_id] : [(t as Order).seller_id, (t as Order).buyer_id]
      if (t.status !== 'completed' || ![x, y].includes(a.id)) throw new Error('You can only review completed transactions you took part in.')
      const dup = s.reviews.some((v) => v.reviewer_id === a.id && (kind === 'rental' ? v.rental_id === id : v.order_id === id))
      if (dup) throw new Error('You already reviewed this transaction.')
      s.reviews.push({
        id: uuid(), rental_id: kind === 'rental' ? id : null, order_id: kind === 'order' ? id : null,
        reviewer_id: a.id, reviewee_id: a.id === x ? y : x, rating, comment: comment.trim().slice(0, 500) || null, created_at: now(),
      })
      write(s)
    },
  },

  reviews: {
    async recent(n) {
      const s = read()
      return s.reviews.filter((r) => r.comment).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, n)
        .map<PublicReview>((r) => ({
          id: r.id, rating: r.rating, comment: r.comment!, created_at: r.created_at,
          reviewer_name: account(s, r.reviewer_id)?.profile.display_name ?? 'Member', is_sample: r.is_sample,
        }))
    },
    async summary(): Promise<ReviewSummary> {
      const rs = read().reviews
      return {
        count: rs.length,
        avg: rs.length ? rs.reduce((t, r) => t + r.rating, 0) / rs.length : 0,
        positivePct: rs.length ? Math.round((rs.filter((r) => r.rating >= 4).length / rs.length) * 100) : 0,
      }
    },
  },

  payments: {
    // Demo checkout: walks through the same steps as a real provider, but NO money moves and NOTHING is marked `paid`.
    async start(kind, id): Promise<PayStart> {
      const s = read()
      const a = activeUser(s)
      const t = txOf(s, kind, id)
      const { payerId, ownerId } = partiesOf(kind, t)
      if (payerId !== a.id) throw new Error('Transaction not found.')
      const ready = kind === 'rental' ? ['accepted', 'active', 'return_requested', 'overdue'].includes(t.status) : t.status === 'accepted'
      if (!ready) throw new Error(kind === 'rental' ? 'This rental is not ready for payment.' : 'This order is not ready for payment.')
      if (!['unpaid', 'failed', 'awaiting_payment'].includes(t.payment_status)) throw new Error('This transaction has already been paid or is being refunded.')
      let p = s.payments.find((x) => x.tx_kind === kind && x.tx_id === id && x.status === 'created')
      if (!p) {
        const gross = grossOf(kind, t)
        p = {
          id: uuid(), tx_kind: kind, tx_id: id, payer_id: payerId, owner_id: ownerId, provider: 'demo', provider_order_id: `demo_order_${uuid().slice(0, 8)}`,
          provider_payment_id: null, method: null, amount: gross, currency: s.settings.currency, commission_amount: t.platform_fee,
          owner_net_amount: r2(gross - t.platform_fee), refunded_amount: 0, status: 'created', is_demo: true, failure_reason: null,
          created_at: now(), captured_at: null,
        }
        s.payments.push(p)
      }
      t.payment_status = 'awaiting_payment'
      write(s)
      return { mode: 'demo', provider: 'demo', payment_id: p.id, amount: p.amount, currency: p.currency, commission: p.commission_amount, owner_net: p.owner_net_amount, order_id: p.provider_order_id ?? undefined }
    },
    async verify(kind, id) {
      const s = read()
      const a = activeUser(s)
      const t = txOf(s, kind, id)
      if (partiesOf(kind, t).payerId !== a.id) throw new Error('Transaction not found.')
      const p = s.payments.find((x) => x.tx_kind === kind && x.tx_id === id && ['created', 'captured'].includes(x.status))
      if (!p) throw new Error('Payment not found.')
      if (p.status === 'captured') return { status: 'captured' } // idempotent
      p.status = 'captured'; p.method = 'demo'; p.captured_at = now(); p.provider_payment_id = `demo_pay_${p.id.slice(0, 8)}`
      t.payment_status = 'demo_simulated' // never 'paid' in demo mode
      t.settlement_status = 'pending'
      addLedger(s, p, captureEntries(p.id, p.amount, p.commission_amount))
      s.settlements.push({ id: uuid(), tx_kind: kind, tx_id: id, payment_id: p.id, owner_id: p.owner_id, amount: p.owner_net_amount, currency: p.currency, status: 'pending', is_demo: true, settled_at: null, created_at: now() })
      notify(s, p.owner_id, 'payment_received', 'Demo payment received', 'A demo payment was simulated. No real money moved.', '/dashboard/earnings')
      write(s)
      return { status: 'captured' }
    },
    async mine() {
      const s = read(); const a = activeUser(s)
      return s.payments.filter((p) => p.payer_id === a.id).map((p) => decoratePayment(s, p)).sort(byNewest)
    },
    async forOwner() {
      const s = read(); const a = activeUser(s)
      return s.payments.filter((p) => p.owner_id === a.id).map((p) => decoratePayment(s, p)).sort(byNewest)
    },
    async payoutAccount() {
      const s = read(); const a = activeUser(s)
      return clone(s.payoutAccounts.find((x) => x.owner_id === a.id) ?? null)
    },
  },

  reports: {
    async create(v) {
      const s = read()
      const a = activeUser(s)
      if (!v.reason.trim()) throw new Error('Please choose a reason.')
      rateLimit(s.reports.filter((r) => r.reporter_id === a.id), 10, 'Too many reports. Please try again later.')
      if (v.target_type === 'listing') {
        const l = s.listings.find((x) => x.id === v.target_id)
        if (!l) throw new Error('Listing not found.')
        if (l.owner_id === a.id) throw new Error('You cannot report your own listing.')
      } else if (v.target_type === 'user') {
        if (!account(s, v.target_id)) throw new Error('User not found.')
        if (v.target_id === a.id) throw new Error('You cannot report yourself.')
      } else if (v.target_type === 'rental') {
        const r = findRental(s, v.target_id)
        if (![r.owner_id, r.borrower_id].includes(a.id)) throw new Error('Rental not found.')
        if (v.kind === 'dispute') {
          if (!['active', 'return_requested', 'overdue'].includes(r.status)) throw new Error('A dispute can only be opened on a rental that is in progress.')
          r.status = 'disputed'
        }
      } else {
        const o = findOrder(s, v.target_id)
        if (![o.seller_id, o.buyer_id].includes(a.id)) throw new Error('Order not found.')
        if (v.kind === 'dispute') {
          if (o.status !== 'accepted') throw new Error('A dispute can only be opened on an accepted order.')
          o.status = 'disputed'
        }
      }
      if (v.kind === 'dispute' && !['rental', 'order'].includes(v.target_type)) throw new Error('Disputes apply to rentals and orders.')
      s.reports.unshift({
        id: uuid(), reporter_id: a.id, target_type: v.target_type, target_id: v.target_id, kind: v.kind,
        reason: v.reason.trim().slice(0, 100), details: v.details.trim().slice(0, 1000) || null, status: 'open', resolution_note: null, created_at: now(),
      })
      s.accounts.filter((x) => x.profile.role === 'admin' && !x.profile.suspended).forEach((x) =>
        notify(s, x.id, 'report', v.kind === 'dispute' ? 'New dispute' : 'New report', v.reason, '/admin/reports'))
      write(s)
    },
  },

  notifications: {
    async list() {
      const s = read()
      const a = activeUser(s)
      return clone(s.notifications.filter((n) => n.user_id === a.id).slice(0, 30))
    },
    async markRead(id) {
      const s = read()
      const a = activeUser(s)
      s.notifications.filter((n) => n.user_id === a.id && (id === 'all' || n.id === id) && !n.read_at).forEach((n) => { n.read_at = now() })
      write(s)
    },
  },

  admin: {
    async isAdmin() {
      const s = read()
      const a = account(s, s.sessionUserId)
      return !!a && a.profile.role === 'admin' && !a.profile.suspended
    },
    async stats(): Promise<AdminStats> {
      const s = read()
      requireAdmin(s)
      const tally = (xs: { status: string }[]) => xs.reduce<Record<string, number>>((m, x) => { m[x.status] = (m[x.status] ?? 0) + 1; return m }, {})
      const real = s.ledger.filter((e) => !e.is_demo)
      const sum = (types: string[]) => r2(real.filter((e) => types.includes(e.entry_type)).reduce((t, e) => t + e.amount, 0))
      return {
        users: s.accounts.length, suspended_users: s.accounts.filter((a) => a.profile.suspended).length,
        listings: s.listings.filter((l) => l.status !== 'removed').length, hidden_listings: s.listings.filter((l) => l.hidden).length,
        rentals: tally(s.rentals), orders: tally(s.orders), open_reports: s.reports.filter((r) => r.status === 'open').length,
        // revenue is derived from the ledger of provider-verified money only (demo entries are excluded)
        gross_volume: sum(['gross_captured', 'refund_gross']), platform_fees: sum(['platform_commission', 'commission_reversal']),
        refunded_total: -sum(['refund_gross']),
        pending_settlement: r2(s.settlements.filter((x) => !x.is_demo && ['pending', 'processing'].includes(x.status)).reduce((t, x) => t + x.amount, 0)),
        manual_commission_accrued: r2([...s.rentals, ...s.orders].filter((t) => t.payment_status === 'manual_received').reduce((t, x) => t + x.platform_fee, 0)),
      }
    },
    async users(): Promise<Profile[]> {
      const s = read(); requireAdmin(s)
      return s.accounts.map((a) => clone(a.profile))
    },
    async listings() {
      const s = read(); requireAdmin(s)
      return s.listings.map((l) => withOwner(s, l)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    },
    async rentals() {
      const s = read(); requireAdmin(s)
      return s.rentals.map((r) => decorateRental(s, r)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    },
    async orders() {
      const s = read(); requireAdmin(s)
      return s.orders.map((o) => decorateOrder(s, o)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    },
    async reports() {
      const s = read(); requireAdmin(s)
      return s.reports.map((r) => ({ ...clone(r), reporter: mini(s, r.reporter_id) }))
    },
    async setUserSuspended(id, suspended) {
      const s = read()
      const admin = requireAdmin(s)
      const t = account(s, id)
      if (!t) throw new Error('User not found.')
      if (t.id === admin.id && suspended) throw new Error('Admins cannot suspend themselves.')
      t.profile.suspended = suspended
      write(s)
    },
    async setListingModeration(id, v) {
      const s = read(); requireAdmin(s)
      const l = s.listings.find((x) => x.id === id)
      if (!l) throw new Error('Listing not found.')
      if (v.hidden != null) l.hidden = v.hidden
      if (v.flagged != null) l.flagged = v.flagged
      write(s)
    },
    async resolveReport(id, status, note, outcome) {
      const s = read(); requireAdmin(s)
      const rep = s.reports.find((r) => r.id === id)
      if (!rep || rep.status !== 'open') throw new Error('Report not found or already closed.')
      if (rep.kind === 'dispute') {
        if (rep.target_type === 'rental') {
          const r = s.rentals.find((x) => x.id === rep.target_id)
          if (r?.status === 'disputed') {
            if (!outcome || !['active', 'completed', 'cancelled'].includes(outcome)) throw new Error('Choose an outcome for the disputed rental (active, completed or cancelled).')
            r.status = outcome as Rental['status']
            if (outcome === 'completed') r.return_confirmed_at = now()
            sync(s, r.listing_id)
            ;[r.owner_id, r.borrower_id].forEach((u) => notify(s, u, 'dispute_resolved', 'Dispute resolved', `Outcome: ${outcome}`, '/dashboard'))
          }
        } else if (rep.target_type === 'order') {
          const o = s.orders.find((x) => x.id === rep.target_id)
          if (o?.status === 'disputed') {
            if (!outcome || !['accepted', 'completed', 'cancelled'].includes(outcome)) throw new Error('Choose an outcome for the disputed order (accepted, completed or cancelled).')
            o.status = outcome as Order['status']
            sync(s, o.listing_id)
            ;[o.seller_id, o.buyer_id].forEach((u) => notify(s, u, 'dispute_resolved', 'Dispute resolved', `Outcome: ${outcome}`, '/dashboard'))
          }
        }
      }
      rep.status = status
      rep.resolution_note = note.trim().slice(0, 500) || null
      write(s)
    },
    async updateSettings(v) {
      const s = read(); requireAdmin(s)
      for (const [label, pct] of [['Rental', v.rental_commission_pct], ['Sale', v.sale_commission_pct]] as const) {
        if (!(pct >= 0 && pct <= 50)) throw new Error(`${label} commission must be between 0 and 50%.`)
      }
      if (!/^[A-Z]{3}$/.test(v.currency)) throw new Error('Currency must be a 3-letter code, e.g. INR.')
      if (!['manual', 'razorpay', 'cashfree'].includes(v.payment_provider)) throw new Error('Unknown payment provider.')
      if (v.payments_live) throw new Error('Live payments cannot be enabled in demo mode. Connect Supabase, configure provider credentials and get provider approval first.')
      s.settings = {
        rental_commission_pct: v.rental_commission_pct, sale_commission_pct: v.sale_commission_pct, currency: v.currency,
        launch_city: v.launch_city.trim().slice(0, 80), payment_provider: v.payment_provider, payments_live: false,
      }
      write(s)
    },
    async payments() {
      const s = read(); requireAdmin(s)
      return s.payments.map((p) => decoratePayment(s, p)).sort(byNewest)
    },
    async ledger(limit = 200) {
      const s = read(); requireAdmin(s)
      return clone([...s.ledger].sort((a, b) => b.seq - a.seq).slice(0, limit))
    },
    async refund(paymentId, amount, reason) {
      const s = read(); requireAdmin(s)
      const p = s.payments.find((x) => x.id === paymentId)
      if (!p || !['captured', 'partially_refunded'].includes(p.status)) throw new Error('Payment cannot be refunded.')
      if (!(amount > 0) || r2(amount) > r2(p.amount - p.refunded_amount)) throw new Error('Refund amount exceeds what is refundable.')
      const refundRef = `demo-refund-${uuid()}`
      addLedger(s, p, refundEntries(refundRef, p.amount, p.commission_amount, p.refunded_amount, r2(amount)))
      const split = refundSplit(p.amount, p.commission_amount, p.refunded_amount, r2(amount))
      p.refunded_amount = r2(p.refunded_amount + amount)
      const full = p.refunded_amount >= p.amount
      p.status = full ? 'refunded' : 'partially_refunded'
      setTxPayment(s, p, full ? 'refunded' : 'partially_refunded')
      const st = s.settlements.find((x) => x.payment_id === p.id)
      if (st && ['pending', 'processing'].includes(st.status)) {
        st.amount = Math.max(0, r2(st.amount - split.owner))
        if (full) { st.status = 'reversed'; setTxPayment(s, p, 'refunded', 'reversed') }
      }
      notify(s, p.payer_id, 'refund_processed', 'Refund processed', `A ${p.is_demo ? 'demo ' : ''}refund of ${r2(amount)} ${p.currency} was issued${reason ? `: ${reason}` : ''}.`, '/dashboard/payments')
      write(s)
    },
    async reconciliation(): Promise<ReconciliationReport> {
      const s = read(); requireAdmin(s)
      const issues: ReconciliationIssue[] = []
      for (const p of s.payments.filter((x) => ['captured', 'refund_pending', 'partially_refunded', 'refunded'].includes(x.status))) {
        const entries = s.ledger.filter((e) => e.payment_id === p.id)
        if (!entries.length) { issues.push({ severity: 'error', code: 'missing_ledger', message: 'Captured payment has no ledger entries.', ref: p.id }); continue }
        const inv = checkInvariant(entries)
        if (!inv.ok) issues.push({ severity: 'error', code: 'ledger_imbalance', message: `Ledger is out of balance by ${inv.diff}`, ref: p.id })
        const gross = r2(entries.filter((e) => ['gross_captured', 'refund_gross'].includes(e.entry_type)).reduce((t, e) => t + e.amount, 0))
        if (Math.abs(gross - (p.amount - p.refunded_amount)) >= 0.005) issues.push({ severity: 'error', code: 'payment_ledger_mismatch', message: `Payment net of refunds ${r2(p.amount - p.refunded_amount)} differs from ledger ${gross}`, ref: p.id })
        const t = p.tx_kind === 'rental' ? s.rentals.find((x) => x.id === p.tx_id) : s.orders.find((x) => x.id === p.tx_id)
        if (p.status === 'captured' && t && !['paid', 'demo_simulated', 'refund_pending'].includes(t.payment_status)) issues.push({ severity: 'error', code: 'tx_status_mismatch', message: `Payment is captured but its transaction shows ${t.payment_status}`, ref: p.id })
      }
      for (const st of s.settlements) {
        if (st.status === 'settled' && !st.is_demo) {
          const own = s.ledger.filter((e) => e.payment_id === st.payment_id)
          const overpaid = r2(-own.filter((e) => e.entry_type === 'owner_payout').reduce((t, e) => t + e.amount, 0) - own.filter((e) => ['owner_earning', 'owner_earning_reversal'].includes(e.entry_type)).reduce((t, e) => t + e.amount, 0))
          if (overpaid >= 0.005) issues.push({ severity: 'warning', code: 'overpaid_owner', message: `Owner was paid ${overpaid} more than their earnings after refunds; reverse the transfer with the provider.`, ref: st.id })
        }
        if (['pending', 'processing', 'failed'].includes(st.status) && !st.is_demo && Date.now() - Date.parse(st.created_at) > 7 * 86_400_000) issues.push({ severity: 'warning', code: 'settlement_overdue', message: 'Settlement has not completed after 7 days.', ref: st.id })
      }
      const real = s.ledger.filter((e) => !e.is_demo)
      const sum = (types: string[], list = real) => r2(list.filter((e) => types.includes(e.entry_type)).reduce((t, e) => t + e.amount, 0))
      return {
        generated_at: now(), issues,
        totals: {
          gross_captured: sum(['gross_captured']), refunded: -sum(['refund_gross']), commission_revenue: sum(['platform_commission', 'commission_reversal']),
          owner_earned: sum(['owner_earning', 'owner_earning_reversal']), owner_paid_out: -sum(['owner_payout']),
          pending_settlement: r2(s.settlements.filter((x) => !x.is_demo && ['pending', 'processing'].includes(x.status)).reduce((t, x) => t + x.amount, 0)),
          demo_gross: sum(['gross_captured'], s.ledger.filter((e) => e.is_demo)),
          manual_commission_accrued: r2([...s.rentals, ...s.orders].filter((t) => t.payment_status === 'manual_received').reduce((t, x) => t + x.platform_fee, 0)),
        },
      }
    },
    async payoutAccounts() {
      const s = read(); requireAdmin(s)
      return s.payoutAccounts.map((x) => ({ ...clone(x), owner_name: account(s, x.owner_id)?.profile.display_name }))
    },
    async setPayoutAccount(ownerId, provider, accountId, status) {
      const s = read(); requireAdmin(s)
      if (status === 'active' && !accountId.trim()) throw new Error('An active payout account needs the provider account id.')
      const existing = s.payoutAccounts.find((x) => x.owner_id === ownerId)
      const next: PayoutAccount = { owner_id: ownerId, provider, provider_account_id: accountId.trim() || null, status, updated_at: now() }
      if (existing) Object.assign(existing, next); else s.payoutAccounts.push(next)
      write(s)
    },
    async reconcileSettlements() { return { checked: 0, updated: 0 } },
  },

  demo: {
    reset() {
      write(seed())
    },
    /** Demo only: pretend the provider settled the owner's payout. */
    async settle(paymentId: string) {
      const s = read(); requireAdmin(s)
      const p = s.payments.find((x) => x.id === paymentId)
      const st = s.settlements.find((x) => x.payment_id === paymentId)
      if (!p || !st || !['pending', 'processing'].includes(st.status)) throw new Error('Nothing to settle for this payment.')
      st.status = 'settled'; st.settled_at = now()
      addLedger(s, p, [payoutEntry(st.id, st.amount)])
      setTxPayment(s, p, undefined, 'settled')
      notify(s, st.owner_id, 'payout_settled', 'Demo payout settled', 'A demo payout was simulated. No real money moved.', '/dashboard/earnings')
      write(s)
    },
  },
}
