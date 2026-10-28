import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BrowseBooksView } from '../components/BrowseBooksView'
import { HomeView } from '../components/HomeView'
import { SavedView } from '../components/SavedView'
import { ErrorState, LoadingState } from '../components/ui'
import { useSettings } from '../context/SettingsContext'
import { api } from '../lib/api'
import { PAGE_SIZE } from '../lib/constants'
import { useAsync, useDebounced, usePageMeta } from '../lib/hooks'
import { useSaved } from '../lib/saved'
import { useRequestList } from '../lib/requestList'
import type { Listing, ListingFilters } from '../lib/types'
import type { BookCondition, BookItem } from '../typesEditorial'

function toBook(listing: Listing, fmt: (amount: number) => string): BookItem {
  const condition: Record<Listing['condition'], BookCondition> = { new: 'Mint', like_new: 'Like New', good: 'Good', acceptable: 'Acceptable' }
  const rental = listing.listing_type !== 'sale' && listing.rental_price != null
  const purchase = listing.listing_type !== 'rent' && listing.sale_price != null
  return {
    id: listing.id, title: listing.title, author: listing.author, category: listing.category,
    type: rental && purchase ? 'both' : rental ? 'rental' : 'purchase',
    rentalWeeks: listing.rental_period_options[0] ? listing.rental_period_options[0] / 7 : undefined,
    rentalFee: listing.rental_price ?? undefined, purchasePrice: listing.sale_price ?? undefined,
    deposit: 0, condition: condition[listing.condition], ownerName: listing.owner?.display_name ?? 'Community member',
    ownerRating: 0, ownerLoans: 0, ownerNote: listing.description ?? undefined,
    location: listing.pickup_area || 'Pickup area not specified', distance: 'Local pickup',
    coverBg: '#FBF9F5', coverAccent: '#1B3B2B', tagLabel: listing.category,
    coverUrl: listing.image_urls[0],
    rentalPriceLabel: rental ? `${fmt(listing.rental_price!)} / week` : undefined,
    purchasePriceLabel: purchase ? `${fmt(listing.sale_price!)} to buy` : undefined,
  }
}

const num = (raw: string | null) => raw && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null

function useOpenListing() {
  const navigate = useNavigate()
  return (book: BookItem) => navigate(`/books/${book.id}`)
}

export function EditorialHomePage() {
  usePageMeta('BorrowLend — Your books can earn', 'Discover pre-owned books to rent or buy, or share your own shelf with readers in your community.')
  const { fmt } = useSettings()
  const navigate = useNavigate()
  const openListing = useOpenListing()
  const result = useAsync(() => api.listings.recent(24), [])
  const books = useMemo(() => (result.data ?? []).map((listing) => toBook(listing, fmt)), [result.data, fmt])
  if (result.loading) return <LoadingState label="Finding recent listings…" />
  if (result.error) return <div className="container-page py-10"><ErrorState message={result.error} onRetry={result.reload} /></div>
  return <HomeView featuredBooks={books} onSelectBook={openListing} onNavigate={(tab) => navigate(tab === 'how-it-works' ? '/how-it-works' : '/browse')} onOpenListBook={() => navigate('/list')} />
}

export function EditorialBrowsePage() {
  usePageMeta('Browse books', 'Search active BorrowLend listings by title, author, category and availability.')
  const [params, setParams] = useSearchParams()
  const { fmt } = useSettings()
  const saved = useSaved()
  const requestList = useRequestList()
  const openListing = useOpenListing()
  const q = params.get('q') ?? ''
  const debouncedQ = useDebounced(q, 250)
  const area = params.get('area') ?? ''
  const debouncedArea = useDebounced(area, 250)
  const category = params.get('category') ?? ''
  const rawType = params.get('type')
  const format: 'all' | 'rental' | 'purchase' = rawType === 'rent' ? 'rental' : rawType === 'sale' ? 'purchase' : 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const condition = params.get('cond') ?? ''
  const sortRaw = params.get('sort')
  const sort: ListingFilters['sort'] = sortRaw === 'newest' || sortRaw === 'price_asc' || sortRaw === 'price_desc' ? sortRaw : 'relevance'
  const filters: ListingFilters = {
    q: debouncedQ, category, type: format === 'rental' ? 'rent' : format === 'purchase' ? 'sale' : '',
    conditions: ['new', 'like_new', 'good', 'acceptable'].includes(condition) ? [condition as ListingFilters['conditions'][number]] : [],
    minPrice: num(params.get('min')), maxPrice: num(params.get('max')),
    area: debouncedArea, sort, page,
  }
  const key = JSON.stringify(filters)
  const result = useAsync(() => api.listings.search(filters), [key])
  const change = (patch: { q?: string; category?: string; format?: 'all' | 'rental' | 'purchase'; minPrice?: string; maxPrice?: string; area?: string; condition?: string; sort?: string }) => {
    const next = new URLSearchParams(params)
    const write = (key: string, value: string) => { if (value) next.set(key, value); else next.delete(key) }
    if (patch.q !== undefined) write('q', patch.q)
    if (patch.category !== undefined) write('category', patch.category)
    if (patch.format !== undefined) {
      const value = patch.format === 'rental' ? 'rent' : patch.format === 'purchase' ? 'sale' : ''
      write('type', value)
    }
    for (const [key, value] of [['min', patch.minPrice], ['max', patch.maxPrice], ['area', patch.area], ['cond', patch.condition], ['sort', patch.sort]] as const) {
      if (value !== undefined) write(key, value)
    }
    next.delete('page')
    setParams(next, { replace: true })
  }
  const pageTo = (n: number) => { const next = new URLSearchParams(params); next.set('page', String(n)); setParams(next) }
  if (result.loading && !result.data) return <LoadingState label="Searching books…" />
  if (result.error) return <div className="container-page py-10"><ErrorState message={result.error} onRetry={result.reload} /></div>
  return <BrowseBooksView books={(result.data?.items ?? []).map((listing) => toBook(listing, fmt))} savedBookIds={saved.ids} onToggleSave={saved.toggle} requestBookIds={requestList.ids} onToggleRequestBook={requestList.toggle} onSelectBook={openListing} query={q} category={category} format={format} minPrice={params.get('min') ?? ''} maxPrice={params.get('max') ?? ''} area={area} condition={condition} sort={sort} onFilters={change} page={page} total={result.data?.total ?? 0} pageSize={PAGE_SIZE} onPage={pageTo} />
}

export function EditorialSavedPage() {
  usePageMeta('Saved books', 'Books you saved on this device.')
  const saved = useSaved()
  const { fmt } = useSettings()
  const openListing = useOpenListing()
  const key = saved.ids.join(',')
  const result = useAsync(async () => {
    const rows = await Promise.all(saved.ids.map((id) => api.listings.get(id).catch(() => null)))
    return rows.filter((listing): listing is Listing => !!listing && listing.status !== 'removed')
  }, [key])
  const books = (result.data ?? []).map((listing) => toBook(listing, fmt))
  if (result.loading) return <LoadingState label="Loading saved books…" />
  if (result.error) return <div className="container-page py-10"><ErrorState message={result.error} onRetry={result.reload} /></div>
  return <SavedView savedBookIds={saved.ids} books={books} onToggleSave={saved.toggle} onSelectBook={openListing} />
}

export function RequestListPage() {
  usePageMeta('Request list', 'Books you are considering on BorrowLend.')
  const list = useRequestList()
  const { fmt } = useSettings()
  const key = list.ids.join(',')
  const result = useAsync(async () => {
    const rows = await Promise.all(list.ids.map((id) => api.listings.get(id).catch(() => null)))
    return rows.filter((listing): listing is Listing => !!listing && listing.status !== 'removed')
  }, [key])
  if (result.loading) return <LoadingState label="Loading your request list…" />
  if (result.error) return <div className="container-page py-10"><ErrorState message={result.error} onRetry={result.reload} /></div>
  const rows = result.data ?? []
  return <main className="container-page py-10">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-clay">Plan your next read</p><h1 className="mt-2 text-4xl text-pine">Your request list</h1>
    <p className="mt-2 max-w-2xl text-sm text-ink-soft">This list is saved in this browser. It does not reserve a book or take payment. Open a listing to choose a rental period or send a purchase request to its owner.</p>
    {!rows.length ? <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-12 text-center text-ink-soft">Your list is empty. <Link to="/browse" className="font-semibold text-pine">Browse books</Link> and add a listing to compare.</div> :
      <div className="mt-7 space-y-3">{rows.map((listing) => <article key={listing.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-clay">{listing.category} · {listing.status === 'active' ? 'Available to request' : 'Currently unavailable'}</p><h2 className="mt-1 text-xl text-ink">{listing.title}</h2><p className="text-sm text-ink-soft">{listing.author} · {listing.pickup_area}</p><p className="mt-2 text-sm font-bold text-pine">{listing.rental_price != null ? `${fmt(listing.rental_price)} / week` : ''}{listing.rental_price != null && listing.sale_price != null ? ' · ' : ''}{listing.sale_price != null ? `${fmt(listing.sale_price)} to buy` : ''}</p></div>
        <div className="flex gap-2"><Link to={`/books/${listing.id}`} className="btn-primary no-underline text-white">View request options</Link><button onClick={() => list.remove(listing.id)} className="btn-secondary">Remove</button></div>
      </article>)}</div>}
  </main>
}
