import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { BRAND } from '../lib/constants'
import { IS_DEMO } from '../lib/env'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { useSaved } from '../lib/saved'
import { HeartIcon } from './HeartButton'
import { NotificationsBell } from './NotificationsBell'
import { LoadingState } from './ui'

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill={light ? '#ffffff' : '#5848d0'} />
        <path d="M9 8h9a4 4 0 0 1 4 4v12H13a4 4 0 0 1-4-4z" fill={light ? '#5848d0' : '#ffffff'} />
        <path d="M13 12h6" stroke="#ee8b73" strokeWidth="2" />
      </svg>
      <span className={`font-sans text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-pine-dark'}`}>{BRAND.name}</span>
    </span>
  )
}

function Announcement() {
  if (IS_DEMO) return null
  return (
    <div className="bg-pine px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
      Pilot launch: list a book in two minutes and start earning from your shelf.{' '}
      <Link to="/list" className="font-bold text-white underline">List a book</Link>
    </div>
  )
}

function DemoBanner() {
  const toast = useToast()
  if (!IS_DEMO) return null
  return (
    <div className="bg-pine px-4 py-2 text-center text-xs text-white sm:text-sm">
      <strong>Demo mode.</strong> Data is stored only in this browser; books and people marked “Sample” are fake. No payments or emails are real.{' '}
      <button
        className="font-bold underline"
        onClick={() => { api.demo?.reset(); toast('Demo data reset.', 'info'); window.location.assign('/') }}
      >
        Reset demo data
      </button>
    </div>
  )
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 text-sm font-semibold no-underline ${isActive ? 'text-pine underline decoration-2 underline-offset-[10px]' : 'text-ink hover:text-pine'}`

function Header() {
  const { user, profile, isAdmin, signOut, loading } = useAuth()
  const { ids } = useSaved()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])

  const links = (
    <>
      <NavLink to="/browse" end className={navCls}>Browse</NavLink>
      <NavLink to="/browse?sort=newest" className={() => navCls({ isActive: false })}>New listings</NavLink>
      <NavLink to="/how-it-works" className={navCls}>How it works</NavLink>
      {user && <NavLink to="/dashboard" className={navCls}>Dashboard</NavLink>}
      {isAdmin && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
    </>
  )

  return (
    <header className="sticky top-0 z-30 bg-white/95 shadow-[0_1px_0_#e7e7ef] backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link to="/" aria-label={`${BRAND.name} home`} className="no-underline"><Logo /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">{links}</nav>
        <div className="flex items-center gap-1">
          <label className="sr-only" htmlFor="lang">Language</label>
          <select id="lang" className="hidden h-9 w-[4.25rem] rounded-lg border-0 bg-transparent pl-2 pr-6 text-sm font-semibold text-ink focus:ring-2 focus:ring-pine/30 lg:block" defaultValue="en" title="More languages coming soon">
            <option value="en">EN</option>
          </select>
          <Link to="/saved" className="btn-ghost btn-sm relative px-2 text-ink" aria-label={`Saved books${ids.length ? `, ${ids.length}` : ''}`}>
            <HeartIcon size={20} />
            {ids.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{ids.length}</span>}
          </Link>
          {!loading && user && <NotificationsBell />}
          <Link to={user ? '/account' : '/auth'} className="btn-ghost btn-sm px-2 text-ink" aria-label={user ? `Your account (${profile?.display_name ?? ''})` : 'Log in'}>
            {user ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pine text-xs font-bold text-white">{initials(profile?.display_name ?? '?')}</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            )}
          </Link>
          {!loading && !user && <Link to="/auth" state={{ mode: 'up' }} className="btn-primary btn-sm hidden no-underline text-white sm:inline-flex">Sign up</Link>}
          {!loading && user && <button className="btn-ghost btn-sm hidden lg:inline-flex" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>}
          <button
            className="btn-ghost btn-sm md:hidden" aria-label="Menu" aria-expanded={open} aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="container-page flex flex-col gap-1 border-t border-line pb-4 pt-3 md:hidden">
          {links}
          <NavLink to="/list" className={navCls}>List a book</NavLink>
          <NavLink to="/saved" className={navCls}>Saved books{ids.length ? ` (${ids.length})` : ''}</NavLink>
          {user ? (
            <>
              <NavLink to="/account" className={navCls}>Account ({profile?.display_name})</NavLink>
              <button className="px-3 py-2 text-left text-sm font-semibold text-ink-soft hover:text-pine" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
            </>
          ) : (
            <NavLink to="/auth" className={navCls}>Log in / Sign up</NavLink>
          )}
        </nav>
      )}
    </header>
  )
}

function Footer() {
  const col = 'space-y-2 text-sm'
  const a = 'text-paper/80 hover:text-white'
  return (
    <footer className="mt-20 bg-[#15132b] text-paper">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <Logo light />
          <p className="max-w-xs text-sm text-paper/80">{BRAND.tagline}</p>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide text-[#b9b2ff]">Marketplace</h2>
          <ul className={col}>
            <li><Link className={a} to="/browse">Browse books</Link></li>
            <li><Link className={a} to="/list">List a book</Link></li>
            <li><Link className={a} to="/how-it-works">How it works</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide text-[#b9b2ff]">Company</h2>
          <ul className={col}>
            <li><Link className={a} to="/about">About</Link></li>
            <li><Link className={a} to="/contact">Contact</Link></li>
            <li><Link className={a} to="/faq">Help / FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide text-[#b9b2ff]">Legal (drafts)</h2>
          <ul className={col}>
            <li><Link className={a} to="/terms">Terms of use</Link></li>
            <li><Link className={a} to="/privacy">Privacy policy</Link></li>
            <li><Link className={a} to="/policies">Rental &amp; return policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-paper/60">
        © {new Date().getFullYear()} {BRAND.name}. Pilot version. Legal pages are drafts pending review.
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
      <Announcement />
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
