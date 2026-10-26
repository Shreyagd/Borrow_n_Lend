import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookCard, BookGrid } from '../components/BookCard'
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORIES, CONDITIONS, PAGE_SIZE } from '../lib/constants'
import { useAsync, useDebounced, usePageMeta } from '../lib/hooks'
import type { Condition, ListingFilters } from '../lib/types'

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) && Number(v) >= 0 ? Number(v) : null)

function parse(sp: URLSearchParams): ListingFilters {
  const type = sp.get('type')
  const sort = sp.get('sort')
  return {
    q: sp.get('q') ?? '',
    category: sp.get('category') ?? '',
    type: type === 'rent' || type === 'sale' ? type : '',
    conditions: (sp.get('cond') ?? '').split(',').filter((c): c is Condition => CONDITIONS.some((x) => x.value === c)),
    minPrice: num(sp.get('min')),
    maxPrice: num(sp.get('max')),
    area: sp.get('area') ?? '',
    sort: sort === 'newest' || sort === 'price_asc' || sort === 'price_desc' || sort === 'relevance' ? sort : 'relevance',
    page: Math.max(1, Number(sp.get('page')) || 1),
  }
}

export default function Browse() {
  const [sp, setSp] = useSearchParams()
  const f = parse(sp)
  usePageMeta('Browse books', 'Search and filter pre-owned books to rent or buy from readers in your area.')

  const [qText, setQText] = useState(f.q)
  const [areaText, setAreaText] = useState(f.area)
  const [min, setMin] = useState(f.minPrice?.toString() ?? '')
  const [max, setMax] = useState(f.maxPrice?.toString() ?? '')
  const [drawer, setDrawer] = useState(false)
  const dq = useDebounced(qText), darea = useDebounced(areaText), dmin = useDebounced(min), dmax = useDebounced(max)

  const update = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    if (!keepPage) next.delete('page')
    setSp(next, { replace: true })
  }

  // Sync debounced text inputs into the URL.
  useEffect(() => {
    if (dq !== f.q || darea !== f.area || (dmin || '') !== (f.minPrice?.toString() ?? '') || (dmax || '') !== (f.maxPrice?.toString() ?? '')) {
      update({ q: dq || null, area: darea || null, min: dmin || null, max: dmax || null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, darea, dmin, dmax])
  // Keep inputs in sync if the URL changes externally (e.g. header search / reset).
  useEffect(() => {
    setQText(f.q); setAreaText(f.area); setMin(f.minPrice?.toString() ?? ''); setMax(f.maxPrice?.toString() ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get('q'), sp.get('area'), sp.get('min'), sp.get('max')])

  const key = sp.toString()
  const res = useAsync(() => api.listings.search(f), [key])

  const hasFilters = !!(f.q || f.category || f.type || f.conditions.length || f.minPrice != null || f.maxPrice != null || f.area)
  const reset = () => { setSp(new URLSearchParams(), { replace: true }); setDrawer(false) }

  const toggleCond = (c: Condition) => {
    const set = new Set(f.conditions)
    if (set.has(c)) set.delete(c); else set.add(c)
    update({ cond: [...set].join(',') || null })
  }

  const filters = (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">Available to</legend>
        <div className="flex gap-2">
          {([['', 'All'], ['rent', 'Rent'], ['sale', 'Buy']] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={f.type === v}
              onClick={() => update({ type: v || null })}
              className={`btn btn-sm flex-1 ${f.type === v ? 'bg-pine text-white' : 'border border-line bg-white text-ink'}`}>{l}</button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="f-cat">Category</label>
        <select id="f-cat" className="input" value={f.category} onChange={(e) => update({ category: e.target.value || null })}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="label">Condition</legend>
        <div className="space-y-2">
          {CONDITIONS.map((c) => (
            <label key={c.value} className="flex min-h-[28px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-pine" checked={f.conditions.includes(c.value)} onChange={() => toggleCond(c.value)} />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Price {f.type === 'rent' ? '(per week)' : f.type === 'sale' ? '(to buy)' : '(week rent or buy)'}</legend>
        <div className="flex items-center gap-2">
          <input aria-label="Minimum price" className="input" inputMode="numeric" type="number" min={0} placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} />
          <span aria-hidden="true">–</span>
          <input aria-label="Maximum price" className="input" inputMode="numeric" type="number" min={0} placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="f-area">Pickup area</label>
        <input id="f-area" className="input" placeholder="e.g. neighbourhood" value={areaText} onChange={(e) => setAreaText(e.target.value)} />
        <p className="mt-1 text-xs text-ink-mute">Matches the area text on listings. Distance search isn’t available yet.</p>
      </div>
      {hasFilters && <button className="btn-secondary w-full" onClick={reset}>Reset all filters</button>}
    </div>
  )

  return (
    <div className="container-page py-8">
      <div className="mb-5"><h1 className="text-3xl sm:text-4xl">Let’s discover something new <span className="text-ink/40">every time you turn the page</span></h1></div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Genres">
        {[['', 'All books'], ...CATEGORIES.map((c) => [c, c])].map(([v, l]) => (
          <button key={l} type="button" aria-pressed={f.category === v}
            onClick={() => update({ category: v || null })}
            className={`btn btn-sm shrink-0 rounded-full ${f.category === v ? 'bg-ink text-white' : 'border border-line bg-white text-ink hover:bg-pine-light'}`}>{l}</button>
        ))}
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <form role="search" className="flex-1" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="b-search" className="sr-only">Search by title, author, ISBN or keyword</label>
          <input id="b-search" type="search" className="input" placeholder="Search title, author, ISBN or keyword" value={qText} onChange={(e) => setQText(e.target.value)} />
        </form>
        <div className="flex gap-2">
          <button className="btn-secondary lg:hidden" onClick={() => setDrawer(true)} aria-haspopup="dialog">
            Filters{hasFilters ? ' •' : ''}
          </button>
          <div className="flex-1 sm:flex-none">
            <label htmlFor="b-sort" className="sr-only">Sort by</label>
            <select id="b-sort" className="input" value={f.sort} onChange={(e) => update({ sort: e.target.value === 'relevance' ? null : e.target.value })}>
              <option value="relevance">Sort: Relevance</option>
              <option value="newest">Sort: Newest</option>
              <option value="price_asc">Sort: Price, low to high</option>
              <option value="price_desc">Sort: Price, high to low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">{filters}</aside>
        <section aria-live="polite">
          {res.loading && <LoadingState label="Searching…" />}
          {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
          {!res.loading && res.data && (
            res.data.items.length === 0 ? (
              <EmptyState
                title={hasFilters ? 'No books match your filters' : 'No books listed yet'}
                action={hasFilters ? <button className="btn-primary" onClick={reset}>Reset filters</button> : undefined}
              >
                {hasFilters ? 'Try a different search or remove some filters.' : 'Check back soon, or list one of your own.'}
              </EmptyState>
            ) : (
              <>
                <p className="mb-4 text-sm text-ink-soft">{res.data.total} book{res.data.total === 1 ? '' : 's'}</p>
                <BookGrid>{res.data.items.map((l) => <BookCard key={l.id} listing={l} />)}</BookGrid>
                <Pagination page={f.page} total={res.data.total} pageSize={PAGE_SIZE} onPage={(p) => { update({ page: p > 1 ? String(p) : null }, true); window.scrollTo(0, 0) }} />
              </>
            )
          )}
        </section>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-lg">Filters</h2>
              <button className="btn-ghost btn-sm" onClick={() => setDrawer(false)} aria-label="Close filters">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{filters}</div>
            <div className="border-t border-line p-4"><button className="btn-primary w-full" onClick={() => setDrawer(false)}>Show results</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
