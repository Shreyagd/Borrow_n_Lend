import React from 'react';
import { CartItem, FulfillmentMethod } from '../types';

interface OrderConfirmationModalProps {
  orderData: {
    items: CartItem[];
    total: number;
    deposit: number;
    fulfillment: FulfillmentMethod;
    pickupLocation: string;
    pinCode: string;
    note: string;
  } | null;
  onClose: () => void;
  onViewMyShelf: () => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  orderData,
  onClose,
  onViewMyShelf,
}) => {
  if (!orderData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#e1ddd0] shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Celebration header */}
        <div className="w-16 h-16 mx-auto rounded-full bg-[#c5ebd6] flex items-center justify-center text-[#04281a]">
          <span className="material-symbols-outlined text-[36px]">check_circle</span>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a04028]">
            Order Reserved &amp; Escrow Activated
          </span>
          <h2 className="font-serif text-[26px] text-[#04281a] font-semibold">
            Dates Locked Successfully!
          </h2>
          <p className="text-[13px] text-[#414844]">
            Your lender request is confirmed. Compartment access key generated.
          </p>
        </div>

        {/* Access Key Card */}
        <div className="bg-[#f6f3ea] p-5 rounded-2xl border border-[#e1ddd0] space-y-4 text-left">
          <div className="flex justify-between items-center pb-3 border-b border-[#e1ddd0]">
            <div>
              <span className="text-[11px] text-[#414844] block">Locker Pickup Station</span>
              <strong className="text-[13px] text-[#1c1c17]">{orderData.pickupLocation}</strong>
            </div>
            <span className="material-symbols-outlined text-[#04281a]">local_library</span>
          </div>

          <div className="text-center py-2 bg-white rounded-xl border border-[#e1ddd0]">
            <span className="text-[10px] font-bold text-[#414844] uppercase tracking-wider block">
              6-Digit Locker PIN Code
            </span>
            <p className="font-mono text-[28px] font-bold text-[#04281a] tracking-widest my-1">
              {orderData.pinCode}
            </p>
            <span className="text-[11px] text-[#414844]">
              Available 24/7 with instant compartment auto-open
            </span>
          </div>

          <div className="space-y-1.5 text-[12px] text-[#414844]">
            <div className="flex justify-between">
              <span>Items reserved:</span>
              <strong className="text-[#1c1c17]">{orderData.items.length} volumes</strong>
            </div>
            <div className="flex justify-between">
              <span>Deposit held in escrow:</span>
              <strong className="text-[#04281a]">${orderData.deposit.toFixed(2)} (100% refundable)</strong>
            </div>
            <div className="flex justify-between">
              <span>Total charged:</span>
              <strong className="text-[#1c1c17]">${orderData.total.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onViewMyShelf();
            }}
            className="w-full py-3.5 rounded-full bg-[#04281a] text-white font-semibold text-[14px] hover:bg-[#1c3e2f] transition-all cursor-pointer shadow-md"
          >
            View in My Shelf
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full text-[#414844] font-semibold text-[13px] hover:text-[#1c1c17] cursor-pointer"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
};
