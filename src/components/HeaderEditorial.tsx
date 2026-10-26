import React, { useState } from 'react';

interface HeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  cartCount: number;
  savedCount: number;
  onOpenListBook: () => void;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  cartCount,
  savedCount,
  onOpenListBook,
  onOpenSearch,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#fcf9f0]/95 backdrop-blur-md shadow-[0_1px_8px_rgba(28,62,47,0.05)] border-b border-[#e1ddd0]/70">
      {/* Top Banner */}
      <div className="w-full bg-[#ebe8df]/70 py-1.5 px-4 sm:px-6 lg:px-12 text-center text-[#414844] text-[11px] leading-[14px] font-bold tracking-wider flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-[15px] text-[#04281a]">eco</span>
        <span>Local book lending &amp; buying — Share your shelf, earn sustainably, and read for less.</span>
      </div>

      {/* Main Bar */}
      <div className="h-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-4 sm:gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {/* Elegant Book Arch Brand Icon */}
            <div className="w-9 h-9 rounded-xl bg-[#04281a] flex items-center justify-center text-[#fcf9f0] shadow-sm group-hover:bg-[#1c3e2f] transition-colors relative overflow-hidden">
              <span className="material-symbols-outlined text-[20px]">auto_stories</span>
              <div className="absolute top-0 right-1 w-1.5 h-3 bg-[#a04028] rounded-b-xs"></div>
            </div>
            <div>
              <span className="font-serif text-[24px] sm:text-[26px] leading-tight tracking-tight text-[#04281a] font-bold group-hover:opacity-90 transition-opacity block">
                BorrowLend
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#a04028] font-bold block -mt-1">
                Neighborhood Exchange
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center gap-7">
          <button
            onClick={() => onNavigate('home')}
            className={`text-[15px] font-semibold transition-colors py-1 cursor-pointer ${
              currentTab === 'home'
                ? 'text-[#04281a] border-b-2 border-[#04281a]'
                : 'text-[#414844] hover:text-[#1c1c17]'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => onNavigate('browse')}
            className={`text-[15px] font-semibold transition-colors py-1 cursor-pointer ${
              currentTab === 'browse'
                ? 'text-[#04281a] border-b-2 border-[#04281a]'
                : 'text-[#414844] hover:text-[#1c1c17]'
            }`}
          >
            Browse Books
          </button>
          <button
            onClick={() => onNavigate('how-it-works')}
            className={`text-[15px] font-semibold transition-colors py-1 cursor-pointer ${
              currentTab === 'how-it-works'
                ? 'text-[#04281a] border-b-2 border-[#04281a]'
                : 'text-[#414844] hover:text-[#1c1c17]'
            }`}
          >
            How It Works
          </button>
          <div className="relative flex items-center">
            <button
              onClick={() => onNavigate('my-shelf')}
              className={`text-[15px] font-semibold transition-colors py-1 cursor-pointer ${
                currentTab === 'my-shelf'
                  ? 'text-[#04281a] border-b-2 border-[#04281a]'
                  : 'text-[#414844] hover:text-[#1c1c17]'
              }`}
            >
              My Shelf &amp; Dashboard
            </button>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[#c5ebd6] text-[#002114] text-[11px] font-bold">
              2 Active
            </span>
          </div>
          <button
            onClick={() => onNavigate('community')}
            className={`text-[15px] font-semibold transition-colors py-1 cursor-pointer ${
              currentTab === 'community'
                ? 'text-[#04281a] border-b-2 border-[#04281a]'
                : 'text-[#414844] hover:text-[#1c1c17]'
            }`}
          >
            Community
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            aria-label="Search catalog"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#414844] hover:bg-[#ebe8df] hover:text-[#1c1c17] transition-all cursor-pointer"
            title="Search catalog"
          >
            <span className="material-symbols-outlined text-[22px]">search</span>
          </button>

          {/* Saved Wishlist */}
          <button
            onClick={() => onNavigate('saved')}
            aria-label="Saved books"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'saved'
                ? 'bg-[#ffdad2] text-[#3c0700]'
                : 'text-[#414844] hover:bg-[#ebe8df] hover:text-[#1c1c17]'
            }`}
            title="Saved Books"
          >
            <span className="material-symbols-outlined text-[22px]">
              {savedCount > 0 ? 'favorite' : 'favorite_border'}
            </span>
            {savedCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#a04028] text-white text-[10px] leading-[16px] text-center font-bold">
                {savedCount}
              </span>
            )}
          </button>

          {/* List a Book CTA */}
          <button
            onClick={onOpenListBook}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a04028] text-white text-[14px] font-semibold shadow-[0_4px_14px_rgba(160,64,40,0.25)] hover:bg-[#74200a] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>List a Book</span>
          </button>

          {/* Cart & Borrowing Lock Trigger */}
          <button
            onClick={() => onNavigate('cart')}
            aria-label="Shopping Cart & Borrowing Lock"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'cart'
                ? 'bg-[#c5ebd6] text-[#002114]'
                : 'text-[#414844] hover:bg-[#ebe8df] hover:text-[#1c1c17]'
            }`}
            title="Cart & Borrowing Lock"
          >
            <span className="material-symbols-outlined text-[22px]">local_mall</span>
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#a04028] text-white text-[10px] leading-[16px] text-center font-bold">
                {cartCount}
              </span>
            )}
          </button>

          {/* User Profile Avatar */}
          <div
            onClick={() => onNavigate('my-shelf')}
            className="pl-1 sm:pl-2 cursor-pointer group flex items-center gap-2"
            title="Clara Vance - My Shelf"
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#c5ebd6] group-hover:ring-[#04281a] transition-all"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGr-Y3G49tokp_0QU9h-3mZ9zRoZJJuXp3GtxkkmLWAQDQ2sds1mn2-N9dH7HL1TZItKyzt6gKqb25a0CszKZzAbby5MhrHyK6y0dKcoMXNa9-fs0ZVEG1yxGhIxvRtfByoSqWDh6dMjAY6N-FLgCatoeuoGiWHlzT3Z-HGeYlgJVAn4nXXHsFvep0ylYoBuHqyRdhL0y3HL2NEy029qNwfzCI98PXwhiR3-7zmeWz3I_UI8brqgCV"
            />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden w-10 h-10 rounded-full flex items-center justify-center text-[#414844] hover:bg-[#ebe8df]"
            aria-label="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#fcf9f0] border-t border-[#e1ddd0] px-6 py-4 space-y-3 shadow-lg">
          <button
            onClick={() => {
              onNavigate('home');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            Home
          </button>
          <button
            onClick={() => {
              onNavigate('browse');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            Browse Books
          </button>
          <button
            onClick={() => {
              onNavigate('how-it-works');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            How It Works
          </button>
          <button
            onClick={() => {
              onNavigate('my-shelf');
              setMobileMenuOpen(false);
            }}
            className="flex items-center justify-between w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            <span>My Shelf &amp; Dashboard</span>
            <span className="px-2 py-0.5 rounded-full bg-[#c5ebd6] text-[#002114] text-[11px] font-bold">
              2 Active
            </span>
          </button>
          <button
            onClick={() => {
              onNavigate('saved');
              setMobileMenuOpen(false);
            }}
            className="flex items-center justify-between w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            <span>Saved Books</span>
            {savedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#ffdad2] text-[#3c0700] text-[11px] font-bold">
                {savedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              onNavigate('cart');
              setMobileMenuOpen(false);
            }}
            className="flex items-center justify-between w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            <span>Cart &amp; Borrowing Lock</span>
            {cartCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#a04028] text-white text-[11px] font-bold">
                {cartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              onNavigate('community');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 font-semibold text-[#1c1c17] hover:text-[#04281a]"
          >
            Community
          </button>
          <button
            onClick={() => {
              onOpenListBook();
              setMobileMenuOpen(false);
            }}
            className="w-full mt-2 py-2.5 rounded-full bg-[#a04028] text-white text-[14px] font-semibold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>List a Book</span>
          </button>
        </div>
      )}
    </header>
  );
};
