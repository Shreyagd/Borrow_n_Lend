// Pure marketplace rules. The same arithmetic lives in SQL (supabase/migrations/0002_functions.sql);
// the demo backend and the UI price preview use these functions.
import type { Listing, ListingInput } from './types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function rentalAmount(weeklyPrice: number, days: number): number {
  return round2((weeklyPrice * days) / 7)
}
export function platformFee(amount: number, commissionPct: number): number {
  return round2((amount * commissionPct) / 100)
}

export interface Breakdown {
  lines: { label: string; amount: number; note?: string }[]
  total: number
  platformFee: number
  ownerNet: number
}

export function rentalBreakdown(l: Pick<Listing, 'rental_price'>, days: number, commissionPct: number): Breakdown {
  const amount = rentalAmount(l.rental_price ?? 0, days)
  const fee = platformFee(amount, commissionPct)
  return {
    lines: [
      { label: `Rental (${days} days)`, amount },
      { label: 'Delivery', amount: 0, note: 'Local pickup – no delivery cost' },
      { label: 'Deposit', amount: 0, note: 'No deposit is collected' },
    ],
    total: amount,
    platformFee: fee,
    ownerNet: round2(amount - fee),
  }
}

export function saleBreakdown(l: Pick<Listing, 'sale_price'>, commissionPct: number): Breakdown {
  const price = l.sale_price ?? 0
  const fee = platformFee(price, commissionPct)
  return {
    lines: [
      { label: 'Book price', amount: price },
      { label: 'Delivery', amount: 0, note: 'Local pickup – no delivery cost' },
    ],
    total: price,
    platformFee: fee,
    ownerNet: round2(price - fee),
  }
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const todayISO = () => new Date().toISOString().slice(0, 10)

export function daysUntil(dueISO: string, from = todayISO()): number {
  return Math.round((Date.parse(dueISO) - Date.parse(from)) / 86_400_000)
}

export type FieldErrors = Partial<Record<keyof ListingInput, string>>

/** Client-side validation. The database re-validates everything (check constraints / triggers). */
export function validateListing(i: ListingInput): FieldErrors {
  const e: FieldErrors = {}
  if (!i.title.trim()) e.title = 'Enter the book title.'
  else if (i.title.length > 200) e.title = 'Title is too long (200 max).'
  if (!i.author.trim()) e.author = 'Enter the author.'
  if (i.isbn.trim() && !/^[0-9Xx-]{10,17}$/.test(i.isbn.trim())) e.isbn = 'ISBN should be 10–13 digits (hyphens allowed).'
  if (!i.category) e.category = 'Choose a category.'
  if (i.description.length > 2000) e.description = 'Description is too long (2000 max).'
  if (i.pickup_area.trim().length < 2) e.pickup_area = 'Enter a pickup area, e.g. a neighbourhood.'
  if (i.listing_type !== 'sale') {
    if (!i.rental_price || i.rental_price <= 0) e.rental_price = 'Enter a rental price per week.'
    if (i.rental_period_options.length === 0) e.rental_period_options = 'Choose at least one rental period.'
  }
  if (i.listing_type !== 'rent') {
    if (!i.sale_price || i.sale_price <= 0) e.sale_price = 'Enter a sale price.'
  }
  return e
}

export function normalizeListingInput(i: ListingInput): ListingInput {
  return {
    ...i,
    title: i.title.trim(),
    author: i.author.trim(),
    isbn: i.isbn.trim(),
    pickup_area: i.pickup_area.trim(),
    rental_price: i.listing_type === 'sale' ? null : i.rental_price,
    rental_period_options: i.listing_type === 'sale' ? [] : [...i.rental_period_options].sort((a, b) => a - b),
    sale_price: i.listing_type === 'rent' ? null : i.sale_price,
  }
}
