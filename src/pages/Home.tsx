import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Book3D, FloorShadow } from '../components/Book3D'
import { BookCard, itemVariants, listVariants } from '../components/BookCard'
import { BookCover } from '../components/BookCover'
import { ErrorState, LoadingState } from '../components/ui'
import { useSettings } from '../context/SettingsContext'
import { api } from '../lib/api'
import { BRAND, CATEGORIES } from '../lib/constants'
import { HERO_IMAGE_URL, IS_DEMO } from '../lib/env'
import { FAQ_ITEMS } from '../lib/faq'
import { initials } from '../lib/format'
import { useAsync, usePageMeta } from '../lib/hooks'
import type { Listing } from '../lib/types'

const readerSteps = [
  ['Find a book', 'Search by title, author, ISBN or category and filter by condition and price.'],
  ['Request it', 'Pick a rental period or buy outright. See the full price before you confirm.'],
  ['Meet & read', 'Collect it locally once the owner accepts. Return it by the due date.'],
]
const ownerSteps = [
  ['List your book', 'Add a photo, set your rent and/or sale price in minutes.'],
  ['Approve requests', 'You decide who borrows or buys. Your address stays private until you accept.'],
  ['Get paid', 'Earn from every completed rental or sale. The platform fee is shown up front.'],
]

const PRICE_STEPS = [100, 250, 500, 1000]
// playful, overlapping layout for the hero covers
const TILT = [-9, -3, 4, 9, -5]
const LIFT = [26, 0, 14, -4, 30]

/** Overlapping, rotated real covers. Hovering lifts a book and straightens it. */
function HeroCovers({ books }: { books: Listing[] }) {
  return (
    <motion.ul
      variants={listVariants} initial="hidden" animate="show"
      className="mx-auto flex h-[300px] items-end justify-center overflow-hidden sm:h-[400px]"
      aria-label="Newly listed books"
    >
      {books.slice(0, 5).map((b, i) => (
        <motion.li
          key={b.id}
          variants={{ hidden: { opacity: 0, y: 120 }, show: { opacity: 1, y: LIFT[i] + 36, rotate: TILT[i], transition: { type: 'spring', stiffness: 70, damping: 14, delay: i * 0.08 } } }}
          whileHover={{ y: -6, rotate: 0, scale: 1.07, zIndex: 20, transition: { type: 'spring', stiffness: 260, damping: 18 } }}
          className={`relative -ml-8 w-36 shrink-0 first:ml-0 sm:-ml-12 sm:w-52 ${i > 2 ? 'hidden sm:block' : ''}`}
          style={{ zIndex: i === 1 ? 6 : 5 - Math.abs(i - 2) }}
        >
          <Link to={`/books/${b.id}`} aria-label={`${b.title} by ${b.author}`} className="block">
            <BookCover title={b.title} author={b.author} src={b.image_urls[0]} eager className="!rounded-xl !shadow-2xl" />
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  )
}

/** Shown when nothing is listed yet: decorative CSS 3D books. */
function HeroPlaceholderBooks() {
  return (
    <div className="relative mx-auto h-[310px] overflow-hidden sm:h-[380px]" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 flex origin-bottom scale-[0.66] items-end justify-center sm:scale-100">
        <div style={{ marginRight: -34, marginBottom: 10 }}><Book3D from="#3b2fa0" to="#5848d0" accent="#f6dc94" art="sun" ry={-34} rx={8} rz={-3} /><FloorShadow width={150} /></div>
        <div style={{ marginRight: -34, marginBottom: 34 }}><Book3D from="#c4492f" to="#ee8b73" accent="#fdf3d8" art="hills" w={180} h={275} ry={-14} rx={8} /><FloorShadow width={160} /></div>
        <div className="hidden sm:block" style={{ marginBottom: 14 }}><Book3D from="#12606b" to="#2c8a94" accent="#f6dc94" art="rings" w={175} h={258} ry={14} rx={8} /><FloorShadow width={150} /></div>
      </div>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} out of 5 stars`} className="text-amber-500">
      {'★'.repeat(Math.round(value))}<span className="text-line">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold"
        aria-expanded={open} onClick={() => setOpen((o) => !o)}
      >
        {q}
        <motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine-light text-lg leading-none text-pine">
          {open ? '−' : '+'}
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }} className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-ink-soft">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Home() {
  usePageMeta('BorrowLend — Rent or buy pre-owned books', 'Rent or buy pre-owned books from readers near you, or earn by lending your own. BorrowLend is a peer-to-peer book marketplace.')
  const nav = useNavigate()
  const { settings, fmt } = useSettings()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [max, setMax] = useState('')
  const recent = useAsync(() => api.listings.recent(10), [])
  const reviews = useAsync(() => api.reviews.recent(4), [])
  const summary = useAsync(() => api.reviews.summary(), [])
  const track = useRef<HTMLUListElement>(null)

  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (cat) sp.set('category', cat)
    if (max) sp.set('max', max)
    nav(`/browse${sp.toString() ? `?${sp}` : ''}`)
  }
  const sm = summary.data

  return (
    <>
      {/* ───────── hero ───────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-paper">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-pine/10 blur-3xl" />
        <div className="container-page relative pt-12 text-center sm:pt-16">
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-4xl leading-[1.08] sm:text-6xl"
          >
            Your books can earn. <span className="text-pine">Someone’s next story starts here.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl text-base text-ink-soft sm:text-lg"
          >
            Rent or buy pre-owned books from readers{settings.launch_city ? ` in ${settings.launch_city}` : ' near you'} — or turn the shelf you’ve outgrown into income.
          </motion.p>

          <motion.form
            onSubmit={submit} role="search"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-8 grid max-w-3xl gap-2 rounded-3xl border border-line bg-white p-3 text-left shadow-[0_24px_48px_-24px_rgba(60,50,140,0.3)] sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end sm:gap-3"
          >
            <div>
              <label htmlFor="hs-q" className="label px-1">Search</label>
              <input id="hs-q" className="input" placeholder="Search by title / author name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div>
              <label htmlFor="hs-cat" className="label px-1">Genre</label>
              <select id="hs-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Select genre</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="hs-max" className="label px-1">Price</label>
              <select id="hs-max" className="input" value={max} onChange={(e) => setMax(e.target.value)}>
                <option value="">Select price set</option>
                {PRICE_STEPS.map((p) => <option key={p} value={p}>Up to {fmt(p)}</option>)}
              </select>
            </div>
            <button className="btn-primary btn-lg" type="submit">Search book</button>
          </motion.form>

          <div className="mt-6">
            {recent.data && recent.data.length > 0 ? <HeroCovers books={recent.data} />
              : HERO_IMAGE_URL ? <img src={HERO_IMAGE_URL} alt="A stack of hardcover books" width={900} height={600} className="mx-auto w-full max-w-3xl object-contain" />
              : <HeroPlaceholderBooks />}
          </div>
        </div>
      </section>

      {/* ───────── this week's picks ───────── */}
      <section className="container-page pt-16" aria-labelledby="picks">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="picks" className="max-w-md text-3xl leading-tight sm:text-4xl">Amazing curated books: this week’s picks</h2>
            <p className="mt-3 max-w-md text-ink-soft">
              {IS_DEMO ? 'Demo mode: these books are clearly marked sample content.' : 'The newest books from readers near you. Rent by the week or buy outright.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-lg shadow-sm hover:bg-pine-light" aria-label="Scroll left" onClick={() => scroll(-1)}>←</button>
            <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-lg shadow-sm hover:bg-pine-light" aria-label="Scroll right" onClick={() => scroll(1)}>→</button>
          </div>
        </div>
        <div className="rounded-[2rem] bg-[#f0f0f6] p-3 sm:p-5">
          {recent.loading && <LoadingState label="Loading books…" />}
          {recent.error && <ErrorState message={recent.error} onRetry={recent.reload} />}
          {recent.data && recent.data.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-xl font-bold">No books listed yet</p>
              <p className="mt-1 text-sm text-ink-soft">Be the first to list a book in {settings.launch_city || 'your area'}.</p>
              <Link to="/list" className="btn-primary mt-4 no-underline text-white">List a book</Link>
            </div>
          )}
          {recent.data && recent.data.length > 0 && (
            <motion.ul
              ref={track} variants={listVariants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}
              className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-1"
            >
              {recent.data.map((l) => (
                <motion.li key={l.id} variants={itemVariants} className="w-60 shrink-0 snap-start sm:w-64">
                  <BookCard listing={l} />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
        <div className="mt-3 text-right"><Link to="/browse?sort=newest" className="text-sm font-bold">See all books →</Link></div>
      </section>

      {/* ───────── readers / metrics ───────── */}
      <section className="container-page py-16" aria-labelledby="readers">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.35fr]">
          <div>
            <h2 id="readers" className="text-3xl sm:text-4xl">What readers are saying about us</h2>
            <p className="mt-3 max-w-sm text-ink-soft">Reviews come only from people who completed a rental or purchase on BorrowLend.</p>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="card p-5">
                <dt className="text-sm font-semibold text-ink-soft">Average rating</dt>
                <dd className="mt-1 flex items-baseline gap-3">
                  <span className="font-serif text-4xl font-bold">{sm && sm.count ? sm.avg.toFixed(1) : '—'}<span className="text-lg text-ink-mute">/5</span></span>
                  {sm && sm.count > 0 && <Stars value={sm.avg} />}
                </dd>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="card p-5">
                <dt className="text-sm font-semibold text-ink-soft">Reviews rated 4★ or higher</dt>
                <dd className="mt-1 font-serif text-4xl font-bold text-pine">{sm && sm.count ? `${sm.positivePct}%` : '—'}</dd>
                <dd className="text-xs text-ink-mute">{sm ? `${sm.count} review${sm.count === 1 ? '' : 's'}` : ''}</dd>
              </motion.div>
            </dl>
          </div>

          <div>
            {reviews.loading && <LoadingState label="Loading reviews…" />}
            {reviews.error && <ErrorState message={reviews.error} onRetry={reviews.reload} />}
            {reviews.data && reviews.data.length === 0 && (
              <div className="card px-6 py-10 text-center">
                <p className="text-xl font-bold">No reviews yet</p>
                <p className="mt-1 text-sm text-ink-soft">Be one of the first to complete a rental and share how it went.</p>
              </div>
            )}
            {reviews.data && reviews.data.length > 0 && (
              <motion.ul variants={listVariants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="space-y-4">
                {reviews.data.map((r) => (
                  <motion.li key={r.id} variants={itemVariants} whileHover={{ x: 6 }} className="card flex gap-4 p-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pine-light font-bold text-pine-dark" aria-hidden="true">{initials(r.reviewer_name)}</span>
                    <figure className="min-w-0">
                      <span aria-hidden="true" className="font-serif text-3xl leading-none text-pine">“</span>
                      <blockquote className="-mt-2 italic text-ink">{r.comment}</blockquote>
                      <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-pine">{r.reviewer_name}</span>
                        <Stars value={r.rating} />
                        {r.is_sample && <span className="chip bg-ink/80 text-white">Sample</span>}
                      </figcaption>
                    </figure>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </div>
      </section>

      {/* ───────── how it works ───────── */}
      <section className="container-page pb-6" aria-labelledby="how">
        <h2 id="how" className="mb-6 text-3xl sm:text-4xl">How BorrowLend works</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {[['For readers', readerSteps, 'tint-mist'], ['For book owners', ownerSteps, 'tint-blush']].map(([title, steps, tint]) => (
            <motion.div key={title as string} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card overflow-hidden rounded-3xl">
              <h3 className={`px-6 py-3 text-xl ${tint as string}`}>{title as string}</h3>
              <ol className="space-y-4 p-6">
                {(steps as string[][]).map(([h, p], i) => (
                  <li key={h} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine text-sm font-extrabold text-white" aria-hidden="true">{i + 1}</span>
                    <div><p className="font-bold">{h}</p><p className="text-sm text-ink-soft">{p}</p></div>
                  </li>
                ))}
              </ol>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="container-page py-14" aria-labelledby="faq">
        <h2 id="faq" className="text-center text-3xl sm:text-4xl">Questions you might have</h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">Quick answers about renting, buying and listing. More on the <Link to="/faq">Help page</Link>.</p>
        <div className="mx-auto mt-6 max-w-3xl space-y-3">
          {FAQ_ITEMS.slice(0, 5).map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
        </div>
      </section>

      <section className="container-page pb-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-pine-dark to-pine px-6 py-14 text-center text-white shadow-lg">
          <div aria-hidden="true" className="absolute -left-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
          <div aria-hidden="true" className="absolute -bottom-14 -right-8 h-52 w-52 rounded-full bg-clay/30" />
          <h2 className="relative mx-auto max-w-xl text-white">{BRAND.tagline}</h2>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/list" className="btn btn-lg bg-white text-pine-dark no-underline hover:bg-pine-light">List your first book</Link>
            <Link to="/browse" className="btn btn-lg border border-white/60 text-white no-underline hover:bg-white/10">Browse books</Link>
          </div>
        </div>
      </section>
    </>
  )
}
