import { PAGE_SIZE } from '../constants'
import { compressImage } from '../image'
import { normalizeListingInput } from '../rules'
import { supabase } from '../supabase'
import type {
  AdminStats, HandoverInfo, Listing, ListingFilters, ListingInput, ListingPrivate, Notification, Order, Profile,
  PublicReview, Rental, Report, ReviewSummary, Settings,
} from '../types'
import type { Api, TxKind } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */

function fail(error: { message: string } | null): never {
  throw new Error(error?.message || 'Something went wrong. Please try again.')
}
function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) fail(res.error)
  return res.data as T
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Please sign in first.')
  return id
}

const OWNER = 'owner:profiles!listings_owner_id_fkey(id,display_name,city)'
const LISTING_SUMMARY = 'listing:listings(id,title,author,image_urls,pickup_area,category)'
const RENTAL_SELECT = `*, ${LISTING_SUMMARY}, owner:profiles!rentals_owner_id_fkey(id,display_name,city), borrower:profiles!rentals_borrower_id_fkey(id,display_name,city)`
const ORDER_SELECT = `*, ${LISTING_SUMMARY}, seller:profiles!orders_seller_id_fkey(id,display_name,city), buyer:profiles!orders_buyer_id_fkey(id,display_name,city)`

/** Strip characters that have meaning inside a PostgREST `or=()` filter or a LIKE pattern. */
const safeTerm = (s: string) => s.replace(/[%_\\,()"'*:]/g, ' ').replace(/\s+/g, ' ').trim()

function listingFields(i: ListingInput) {
  const n = normalizeListingInput(i)
  return {
    title: n.title, author: n.author, isbn: n.isbn || null, category: n.category,
    description: n.description.trim() || null, condition: n.condition, image_urls: n.image_urls,
    listing_type: n.listing_type, rental_price: n.rental_price, rental_period_options: n.rental_period_options,
    sale_price: n.sale_price, pickup_area: n.pickup_area, status: n.status,
  }
}

async function markReviewed<T extends { id: string; reviewed?: boolean }>(rows: T[], kind: TxKind, me: string) {
  if (!rows.length) return rows
  const col = kind === 'rental' ? 'rental_id' : 'order_id'
  const { data } = await supabase.from('reviews').select(col).eq('reviewer_id', me).in(col, rows.map((r) => r.id))
  const done = new Set((data ?? []).map((d: any) => d[col]))
  return rows.map((r) => ({ ...r, reviewed: done.has(r.id) }))
}

export const supabaseApi: Api = {
  mode: 'supabase',

  auth: {
    async getUser() {
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      return u ? { id: u.id, email: u.email ?? '' } : null
    },
    async signUp(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { display_name: displayName } },
      })
      if (error) fail(error)
      return { needsConfirmation: !data.session }
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) fail(error)
    },
    async signOut() {
      await supabase.auth.signOut()
    },
    onChange(cb) {
      const { data } = supabase.auth.onAuthStateChange(() => cb())
      return () => data.subscription.unsubscribe()
    },
  },

  profiles: {
    async mine() {
      const { data } = await supabase.auth.getSession()
      const id = data.session?.user.id
      if (!id) return null
      const profile = ok(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null
      if (!profile) return null
      const priv = ok(await supabase.from('profile_private').select('phone').eq('id', id).maybeSingle()) as { phone: string | null } | null
      return { profile, phone: priv?.phone ?? null }
    },
    async updateMine(v) {
      const id = await uid()
      ok(await supabase.from('profiles').update({ display_name: v.display_name.trim(), city: v.city.trim() || null }).eq('id', id).select('id').single())
      ok(await supabase.from('profile_private').update({ phone: v.phone.trim() || null }).eq('id', id).select('id').single())
    },
    async rating(userId) {
      const rows = ok(await supabase.from('reviews').select('rating').eq('reviewee_id', userId)) as { rating: number }[]
      const count = rows.length
      return { count, avg: count ? rows.reduce((s, r) => s + r.rating, 0) / count : 0 }
    },
  },

  settings: {
    async get() {
      return ok(await supabase.from('admin_settings').select('commission_pct,currency,launch_city').eq('id', 1).single()) as Settings
    },
  },

  listings: {
    async search(f: ListingFilters) {
      let q = supabase.from('listings').select(`*, ${OWNER}`, { count: 'exact' }).eq('status', 'active')
      const term = safeTerm(f.q)
      if (term) {
        const p = `%${term}%`
        q = q.or(`title.ilike.${p},author.ilike.${p},isbn.ilike.${p},description.ilike.${p},category.ilike.${p}`)
      }
      if (f.category) q = q.eq('category', f.category)
      if (f.type === 'rent') q = q.in('listing_type', ['rent', 'both'])
      if (f.type === 'sale') q = q.in('listing_type', ['sale', 'both'])
      if (f.conditions.length) q = q.in('condition', f.conditions)
      const area = safeTerm(f.area)
      if (area) q = q.ilike('pickup_area', `%${area}%`)

      const range = (col: string) => {
        const parts: string[] = []
        if (f.minPrice != null) parts.push(`${col}.gte.${f.minPrice}`)
        if (f.maxPrice != null) parts.push(`${col}.lte.${f.maxPrice}`)
        return parts.join(',')
      }
      if (f.minPrice != null || f.maxPrice != null) {
        if (f.type === 'rent') q = q.or(`and(${range('rental_price')})`)
        else if (f.type === 'sale') q = q.or(`and(${range('sale_price')})`)
        else q = q.or(`and(${range('rental_price')}),and(${range('sale_price')})`)
      }

      if (f.sort === 'price_asc') q = q.order('display_price', { ascending: true })
      else if (f.sort === 'price_desc') q = q.order('display_price', { ascending: false })
      q = q.order('created_at', { ascending: false })

      const from = (Math.max(1, f.page) - 1) * PAGE_SIZE
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) fail(error)
      return { items: (data ?? []) as unknown as Listing[], total: count ?? 0 }
    },
    async recent(n) {
      const data = ok(await supabase.from('listings').select(`*, ${OWNER}`).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(n))
      return data as unknown as Listing[]
    },
    async get(id) {
      const { data, error } = await supabase.from('listings').select(`*, ${OWNER}`).eq('id', id).maybeSingle()
      if (error) fail(error)
      return (data as unknown as Listing) ?? null
    },
    async getPrivate(id) {
      const { data } = await supabase.from('listing_private').select('exact_address,handover_notes').eq('listing_id', id).maybeSingle()
      return (data as ListingPrivate | null) ?? null
    },
    async mine() {
      const id = await uid()
      return ok(await supabase.from('listings').select('*').eq('owner_id', id).neq('status', 'removed')
        .order('created_at', { ascending: false })) as unknown as Listing[]
    },
    async create(input) {
      const id = await uid()
      const row = ok(await supabase.from('listings').insert({ ...listingFields(input), owner_id: id }).select('*').single()) as Listing
      ok(await supabase.from('listing_private').insert({
        listing_id: row.id, exact_address: input.exact_address.trim() || null, handover_notes: input.handover_notes.trim() || null,
      }).select('listing_id').single())
      return row
    },
    async update(id, input) {
      const row = ok(await supabase.from('listings').update(listingFields(input)).eq('id', id).select('*').single()) as Listing
      ok(await supabase.from('listing_private').upsert({
        listing_id: id, exact_address: input.exact_address.trim() || null, handover_notes: input.handover_notes.trim() || null,
      }).select('listing_id').single())
      return row
    },
    async setStatus(id, status) {
      ok(await supabase.from('listings').update({ status }).eq('id', id).select('id').single())
    },
    async uploadImage(file) {
      const me = await uid()
      const blob = await compressImage(file)
      const path = `${me}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('book-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (error) fail(error)
      return supabase.storage.from('book-images').getPublicUrl(path).data.publicUrl
    },
  },

  rentals: {
    async mine() {
      const me = await uid()
      const rows = ok(await supabase.from('rentals').select(RENTAL_SELECT)
        .or(`owner_id.eq.${me},borrower_id.eq.${me}`).order('created_at', { ascending: false })) as unknown as Rental[]
      return markReviewed(rows, 'rental', me)
    },
    async request(listingId, days) {
      return ok(await supabase.rpc('request_rental', { p_listing: listingId, p_days: days })) as Rental
    },
    async respond(id, accept, reason) {
      return ok(await supabase.rpc('respond_rental', { p_id: id, p_accept: accept, p_reason: reason ?? null })) as Rental
    },
    async cancel(id) { return ok(await supabase.rpc('cancel_rental', { p_id: id })) as Rental },
    async confirmHandover(id) { return ok(await supabase.rpc('confirm_handover_rental', { p_id: id })) as Rental },
    async requestReturn(id) { return ok(await supabase.rpc('request_return', { p_id: id })) as Rental },
    async confirmReturn(id) { return ok(await supabase.rpc('confirm_return', { p_id: id })) as Rental },
    async markOverdue() { await supabase.rpc('mark_overdue') },
  },

  orders: {
    async mine() {
      const me = await uid()
      const rows = ok(await supabase.from('orders').select(ORDER_SELECT)
        .or(`seller_id.eq.${me},buyer_id.eq.${me}`).order('created_at', { ascending: false })) as unknown as Order[]
      return markReviewed(rows, 'order', me)
    },
    async create(listingId) { return ok(await supabase.rpc('create_order', { p_listing: listingId })) as Order },
    async respond(id, accept, reason) {
      return ok(await supabase.rpc('respond_order', { p_id: id, p_accept: accept, p_reason: reason ?? null })) as Order
    },
    async cancel(id) { return ok(await supabase.rpc('cancel_order', { p_id: id })) as Order },
    async confirmHandover(id) { return ok(await supabase.rpc('confirm_handover_order', { p_id: id })) as Order },
  },

  transactions: {
    async handoverInfo(kind, id): Promise<HandoverInfo> {
      const me = await uid()
      const t = kind === 'rental'
        ? ok(await supabase.from('rentals').select('listing_id,owner_id,borrower_id').eq('id', id).single()) as any
        : ok(await supabase.from('orders').select('listing_id,seller_id,buyer_id').eq('id', id).single()) as any
      const other = kind === 'rental' ? (t.owner_id === me ? t.borrower_id : t.owner_id) : (t.seller_id === me ? t.buyer_id : t.seller_id)
      // RLS decides whether these rows are visible (only during an accepted/active deal).
      const { data: lp } = await supabase.from('listing_private').select('exact_address,handover_notes').eq('listing_id', t.listing_id).maybeSingle()
      const { data: pp } = await supabase.from('profile_private').select('phone').eq('id', other).maybeSingle()
      return {
        exact_address: (lp as any)?.exact_address ?? null,
        handover_notes: (lp as any)?.handover_notes ?? null,
        counterparty_phone: (pp as any)?.phone ?? null,
      }
    },
    async markPaymentReceived(kind, id) {
      const { error } = await supabase.rpc('mark_payment_received', { p_kind: kind, p_id: id })
      if (error) fail(error)
    },
    async review(kind, id, rating, comment) {
      const { error } = await supabase.rpc('submit_review', { p_kind: kind, p_id: id, p_rating: rating, p_comment: comment || null })
      if (error) fail(error)
    },
  },

  reviews: {
    async recent(n) {
      const rows = ok(await supabase.from('reviews')
        .select('id,rating,comment,created_at,reviewer:profiles!reviews_reviewer_id_fkey(display_name)')
        .not('comment', 'is', null).order('created_at', { ascending: false }).limit(n)) as unknown as
        { id: string; rating: number; comment: string; created_at: string; reviewer: { display_name: string } | null }[]
      return rows.map<PublicReview>((r) => ({ id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at, reviewer_name: r.reviewer?.display_name ?? 'Member' }))
    },
    async summary(): Promise<ReviewSummary> {
      const rows = ok(await supabase.from('reviews').select('rating').limit(5000)) as { rating: number }[]
      const count = rows.length
      return {
        count,
        avg: count ? rows.reduce((t, r) => t + r.rating, 0) / count : 0,
        positivePct: count ? Math.round((rows.filter((r) => r.rating >= 4).length / count) * 100) : 0,
      }
    },
  },

  reports: {
    async create(v) {
      const { error } = await supabase.rpc('create_report', {
        p_target_type: v.target_type, p_target_id: v.target_id, p_kind: v.kind, p_reason: v.reason, p_details: v.details || null,
      })
      if (error) fail(error)
    },
  },

  notifications: {
    async list() {
      return ok(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)) as Notification[]
    },
    async markRead(id) {
      const q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      const { error } = id === 'all' ? await q.not('id', 'is', null) : await q.eq('id', id)
      if (error) fail(error)
    },
  },

  admin: {
    async isAdmin() {
      const me = await supabase.auth.getSession()
      const id = me.data.session?.user.id
      if (!id) return false
      const { data } = await supabase.from('profiles').select('role,suspended').eq('id', id).maybeSingle()
      return data?.role === 'admin' && !data.suspended
    },
    async stats() { return ok(await supabase.rpc('admin_stats')) as AdminStats },
    async users() {
      return ok(await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500)) as Profile[]
    },
    async listings() {
      return ok(await supabase.from('listings').select(`*, ${OWNER}`).order('created_at', { ascending: false }).limit(500)) as unknown as Listing[]
    },
    async rentals() {
      return ok(await supabase.from('rentals').select(RENTAL_SELECT).order('created_at', { ascending: false }).limit(500)) as unknown as Rental[]
    },
    async orders() {
      return ok(await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(500)) as unknown as Order[]
    },
    async reports() {
      return ok(await supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(id,display_name,city)')
        .order('created_at', { ascending: false }).limit(500)) as unknown as Report[]
    },
    async setUserSuspended(id, suspended) {
      ok(await supabase.from('profiles').update({ suspended }).eq('id', id).select('id').single())
    },
    async setListingModeration(id, v) {
      ok(await supabase.from('listings').update(v).eq('id', id).select('id').single())
    },
    async resolveReport(id, status, note, outcome) {
      const { error } = await supabase.rpc('resolve_report', { p_id: id, p_status: status, p_note: note || null, p_outcome: outcome ?? null })
      if (error) fail(error)
    },
    async updateSettings(s) {
      ok(await supabase.from('admin_settings').update({ ...s, updated_at: new Date().toISOString() }).eq('id', 1).select('id').single())
    },
  },
}
