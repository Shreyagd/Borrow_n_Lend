import { describe, expect, it } from 'vitest'
import { addDays, daysUntil, platformFee, rentalAmount, rentalBreakdown, saleBreakdown, validateListing } from './rules'
import type { ListingInput } from './types'

const valid: ListingInput = {
  title: 'T', author: 'A', isbn: '', category: 'Fiction', description: '', condition: 'good', image_urls: [],
  listing_type: 'both', rental_price: 50, rental_period_options: [7], sale_price: 200, pickup_area: 'Area',
  exact_address: '', handover_notes: '', status: 'active',
}

describe('pricing', () => {
  it('prorates weekly rent and rounds to 2dp', () => {
    expect(rentalAmount(70, 14)).toBe(140)
    expect(rentalAmount(45, 30)).toBe(192.86)
    expect(platformFee(192.86, 12.5)).toBe(24.11)
  })
  it('breakdowns separate rent, delivery, deposit and owner net', () => {
    const b = rentalBreakdown({ rental_price: 40 }, 21, 10)
    expect(b.total).toBe(120)
    expect(b.platformFee).toBe(12)
    expect(b.ownerNet).toBe(108)
    expect(b.lines.map((l) => l.label)).toEqual(['Rental (21 days)', 'Delivery', 'Deposit'])
    expect(saleBreakdown({ sale_price: 250 }, 0).ownerNet).toBe(250)
  })
})

describe('dates', () => {
  it('adds days and computes distance', () => {
    expect(addDays('2026-01-30', 7)).toBe('2026-02-06')
    expect(daysUntil('2026-02-06', '2026-02-01')).toBe(5)
  })
})

describe('validateListing', () => {
  it('accepts valid input', () => expect(validateListing(valid)).toEqual({}))
  it('requires fields per listing type', () => {
    expect(validateListing({ ...valid, listing_type: 'rent', rental_price: null, rental_period_options: [] })).toHaveProperty('rental_price')
    expect(validateListing({ ...valid, listing_type: 'sale', sale_price: 0 })).toHaveProperty('sale_price')
    expect(validateListing({ ...valid, listing_type: 'sale', rental_price: null, rental_period_options: [] })).toEqual({})
    expect(validateListing({ ...valid, title: ' ', isbn: 'abc' })).toMatchObject({ title: expect.any(String), isbn: expect.any(String) })
  })
})
