import React, { useState } from 'react';
import { BookItem, BookCondition, BookType } from '../types';

interface ListBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListBook: (book: BookItem) => void;
}

export const ListBookModal: React.FC<ListBookModalProps> = ({
  isOpen,
  onClose,
  onListBook,
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Non-Fiction');
  const [type, setType] = useState<BookType>('rental');
  const [rate, setRate] = useState('3.00');
  const [condition, setCondition] = useState<BookCondition>('Like New');
  const [locker, setLocker] = useState('Central Library Safe Swap Locker #4');
  const [ownerNote, setOwnerNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    const newBook: BookItem = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      author: author.trim(),
      category,
      type,
      rentalWeeks: type === 'rental' ? 2 : undefined,
      rentalFee: type === 'rental' ? parseFloat(rate) || 3.0 : undefined,
      purchasePrice: type === 'purchase' ? parseFloat(rate) || 8.0 : undefined,
      deposit: type === 'rental' ? 10.0 : 0,
      condition,
      ownerName: 'Clara Vance',
      ownerRating: 5.0,
      ownerLoans: 25,
      ownerNote: ownerNote.trim() || 'Lent with care by neighborhood host Clara.',
      location: locker,
      distance: '0.4 mi away',
      coverBg: '#faf7ee',
      coverAccent: type === 'rental' ? '#a04028' : '#04281a',
      tagLabel: category,
    };

    onListBook(newBook);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#e1ddd0] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-[#e1ddd0]">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#a04028] uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Neighborhood Shelf Host</span>
            </div>
            <h2 className="font-serif text-[24px] text-[#04281a] font-semibold mt-0.5">
              List a Book on Paper Haven
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f6f3ea] flex items-center justify-center text-[#414844] hover:text-[#1c1c17] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
              Book Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Overstory or Stolen Focus"
              className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
              Author *
            </label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Richard Powers"
              className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
                Lending Format
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('rental')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                    type === 'rental'
                      ? 'bg-[#04281a] text-white border-[#04281a]'
                      : 'bg-[#f6f3ea] text-[#414844] border-[#e1ddd0]'
                  }`}
                >
                  Rent ($/wk)
                </button>
                <button
                  type="button"
                  onClick={() => setType('purchase')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                    type === 'purchase'
                      ? 'bg-[#a04028] text-white border-[#a04028]'
                      : 'bg-[#f6f3ea] text-[#414844] border-[#e1ddd0]'
                  }`}
                >
                  Sell Outright
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
                {type === 'rental' ? 'Rental Fee ($ / 2 wks)' : 'Selling Price ($)'}
              </label>
              <input
                type="number"
                step="0.25"
                min="0.5"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCondition)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
              >
                <option value="Mint">Mint (Flawless)</option>
                <option value="Like New">Like New (Unmarked)</option>
                <option value="Very Good">Very Good (Lightly read)</option>
                <option value="Good">Good (Spine intact, neat notes)</option>
                <option value="Acceptable">Acceptable (Well-loved)</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
              >
                <option value="Non-Fiction">Non-Fiction</option>
                <option value="Bestseller">Bestseller</option>
                <option value="Mindset">Mindset &amp; Productivity</option>
                <option value="Philosophy">Philosophy</option>
                <option value="Bio">Biography &amp; Memoir</option>
                <option value="Fiction">Literary Fiction</option>
                <option value="Ecology">Ecology &amp; Nature</option>
                <option value="Classics">Classics</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
              Drop-off Locker Pod
            </label>
            <select
              value={locker}
              onChange={(e) => setLocker(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
            >
              <option value="Central Library Safe Swap Locker #4">
                Central Library Safe Swap Locker #4 (Foyer)
              </option>
              <option value="Community Center Locker #1">
                North Ward Community Center Locker #1
              </option>
              <option value="Civic Square Safe Locker #3">Civic Square Safe Locker #3</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1c1c17] mb-1">
              Personal Reader Note for Borrower{' '}
              <span className="font-normal text-[#414844]">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={ownerNote}
              onChange={(e) => setOwnerNote(e.target.value)}
              placeholder="e.g. 'Left a handmade bookmark in chapter 2! Hope this book inspires your morning routines.'"
              className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[13px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full bg-[#f6f3ea] text-[#1c1c17] font-semibold text-[14px] hover:bg-[#ebe8df] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-full bg-[#a04028] text-white font-semibold text-[14px] hover:bg-[#74200a] transition-all cursor-pointer shadow-md"
            >
              List Book on Shelf
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
