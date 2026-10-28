import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { onlinePaymentsLive } from '../lib/payments'
import type { BookItem } from '../typesEditorial'
import { BookCover } from './BookCover'
import { BookTile, tileListVariants } from './BookTile'
import { ArrowRightIcon, BookIcon, ChevronRightIcon, CheckCircleIcon, PlusIcon } from './Icons'

interface HomeViewProps {
  featuredBooks: BookItem[]
  onSelectBook: (book: BookItem) => void
  onNavigate: (tab: string) => void
  onOpenListBook: () => void
}

/** A small floating card in the hero arch. */
function FloatCard({ book, onSelect, className, coverClass, tag, tagClass = 'bg-pine/90' }: {
  book: BookItem; onSelect: (b: BookItem) => void; className: string; coverClass: string; tag?: string; tagClass?: string
}) {
  return (
    <button
      onClick={() => onSelect(book)} aria-label={`View ${book.title}`}
      className={`absolute cursor-pointer rounded-xl border border-sand bg-white p-2.5 text-left shadow-float transition-transform duration-300 hover:scale-105 ${className}`}
    >
      <div className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-sand/50 ${coverClass}`}>
        <BookCover title={book.title} author={book.author} src={book.coverUrl} className="!h-full !w-auto !rounded-sm" />
        {tag && <span className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-bold text-white ${tagClass}`}>{tag}</span>}
      </div>
      <div className="mt-2.5">
        <p className="truncate font-serif text-xs font-bold text-ink">{book.title}</p>
        <p className="truncate text-[11px] text-ink-mute">{book.author}</p>
        <p className="mt-1 truncate text-xs font-bold text-clay">{book.rentalPriceLabel ?? book.purchasePriceLabel}</p>
      </div>
    </button>
  )
}

export const HomeView = ({ featuredBooks, onSelectBook, onNavigate, onOpenListBook }: HomeViewProps) => {
  const [tab, setTab] = useState('all')
  const { settings } = useSettings()
  const live = onlinePaymentsLive(settings)
  const categories = useMemo(() => [...new Set(featuredBooks.map((b) => b.category))].slice(0, 6), [featuredBooks])
  const shown = featuredBooks.filter((b) => tab === 'all' || b.category === tab).slice(0, 8)
  const [a, b, c] = featuredBooks

  return (
    <>
      {/* ───────── hero ───────── */}
      <section className="relative overflow-hidden pb-16 pt-8 lg:pb-24 lg:pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-10 -z-10 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-clay/10 via-sand/40 to-pine/5 blur-3xl" />
        <div className="container-page">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="text-4xl leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl"
              >
                Your books can earn.<br />
                <span className="font-normal italic text-clay">Someone’s next story</span> starts here.
              </motion.h1>
              <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-ink-soft sm:text-xl lg:mx-0">
                Discover pre-owned books to rent or buy from neighbours, or share your own shelf with book lovers in your local community.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row lg:justify-start">
                <button onClick={() => onNavigate('browse')} className="btn-primary btn-lg group w-full gap-3 sm:w-auto">
                  Browse books <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button onClick={onOpenListBook} className="btn-accent btn-lg w-full sm:w-auto"><BookIcon size={16} /> List a book</button>
                <Link to="/how-it-works" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-pine no-underline transition-colors hover:text-clay">
                  How it works <ChevronRightIcon size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-sand/80 pt-8 text-left sm:grid-cols-3">
                {[
                  ['Local pickup', 'Arranged between you and the owner'],
                  live ? ['Secure payment', 'UPI, cards & wallets via our provider'] : ['Direct payment', 'No online payment is collected yet'],
                  ['Privacy first', 'Your address stays private'],
                ].map(([h, p]) => (
                  <div key={h} className="flex items-start gap-2.5">
                    <CheckCircleIcon size={16} className="mt-0.5 shrink-0 text-clay" />
                    <div><h4 className="font-sans text-xs font-bold uppercase tracking-wider text-pine">{h}</h4><p className="text-xs text-ink-mute">{p}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {/* arch with floating real listings */}
            <div className="relative flex justify-center lg:col-span-5">
              <div className="relative flex h-96 w-72 items-center justify-center overflow-hidden rounded-t-full border border-sand bg-sand/60 shadow-inner sm:h-[420px] sm:w-80">
                <div className="z-0 -translate-y-12 p-6 text-center">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-clay">From the community</span>
                  <h3 className="font-serif text-2xl font-bold text-pine">Real books, real listings</h3>
                  <p className="mt-2 text-xs text-ink-mute">Shared by readers near you</p>
                </div>
              </div>
              {a && <FloatCard book={a} onSelect={onSelectBook} className="animate-float bottom-10 left-2 w-36 sm:left-6 sm:w-40" coverClass="h-44 sm:h-48" tag={a.category} />}
              {b && <FloatCard book={b} onSelect={onSelectBook} className="animate-float-reverse bottom-4 z-10 w-40 !p-3 shadow-2xl sm:w-44" coverClass="h-48 sm:h-52" tag="Newest" tagClass="bg-clay" />}
              {c && <FloatCard book={c} onSelect={onSelectBook} className="animate-float right-2 top-16 w-36 sm:right-6 sm:w-40" coverClass="h-40 sm:h-44" />}
              {featuredBooks.length === 0 && (
                <div className="absolute bottom-16 w-60 rounded-2xl bg-white/90 p-6 text-center text-sm text-ink-soft shadow-float">
                  New listings will appear here. <Link className="mt-1 block font-semibold" to="/browse">Browse books</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── recently listed ───────── */}
      <section id="featured" className="border-y border-sand/60 bg-white py-16">
        <div className="container-page">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="eyebrow mb-1 block">Recently listed</span>
              <h2 className="text-3xl sm:text-4xl">Find your next read</h2>
              <p className="mt-1 text-sm text-ink-mute">Explore titles available for rent or purchase in your area</p>
            </div>
            {categories.length > 1 && (
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-2 md:pb-0" role="group" aria-label="Filter by genre">
                {[['all', 'All books'], ...categories.map((c) => [c, c])].map(([v, l]) => (
                  <button key={v} onClick={() => setTab(v)} aria-pressed={tab === v}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${tab === v ? 'bg-pine text-sand' : 'bg-sand/60 text-ink-soft hover:bg-sand'}`}>{l}</button>
                ))}
              </div>
            )}
          </div>

          {shown.length ? (
            <motion.div key={tab} variants={tileListVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((book) => <BookTile key={book.id} book={book} onSelect={onSelectBook} />)}
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-paper p-12 text-center text-ink-soft">
              No active listings yet. Be the first to <button onClick={onOpenListBook} className="font-bold text-clay underline">list a book</button>.
            </div>
          )}

          <div className="mt-12 text-center">
            <button onClick={() => onNavigate('browse')} className="inline-flex items-center gap-2 rounded-full border border-pine px-6 py-3 text-sm font-semibold text-pine transition-all hover:bg-pine hover:text-sand">
              View all listings <ArrowRightIcon size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ───────── how it works ───────── */}
      <section id="how-it-works" className="relative py-20">
        <div className="container-page">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <span className="eyebrow mb-2 block">Simple &amp; community-led</span>
            <h2 className="text-3xl sm:text-4xl">How BorrowLend works</h2>
            <p className="mt-2 text-sm text-ink-soft">Connecting book owners and readers locally in 3 effortless steps</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              ['01', 'Discover a book', 'Browse pre-loved books nearby. Filter by genre, condition or price, and see whether a book is for weekly rent or outright purchase.'],
              ['02', 'Request to rent or buy', 'Choose a rental period or send a purchase request. The owner accepts or declines, and you see the full price before you confirm.'],
              ['03', 'Arrange local pickup', live ? 'Once accepted, pay securely online, agree a time and place, and both confirm the handover in your dashboard.' : 'Once accepted, agree a time and place and pay the owner directly on handover; both of you confirm it in your dashboard.'],
            ].map(([n, title, text]) => (
              <motion.article key={n} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="group rounded-2xl border border-sand bg-white p-8 shadow-soft transition-all hover:shadow-md">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-clay-light font-serif text-xl font-bold text-clay transition-colors group-hover:bg-clay group-hover:text-white">{n}</div>
                <h3 className="mb-3 text-xl text-pine">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── call to action ───────── */}
      <section className="relative overflow-hidden bg-pine py-16 text-sand">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(#C04E2D_1px,transparent_1px)] opacity-10 [background-size:16px_16px]" />
        <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 text-center">
          <h2 className="text-3xl leading-tight !text-white sm:text-5xl">
            A good book deserves<br /><span className="font-normal italic text-clay">another reader.</span>
          </h2>
          <p className="mx-auto max-w-xl text-base font-light text-sand/80">
            Give your books another chapter by listing them for rent or sale, and share your shelf with readers in your neighbourhood.
          </p>
          <div className="pt-4">
            <button onClick={onOpenListBook} className="btn-accent btn-lg gap-2 shadow-xl hover:scale-105"><PlusIcon size={16} /> Share your shelf now</button>
          </div>
        </div>
      </section>
      <div aria-hidden="true" className="-mb-12 h-0" />
    </>
  )
}

