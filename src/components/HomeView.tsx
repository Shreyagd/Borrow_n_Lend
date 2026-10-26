import React from 'react';
import { BookItem, CartItem } from '../typesEditorial';

interface HomeViewProps {
  featuredBooks: BookItem[];
  cartItems: CartItem[];
  onAddToCart: (book: BookItem) => void;
  onSelectBook: (book: BookItem) => void;
  onNavigate: (tab: string) => void;
  onOpenListBook: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  featuredBooks,
  cartItems,
  onAddToCart,
  onSelectBook,
  onNavigate,
  onOpenListBook,
}) => {
  return (
    <div className="w-full">
      {/* Editorial Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f6f3ea] to-[#fcf9f0] border-b border-[#e1ddd0] py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c5ebd6] text-[#002114] text-[12px] font-bold tracking-wide">
                <span className="material-symbols-outlined text-[16px] text-[#04281a]">
                  verified
                </span>
                <span>North Central Ward Lending Network</span>
              </div>

              <h1 className="font-serif text-[42px] sm:text-[54px] lg:text-[60px] leading-[1.08] text-[#04281a] font-semibold tracking-tight text-balance">
                Your books can earn. Someone’s next story starts here.
              </h1>

              <p className="text-[17px] sm:text-[19px] leading-relaxed text-[#414844] max-w-xl">
                A warm neighborhood exchange for book lovers. Rent gently loved editions, buy beloved copies,
                and share your personal library with 24/7 safe swap lockers and full deposit protection.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onNavigate('browse')}
                  className="px-7 py-3.5 rounded-full bg-[#04281a] text-white text-[15px] font-semibold hover:bg-[#1c3e2f] shadow-md active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">explore</span>
                  <span>Explore Catalog</span>
                </button>

                <button
                  onClick={onOpenListBook}
                  className="px-6 py-3.5 rounded-full bg-[#a04028] text-white text-[15px] font-semibold hover:bg-[#74200a] shadow-md active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>Share Your Shelf</span>
                </button>

                <button
                  onClick={() => onNavigate('how-it-works')}
                  className="px-5 py-3.5 rounded-full text-[#1c1c17] text-[14px] font-semibold hover:bg-[#ebe8df] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>How It Works</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>

              {/* Social Proof Strip */}
              <div className="pt-6 border-t border-[#e1ddd0]/80 grid grid-cols-3 gap-6 text-[#1c1c17]">
                <div>
                  <span className="font-serif text-[26px] sm:text-[30px] font-bold text-[#04281a] block">
                    4,200+
                  </span>
                  <span className="text-[12px] text-[#414844]">Local loans completed</span>
                </div>
                <div>
                  <span className="font-serif text-[26px] sm:text-[30px] font-bold text-[#a04028] block">
                    12 Lockers
                  </span>
                  <span className="text-[12px] text-[#414844]">24/7 Library pickup pods</span>
                </div>
                <div>
                  <span className="font-serif text-[26px] sm:text-[30px] font-bold text-[#04281a] block">
                    100%
                  </span>
                  <span className="text-[12px] text-[#414844]">Deposit escrow protection</span>
                </div>
              </div>
            </div>

            {/* Right Visual Arch Composition (5 cols) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm">
                {/* Architectural background arch */}
                <div className="w-full aspect-[4/5] bg-[#ebe8df] rounded-t-full rounded-b-2xl shadow-xl p-8 flex flex-col justify-between items-center relative overflow-hidden border border-[#e1ddd0]">
                  {/* Decorative background sunlight shimmer */}
                  <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>

                  <div className="text-center pt-4">
                    <span className="text-[11px] uppercase tracking-widest text-[#a04028] font-bold">
                      Now Trending in North Ward
                    </span>
                    <h3 className="font-serif text-[22px] text-[#04281a] font-semibold mt-1">
                      Atomic Habits
                    </h3>
                    <p className="text-[13px] text-[#414844]">By James Clear • Like New</p>
                  </div>

                  {/* 3D Elevated Book Mockup */}
                  <div className="w-40 h-56 bg-[#faf7ee] rounded-md shadow-2xl flex flex-col justify-between p-4 text-center border-l-4 border-stone-300 relative transform -rotate-1 hover:rotate-0 transition-transform">
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-wider text-[#a04028] font-bold">
                        Bestseller
                      </span>
                      <p className="font-serif text-[15px] leading-tight text-[#04281a] font-bold">
                        Atomic Habits
                      </p>
                    </div>
                    <div className="border-t border-[#e1ddd0] pt-2">
                      <p className="text-[11px] text-[#414844]">James Clear</p>
                    </div>
                    <div className="absolute top-0 right-4 w-3.5 h-10 bg-[#a04028] rounded-b-sm shadow-sm"></div>
                  </div>

                  {/* Micro badge chip at baseline */}
                  <div className="w-full bg-white/90 backdrop-blur-xs py-2 px-4 rounded-xl flex items-center justify-between text-[12px] border border-[#e1ddd0]/80">
                    <span className="text-[#04281a] font-bold">$3.50 / 2 wks</span>
                    <button
                      onClick={() => onNavigate('cart')}
                      className="text-[#a04028] font-bold hover:underline flex items-center gap-1"
                    >
                      <span>In Cart</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books Section */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#a04028] text-[11px] uppercase tracking-widest font-bold">
              <span className="material-symbols-outlined text-[16px]">local_library</span>
              <span>Curated Selection</span>
            </div>
            <h2 className="font-serif text-[32px] sm:text-[36px] text-[#04281a] font-semibold">
              From Your Neighbors’ Shelves
            </h2>
            <p className="text-[15px] text-[#414844] mt-1">
              Hand-picked books available for safe locker pickup in under 15 minutes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('browse')}
            className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#04281a] hover:text-[#a04028] transition-colors"
          >
            <span>View All Catalog</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredBooks.slice(0, 4).map((book) => {
            const inCart = cartItems.some((i) => i.id === book.id);

            return (
              <div
                key={book.id}
                className="bg-white rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#e1ddd0]"
              >
                {/* Arch Alcove Book Cover */}
                <div
                  onClick={() => onSelectBook(book)}
                  className="flex items-center justify-center p-6 bg-[#f6f3ea] rounded-t-full rounded-b-lg mb-4 cursor-pointer group-hover:bg-[#ebe8df]/70 transition-colors relative"
                >
                  <div className="w-20 h-28 bg-[#faf7ee] rounded shadow-md flex flex-col justify-between p-2 text-center border-l-2 border-stone-300 relative">
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
                  {book.type === 'rental' && (
                    <div className="absolute top-2 right-4 w-2.5 h-6 bg-[#a04028] rounded-b-sm shadow-sm"></div>
                  )}
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

                  <button
                    onClick={() => !inCart && onAddToCart(book)}
                    disabled={inCart}
                    className={`w-full py-2 px-3 rounded-full text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      inCart
                        ? 'bg-[#c5ebd6] text-[#002114] cursor-default'
                        : 'bg-[#ebe8df] text-[#1c1c17] hover:bg-[#04281a] hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {inCart ? 'done' : 'add'}
                    </span>
                    <span>{inCart ? 'In Your Basket' : 'Add to Locker Cart'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Banner */}
      <section className="bg-[#f6f3ea] py-16 border-y border-[#e1ddd0]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-[11px] uppercase tracking-widest text-[#a04028] font-bold">
              The Peer-to-Peer Cycle
            </span>
            <h2 className="font-serif text-[32px] sm:text-[36px] text-[#04281a] font-semibold">
              How Paper Haven Works
            </h2>
            <p className="text-[15px] text-[#414844]">
              Zero shipping waste. No lost books. Built on neighborhood honor and community escrow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white p-7 rounded-2xl border border-[#e1ddd0] space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#c5ebd6] text-[#04281a] flex items-center justify-center font-bold text-[18px]">
                1
              </div>
              <h3 className="font-serif text-[20px] text-[#1c1c17] font-semibold">
                Browse &amp; Lock Dates
              </h3>
              <p className="text-[14px] leading-relaxed text-[#414844]">
                Choose gently loved editions nearby. Reserve rental duration or purchase outright with
                100% deposit escrow protection.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-7 rounded-2xl border border-[#e1ddd0] space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#ffdad2] text-[#3c0700] flex items-center justify-center font-bold text-[18px]">
                2
              </div>
              <h3 className="font-serif text-[20px] text-[#1c1c17] font-semibold">
                Collect 24/7 with PIN
              </h3>
              <p className="text-[14px] leading-relaxed text-[#414844]">
                Receive a private 6-digit access code for your assigned safe swap locker compartment at
                the library or choose zero-emission bicycle courier.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-7 rounded-2xl border border-[#e1ddd0] space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#efbf73]/40 text-[#4d3300] flex items-center justify-center font-bold text-[18px]">
                3
              </div>
              <h3 className="font-serif text-[20px] text-[#1c1c17] font-semibold">
                Read, Return &amp; Auto-Refund
              </h3>
              <p className="text-[14px] leading-relaxed text-[#414844]">
                Enjoy reading at your pace. Drop back into the locker compartment by the due date to
                have your deposit automatically released within 2 hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Lender Spotlight */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <div className="bg-white rounded-2xl p-8 sm:p-12 border border-[#e1ddd0] shadow-sm flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 space-y-4">
            <span className="text-[11px] uppercase tracking-widest text-[#a04028] font-bold">
              Meet Your Shelf Host
            </span>
            <h2 className="font-serif text-[28px] sm:text-[34px] text-[#04281a] font-semibold">
              &ldquo;Sharing my bookshelf helped me meet readers right on my block.&rdquo;
            </h2>
            <p className="text-[15px] leading-relaxed text-[#414844]">
              Clara Vance has shared 24 books across North Central Ward, maintaining a pristine 4.9-star
              rating. Readers love her thoughtful handwritten marginal notes and vintage bookmarks.
            </p>
            <div className="pt-2 flex items-center gap-6">
              <button
                onClick={() => onNavigate('browse')}
                className="px-5 py-2.5 rounded-full bg-[#04281a] text-white text-[13px] font-semibold hover:bg-[#1c3e2f] transition-all cursor-pointer"
              >
                Browse Clara’s Shelf
              </button>
              <button
                onClick={onOpenListBook}
                className="text-[13px] font-semibold text-[#a04028] hover:underline cursor-pointer"
              >
                Become a Shelf Host →
              </button>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-4 bg-[#f6f3ea] p-6 rounded-2xl border border-[#e1ddd0]">
            <img
              alt="Clara Vance"
              className="w-20 h-20 rounded-full object-cover ring-4 ring-[#c5ebd6]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGr-Y3G49tokp_0QU9h-3mZ9zRoZJJuXp3GtxkkmLWAQDQ2sds1mn2-N9dH7HL1TZItKyzt6gKqb25a0CszKZzAbby5MhrHyK6y0dKcoMXNa9-fs0ZVEG1yxGhIxvRtfByoSqWDh6dMjAY6N-FLgCatoeuoGiWHlzT3Z-HGeYlgJVAn4nXXHsFvep0ylYoBuHqyRdhL0y3HL2NEy029qNwfzCI98PXwhiR3-7zmeWz3I_UI8brqgCV"
            />
            <div>
              <h4 className="font-serif text-[18px] text-[#1c1c17] font-semibold">Clara Vance</h4>
              <p className="text-[12px] text-[#414844]">North Central Ward • 24 Loans</p>
              <div className="flex items-center gap-1 text-[12px] text-[#a04028] mt-1 font-bold">
                <span>★ 4.9 Top Lender</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
