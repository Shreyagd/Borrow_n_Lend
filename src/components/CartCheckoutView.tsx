import React, { useState, useEffect } from 'react';
import { CartItem, BookItem, FulfillmentMethod, PaymentMethod } from '../typesEditorial';

interface CartCheckoutViewProps {
  cartItems: CartItem[];
  onRemoveItem: (cartId: string) => void;
  onAddItem: (book: BookItem) => void;
  onCheckoutSuccess: (orderData: {
    items: CartItem[];
    total: number;
    deposit: number;
    fulfillment: FulfillmentMethod;
    pickupLocation: string;
    pinCode: string;
    note: string;
  }) => void;
  onNavigate: (tab: string) => void;
}

export const CartCheckoutView: React.FC<CartCheckoutViewProps> = ({
  cartItems,
  onRemoveItem,
  onAddItem,
  onCheckoutSuccess,
  onNavigate,
}) => {
  // Fulfillment & Payment state
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [agreementChecked, setAgreementChecked] = useState(true);
  const [lenderNote, setLenderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Reservation Countdown timer
  const [secondsRemaining, setSecondsRemaining] = useState(14 * 60 + 52);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Pricing calculations
  const rentalFeeTotal = cartItems
    .filter((item) => item.type === 'rental')
    .reduce((sum, item) => sum + (item.rentalFee || 0), 0);

  const purchaseFeeTotal = cartItems
    .filter((item) => item.type === 'purchase')
    .reduce((sum, item) => sum + (item.purchasePrice || 0), 0);

  const refundableDepositTotal = cartItems.reduce((sum, item) => sum + (item.deposit || 0), 0);

  const courierCost = fulfillment === 'courier' ? 3.0 : 0.0;
  const platformFee = cartItems.length > 0 ? 0.9 : 0.0;

  const totalDueNow = rentalFeeTotal + purchaseFeeTotal + courierCost + platformFee + refundableDepositTotal;
  const netCostAfterDeposit = rentalFeeTotal + purchaseFeeTotal + courierCost + platformFee;

  const handleCheckout = () => {
    if (!agreementChecked || cartItems.length === 0) return;
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      onCheckoutSuccess({
        items: cartItems,
        total: totalDueNow,
        deposit: refundableDepositTotal,
        fulfillment,
        pickupLocation:
          fulfillment === 'pickup'
            ? 'Central Library Safe Swap Locker #4 (Compartment #12)'
            : 'Doorstep Courier Delivery (Recycled Canvas Tote)',
        pinCode: generatedPin,
        note: lenderNote,
      });
    }, 1200);
  };

  // Add-ons list
  const suggestedAddons: BookItem[] = [
    {
      id: 'deep-work',
      title: 'Deep Work: Rules for Focused Success',
      author: 'Cal Newport',
      category: 'Mindset',
      type: 'rental',
      rentalWeeks: 1,
      rentalFee: 2.0,
      deposit: 10.0,
      condition: 'Very Good',
      ownerName: 'Cal Newport',
      ownerRating: 4.9,
      ownerLoans: 14,
      location: 'Central Library Safe Swap Locker #4',
      distance: '0.3 mi away',
      tagLabel: 'Mindset',
      coverBg: '#faf7ee',
      coverAccent: '#a04028',
    },
    {
      id: 'ikigai',
      title: 'Ikigai: Japanese Secret to Life',
      author: 'Héctor García',
      category: 'Philosophy',
      type: 'purchase',
      purchasePrice: 6.0,
      deposit: 0,
      condition: 'Like New',
      ownerName: 'Héctor García',
      ownerRating: 5.0,
      ownerLoans: 29,
      location: 'Same Locker',
      distance: 'Same Locker',
      tagLabel: 'Philosophy',
      coverBg: '#faf7ee',
      coverAccent: '#04281a',
    },
    {
      id: 'naval-almanack',
      title: 'The Almanack of Naval Ravikant',
      author: 'Eric Jorgenson',
      category: 'Bio',
      type: 'rental',
      rentalWeeks: 1,
      rentalFee: 2.5,
      deposit: 10.0,
      condition: 'Mint',
      ownerName: 'Eric Jorgenson',
      ownerRating: 5.0,
      ownerLoans: 19,
      location: 'Community Center Locker #1',
      distance: '0.8 mi away',
      tagLabel: 'Bio',
      coverBg: '#faf7ee',
      coverAccent: '#a04028',
    },
    {
      id: 'leather-bookmark',
      title: 'Pressed Flower Leather Bookmark',
      author: 'Haven Workshop',
      category: 'Keepsake craft',
      type: 'purchase',
      purchasePrice: 4.0,
      deposit: 0,
      condition: 'Mint',
      ownerName: 'Haven Workshop',
      ownerRating: 5.0,
      ownerLoans: 86,
      location: 'Haven Workshop',
      distance: 'In Stock',
      tagLabel: 'Keepsake craft',
      notes: 'Naturally vegetable-tanned leather strip.',
      isAccessory: true,
    },
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Subtle Breadcrumb & Safe Transaction Micro-banner */}
      <div className="w-full bg-[#f6f3ea] py-3 px-6 lg:px-12 border-b border-[#e1ddd0]/60">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#414844]">
            <button
              onClick={() => onNavigate('browse')}
              className="hover:text-[#04281a] transition-colors"
            >
              Catalog
            </button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <button
              onClick={() => onNavigate('cart')}
              className="hover:text-[#04281a] transition-colors"
            >
              My Basket
            </button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-[#04281a] font-semibold">Checkout &amp; Date Reservation</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e5e2da] text-[#1c1c17] text-[11px] font-bold">
              <span className="material-symbols-outlined text-[15px] text-[#04281a]">
                verified_user
              </span>
              <span>Community Deposit Escrow Active</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[#414844] text-[13px]">
              <span className="material-symbols-outlined text-[16px] text-[#a04028]">schedule</span>
              <span>
                Dates reserved for{' '}
                <strong className="font-semibold text-[#1c1c17]">
                  {formatTimer(secondsRemaining)}
                </strong>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 w-full">
        {/* Header Title with Architectural Bookish Accent */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#a04028] text-[11px] uppercase tracking-widest font-bold">
              <span className="material-symbols-outlined text-[16px]">bookmark_heart</span>
              <span>Neighborhood Reading Exchange</span>
            </div>
            <h1 className="font-serif text-[34px] sm:text-[40px] leading-tight text-[#04281a] tracking-tight font-semibold">
              Your Cart &amp; Borrowing Lock
            </h1>
            <p className="text-[15px] leading-[22px] text-[#414844] mt-1">
              Review rental dates, fulfillment preferences, and local deposit protection.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[#414844] text-[12px] font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2c4d3e] animate-pulse"></span>
            <span>
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} from{' '}
              <strong>North Central Ward</strong>
            </span>
          </div>
        </div>

        {/* Two-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* LEFT COLUMN: Order Details & Fulfillment (7 Cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* SECTION 1: Items in Order */}
            <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#e1ddd0]/70">
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#e1ddd0]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#c5ebd6] text-[#04281a] flex items-center justify-center text-[16px] font-bold">
                    1
                  </span>
                  <div>
                    <h2 className="font-serif text-[22px] leading-[28px] text-[#1c1c17] font-medium">
                      Reserved Books ({cartItems.length})
                    </h2>
                    <p className="text-[13px] text-[#414844]">
                      Lent with care by verified neighborhood neighbors
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('browse')}
                  className="text-[12px] font-semibold text-[#a04028] hover:text-[#74200a] transition-colors"
                >
                  Edit items
                </button>
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#f6f3ea] flex items-center justify-center text-[#414844]">
                    <span className="material-symbols-outlined text-[32px]">menu_book</span>
                  </div>
                  <h3 className="font-serif text-[20px] text-[#1c1c17]">Your basket is empty</h3>
                  <p className="text-[14px] text-[#414844] max-w-sm mx-auto">
                    Explore available books from fellow readers in North Central Ward.
                  </p>
                  <button
                    onClick={() => onNavigate('browse')}
                    className="px-6 py-2.5 rounded-full bg-[#04281a] text-white text-[14px] font-semibold hover:bg-[#1c3e2f] transition-all"
                  >
                    Browse Catalog
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cartItems.map((item) => (
                    <div
                      key={item.cartId}
                      className="relative bg-[#f6f3ea]/70 rounded-xl p-5 flex flex-col sm:flex-row gap-5 group transition-all hover:bg-[#f6f3ea] border border-[#e1ddd0]/40"
                    >
                      {/* Arch Alcove Book Cover Mock */}
                      <div className="shrink-0 w-28 h-36 bg-[#ebe8df] rounded-t-full rounded-b-md flex items-center justify-center relative overflow-hidden shadow-md">
                        <div className="w-20 h-28 bg-[#faf7ee] rounded shadow-inner flex flex-col justify-between p-2.5 text-center relative border-l-2 border-stone-300">
                          <div className="space-y-1">
                            <span
                              className={`text-[8px] uppercase tracking-wider font-bold ${
                                item.type === 'rental' ? 'text-[#a04028]' : 'text-[#04281a]'
                              }`}
                            >
                              {item.tagLabel || (item.type === 'rental' ? 'Bestseller' : 'Non-Fiction')}
                            </span>
                            <p
                              className={`font-serif text-[11px] leading-tight font-bold ${
                                item.type === 'rental' ? 'text-[#04281a]' : 'text-[#a04028]'
                              }`}
                            >
                              {item.title.split(':')[0]}
                            </p>
                          </div>
                          <p className="text-[9px] text-[#414844] truncate">{item.author}</p>
                        </div>
                        {/* Bookmark ribbon accent on rental items */}
                        {item.type === 'rental' && (
                          <div className="absolute top-0 right-3 w-2.5 h-6 bg-[#a04028] rounded-b-sm shadow-sm"></div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {item.type === 'rental' ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#c5ebd6] text-[#002114] text-[11px] font-bold uppercase tracking-wider">
                                    Rental • {item.rentalWeeks || 2} Weeks
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#ffdad2] text-[#3c0700] text-[11px] font-bold uppercase tracking-wider">
                                    Direct Purchase
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    item.condition === 'Like New' || item.condition === 'Mint'
                                      ? 'bg-[#EDF3EB] text-[#2A573F]'
                                      : 'bg-[#FEF7EC] text-[#946114]'
                                  }`}
                                >
                                  {item.condition}
                                </span>
                              </div>
                              <h3 className="text-[18px] leading-[24px] text-[#1c1c17] font-semibold">
                                {item.title}
                              </h3>
                              <p className="text-[13px] text-[#414844]">
                                By {item.author} • {item.type === 'rental' ? 'Lent by' : 'Sold by'}{' '}
                                <strong>{item.ownerName}</strong> (★ {item.ownerRating} •{' '}
                                {item.ownerLoans} loans)
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-[18px] font-bold ${
                                  item.type === 'rental' ? 'text-[#04281a]' : 'text-[#a04028]'
                                }`}
                              >
                                ${item.type === 'rental' ? item.rentalFee?.toFixed(2) : item.purchasePrice?.toFixed(2)}
                              </span>
                              <p className="text-[11px] text-[#414844] font-medium">
                                {item.type === 'rental' ? 'Rental fee' : 'To keep forever'}
                              </p>
                            </div>
                          </div>

                          {/* Notes if present */}
                          {item.notes && (
                            <p className="mt-2.5 text-[#414844] text-[13px] leading-relaxed">
                              {item.notes}
                            </p>
                          )}

                          {/* Date Range & Deposit detail tags for rental */}
                          {item.type === 'rental' && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg text-[#1c1c17] text-[13px] border border-[#e1ddd0]/60">
                                <span className="material-symbols-outlined text-[18px] text-[#04281a]">
                                  calendar_month
                                </span>
                                <span>{item.dateRange || 'Oct 24 – Nov 7, 2024'}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg text-[#1c1c17] text-[13px] border border-[#e1ddd0]/60">
                                <span className="material-symbols-outlined text-[18px] text-[#4d3300]">
                                  lock
                                </span>
                                <span className="text-[#414844]">
                                  Deposit:{' '}
                                  <strong className="text-[#1c1c17]">
                                    ${item.deposit?.toFixed(2) || '10.00'}
                                  </strong>{' '}
                                  (Refundable)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card baseline: Locker and remove */}
                        <div className="mt-3 pt-3 flex items-center justify-between text-[#414844] text-[12px] border-t border-[#e1ddd0]/40">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                item.type === 'rental' ? 'text-[#a04028]' : 'text-[#04281a]'
                              }`}
                            >
                              {item.type === 'rental' ? 'location_on' : 'eco'}
                            </span>
                            <span>{item.location}</span>
                          </div>
                          <button
                            onClick={() => onRemoveItem(item.cartId)}
                            className="text-[#ba1a1a] hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: Fulfillment & Handover Selection */}
            <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-[#e1ddd0]/70">
              <div className="flex items-center gap-3 pb-6 mb-6 border-b border-[#e1ddd0]/60">
                <span className="w-8 h-8 rounded-full bg-[#c5ebd6] text-[#04281a] flex items-center justify-center text-[16px] font-bold">
                  2
                </span>
                <div>
                  <h2 className="font-serif text-[22px] leading-[28px] text-[#1c1c17] font-medium">
                    Handover &amp; Logistics
                  </h2>
                  <p className="text-[13px] text-[#414844]">
                    Choose how you wish to collect and exchange your books
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Option 1: Community Locker */}
                <label
                  onClick={() => setFulfillment('pickup')}
                  className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                    fulfillment === 'pickup'
                      ? 'bg-[#f6f3ea] border-[#04281a]/20 shadow-xs'
                      : 'bg-white hover:bg-[#f6f3ea]/50 border-[#e1ddd0]'
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={fulfillment === 'pickup'}
                    onChange={() => setFulfillment('pickup')}
                    className="mt-1 text-[#04281a] focus:ring-[#04281a] w-4 h-4 cursor-pointer accent-[#04281a]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] text-[#1c1c17] font-semibold">
                          Local Safe Pickup
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#c5ebd6] text-[#002114] text-[11px] font-bold">
                          Recommended
                        </span>
                      </div>
                      <span className="text-[16px] text-[#04281a] font-bold">FREE</span>
                    </div>
                    <p className="text-[13px] text-[#414844] mt-1">
                      Central Library Safe Swap Locker #4 • Code sent upon confirmation • 0.4 miles away
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-[#414844] text-[11px] font-semibold">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#04281a]">
                          schedule
                        </span>{' '}
                        Open 24/7 with PIN
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#04281a]">
                          shield
                        </span>{' '}
                        Video Monitored
                      </span>
                    </div>
                  </div>
                </label>

                {/* Option 2: Bicycle Courier */}
                <label
                  onClick={() => setFulfillment('courier')}
                  className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                    fulfillment === 'courier'
                      ? 'bg-[#f6f3ea] border-[#04281a]/20 shadow-xs'
                      : 'bg-white hover:bg-[#f6f3ea]/50 border-[#e1ddd0]'
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    checked={fulfillment === 'courier'}
                    onChange={() => setFulfillment('courier')}
                    className="mt-1 text-[#04281a] focus:ring-[#04281a] w-4 h-4 cursor-pointer accent-[#04281a]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] text-[#1c1c17] font-semibold">
                          Local Bicycle Courier
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#ebe8df] text-[#414844] text-[11px] font-bold">
                          Zero Emissions
                        </span>
                      </div>
                      <span className="text-[16px] text-[#1c1c17] font-bold">+$3.00</span>
                    </div>
                    <p className="text-[13px] text-[#414844] mt-1">
                      Delivered to your doorstep in recycled canvas tote by tomorrow, 4:00 PM
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-[#414844] text-[11px] font-semibold">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#04281a]">
                          pedal_bike
                        </span>{' '}
                        Same-day dispatch
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#04281a]">
                          pin_drop
                        </span>{' '}
                        GPS live tracking
                      </span>
                    </div>
                  </div>
                </label>
              </div>

              {/* Note to Lender */}
              <div className="mt-6 pt-6 border-t border-[#e1ddd0]/60">
                <label
                  className="block text-[16px] leading-[22px] text-[#1c1c17] font-semibold mb-2"
                  htmlFor="lender-note"
                >
                  Note to Lender{' '}
                  <span className="font-normal text-[#414844] text-[13px]">(Optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    id="lender-note"
                    value={lenderNote}
                    onChange={(e) => setLenderNote(e.target.value.slice(0, 250))}
                    className="w-full rounded-xl bg-[#f6f3ea] px-4 py-3 text-[14px] text-[#1c1c17] placeholder-[#414844]/60 focus:outline-none focus:ring-2 focus:ring-[#04281a] focus:bg-white transition-all resize-none border border-[#e1ddd0]"
                    placeholder="Add a warm message to Clara (e.g., 'Looking forward to this read, will keep it on my study desk!')..."
                    rows={3}
                  />
                  <span className="absolute bottom-3 right-3 text-[11px] text-[#414844]">
                    {lenderNote.length}/250 chars
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 3: Community Agreement */}
            <div className="bg-[#f6f3ea] rounded-xl p-6 sm:p-7 border border-[#e1ddd0]">
              <label className="flex items-start gap-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementChecked}
                  onChange={(e) => setAgreementChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded text-[#04281a] focus:ring-[#04281a] cursor-pointer accent-[#04281a]"
                />
                <div className="text-[#1c1c17]">
                  <span className="text-[16px] font-semibold block">
                    Rental Care &amp; Honor Agreement
                  </span>
                  <p className="text-[13px] text-[#414844] mt-1 leading-relaxed">
                    I agree to return borrowed books in original condition before the due date (Nov 7).
                    I understand security deposits are automatically credited back within 2 hours of drop-off scan.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* RIGHT COLUMN: Order Summary & Payment (5 Cols) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
            {/* Summary Card */}
            <div className="bg-white rounded-xl p-6 sm:p-8 shadow-md border border-[#e1ddd0]">
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#e1ddd0]/60">
                <h2 className="font-serif text-[22px] leading-[28px] text-[#1c1c17] font-semibold">
                  Order Summary
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-[#c5ebd6] text-[#04281a] text-[11px] font-bold">
                  {cartItems.length} {cartItems.length === 1 ? 'Volume' : 'Volumes'}
                </span>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3.5 text-[15px] text-[#414844] pb-6 mb-6 border-b border-[#e1ddd0]/60">
                <div className="flex justify-between items-center">
                  <span>Rental Fees ({cartItems.filter((i) => i.type === 'rental').length} item • 14 days)</span>
                  <span className="text-[#1c1c17] font-medium">${rentalFeeTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Book Purchases ({cartItems.filter((i) => i.type === 'purchase').length} item outright)</span>
                  <span className="text-[#1c1c17] font-medium">${purchaseFeeTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Handover Fulfillment</span>
                  <span
                    className={
                      fulfillment === 'pickup'
                        ? 'text-[#04281a] font-medium'
                        : 'text-[#1c1c17] font-medium'
                    }
                  >
                    {fulfillment === 'pickup' ? 'FREE (Locker Swap)' : '+$3.00 (Bicycle Courier)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span>Platform Preservation Fee</span>
                    <span
                      className="material-symbols-outlined text-[16px] text-[#414844] cursor-help"
                      title="Supports carbon neutral deliveries and local library lockers"
                    >
                      help
                    </span>
                  </span>
                  <span className="text-[#1c1c17] font-medium">${platformFee.toFixed(2)}</span>
                </div>

                {/* Refundable Escrow Highlight */}
                {refundableDepositTotal > 0 && (
                  <div className="pt-3">
                    <div className="p-3.5 rounded-lg bg-[#f6f3ea] flex items-start justify-between gap-3 border border-[#e1ddd0]/80">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[20px] text-[#04281a] shrink-0 mt-0.5">
                          lock_reset
                        </span>
                        <div>
                          <span className="text-[16px] text-[#1c1c17] font-semibold block">
                            Refundable Security Deposit
                          </span>
                          <span className="text-[11px] text-[#414844]">
                            Returned immediately upon Nov 7 locker check-in
                          </span>
                        </div>
                      </div>
                      <span className="text-[16px] text-[#1c1c17] font-bold">
                        +${refundableDepositTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Calculation Section */}
              <div className="pt-2 pb-6 mb-6 space-y-2 border-b border-[#e1ddd0]/60">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="font-serif text-[22px] leading-tight text-[#1c1c17] font-bold block">
                      Total Due Now
                    </span>
                    <span className="text-[12px] text-[#414844]">Includes refundable deposit</span>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-[36px] sm:text-[40px] text-[#04281a] font-bold leading-none">
                      ${totalDueNow.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#c5ebd6]/50 flex items-center justify-between text-[#002114] text-[12px] font-medium">
                  <span>Actual net cost after deposit return:</span>
                  <strong className="text-[16px] font-bold">
                    ${netCostAfterDeposit.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-4 pb-6 mb-6 border-b border-[#e1ddd0]/60">
                <label className="block text-[16px] text-[#1c1c17] font-semibold">
                  Payment Method
                </label>
                <div className="space-y-2.5">
                  {/* Shelf Credits */}
                  <label
                    onClick={() => setPaymentMethod('credits')}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${
                      paymentMethod === 'credits'
                        ? 'bg-[#f6f3ea] border-[#04281a]'
                        : 'bg-[#f6f3ea]/70 border-transparent hover:bg-[#f6f3ea]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === 'credits'}
                        onChange={() => setPaymentMethod('credits')}
                        className="text-[#04281a] focus:ring-[#04281a] w-4 h-4 cursor-pointer accent-[#04281a]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] text-[#1c1c17] font-medium">
                            Shelf Credits
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#ffdad2] text-[#3c0700] text-[11px] font-bold">
                            Earned
                          </span>
                        </div>
                        <span className="text-[13px] text-[#414844]">$15.00 available balance</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[#04281a] text-[22px]">
                      account_balance_wallet
                    </span>
                  </label>

                  {/* Saved Credit Card */}
                  <label
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${
                      paymentMethod === 'card'
                        ? 'bg-[#ebe8df] border-[#04281a]'
                        : 'bg-[#ebe8df]/60 border-transparent hover:bg-[#ebe8df]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === 'card'}
                        onChange={() => setPaymentMethod('card')}
                        className="text-[#04281a] focus:ring-[#04281a] w-4 h-4 cursor-pointer accent-[#04281a]"
                      />
                      <div>
                        <span className="text-[16px] text-[#1c1c17] block font-medium">
                          Credit Card •••• 4291
                        </span>
                        <span className="text-[13px] text-[#414844]">Expires 08/27 • Mastercard</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-4 bg-[#a04028] rounded-xs inline-block opacity-85"></span>
                      <span className="w-6 h-4 bg-[#efbf73] rounded-xs -ml-3 inline-block opacity-85"></span>
                    </div>
                  </label>

                  {/* Apple Pay */}
                  <label
                    onClick={() => setPaymentMethod('applepay')}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${
                      paymentMethod === 'applepay'
                        ? 'bg-[#f6f3ea] border-[#04281a]'
                        : 'bg-[#f6f3ea]/70 border-transparent hover:bg-[#f6f3ea]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === 'applepay'}
                        onChange={() => setPaymentMethod('applepay')}
                        className="text-[#04281a] focus:ring-[#04281a] w-4 h-4 cursor-pointer accent-[#04281a]"
                      />
                      <span className="text-[16px] text-[#1c1c17] font-medium">Apple Pay</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#1c1c17] tracking-wider bg-[#e5e2da] px-2 py-1 rounded">
                       PAY
                    </span>
                  </label>
                </div>
              </div>

              {/* Big Primary CTA */}
              <div className="space-y-4">
                <button
                  disabled={!agreementChecked || cartItems.length === 0 || isSubmitting}
                  onClick={handleCheckout}
                  className={`w-full py-4 px-6 rounded-full text-white text-[16px] font-semibold tracking-wide shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    !agreementChecked || cartItems.length === 0
                      ? 'bg-stone-400 opacity-60 cursor-not-allowed'
                      : submitSuccess
                      ? 'bg-[#142C21]'
                      : 'bg-[#04281a] hover:bg-[#1c3e2f] active:scale-[0.99]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[20px] animate-spin">
                        sync
                      </span>
                      <span>Securing Locker &amp; Locking Dates...</span>
                    </>
                  ) : submitSuccess ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      <span>Dates Reserved! Code Sent to Phone</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                      <span>Confirm Order &amp; Lock Dates</span>
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-[#414844]">
                  You won’t be charged the deposit until Clara and Marcus accept your request.
                </p>
              </div>

              {/* Trust Badges Bar */}
              <div className="mt-8 pt-6 space-y-3 text-[13px] text-[#414844] border-t border-[#e1ddd0]/60">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#04281a] text-[20px]">
                    format_image_left
                  </span>
                  <span>
                    <strong>100% Refundable Deposit</strong> — auto-released on check-in
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#a04028] text-[20px]">
                    workspace_premium
                  </span>
                  <span>
                    <strong>Money-Back Guarantee</strong> if condition doesn’t match listing
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#4d3300] text-[20px]">
                    diversity_3
                  </span>
                  <span>
                    <strong>Neighborhood Verified</strong> — 4,200+ local successful loans
                  </span>
                </div>
              </div>
            </div>

            {/* Shelf Host Micro-Card (Community Touch) */}
            <div className="bg-[#f6f3ea] rounded-xl p-5 flex items-center gap-4 border border-[#e1ddd0]">
              <div className="w-12 h-12 rounded-full bg-[#c5ebd6] flex items-center justify-center text-[#04281a] font-serif text-[22px] font-bold shrink-0">
                CV
              </div>
              <div className="flex-1">
                <p className="text-[16px] text-[#1c1c17] font-semibold">Lent with warmth by Clara</p>
                <p className="text-[13px] text-[#414844] italic">
                  &ldquo;Happy to leave a reader note in chapter 3! Treat the spine gently.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested Add-ons & Bookmark Alcove Carousel Section */}
        <div className="mt-20 pt-12 border-t border-[#e1ddd0]/70">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-[11px] uppercase tracking-widest text-[#a04028] font-bold">
                Frequently Borrowed Together
              </span>
              <h2 className="font-serif text-[28px] text-[#04281a] mt-1 font-medium">
                Complete Your Reading Stint
              </h2>
              <p className="text-[15px] text-[#414844]">
                Readers who borrowed <em className="font-serif italic">Atomic Habits</em> also picked
                up these editions nearby:
              </p>
            </div>
            <button
              onClick={() => onNavigate('browse')}
              className="inline-flex items-center gap-1 text-[14px] text-[#04281a] font-semibold hover:text-[#a04028] transition-colors"
            >
              <span>Explore North Ward shelf</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {suggestedAddons.map((addon) => {
              const isAlreadyInCart = cartItems.some((i) => i.id === addon.id);

              if (addon.isAccessory) {
                return (
                  <div
                    key={addon.id}
                    className="bg-[#f6f3ea] rounded-xl p-5 flex flex-col justify-between group border border-[#e1ddd0]"
                  >
                    <div className="h-40 rounded-lg bg-[#ebe8df] flex flex-col items-center justify-center text-center p-4">
                      <span className="material-symbols-outlined text-[36px] text-[#04281a] mb-1">
                        local_florist
                      </span>
                      <span className="font-serif text-[13px] text-[#04281a] font-semibold">
                        Pressed Flower Leather Bookmark
                      </span>
                      <span className="text-[11px] text-[#a04028] font-bold mt-1">
                        Made by Haven Workshop
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#414844]">Keepsake craft</span>
                        <span className="text-[16px] text-[#1c1c17] font-bold">$4.00</span>
                      </div>
                      <p className="text-[13px] text-[#414844] mb-4">
                        Naturally vegetable-tanned leather strip.
                      </p>
                      <button
                        onClick={() => !isAlreadyInCart && onAddItem(addon)}
                        disabled={isAlreadyInCart}
                        className={`w-full py-2 px-3 rounded-full text-white text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isAlreadyInCart
                            ? 'bg-[#1c3e2f] opacity-80 cursor-default'
                            : 'bg-[#a04028] hover:bg-[#74200a]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isAlreadyInCart ? 'done' : 'add_shopping_cart'}
                        </span>
                        <span>{isAlreadyInCart ? 'In Your Basket' : 'Include in Tote'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={addon.id}
                  className="bg-white rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#e1ddd0]"
                >
                  <div className="flex items-center justify-center p-6 bg-[#f6f3ea] rounded-t-full rounded-b-lg mb-4">
                    <div className="w-20 h-28 bg-[#faf7ee] rounded shadow-md flex flex-col justify-between p-2 text-center border-l-2 border-stone-300">
                      <span
                        className={`text-[8px] uppercase font-bold ${
                          addon.type === 'rental' ? 'text-[#a04028]' : 'text-[#04281a]'
                        }`}
                      >
                        {addon.category}
                      </span>
                      <p
                        className={`font-serif text-[10px] leading-tight font-bold ${
                          addon.type === 'rental' ? 'text-[#04281a]' : 'text-[#a04028]'
                        }`}
                      >
                        {addon.title.split(':')[0]}
                      </p>
                      <p className="text-[8px] text-[#414844] truncate">{addon.author}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          addon.type === 'rental'
                            ? 'text-[#04281a] bg-[#c5ebd6]'
                            : 'text-[#a04028] bg-[#ffdad2]'
                        }`}
                      >
                        {addon.type === 'rental'
                          ? `$${addon.rentalFee?.toFixed(2)} / wk`
                          : `$${addon.purchasePrice?.toFixed(2)} buy`}
                      </span>
                      <span className="text-[11px] text-[#414844]">{addon.distance}</span>
                    </div>
                    <h3 className="text-[16px] text-[#1c1c17] font-semibold line-clamp-1">
                      {addon.title}
                    </h3>
                    <p className="text-[13px] text-[#414844] mb-4">
                      {addon.author} • {addon.condition}
                    </p>
                    <button
                      onClick={() => !isAlreadyInCart && onAddItem(addon)}
                      disabled={isAlreadyInCart}
                      className={`w-full py-2 px-3 rounded-full text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isAlreadyInCart
                          ? 'bg-[#c5ebd6] text-[#002114] cursor-default'
                          : 'bg-[#ebe8df] text-[#1c1c17] hover:bg-[#04281a] hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isAlreadyInCart ? 'done' : 'add'}
                      </span>
                      <span>{isAlreadyInCart ? 'Added to Locker' : 'Add to Same Locker'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ Collapsible Section */}
        <div className="mt-20 pt-10 pb-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-serif text-[28px] text-[#04281a] font-medium">
                Rental &amp; Deposit Transparency
              </h2>
              <p className="text-[15px] text-[#414844]">
                Everything you need to know about peer-to-peer book lending at Paper Haven
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <details className="group bg-white rounded-xl p-5 cursor-pointer border border-[#e1ddd0] transition-colors hover:border-[#04281a]/30">
                <summary className="flex justify-between items-center text-[16px] text-[#1c1c17] font-semibold list-none">
                  <span>When exactly do I receive my $10.00 deposit back?</span>
                  <span className="material-symbols-outlined text-[#04281a] group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-[13px] text-[#414844] leading-relaxed">
                  Deposits are kept in an escrow vault. As soon as you deposit the book into the safe swap
                  locker or return it to the courier and the QR scan completes, the full $10.00 is
                  immediately released back to your original payment method or Shelf Balance within 2 hours.
                </p>
              </details>

              <details className="group bg-white rounded-xl p-5 cursor-pointer border border-[#e1ddd0] transition-colors hover:border-[#04281a]/30">
                <summary className="flex justify-between items-center text-[16px] text-[#1c1c17] font-semibold list-none">
                  <span>What if I need the book for an extra week?</span>
                  <span className="material-symbols-outlined text-[#04281a] group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-[13px] text-[#414844] leading-relaxed">
                  You can tap “Extend Rental” from your “My Shelf” tab at any time up to 24 hours before
                  the due date. Provided another reader hasn’t queued a reservation, extensions are just
                  $1.75 per additional 7 days.
                </p>
              </details>

              <details className="group bg-white rounded-xl p-5 cursor-pointer border border-[#e1ddd0] transition-colors hover:border-[#04281a]/30">
                <summary className="flex justify-between items-center text-[16px] text-[#1c1c17] font-semibold list-none">
                  <span>How does the 24/7 Community Safe Swap Locker work?</span>
                  <span className="material-symbols-outlined text-[#04281a] group-open:rotate-180 transition-transform">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-[13px] text-[#414844] leading-relaxed">
                  Lockers are situated in brightly lit, secure library foyers and neighborhood bookstores.
                  You receive a unique 6-digit access code and QR key on your phone to open your assigned
                  compartment at any convenient hour.
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
