import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
  setData: (v: T | null) => void
}

/** Runs `fn` on mount and whenever `deps` change. Ignores results from superseded calls. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    fnRef.current().then(
      (d) => { if (live) { setData(d); setLoading(false) } },
      (e: unknown) => { if (live) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setLoading(false) } },
    )
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload, setData }
}

/** Sets document title and meta description (SPA SEO basics; see README for pre-rendering notes). */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title.includes('BorrowLend') ? title : `${title} · BorrowLend`
    if (description) {
      let m = document.querySelector('meta[name="description"]')
      if (!m) {
        m = document.createElement('meta')
        m.setAttribute('name', 'description')
        document.head.appendChild(m)
      }
      m.setAttribute('content', description.slice(0, 160))
    }
  }, [title, description])
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
