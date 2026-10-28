import { motion } from 'framer-motion'
import { CATEGORIES } from '../lib/constants'
import type { BookItem } from '../typesEditorial'
import { BookTile, tileListVariants } from './BookTile'
import { SearchIcon } from './Icons'

interface BrowseBooksViewProps {
  books: BookItem[]
  savedBookIds: string[]
  onToggleSave: (id: string) => void
  requestBookIds: string[]
  onToggleRequestBook: (id: string) => void
  onSelectBook: (book: BookItem) => void
  query: string
  category: string
  format: 'all' | 'rental' | 'purchase'
  minPrice: string
  maxPrice: string
  area: string
  condition: string
  sort: string
  onFilters: (next: { q?: string; category?: string; format?: 'all' | 'rental' | 'purchase'; minPrice?: string; maxPrice?: string; area?: string; condition?: string; sort?: string }) => void
  page: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}

const field = 'min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-ink focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/30'

export const BrowseBooksView = ({ books, requestBookIds, onToggleRequestBook, onSelectBook, query, category, format, minPrice, maxPrice, area, condition, sort, onFilters, page, total, pageSize, onPage }: BrowseBooksViewProps) => {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = !!(query || category || format !== 'all' || minPrice || maxPrice || area || condition)
  return (
    <main className="container-page py-10">
      <div className="mb-7">
        <p className="eyebrow">Community catalogue</p>
        <h1 className="mt-2 text-4xl">Browse books</h1>
        <p className="mt-2 text-ink-soft">Search active listings for rent or sale. Pickup areas are shown; exact addresses stay private.</p>
      </div>

      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Genres">
        {[['', 'All books'], ...CATEGORIES.map((c) => [c, c])].map(([v, l]) => (
          <button key={l} type="button" aria-pressed={category === v} onClick={() => onFilters({ category: v })}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${category === v ? 'bg-pine text-sand' : 'bg-sand/60 text-ink-soft hover:bg-sand'}`}>{l}</button>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-line bg-white p-4 shadow-soft" aria-label="Book filters">
        <div className="grid gap-3 md:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <label className="sr-only" htmlFor="editorial-q">Search title, author or ISBN</label>
            <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-ink-mute" />
            <input id="editorial-q" className={`${field} w-full pl-10`} value={query} placeholder="Title, author, ISBN or keyword" onChange={(e) => onFilters({ q: e.target.value })} />
          </div>
          <label className="sr-only" htmlFor="editorial-category">Category</label>
          <select id="editorial-category" className={field} value={category} onChange={(e) => onFilters({ category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="sr-only" htmlFor="editorial-format">Availability</label>
          <select id="editorial-format" className={field} value={format} onChange={(e) => onFilters({ format: e.target.value as BrowseBooksViewProps['format'] })}><option value="all">Rent or buy</option><option value="rental">Rent</option><option value="purchase">Buy</option></select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="sr-only" htmlFor="editorial-condition">Condition</label>
          <select id="editorial-condition" className={field} value={condition} onChange={(e) => onFilters({ condition: e.target.value })}><option value="">Any condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="acceptable">Acceptable</option></select>
          <label className="sr-only" htmlFor="editorial-area">Pickup area</label>
          <input id="editorial-area" className={field} value={area} placeholder="Pickup area" onChange={(e) => onFilters({ area: e.target.value })} />
          <label className="sr-only" htmlFor="editorial-min">Minimum price</label>
          <input id="editorial-min" type="number" min="0" className={field} value={minPrice} placeholder="Min price" onChange={(e) => onFilters({ minPrice: e.target.value })} />
          <label className="sr-only" htmlFor="editorial-max">Maximum price</label>
          <input id="editorial-max" type="number" min="0" className={field} value={maxPrice} placeholder="Max price" onChange={(e) => onFilters({ maxPrice: e.target.value })} />
          <label className="sr-only" htmlFor="editorial-sort">Sort books</label>
          <select id="editorial-sort" className={field} value={sort} onChange={(e) => onFilters({ sort: e.target.value })}><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
        </div>
      </section>

      {books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-ink-soft">
          <p className="font-serif text-xl font-bold text-pine">{hasFilters ? 'No books match those filters' : 'No books listed yet'}</p>
          <p className="mt-1 text-sm">{hasFilters ? 'Try another search or remove some filters.' : 'Check back soon, or list one of your own.'}</p>
          {hasFilters && <button className="btn-primary mt-4" onClick={() => onFilters({ q: '', category: '', format: 'all', minPrice: '', maxPrice: '', area: '', condition: '' })}>Reset filters</button>}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-mute" aria-live="polite">{total} book{total === 1 ? '' : 's'}</p>
          <motion.div key={JSON.stringify([query, category, format, page, sort])} variants={tileListVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((book) => (
              <BookTile key={book.id} book={book} onSelect={onSelectBook}>
                <button onClick={() => onToggleRequestBook(book.id)} aria-pressed={requestBookIds.includes(book.id)}
                  className="mt-3 w-full rounded-full border border-line px-4 py-2 text-xs font-semibold text-pine transition-colors hover:bg-sand/60">
                  {requestBookIds.includes(book.id) ? 'Remove from request list' : 'Add to request list'}
                </button>
              </BookTile>
            ))}
          </motion.div>
        </>
      )}

      {total > pageSize && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
          <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
          <span className="text-sm text-ink-soft">Page {page} of {pages}</span>
          <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
        </nav>
      )}
    </main>
  )
}
