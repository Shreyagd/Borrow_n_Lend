import React, { useState, useMemo } from 'react';
import { BookItem } from '../typesEditorial';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookItem[];
  onSelectBook: (book: BookItem) => void;
  onAddToCart: (book: BookItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  books,
  onSelectBook,
  onAddToCart,
}) => {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return books.slice(0, 5);
    const q = query.toLowerCase();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q)
    );
  }, [books, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 pt-16">
      <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-[#e1ddd0] shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
        {/* Search Input */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-[#414844] text-[22px]">
            search
          </span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books, authors, categories, or lockers..."
            className="w-full pl-11 pr-10 py-3 rounded-full bg-[#f6f3ea] text-[15px] text-[#1c1c17] placeholder-[#414844]/60 border border-[#e1ddd0] focus:outline-none focus:ring-2 focus:ring-[#04281a]"
          />
          <button
            onClick={onClose}
            className="absolute right-3.5 text-[#414844] hover:text-[#1c1c17] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto space-y-2 flex-1 pr-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#414844] px-2">
            {query.trim() ? `Search Results (${searchResults.length})` : 'Popular in North Ward'}
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-8 text-[#414844] text-[14px]">
              No editions found matching &ldquo;{query}&rdquo;.
            </div>
          ) : (
            searchResults.map((book) => (
              <div
                key={book.id}
                className="p-3 rounded-xl hover:bg-[#f6f3ea] transition-colors flex items-center justify-between gap-3 border border-transparent hover:border-[#e1ddd0] group"
              >
                <div
                  onClick={() => {
                    onSelectBook(book);
                    onClose();
                  }}
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <div className="w-10 h-14 bg-[#faf7ee] rounded border border-stone-300 flex items-center justify-center font-serif text-[10px] font-bold text-[#04281a] shrink-0 text-center p-1">
                    {book.title.split(':')[0].slice(0, 15)}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-[#1c1c17] group-hover:text-[#04281a] line-clamp-1">
                      {book.title}
                    </h4>
                    <p className="text-[12px] text-[#414844]">
                      By {book.author} • {book.category} • {book.distance}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] font-bold text-[#04281a]">
                    ${book.type === 'rental' ? `${book.rentalFee?.toFixed(2)}/wk` : `${book.purchasePrice?.toFixed(2)} buy`}
                  </span>
                  <button
                    onClick={() => {
                      onAddToCart(book);
                      onClose();
                    }}
                    className="p-1.5 rounded-full bg-[#f6f3ea] hover:bg-[#04281a] hover:text-white transition-colors cursor-pointer"
                    title="Add to cart"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
