import React, { useState } from 'react';
import { ActiveBorrow } from '../typesEditorial';

interface MyShelfViewProps {
  activeBorrows: ActiveBorrow[];
  onExtendBorrow: (id: string) => void;
  onReturnBorrow: (id: string) => void;
  onNavigate: (tab: string) => void;
  onOpenListBook: () => void;
}

export const MyShelfView: React.FC<MyShelfViewProps> = ({
  activeBorrows,
  onExtendBorrow,
  onReturnBorrow,
  onNavigate,
  onOpenListBook,
}) => {
  const [activeTab, setActiveTab] = useState<'borrows' | 'lending'>('borrows');
  const [shelfCredits] = useState(15.0);
  const [selectedBorrowForPass, setSelectedBorrowForPass] = useState<ActiveBorrow | null>(null);

  // Books lent out by user (Clara)
  const lentBooks = [
    {
      id: 'lent-1',
      title: 'Atomic Habits: An Easy & Proven Way to Build Good Habits',
      borrower: 'Marcus Reed',
      status: 'On Loan (Due Nov 7)',
      earned: '$3.50',
      depositHeld: '$10.00 in Escrow',
      locker: 'Central Library Safe Swap Locker #4',
    },
    {
      id: 'lent-2',
      title: 'A Gentleman in Moscow',
      borrower: 'Elena Rostova',
      status: 'Reserved for Pickup',
      earned: '$7.50',
      depositHeld: 'Direct Buy Outright',
      locker: 'Central Library Safe Swap Locker #4 (Box #2)',
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 space-y-10">
      {/* Header Profile Summary */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e1ddd0] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <img
            alt="Clara Vance Profile"
            className="w-16 h-16 rounded-full object-cover ring-4 ring-[#c5ebd6]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGr-Y3G49tokp_0QU9h-3mZ9zRoZJJuXp3GtxkkmLWAQDQ2sds1mn2-N9dH7HL1TZItKyzt6gKqb25a0CszKZzAbby5MhrHyK6y0dKcoMXNa9-fs0ZVEG1yxGhIxvRtfByoSqWDh6dMjAY6N-FLgCatoeuoGiWHlzT3Z-HGeYlgJVAn4nXXHsFvep0ylYoBuHqyRdhL0y3HL2NEy029qNwfzCI98PXwhiR3-7zmeWz3I_UI8brqgCV"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[24px] sm:text-[28px] text-[#04281a] font-semibold">
                Clara Vance
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#c5ebd6] text-[#002114] text-[11px] font-bold">
                Neighborhood Host
              </span>
            </div>
            <p className="text-[13px] text-[#414844] mt-0.5">
              North Central Ward • 24 books shared • 5.0 reader rating
            </p>
          </div>
        </div>

        {/* Shelf Credit & Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-[#f6f3ea] px-4 py-2.5 rounded-2xl border border-[#e1ddd0]">
            <span className="text-[11px] text-[#414844] block font-medium">Available Shelf Credits</span>
            <span className="font-serif text-[20px] font-bold text-[#04281a]">
              ${shelfCredits.toFixed(2)}
            </span>
          </div>

          <button
            onClick={onOpenListBook}
            className="px-5 py-2.5 rounded-full bg-[#a04028] text-white text-[13px] font-semibold hover:bg-[#74200a] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>List Another Book</span>
          </button>
        </div>
      </div>

      {/* Segmented Controls */}
      <div className="flex items-center justify-between border-b border-[#e1ddd0] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('borrows')}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${
              activeTab === 'borrows'
                ? 'bg-[#04281a] text-white'
                : 'bg-[#f6f3ea] text-[#414844] hover:text-[#1c1c17]'
            }`}
          >
            Currently Borrowed ({activeBorrows.length})
          </button>
          <button
            onClick={() => setActiveTab('lending')}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${
              activeTab === 'lending'
                ? 'bg-[#04281a] text-white'
                : 'bg-[#f6f3ea] text-[#414844] hover:text-[#1c1c17]'
            }`}
          >
            Lending Out to Neighbors ({lentBooks.length})
          </button>
        </div>

        <button
          onClick={() => onNavigate('browse')}
          className="hidden sm:inline-flex items-center gap-1 text-[13px] font-semibold text-[#a04028] hover:underline"
        >
          <span>Find more reads</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>

      {/* Tab: Currently Borrowed */}
      {activeTab === 'borrows' && (
        <div className="space-y-6">
          {activeBorrows.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-[#e1ddd0] space-y-4">
              <span className="material-symbols-outlined text-[36px] text-[#414844]">auto_stories</span>
              <h3 className="font-serif text-[20px] text-[#1c1c17]">No active borrows right now</h3>
              <p className="text-[14px] text-[#414844]">
                Reserve books from your neighbors or check your cart to lock dates.
              </p>
              <button
                onClick={() => onNavigate('browse')}
                className="px-6 py-2.5 rounded-full bg-[#04281a] text-white text-[13px] font-semibold"
              >
                Explore Books
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeBorrows.map((borrow) => (
                <div
                  key={borrow.id}
                  className="bg-white rounded-2xl p-6 border border-[#e1ddd0] shadow-xs flex flex-col justify-between space-y-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-[#c5ebd6] text-[#002114] text-[11px] font-bold">
                          {borrow.daysRemaining > 0 ? `${borrow.daysRemaining} Days Left` : 'Due Today'}
                        </span>
                        <span className="text-[11px] text-[#414844]">Due {borrow.dueDate}</span>
                      </div>
                      <h3 className="font-serif text-[19px] text-[#1c1c17] font-semibold">
                        {borrow.bookTitle}
                      </h3>
                      <p className="text-[13px] text-[#414844]">
                        By {borrow.author} • Lent by <strong>{borrow.lenderName}</strong>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-[#414844] block">Deposit in Escrow</span>
                      <span className="text-[16px] font-bold text-[#04281a]">
                        ${borrow.depositAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Locker Info box */}
                  <div className="bg-[#f6f3ea] p-4 rounded-xl border border-[#e1ddd0] flex items-center justify-between text-[12px]">
                    <div>
                      <span className="text-[#414844] block font-medium">Pickup/Return Pod</span>
                      <strong className="text-[#1c1c17] text-[13px]">
                        {borrow.lockerName} (Box #{borrow.compartmentNumber})
                      </strong>
                    </div>
                    <button
                      onClick={() => setSelectedBorrowForPass(borrow)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#e1ddd0] text-[#04281a] font-semibold hover:bg-[#ebe8df] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                      <span>View Pass</span>
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => onExtendBorrow(borrow.id)}
                      className="flex-1 py-2.5 px-4 rounded-full bg-[#f6f3ea] text-[#04281a] border border-[#e1ddd0] font-semibold text-[13px] hover:bg-[#ebe8df] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">update</span>
                      <span>Extend (+7 Days for $1.75)</span>
                    </button>

                    <button
                      onClick={() => onReturnBorrow(borrow.id)}
                      className="py-2.5 px-5 rounded-full bg-[#04281a] text-white font-semibold text-[13px] hover:bg-[#1c3e2f] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">assignment_return</span>
                      <span>Return Book</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Lending Out */}
      {activeTab === 'lending' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {lentBooks.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-6 border border-[#e1ddd0] shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-[#ffdad2] text-[#3c0700] text-[11px] font-bold">
                      {item.status}
                    </span>
                    <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold mt-2">
                      {item.title}
                    </h3>
                    <p className="text-[13px] text-[#414844]">
                      Borrowed by <strong>{item.borrower}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#414844] block">Your Earnings</span>
                    <span className="text-[18px] font-bold text-[#04281a]">{item.earned}</span>
                  </div>
                </div>

                <div className="bg-[#f6f3ea] p-3 rounded-xl border border-[#e1ddd0] text-[12px] flex items-center justify-between">
                  <span className="text-[#414844]">{item.locker}</span>
                  <span className="font-semibold text-[#04281a]">{item.depositHeld}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locker Pass Modal */}
      {selectedBorrowForPass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full border border-[#e1ddd0] shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-[#e1ddd0]">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#a04028]">
                24/7 Locker Pickup Pass
              </span>
              <button
                onClick={() => setSelectedBorrowForPass(null)}
                className="w-7 h-7 rounded-full bg-[#f6f3ea] flex items-center justify-center text-[#414844] hover:text-[#1c1c17]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-[20px] text-[#04281a] font-semibold">
                {selectedBorrowForPass.bookTitle}
              </h3>
              <p className="text-[13px] text-[#414844]">{selectedBorrowForPass.lockerName}</p>
            </div>

            {/* Simulated QR Code & PIN Code */}
            <div className="p-4 bg-[#f6f3ea] rounded-2xl border border-[#e1ddd0] space-y-3">
              <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-[#e1ddd0] flex items-center justify-center">
                <div className="w-full h-full border-4 border-dashed border-[#04281a]/40 rounded-lg flex flex-col items-center justify-center p-2 text-[#04281a]">
                  <span className="material-symbols-outlined text-[48px]">qr_code_2</span>
                  <span className="text-[9px] font-mono tracking-wider">TAP SCANNER</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-[#414844] uppercase font-bold tracking-wider">
                  PIN CODE KEY
                </span>
                <p className="font-mono text-[24px] font-bold text-[#04281a] tracking-widest">
                  {selectedBorrowForPass.accessCode}
                </p>
                <span className="text-[11px] text-[#414844]">
                  Compartment #{selectedBorrowForPass.compartmentNumber}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedBorrowForPass(null)}
              className="w-full py-3 rounded-full bg-[#04281a] text-white font-semibold text-[14px] hover:bg-[#1c3e2f] transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
