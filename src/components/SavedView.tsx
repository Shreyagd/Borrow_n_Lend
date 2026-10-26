import React from 'react';
import { BookItem, CartItem } from '../types';

interface SavedViewProps {
  savedBookIds: string[];
  books: BookItem[];
  cartItems: CartItem[];
  onToggleSave: (bookId: string) => void;
  onAddToCart: (book: BookItem) => void;
  onSelectBook: (book: BookItem) => void;
  onNavigate: (tab: string) => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  savedBookIds,
  books,
  cartItems,
  onToggleSave,
  onAddToCart,
  onSelectBook,
  onNavigate,
}) => {
  const savedBooks = books.filter((b) => savedBookIds.includes(b.id));

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-[#a04028] text-[11px] uppercase tracking-widest font-bold">
          <span className="material-symbols-outlined text-[16px]">favorite</span>
          <span>Your Reading Wishlist</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[34px] sm:text-[40px] leading-tight text-[#04281a] font-semibold">
              Saved Books ({savedBooks.length})
            </h1>
            <p className="text-[15px] text-[#414844] mt-1">
              Editions you’ve bookmarked to borrow or buy when you’re ready for your next read.
            </p>
          </div>
          <button
            onClick={() => onNavigate('browse')}
            className="px-5 py-2.5 rounded-full bg-[#f6f3ea] text-[#04281a] text-[13px] font-semibold border border-[#e1ddd0] hover:bg-[#ebe8df] transition-colors self-start sm:self-auto cursor-pointer"
          >
            Explore More Books
          </button>
        </div>
      </div>

      {savedBooks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#e1ddd0] shadow-xs space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#f6f3ea] flex items-center justify-center text-[#a04028]">
            <span className="material-symbols-outlined text-[32px]">favorite_border</span>
          </div>
          <h3 className="font-serif text-[22px] text-[#1c1c17] font-semibold">
            No saved books yet
          </h3>
          <p className="text-[14px] text-[#414844] leading-relaxed">
            Click the heart icon on any book while browsing to save it to your personal wishlist.
          </p>
          <button
            onClick={() => onNavigate('browse')}
            className="px-6 py-2.5 rounded-full bg-[#04281a] text-white font-semibold text-[13px] hover:bg-[#1c3e2f] transition-all cursor-pointer"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {savedBooks.map((book) => {
            const inCart = cartItems.some((i) => i.id === book.id);

            return (
              <div
                key={book.id}
                className="bg-white rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#e1ddd0] relative"
              >
                {/* Heart Button */}
                <button
                  onClick={() => onToggleSave(book.id)}
                  className="absolute top-7 right-7 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-[#a04028] hover:scale-110 transition-transform cursor-pointer"
                  title="Remove from saved"
                >
                  <span className="material-symbols-outlined text-[18px]">favorite</span>
                </button>

                {/* Arch Alcove Book Cover */}
                <div
                  onClick={() => onSelectBook(book)}
                  className="flex items-center justify-center p-6 bg-[#f6f3ea] rounded-t-full rounded-b-lg mb-4 cursor-pointer group-hover:bg-[#ebe8df]/70 transition-colors relative"
                >
                  <div className="w-22 h-30 bg-[#faf7ee] rounded shadow-md flex flex-col justify-between p-2.5 text-center border-l-2 border-stone-300 relative">
                    <span
                      className={`text-[8px] uppercase tracking-wider font-bold ${
                        book.type === 'rental' ? 'text-[#a04028]' : 'text-[#04281a]'
                      }`}
                    >
                      {book.category}
                    </span>
                    <p
                      className={`font-serif text-[11px] leading-tight font-bold line-clamp-2 ${
                        book.type === 'rental' ? 'text-[#04281a]' : 'text-[#a04028]'
                      }`}
                    >
                      {book.title.split(':')[0]}
                    </p>
                    <p className="text-[8px] text-[#414844] truncate">{book.author}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
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
                    <span className="text-[11px] text-[#414844]">{book.distance}</span>
                  </div>

                  <h3
                    onClick={() => onSelectBook(book)}
                    className="font-serif text-[16px] text-[#1c1c17] font-semibold line-clamp-1 hover:text-[#04281a] cursor-pointer"
                  >
                    {book.title}
                  </h3>
                  <p className="text-[13px] text-[#414844] mb-4">
                    {book.author} • {book.condition}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectBook(book)}
                      className="flex-1 py-2 px-2.5 rounded-full bg-[#f6f3ea] text-[#1c1c17] text-[12px] font-semibold hover:bg-[#ebe8df] transition-colors border border-[#e1ddd0] cursor-pointer"
                    >
                      Details
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
                      <span>{inCart ? 'In Cart' : book.type === 'rental' ? 'Rent' : 'Buy'}</span>
                    </button>
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
