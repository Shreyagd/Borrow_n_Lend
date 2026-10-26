import { Link } from 'react-router-dom'
import { BookCard, BookGrid } from '../components/BookCard'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'
import { api } from '../lib/api'
import { useAsync, usePageMeta } from '../lib/hooks'
import { useSaved } from '../lib/saved'

export default function Saved() {
  usePageMeta('Saved books', 'Books you saved on BorrowLend.')
  const { ids } = useSaved()
  const key = ids.join(',')
  const res = useAsync(async () => {
    const rows = await Promise.all(ids.map((id) => api.listings.get(id).catch(() => null)))
    return rows.filter((l): l is NonNullable<typeof l> => !!l && l.status !== 'removed')
  }, [key])

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl sm:text-4xl">Saved books</h1>
      <p className="mt-1 text-sm text-ink-soft">Saved on this device. Tap the heart on any book to add or remove it.</p>
      <div className="mt-6">
        {res.loading && <LoadingState />}
        {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
        {!res.loading && res.data && res.data.length === 0 && (
          <EmptyState title="Nothing saved yet" action={<Link to="/browse" className="btn-primary no-underline text-white">Browse books</Link>}>
            Tap the heart on a book to keep it here for later.
          </EmptyState>
        )}
        {res.data && res.data.length > 0 && <BookGrid>{res.data.map((l) => <BookCard key={l.id} listing={l} />)}</BookGrid>}
      </div>
    </div>
  )
}
