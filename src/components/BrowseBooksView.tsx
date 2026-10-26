import React, { useState, useMemo } from 'react';
import { BookItem, CartItem } from '../typesEditorial';

interface BrowseBooksViewProps {
  books: BookItem[];
  cartItems: CartItem[];
  savedBookIds: string[];
  onToggleSave: (bookId: string) => void;
  onAddToCart: (book: BookItem) => void;
  onSelectBook: (book: BookItem) => void;
  onNavigate: (tab: string) => void;
}

export const BrowseBooksView: React.FC<BrowseBooksViewProps> = ({
  books,
  cartItems,
  savedBookIds,
  onToggleSave,
  onAddToCart,
  onSelectBook,
  onNavigate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [formatFilter, setFormatFilter] = useState<'all' | 'rental' | 'purchase'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLocker] = useState<string>('all');

  const categories = [
    'All',
    'Self-Help',
    'Business',
    'Non-fiction',
    'Fiction',
    'Mindset',
    'Philosophy',
    'Bio',
    'Ecology',
    'Classics',
  ];

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      // Category filter
      if (selectedCategory !== 'All' && !book.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
      // Format filter
      if (formatFilter !== 'all' && book.type !== formatFilter) {
        return false;
      }
      // Locker filter
      if (selectedLocker !== 'all' && !book.location.toLowerCase().includes(selectedLocker.toLowerCase())) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = book.title.toLowerCase().includes(q);
        const matchAuthor = book.author.toLowerCase().includes(q);
        const matchOwner = book.ownerName.toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchOwner;
      }
      return true;
    });
  }, [books, selectedCategory, formatFilter, selectedLocker, searchQuery]);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2 text-[#a04028] text-[11px] uppercase tracking-widest font-bold">
          <span className="material-symbols-outlined text-[16px]">menu_book</span>
          <span>Community Catalog • North Central Ward</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[34px] sm:text-[40px] leading-tight text-[#04281a] font-semibold tracking-tight">
              Browse Available Books
            </h1>
            <p className="text-[15px] text-[#414844] mt-1">
              Gently loved copies resting in neighborhood lockers and on readers’ study desks.
            </p>
          </div>
          <button
            onClick={() => onNavigate('cart')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f6f3ea] text-[#04281a] text-[13px] font-semibold border border-[#e1ddd0] hover:bg-[#ebe8df] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">local_mall</span>
            <span>View Cart ({cartItems.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#e1ddd0] mb-8 space-y-4">
        {/* Top search & format toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#414844] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, or shelf lender..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#f6f3ea] text-[14px] text-[#1c1c17] placeholder-[#414844]/60 focus:outline-none focus:ring-2 focus:ring-[#04281a] border border-[#e1ddd0]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#414844] hover:text-[#1c1c17]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Format segmented tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#f6f3ea] rounded-full border border-[#e1ddd0] shrink-0">
            <button
              onClick={() => setFormatFilter('all')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                formatFilter === 'all'
                  ? 'bg-[#04281a] text-white shadow-xs'
                  : 'text-[#414844] hover:text-[#1c1c17]'
              }`}
            >
              All Formats
            </button>
            <button
              onClick={() => setFormatFilter('rental')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                formatFilter === 'rental'
                  ? 'bg-[#04281a] text-white shadow-xs'
                  : 'text-[#414844] hover:text-[#1c1c17]'
              }`}
            >
              Rent Only
            </button>
            <button
              onClick={() => setFormatFilter('purchase')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                formatFilter === 'purchase'
                  ? 'bg-[#a04028] text-white shadow-xs'
                  : 'text-[#414844] hover:text-[#1c1c17]'
              }`}
            >
              Direct Buy
            </button>
          </div>
        </div>

        {/* Category horizontal scrolling chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <span className="text-[12px] font-semibold text-[#414844] shrink-0 mr-1">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#04281a] text-white shadow-xs'
                  : 'bg-[#f6f3ea] text-[#414844] border border-[#e1ddd0] hover:bg-[#ebe8df]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Books */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#e1ddd0] p-8 space-y-3">
          <span className="material-symbols-outlined text-[36px] text-[#414844]">auto_stories</span>
          <h3 className="font-serif text-[22px] text-[#1c1c17]">No matching books found</h3>
          <p className="text-[14px] text-[#414844]">
            Try adjusting your search query or switching to another category.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setFormatFilter('all');
            }}
            className="px-5 py-2 rounded-full bg-[#04281a] text-white text-[13px] font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map((book) => {
            const inCart = cartItems.some((i) => i.id === book.id);
            const isSaved = savedBookIds.includes(book.id);

            return (
              <div
                key={book.id}
                className="bg-white rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#e1ddd0] relative"
              >
                {/* Heart wishlist button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave(book.id);
                  }}
                  className={`absolute top-7 right-7 z-10 w-8 h-8 rounded-full shadow-xs flex items-center justify-center transition-all cursor-pointer ${
                    isSaved
                      ? 'bg-white text-[#a04028]'
                      : 'bg-white/80 text-[#414844] hover:text-[#a04028] hover:bg-white'
                  }`}
                  title={isSaved ? 'Remove from saved' : 'Save to wishlist'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isSaved ? 'favorite' : 'favorite_border'}
                  </span>
                </button>

                {/* Arch Alcove Book Cover */}
                <div
                  onClick={() => onSelectBook(book)}
                  className="flex items-center justify-center p-6 bg-[#f6f3ea] rounded-t-full rounded-b-lg mb-4 cursor-pointer group-hover:bg-[#ebe8df]/70 transition-colors relative"
                >
                  <div className="w-24 h-32 bg-[#faf7ee] rounded shadow-md flex flex-col justify-between p-3 text-center border-l-2 border-stone-300 relative">
                    <span
                      className={`text-[8px] uppercase tracking-wider font-bold ${
                        book.type === 'rental' ? 'text-[#a04028]' : 'text-[#04281a]'
                      }`}
                    >
                      {book.tagLabel || book.category}
                    </span>
                    <p
                      className={`font-serif text-[12px] leading-tight font-bold line-clamp-3 ${
                        book.type === 'rental' ? 'text-[#04281a]' : 'text-[#a04028]'
                      }`}
                    >
                      {book.title.split(':')[0]}
                    </p>
                    <p className="text-[9px] text-[#414844] truncate">{book.author}</p>
                  </div>

                  {book.type === 'rental' && (
                    <div className="absolute top-2 right-6 w-2.5 h-6 bg-[#a04028] rounded-b-sm shadow-sm"></div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          book.type === 'rental'
                            ? 'text-[#04281a] bg-[#c5ebd6]'
                            : 'text-[#3c0700] bg-[#ffdad2]'
                        }`}
                      >
                        {book.type === 'rental'
                          ? `$${book.rentalFee?.toFixed(2)} / wk`
                          : `$${book.purchasePrice?.toFixed(2)} buy`}
                      </span>
                      <span className="text-[11px] text-[#414844] font-medium">{book.distance}</span>
                    </div>

                    <h3
                      onClick={() => onSelectBook(book)}
                      className="font-serif text-[17px] leading-snug text-[#1c1c17] font-semibold line-clamp-2 hover:text-[#04281a] cursor-pointer"
                    >
                      {book.title}
                    </h3>
                    <p className="text-[13px] text-[#414844] mt-1">By {book.author}</p>
                    <p className="text-[11px] text-[#414844] mt-1">
                      Lender: <strong>{book.ownerName}</strong> (★ {book.ownerRating})
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-[#e1ddd0]/60 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#414844]">
                      <span className="truncate">{book.location}</span>
                      <span className="font-semibold text-[#04281a]">{book.condition}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectBook(book)}
                        className="flex-1 py-2 px-2.5 rounded-full bg-[#f6f3ea] text-[#1c1c17] text-[12px] font-semibold hover:bg-[#ebe8df] transition-colors border border-[#e1ddd0] cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => !inCart && onAddToCart(book)}
                        disabled={inCart}
                        className={`py-2 px-3.5 rounded-full text-[12px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          inCart
                            ? 'bg-[#c5ebd6] text-[#002114] cursor-default'
                            : book.type === 'rental'
                            ? 'bg-[#04281a] text-white hover:bg-[#1c3e2f]'
                            : 'bg-[#a04028] text-white hover:bg-[#74200a]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {inCart ? 'done' : 'local_mall'}
                        </span>
                        <span>{inCart ? 'In Basket' : book.type === 'rental' ? 'Rent' : 'Buy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
