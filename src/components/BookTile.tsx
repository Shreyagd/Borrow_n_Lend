import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import type { BookItem } from '../typesEditorial'
import { BookCover } from './BookCover'
import { HeartButton } from './HeartButton'
import { ChevronRightIcon } from './Icons'

export const tileListVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const tileVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 18 } },
}

export const priceText = (b: BookItem) => [b.rentalPriceLabel, b.purchasePriceLabel].filter(Boolean).join(' · ')

/** Marketplace book card: whole cover on a sand backdrop, category tag, heart, details and a price row. */
export function BookTile({ book, onSelect, children }: { book: BookItem; onSelect: (b: BookItem) => void; children?: ReactNode }) {
  return (
    <motion.article
      variants={tileVariants}
      whileHover={{ y: -4 }}
      className="group relative flex h-full flex-col justify-between rounded-2xl border border-line bg-white p-3.5 shadow-soft transition-shadow duration-300 hover:shadow-xl"
    >
      <div>
        <div className="relative mb-3 flex h-56 items-center justify-center overflow-hidden rounded-xl bg-sand/50 p-3">
          <button onClick={() => onSelect(book)} aria-label={`View ${book.title}`} className="h-full">
            <BookCover title={book.title} author={book.author} src={book.coverUrl} className="!h-full !w-auto transition-transform duration-500 group-hover:scale-105" />
          </button>
          <span className="absolute left-2.5 top-2.5 rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pine shadow-sm backdrop-blur-md">{book.category}</span>
          <HeartButton id={book.id} title={book.title} className="absolute right-2.5 top-2.5" />
        </div>
        <div className="px-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{book.condition}</span>
          <h3 className="mt-0.5 truncate text-base"><button onClick={() => onSelect(book)} className="max-w-full truncate text-left transition-colors hover:text-clay" title={book.title}>{book.title}</button></h3>
          <p className="mt-0.5 truncate text-xs text-ink-soft">{book.author}</p>
        </div>
      </div>
      <div className="mt-2 border-t border-sand/70 px-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-pine">{priceText(book) || 'Price on request'}</p>
          <button onClick={() => onSelect(book)} aria-label={`Open ${book.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand/70 text-pine transition-colors hover:bg-clay hover:text-white">
            <ChevronRightIcon size={14} />
          </button>
        </div>
        {children}
      </div>
    </motion.article>
  )
}
