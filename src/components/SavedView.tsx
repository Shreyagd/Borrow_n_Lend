import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { BookItem } from '../typesEditorial'
import { BookTile, tileListVariants } from './BookTile'

interface SavedViewProps {
  savedBookIds: string[]
  books: BookItem[]
  onToggleSave: (id: string) => void
  onSelectBook: (book: BookItem) => void
}

export const SavedView = ({ savedBookIds, books, onSelectBook }: SavedViewProps) => {
  const saved = books.filter((book) => savedBookIds.includes(book.id))
  return (
    <main className="container-page py-10">
      <p className="eyebrow">Your reading list</p>
      <h1 className="mt-2 text-4xl">Saved books</h1>
      <p className="mt-2 text-sm text-ink-soft">Saved on this device. Your list is not synced between devices.</p>
      {!saved.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-12 text-center text-ink-soft">
          <p className="font-serif text-xl font-bold text-pine">Nothing saved yet</p>
          <p className="mt-1 text-sm">Tap the heart on a book to keep it here for later.</p>
          <Link to="/browse" className="btn-primary mt-4 no-underline text-white">Browse books</Link>
        </div>
      ) : (
        <motion.div variants={tileListVariants} initial="hidden" animate="show" className="mt-7 grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {saved.map((book) => <BookTile key={book.id} book={book} onSelect={onSelectBook} />)}
        </motion.div>
      )}
    </main>
  )
}
