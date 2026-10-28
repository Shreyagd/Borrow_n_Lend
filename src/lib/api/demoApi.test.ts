import { beforeEach, describe, expect, it } from 'vitest'
import { demoApi as api } from './demoApi'
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from './demoSeed'
import type { ListingFilters, ListingInput } from '../types'

const login = (who: string) => api.auth.signIn(`${who}@borrowlend.demo`, DEMO_PASSWORD)
const base: ListingFilters = { q: '', category: '', type: '', conditions: [], minPrice: null, maxPrice: null, area: '', sort: 'newest', page: 1 }
const input = (over: Partial<ListingInput> = {}): ListingInput => ({
  title: 'Test Book', author: 'Tester', isbn: '', category: 'Fiction', description: '', condition: 'good', image_urls: [],
  listing_type: 'both', rental_price: 70, rental_period_options: [7, 14], sale_price: 300, pickup_area: 'Test Area',
  exact_address: '1 Secret Lane', handover_notes: 'ring twice', status: 'active', ...over,
})

// l-sample-1: Asha's "Pride and Prejudice" (rent 40/wk or sale 180)
const L = 'l-sample-1'

beforeEach(() => { api.demo!.reset() })

describe('rental lifecycle', () => {
  it('runs request → accept → both confirm handover → return → complete and updates availability', async () => {
    await login('ravi')
    const req = await api.rentals.request(L, 14)
    expect(req.status).toBe('requested')
    expect(req.rental_amount).toBe(80) // 40/wk * 14d
    expect(req.platform_fee).toBe(12) // 15% rental commission default

    await login('asha')
    expect((await api.rentals.respond(req.id, true)).status).toBe('accepted')
    expect((await api.listings.get(L))!.status).toBe('unavailable')
    await api.rentals.confirmHandover(req.id)

    await login('ravi')
    const active = await api.rentals.confirmHandover(req.id)
    expect(active.status).toBe('active')
    expect(active.due_date).toBeTruthy()
    await api.rentals.requestReturn(req.id)

    await login('asha')
    expect((await api.rentals.confirmReturn(req.id)).status).toBe('completed')
    expect((await api.listings.get(L))!.status).toBe('active')
  })

  it('prevents overlapping rentals of the same copy', async () => {
    await login('ravi')
    const a = await api.rentals.request(L, 7)
    await login('meera')
    const b = await api.rentals.request(L, 7)
    await login('asha')
    await api.rentals.respond(a.id, true)
    // competing request was auto-declined, and cannot be accepted
    await expect(api.rentals.respond(b.id, true)).rejects.toThrow()
    await login('meera')
    await expect(api.rentals.request(L, 7)).rejects.toThrow(/not available/)
  })

  it('rejects own-book, unoffered period and unauthenticated requests', async () => {
    await expect(api.rentals.request(L, 7)).rejects.toThrow(/sign in/i)
    await login('asha')
    await expect(api.rentals.request(L, 7)).rejects.toThrow(/own book/)
    await login('ravi')
    await expect(api.rentals.request(L, 30)).rejects.toThrow(/period/)
    await expect(api.rentals.request('l-sample-5', 7)).rejects.toThrow() // sale-only
  })

  it('only the owner can respond; only the borrower can request return', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 7)
    await expect(api.rentals.respond(r.id, true)).rejects.toThrow()
    await login('meera')
    await expect(api.rentals.cancel(r.id)).rejects.toThrow()
    await login('asha')
    await api.rentals.respond(r.id, true)
    await api.rentals.confirmHandover(r.id)
    await login('ravi')
    await api.rentals.confirmHandover(r.id)
    await login('asha')
    await expect(api.rentals.requestReturn(r.id)).rejects.toThrow()
  })

  it('keeps exact address private until the deal is accepted', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 7)
    expect((await api.transactions.handoverInfo('rental', r.id)).exact_address).toBeNull()
    expect(await api.listings.getPrivate(L)).toBeNull()
    await login('asha')
    await api.rentals.respond(r.id, true)
    await login('ravi')
    expect((await api.transactions.handoverInfo('rental', r.id)).exact_address).toContain('SAMPLE')
    await login('meera')
    await expect(api.transactions.handoverInfo('rental', r.id)).resolves.toMatchObject({ exact_address: null })
  })
})

describe('purchase flow', () => {
  it('completes a sale and marks the single copy unavailable', async () => {
    await login('ravi')
    const o = await api.orders.create(L)
    expect(o.total_amount).toBe(180)
    await login('asha')
    await api.orders.respond(o.id, true)
    await api.orders.confirmHandover(o.id)
    await login('ravi')
    expect((await api.orders.confirmHandover(o.id)).status).toBe('completed')
    expect((await api.listings.get(L))!.status).toBe('unavailable')
    expect((await api.listings.search(base)).items.some((l) => l.id === L)).toBe(false)
    await login('meera')
    await expect(api.orders.create(L)).rejects.toThrow()
    await expect(api.rentals.request(L, 7)).rejects.toThrow()
  })

  it('restores availability when an accepted order is cancelled', async () => {
    await login('ravi')
    const o = await api.orders.create(L)
    await login('asha')
    await api.orders.respond(o.id, true)
    await api.orders.cancel(o.id)
    expect((await api.listings.get(L))!.status).toBe('active')
  })
})

describe('listings & authorization', () => {
  it('validates, and users cannot edit or remove another user’s listing', async () => {
    await login('ravi')
    await expect(api.listings.create(input({ title: '' }))).rejects.toThrow()
    await expect(api.listings.create(input({ rental_price: null }))).rejects.toThrow()
    const created = await api.listings.create(input())
    expect(created.owner_id).toBe('u-ravi')
    await login('meera')
    await expect(api.listings.update(created.id, input({ title: 'Hijack' }))).rejects.toThrow()
    await expect(api.listings.setStatus(created.id, 'removed')).rejects.toThrow()
    await login('ravi')
    await api.listings.setStatus(created.id, 'paused')
    expect((await api.listings.search(base)).items.some((l) => l.id === created.id)).toBe(false)
    await api.listings.setStatus(created.id, 'removed')
    expect(await api.listings.mine().then((m) => m.some((l) => l.id === created.id))).toBe(false)
  })

  it('cannot remove a listing while a rental is in progress', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 7)
    await login('asha')
    await api.rentals.respond(r.id, true)
    await expect(api.listings.setStatus(L, 'removed')).rejects.toThrow(/Finish or cancel/)
  })

  it('filters and sorts', async () => {
    const rent = await api.listings.search({ ...base, type: 'rent', sort: 'price_asc' })
    expect(rent.items.every((l) => l.listing_type !== 'sale')).toBe(true)
    expect(rent.items[0].rental_price).toBeLessThanOrEqual(rent.items[1].rental_price!)
    expect((await api.listings.search({ ...base, q: 'atomic' })).items.map((l) => l.title)).toEqual(['Atomic Habits'])
    expect((await api.listings.search({ ...base, q: 'zzzz-nothing' })).total).toBe(0)
    expect((await api.listings.search({ ...base, category: 'Exam Prep' })).total).toBe(2)
    const paged = await api.listings.search({ ...base, page: 2 })
    expect(paged.items.length).toBe(0) // 12 sample listings fit on one page
  })
})

describe('admin & disputes', () => {
  it('blocks non-admins from admin APIs and lets admins moderate', async () => {
    await login('asha')
    await expect(api.admin.stats()).rejects.toThrow(/Admins only/)
    await expect(api.admin.setUserSuspended('u-ravi', true)).rejects.toThrow()
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    await api.admin.setListingModeration(L, { hidden: true })
    expect((await api.listings.search(base)).items.some((l) => l.id === L)).toBe(false)
    await api.admin.setUserSuspended('u-ravi', true)
    await api.auth.signIn('ravi@borrowlend.demo', DEMO_PASSWORD)
    await expect(api.rentals.request('l-sample-2', 7)).rejects.toThrow(/suspended/)
  })

  it('moves a rental to disputed and requires an outcome to resolve', async () => {
    await login('ravi')
    const r = await api.rentals.request(L, 7)
    await login('asha')
    await api.rentals.respond(r.id, true)
    await api.rentals.confirmHandover(r.id)
    await login('ravi')
    await api.rentals.confirmHandover(r.id)
    await api.reports.create({ target_type: 'rental', target_id: r.id, kind: 'dispute', reason: 'Book not returned', details: '' })
    expect((await api.rentals.mine())[0].status).toBe('disputed')
    await api.auth.signIn(DEMO_ADMIN_EMAIL, DEMO_PASSWORD)
    const [rep] = await api.admin.reports()
    await expect(api.admin.resolveReport(rep.id, 'resolved', 'ok')).rejects.toThrow(/outcome/)
    await api.admin.resolveReport(rep.id, 'resolved', 'returned', 'completed')
    expect((await api.admin.rentals())[0].status).toBe('completed')
    expect((await api.listings.get(L))!.status).toBe('active')
  })
})
