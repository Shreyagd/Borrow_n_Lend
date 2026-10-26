import React from 'react';
import { BookItem } from '../typesEditorial';

interface BookDetailModalProps {
  book: BookItem | null;
  onClose: () => void;
  onAddToCart: (book: BookItem) => void;
  isInCart: boolean;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  onClose,
  onAddToCart,
  isInCart,
}) => {
  if (!book) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#e1ddd0] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                book.type === 'rental'
                  ? 'bg-[#c5ebd6] text-[#002114]'
                  : 'bg-[#ffdad2] text-[#3c0700]'
              }`}
            >
              {book.type === 'rental' ? 'Rental • 2 Weeks' : 'Direct Purchase'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#f6f3ea] text-[#414844] text-[11px] font-semibold border border-[#e1ddd0]">
              {book.condition}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f6f3ea] flex items-center justify-center text-[#414844] hover:text-[#1c1c17] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Visual Book Alcove */}
        <div className="flex flex-col sm:flex-row gap-6 items-center bg-[#f6f3ea] p-6 rounded-2xl border border-[#e1ddd0]">
          <div className="shrink-0 w-28 h-36 bg-[#ebe8df] rounded-t-full rounded-b-md flex items-center justify-center relative overflow-hidden shadow-md">
            <div className="w-20 h-28 bg-[#faf7ee] rounded shadow-inner flex flex-col justify-between p-2.5 text-center relative border-l-2 border-stone-300">
              <span
                className={`text-[8px] uppercase tracking-wider font-bold ${
                  book.type === 'rental' ? 'text-[#a04028]' : 'text-[#04281a]'
                }`}
              >
                {book.category}
              </span>
              <p
                className={`font-serif text-[11px] leading-tight font-bold ${
                  book.type === 'rental' ? 'text-[#04281a]' : 'text-[#a04028]'
                }`}
              >
                {book.title.split(':')[0]}
              </p>
              <p className="text-[8px] text-[#414844] truncate">{book.author}</p>
            </div>
            {book.type === 'rental' && (
              <div className="absolute top-0 right-3 w-2.5 h-6 bg-[#a04028] rounded-b-sm shadow-sm"></div>
            )}
          </div>

          <div className="space-y-1 text-center sm:text-left">
            <h2 className="font-serif text-[20px] text-[#1c1c17] font-semibold leading-snug">
              {book.title}
            </h2>
            <p className="text-[14px] text-[#414844]">By {book.author}</p>
            <div className="pt-2 flex items-baseline justify-center sm:justify-start gap-2">
              <span className="text-[22px] font-bold text-[#04281a]">
                ${book.type === 'rental' ? book.rentalFee?.toFixed(2) : book.purchasePrice?.toFixed(2)}
              </span>
              <span className="text-[12px] text-[#414844]">
                {book.type === 'rental' ? 'for 2 weeks' : 'outright price'}
              </span>
            </div>
          </div>
        </div>

        {/* Lender Profile */}
        <div className="bg-white p-4 rounded-xl border border-[#e1ddd0] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#c5ebd6] flex items-center justify-center font-bold text-[#04281a] font-serif text-[18px]">
            {book.ownerName.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div className="flex-1">
            <h4 className="text-[15px] font-semibold text-[#1c1c17]">{book.ownerName}</h4>
            <p className="text-[12px] text-[#414844]">
              ★ {book.ownerRating} rating • {book.ownerLoans} neighborhood loans
            </p>
          </div>
          <span className="material-symbols-outlined text-[#04281a]">verified</span>
        </div>

        {/* Reader Note or condition note */}
        {(book.ownerNote || book.notes) && (
          <div className="bg-[#f6f3ea] p-4 rounded-xl border border-[#e1ddd0] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#a04028]">
              Lender's Personal Note
            </span>
            <p className="text-[13px] text-[#414844] italic">
              &ldquo;{book.ownerNote || book.notes}&rdquo;
            </p>
          </div>
        )}

        {/* Location & Deposit info */}
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div className="bg-[#f6f3ea] p-3 rounded-xl border border-[#e1ddd0]">
            <span className="text-[#414844] block">Locker Pod</span>
            <strong className="text-[#1c1c17] line-clamp-1">{book.location}</strong>
          </div>
          <div className="bg-[#f6f3ea] p-3 rounded-xl border border-[#e1ddd0]">
            <span className="text-[#414844] block">Refundable Deposit</span>
            <strong className="text-[#1c1c17]">
              {book.type === 'rental' ? '$10.00 (Escrow)' : 'None (Direct Buy)'}
            </strong>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            if (!isInCart) onAddToCart(book);
            onClose();
          }}
          className={`w-full py-3.5 rounded-full font-semibold text-[15px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
            isInCart
              ? 'bg-[#c5ebd6] text-[#002114]'
              : book.type === 'rental'
              ? 'bg-[#04281a] text-white hover:bg-[#1c3e2f]'
              : 'bg-[#a04028] text-white hover:bg-[#74200a]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isInCart ? 'done' : 'local_mall'}
          </span>
          <span>{isInCart ? 'Already in Your Cart' : book.type === 'rental' ? 'Rent This Edition' : 'Buy Outright'}</span>
        </button>
      </div>
    </div>
  );
};
