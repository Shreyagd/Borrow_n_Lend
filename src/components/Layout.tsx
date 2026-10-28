import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { BRAND } from '../lib/constants'
import { IS_DEMO } from '../lib/env'
import { initials } from '../lib/format'
import { useRequestList } from '../lib/requestList'
import { useSaved } from '../lib/saved'
import { ArrowUpIcon, CloseIcon, CartIcon, HeartIcon, MenuIcon, PlusIcon, SearchIcon, UserIcon } from './Icons'
import { NotificationsBell } from './NotificationsBell'
import { LoadingState } from './ui'

const LOGO_ALT = `${BRAND.name} logo: books circulate, stories grow`

/** The Borrow&Lend logo. `light` puts it on a cream plate so it stays legible on the dark footer. */
export function Logo({ light }: { light?: boolean }) {
  const img = (
    <img
      src="/images/logo.png" alt={LOGO_ALT} width={900} height={222} decoding="async"
      className={light ? 'h-14 w-auto' : 'h-10 w-auto md:h-11 xl:h-14'}
    />
  )
  return light ? <span className="inline-block rounded-2xl bg-paper px-4 py-2.5 shadow-sm">{img}</span> : img
}

function DemoBanner() {
  const toast = useToast()
  if (!IS_DEMO) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-pine-soft/30 bg-pine px-4 py-2 text-center text-xs font-medium tracking-wide text-sand">
      <span className="rounded bg-clay px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo mode</span>
      <span>Data is stored only in this browser. Books and people marked “Sample” are simulated; no payments or emails are real.</span>
      <button
        className="font-semibold underline hover:text-white"
        onClick={() => { api.demo?.reset(); toast('Demo data reset.', 'info'); window.location.assign('/') }}
      >
        Reset demo data
      </button>
    </div>
  )
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap text-sm font-medium no-underline transition-colors ${isActive ? 'text-clay' : 'text-ink-soft hover:text-clay'}`

function SearchBox({ onDone, className = '' }: { onDone?: () => void; className?: string }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    nav(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
    onDone?.()
  }
  return (
    <form role="search" onSubmit={submit} className={`relative w-full ${className}`}>
      <label htmlFor="header-search" className="sr-only">Search by title, author, genre or ISBN</label>
      <input
        id="header-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title, author, genre or ISBN..."
        className="w-full rounded-full border border-sand bg-white py-2.5 pl-10 pr-9 text-sm shadow-sm transition-all focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/40"
      />
      <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-3 text-ink-mute" />
      {q && (
        <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-2.5 text-ink-mute hover:text-ink"><CloseIcon size={16} /></button>
      )}
    </form>
  )
}

function Header() {
  const { user, profile, isAdmin, signOut, loading } = useAuth()
  const { ids } = useSaved()
  const requestList = useRequestList()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])

  const badge = 'absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white'
  const iconBtn = 'relative rounded-full p-2.5 text-ink-soft transition-colors hover:bg-sand/60 hover:text-clay'

  return (
    <header className="sticky top-0 z-40 border-b border-sand bg-paper/90 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <div className="container-page">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link to="/" aria-label={`${BRAND.name} home`} className="shrink-0 no-underline"><Logo /></Link>

          <div className="mx-4 hidden max-w-md flex-1 xl:flex"><SearchBox /></div>

          <nav aria-label="Main" className="hidden items-center gap-3 lg:flex xl:gap-5">
            <NavLink to="/browse" end className={navCls}>Browse</NavLink>
            <NavLink to="/browse?sort=newest" className={() => navCls({ isActive: false })}>
              <span className="inline-flex items-center gap-1">New listings<span className="inline-block h-2 w-2 rounded-full bg-clay" aria-hidden="true" /></span>
            </NavLink>
            <NavLink to="/how-it-works" className={navCls}>How it works</NavLink>
            {user && <NavLink to="/dashboard" className={navCls}>Dashboard</NavLink>}
            {isAdmin && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
            <div className="-mx-2 flex items-center">
              <Link to="/request-list" className={iconBtn} aria-label={`Request list${requestList.ids.length ? `, ${requestList.ids.length} books` : ''}`} title="Request list">
                <CartIcon size={20} />
                {requestList.ids.length > 0 && <span className={badge}>{requestList.ids.length}</span>}
              </Link>
              <Link to="/saved" className={iconBtn} aria-label={`Saved books${ids.length ? `, ${ids.length}` : ''}`} title="Saved books">
                <HeartIcon size={20} />
                {ids.length > 0 && <span className={badge}>{ids.length}</span>}
              </Link>
              {!loading && user && <NotificationsBell />}
              <Link to={user ? '/account' : '/auth'} className={iconBtn} aria-label={user ? `Your account (${profile?.display_name ?? ''})` : 'Log in or sign up'} title={user ? 'Your account' : 'Log in / Sign up'}>
                {user ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pine text-[10px] font-bold text-white">{initials(profile?.display_name ?? '?')}</span> : <UserIcon size={20} />}
              </Link>
            </div>
            <Link to="/list" className="btn-primary !min-h-0 gap-2 whitespace-nowrap !px-4 !py-2.5 no-underline text-white lg:!px-5"><PlusIcon size={14} /> List a book</Link>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <Link to="/list" className="rounded-full bg-pine px-3 py-2 text-xs font-semibold text-white no-underline">+ List</Link>
            <button className="p-2 text-ink-soft hover:text-pine" aria-label="Menu" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="container-page space-y-1 border-t border-sand pb-6 pt-3 lg:hidden">
          <SearchBox onDone={() => setOpen(false)} className="my-2" />
          {[['/browse', 'Browse books'], ['/browse?sort=newest', 'New listings'], ['/how-it-works', 'How it works'], ...(user ? [['/dashboard', 'Dashboard']] : []), ...(isAdmin ? [['/admin', 'Admin']] : [])].map(([to, label]) => (
            <Link key={to} to={to} className="block border-b border-sand/60 py-2.5 text-base font-medium text-ink no-underline">{label}</Link>
          ))}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-sm font-medium text-ink">
            <Link to="/saved" className="flex items-center gap-2 text-ink no-underline"><HeartIcon size={16} className="text-clay" /> Saved{ids.length ? ` (${ids.length})` : ''}</Link>
            <Link to="/request-list" className="flex items-center gap-2 text-ink no-underline"><CartIcon size={16} className="text-clay" /> Request list{requestList.ids.length ? ` (${requestList.ids.length})` : ''}</Link>
            {user ? (
              <>
                <Link to="/account" className="flex items-center gap-2 text-ink no-underline"><UserIcon size={16} /> {profile?.display_name ?? 'Account'}</Link>
                <button className="text-ink-soft underline" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
              </>
            ) : (
              <Link to="/auth" className="flex items-center gap-2 text-ink no-underline"><UserIcon size={16} /> Log in / Sign up</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}

function Footer() {
  const a = 'text-sand/80 no-underline transition-colors hover:text-clay'
  const h = 'mb-4 font-sans text-xs font-bold uppercase tracking-widest text-white'
  return (
    <footer className="mt-12 border-t border-pine-soft/20 bg-pine-dark pb-12 pt-16 text-sand/80">
      <div className="container-page">
        <div className="grid gap-10 border-b border-pine-soft/30 pb-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Link to="/" className="no-underline"><Logo light /></Link>
            <p className="max-w-sm text-xs leading-relaxed text-sand/70">
              BorrowLend is a community-first book sharing platform designed to promote reading affordability, reduce waste, and build neighbourhood connections.
            </p>
          </div>
          <div>
            <h2 className={h}>Marketplace</h2>
            <ul className="space-y-2.5 text-xs">
              <li><Link className={a} to="/browse">Browse all books</Link></li>
              <li><Link className={a} to="/browse?category=Fiction">Fiction &amp; novels</Link></li>
              <li><Link className={a} to="/browse?category=Self-Help">Self-development</Link></li>
              <li><Link className={a} to="/browse?category=Textbooks">Academic textbooks</Link></li>
              <li><Link className="font-semibold text-clay no-underline hover:underline" to="/list">List a book</Link></li>
            </ul>
          </div>
          <div>
            <h2 className={h}>Company</h2>
            <ul className="space-y-2.5 text-xs">
              <li><Link className={a} to="/about">About us</Link></li>
              <li><Link className={a} to="/how-it-works">How it works</Link></li>
              <li><Link className={a} to="/contact">Contact support</Link></li>
              <li><Link className={a} to="/faq">Help / FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h2 className={h}>Legal (drafts)</h2>
            <ul className="space-y-2.5 text-xs">
              <li><Link className={a} to="/terms">Terms of use</Link></li>
              <li><Link className={a} to="/privacy">Privacy policy</Link></li>
              <li><Link className={a} to="/policies">Rental &amp; return policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-sand/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {BRAND.name}. Pilot version. Legal pages are drafts pending final review.</p>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-1 transition-colors hover:text-white">
            Back to top <ArrowUpIcon size={12} />
          </button>
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
