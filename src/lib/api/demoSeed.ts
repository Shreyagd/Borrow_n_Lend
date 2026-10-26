// Clearly-labelled SAMPLE content for demo mode only. Never shipped to a real (Supabase) backend.
import type { Condition, Listing, ListingPrivate, ListingType, Profile } from '../types'

export interface DemoAccount {
  id: string
  email: string
  password: string
  profile: Profile
  phone: string | null
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

export const DEMO_PASSWORD = 'demo1234'
export const DEMO_ADMIN_EMAIL = 'admin@borrowlend.demo'

function account(id: string, email: string, name: string, city: string, role: 'user' | 'admin' = 'user'): DemoAccount {
  return {
    id, email, password: DEMO_PASSWORD, phone: '+00 000 000 0000 (sample)',
    profile: { id, display_name: name, avatar_url: null, city, role, suspended: false, created_at: daysAgo(60) },
  }
}

export function seedAccounts(): DemoAccount[] {
  return [
    account('u-admin', DEMO_ADMIN_EMAIL, 'Demo Admin', 'Sample City', 'admin'),
    account('u-asha', 'asha@borrowlend.demo', 'Asha (sample)', 'Sample City'),
    account('u-ravi', 'ravi@borrowlend.demo', 'Ravi (sample)', 'Sample City'),
    account('u-meera', 'meera@borrowlend.demo', 'Meera (sample)', 'Sample City'),
  ]
}

type Row = [string, string, string, string, Condition, ListingType, number | null, number | null, string, string, number]
// owner, title, author, category, condition, type, weekly rent, sale, area, description, daysAgo
const ROWS: Row[] = [
  ['u-asha', 'Pride and Prejudice', 'Jane Austen', 'Fiction', 'good', 'both', 40, 180, 'Sample Area – Central', 'A classic of English literature. Paperback, light shelf wear.', 1],
  ['u-asha', 'Atomic Habits', 'James Clear', 'Self-Help', 'like_new', 'both', 60, 260, 'Sample Area – Central', 'Read once. No highlighting.', 2],
  ['u-ravi', 'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'Non-fiction', 'good', 'rent', 50, null, 'Sample Area – North', 'Popular history of our species. Paperback.', 3],
  ['u-ravi', 'Concepts of Physics, Vol. 1', 'H. C. Verma', 'Exam Prep', 'acceptable', 'both', 45, 200, 'Sample Area – North', 'Some pencil notes in margins. All pages intact.', 4],
  ['u-meera', 'The Alchemist', 'Paulo Coelho', 'Fiction', 'like_new', 'sale', null, 150, 'Sample Area – East', 'Gift copy, barely read.', 5],
  ['u-meera', 'Charlotte’s Web', 'E. B. White', "Children's", 'good', 'rent', 30, null, 'Sample Area – East', 'A gentle story for young readers. Slightly worn cover.', 6],
  ['u-asha', 'The Psychology of Money', 'Morgan Housel', 'Business', 'new', 'both', 55, 280, 'Sample Area – Central', 'Brand new, unread.', 7],
  ['u-ravi', 'Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'Textbooks', 'good', 'rent', 90, null, 'Sample Area – North', 'The “CLRS” textbook. Heavy but in good shape.', 8],
  ['u-meera', 'Persepolis', 'Marjane Satrapi', 'Comics & Manga', 'like_new', 'both', 35, 170, 'Sample Area – East', 'Graphic memoir, complete edition.', 9],
  ['u-asha', 'Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography', 'good', 'sale', null, 120, 'Sample Area – Central', 'Autobiography. Clean pages.', 10],
  ['u-ravi', 'A Brief History of Time', 'Stephen Hawking', 'Science & Tech', 'acceptable', 'rent', 35, null, 'Sample Area – North', 'Well-loved copy with a cracked spine.', 11],
  ['u-meera', 'Quantitative Aptitude for Competitive Exams', 'R. S. Aggarwal', 'Exam Prep', 'good', 'both', 40, 190, 'Sample Area – East', 'Clean, few pencil marks.', 12],
]

export function seedListings(): { listings: Listing[]; priv: Record<string, ListingPrivate> } {
  const listings: Listing[] = []
  const priv: Record<string, ListingPrivate> = {}
  ROWS.forEach((r, i) => {
    const [owner, title, author, category, condition, type, rent, sale, area, description, ago] = r
    const id = `l-sample-${i + 1}`
    listings.push({
      id, owner_id: owner, title, author, isbn: null, category, description, condition, image_urls: [],
      listing_type: type, rental_price: rent, rental_period_options: type === 'sale' ? [] : [7, 14, 21],
      sale_price: sale, pickup_area: area, status: 'active', hidden: false, flagged: false,
      created_at: daysAgo(ago), updated_at: daysAgo(ago), is_sample: true,
    })
    priv[id] = { exact_address: 'SAMPLE – 12 Example Street (private until accepted)', handover_notes: 'SAMPLE – meet at the lobby after 6pm.' }
  })
  return { listings, priv }
}

export interface DemoReview {
  id: string
  rental_id: string | null
  order_id: string | null
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
  created_at: string
  is_sample?: boolean
}

/** SAMPLE reviews so the testimonials section has content in demo mode. Never used with a real backend. */
export function seedReviews(): DemoReview[] {
  const rows: [string, string, number, string, number][] = [
    ['u-ravi', 'u-asha', 5, 'Collecting the book was easy and the owner was friendly. Exactly as described.', 12],
    ['u-meera', 'u-ravi', 5, 'I found the textbook I needed for a fraction of the new price, and returning it was painless.', 9],
    ['u-asha', 'u-meera', 4, 'Smooth handover and a fair price. Would borrow again.', 5],
  ]
  return rows.map(([a, b, rating, comment, ago], i) => ({
    id: `r-sample-${i + 1}`, rental_id: null, order_id: null, reviewer_id: a, reviewee_id: b, rating, comment,
    created_at: daysAgo(ago), is_sample: true,
  }))
}
