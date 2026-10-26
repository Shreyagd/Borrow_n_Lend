import { motion, type Variants } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { conditionLabel } from '../lib/constants'
import type { Listing } from '../lib/types'
import { BookCover } from './BookCover'
import { HeartButton } from './HeartButton'

/** Stagger helpers: put `variants={listVariants}` on a parent and `variants={itemVariants}` on each child. */
export const listVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 18 } },
}

const OFFER: Record<Listing['listing_type'], string> = { rent: 'Rent', sale: 'Buy', both: 'Rent · Buy' }
const isNew = (iso: string) => Date.now() - Date.parse(iso) < 7 * 86_400_000

/** Title, author and price on top; large cover below. Lifts and straightens on hover. */
export function BookCard({ listing: l }: { listing: Listing }) {
  const { fmt } = useSettings()
  const fresh = isNew(l.created_at)
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -8, rotate: -1.2, transition: { type: 'spring', stiffness: 300, damping: 18 } }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(20,20,40,0.03)] hover:shadow-xl"
    >
      <div className="mb-3 space-y-0.5 px-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base leading-snug">
            {/* stretched link: the whole card is clickable, the heart button sits above it */}
            <Link to={`/books/${l.id}`} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] group-hover:text-pine">{l.title}</Link>
          </h3>
          <span className={`chip shrink-0 ${fresh ? 'tint-butter' : 'tint-mist'}`}>{fresh ? '★ New this week' : OFFER[l.listing_type]}</span>
        </div>
        <p className="truncate text-sm text-ink-soft">By : {l.author}</p>
        <p className="pt-1 text-base font-bold text-pine">
          {l.rental_price != null && <>{fmt(l.rental_price)}<span className="text-xs font-medium text-ink-mute">/week</span></>}
          {l.rental_price != null && l.sale_price != null && <span className="px-1.5 text-ink-mute">·</span>}
          {l.sale_price != null && <>{fmt(l.sale_price)}<span className="text-xs font-medium text-ink-mute"> to buy</span></>}
        </p>
      </div>
      <div className="relative mt-auto">
        <BookCover title={l.title} author={l.author} src={l.image_urls[0]} className="!rounded-2xl" />
        {l.is_sample && <span className="chip absolute left-2 top-2 bg-ink/80 text-white">Sample</span>}
        <HeartButton id={l.id} title={l.title} className="absolute right-2 top-2 z-10" />
      </div>
      <p className="mt-2 truncate px-1 text-xs text-ink-mute">{conditionLabel(l.condition)} · {l.pickup_area}</p>
    </motion.div>
  )
}

export function BookGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={listVariants} initial="hidden" animate="show"
      className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      {children}
    </motion.div>
  )
}
