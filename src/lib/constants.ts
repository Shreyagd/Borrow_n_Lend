import type { Condition, ListingType, OrderStatus, RentalStatus } from './types'

export const BRAND = { name: 'BorrowLend', tagline: 'Your books can earn. Someone’s next story starts here.' }

export const CATEGORIES = [
  'Fiction', 'Non-fiction', 'Exam Prep', 'Textbooks', "Children's", 'Comics & Manga',
  'Biography', 'Self-Help', 'Business', 'Science & Tech', 'Other',
] as const

export const CONDITIONS: { value: Condition; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'Unread, no marks' },
  { value: 'like_new', label: 'Like New', hint: 'Read once, no visible wear' },
  { value: 'good', label: 'Good', hint: 'Minor wear, all pages intact' },
  { value: 'acceptable', label: 'Acceptable', hint: 'Visible wear, fully readable' },
]
export const conditionLabel = (c: Condition) => CONDITIONS.find((x) => x.value === c)?.label ?? c

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: 'rent', label: 'Rent only' },
  { value: 'sale', label: 'Sell only' },
  { value: 'both', label: 'Rent or sell' },
]

/** Allowed rental periods in days. Prices are set per 7 days. */
export const PERIOD_CHOICES = [7, 14, 21, 30] as const

export const PAGE_SIZE = 12
export const MAX_IMAGES = 3
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export const RENTAL_STATUS_LABEL: Record<RentalStatus, string> = {
  requested: 'Requested', accepted: 'Accepted – arrange handover', declined: 'Declined', cancelled: 'Cancelled',
  active: 'On loan', return_requested: 'Return requested', completed: 'Completed', overdue: 'Overdue', disputed: 'Disputed',
}
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  requested: 'Requested', accepted: 'Accepted – arrange handover', declined: 'Declined', cancelled: 'Cancelled',
  completed: 'Completed', disputed: 'Disputed',
}

/** Statuses of a rental that reserve the physical copy. */
export const BLOCKING_RENTAL: RentalStatus[] = ['accepted', 'active', 'return_requested', 'overdue', 'disputed']
export const BLOCKING_ORDER: OrderStatus[] = ['accepted', 'completed', 'disputed']

export const REPORT_REASONS = [
  'Misleading or fake listing', 'Inappropriate content', 'Suspected scam', 'Item not as described',
  'Did not show up for handover', 'Book not returned', 'Harassment or unsafe behaviour', 'Other',
]
