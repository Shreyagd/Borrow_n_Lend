import React, { useState } from 'react';

interface HowItWorksViewProps {
  onNavigate: (tab: string) => void;
  onOpenListBook: () => void;
}

export const HowItWorksView: React.FC<HowItWorksViewProps> = ({
  onNavigate,
  onOpenListBook,
}) => {
  // Locker Simulator State
  const [pinInput, setPinInput] = useState('');
  const [unlockedCompartment, setUnlockedCompartment] = useState<number | null>(null);
  const [simulatorMessage, setSimulatorMessage] = useState('Enter test code "839204" or any 6-digit PIN to test locker door');

  const handleTestPin = () => {
    if (pinInput.length === 6) {
      setUnlockedCompartment(4);
      setSimulatorMessage('Compartment #4 UNLOCKED! Door popped open. Take your book and close door securely.');
    } else {
      setSimulatorMessage('Please enter a 6-digit PIN code.');
    }
  };

  const handleCloseCompartment = () => {
    setUnlockedCompartment(null);
    setPinInput('');
    setSimulatorMessage('Compartment locked securely. Ready for next scan.');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 space-y-16">
      {/* Header */}
      <div className="max-w-3xl space-y-3">
        <div className="flex items-center gap-2 text-[#a04028] text-[11px] uppercase tracking-widest font-bold">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>Community Lending Guidelines</span>
        </div>
        <h1 className="font-serif text-[34px] sm:text-[44px] leading-tight text-[#04281a] font-semibold">
          How Paper Haven Works
        </h1>
        <p className="text-[16px] leading-relaxed text-[#414844]">
          Paper Haven combines the warmth of an independent bookstore with neighborhood trust,
          smart swap lockers, and automated deposit escrow.
        </p>
      </div>

      {/* 4 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#e1ddd0] space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#c5ebd6] text-[#04281a] flex items-center justify-center font-bold">
            1
          </div>
          <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold">Browse &amp; Lock</h3>
          <p className="text-[13px] text-[#414844] leading-relaxed">
            Pick from neighbors in your ward. Rent for 1–4 weeks or buy gently read copies.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#e1ddd0] space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#ffdad2] text-[#3c0700] flex items-center justify-center font-bold">
            2
          </div>
          <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold">24/7 Locker Pods</h3>
          <p className="text-[13px] text-[#414844] leading-relaxed">
            Collect anytime from well-lit library foyers using your private PIN or QR code.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#e1ddd0] space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#efbf73]/40 text-[#4d3300] flex items-center justify-center font-bold">
            3
          </div>
          <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold">Escrow Deposit</h3>
          <p className="text-[13px] text-[#414844] leading-relaxed">
            Your $10 deposit is held in escrow and credited back within 2 hours of drop-off scan.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#e1ddd0] space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#ebe8df] text-[#04281a] flex items-center justify-center font-bold">
            4
          </div>
          <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold">Bicycle Couriers</h3>
          <p className="text-[13px] text-[#414844] leading-relaxed">
            Prefer home delivery? Our local bike couriers deliver in recycled canvas totes for +$3.
          </p>
        </div>
      </div>

      {/* Interactive Locker Pod Simulator */}
      <div className="bg-[#f6f3ea] rounded-3xl p-8 sm:p-12 border border-[#e1ddd0] space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-[11px] uppercase tracking-widest text-[#a04028] font-bold">
            Interactive Prototype
          </span>
          <h2 className="font-serif text-[28px] sm:text-[34px] text-[#04281a] font-semibold">
            Central Library Safe Swap Locker #4
          </h2>
          <p className="text-[14px] text-[#414844]">
            Simulate how readers pick up their books at the 24/7 smart lockers situated in library
            foyers. Enter your code below:
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Keypad & controls (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#e1ddd0] shadow-sm space-y-5">
            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-[#1c1c17] block">
                Enter 6-Digit Locker PIN
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 839204"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] font-mono text-[18px] text-center tracking-widest focus:ring-2 focus:ring-[#04281a] focus:outline-none"
                />
                <button
                  onClick={handleTestPin}
                  className="px-5 py-2.5 rounded-xl bg-[#04281a] text-white font-semibold text-[13px] hover:bg-[#1c3e2f] transition-all cursor-pointer"
                >
                  Unlock
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#f6f3ea] text-[12px] text-[#414844] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#04281a]">info</span>
              <span>{simulatorMessage}</span>
            </div>

            {unlockedCompartment && (
              <button
                onClick={handleCloseCompartment}
                className="w-full py-2.5 rounded-xl bg-[#a04028] text-white text-[13px] font-semibold hover:bg-[#74200a] transition-all cursor-pointer"
              >
                Close &amp; Lock Compartment Door
              </button>
            )}
          </div>

          {/* Visual Locker Grid (7 cols) */}
          <div className="lg:col-span-7 bg-[#212529] p-6 rounded-2xl shadow-xl border border-stone-800 text-stone-300">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-700">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[12px] font-mono tracking-wider text-emerald-400">
                  SYSTEM READY • POD 04
                </span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">CAMERA MONITORED</span>
            </div>

            {/* 6 Compartments display */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((compNum) => {
                const isOpen = unlockedCompartment === compNum;
                return (
                  <div
                    key={compNum}
                    className={`h-28 rounded-lg border-2 p-3 flex flex-col justify-between transition-all ${
                      isOpen
                        ? 'bg-[#faf7ee] border-amber-400 text-[#04281a] shadow-inner'
                        : 'bg-stone-800 border-stone-700 text-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold">BOX #{compNum}</span>
                      <span className="material-symbols-outlined text-[16px]">
                        {isOpen ? 'lock_open' : 'lock'}
                      </span>
                    </div>

                    {isOpen ? (
                      <div className="text-center py-1">
                        <span className="material-symbols-outlined text-[24px] text-[#a04028]">
                          book
                        </span>
                        <p className="text-[10px] font-bold text-[#04281a]">Atomic Habits Ready</p>
                      </div>
                    ) : (
                      <div className="text-center text-[10px] font-mono text-stone-500">
                        {compNum === 4 ? 'RESERVED' : 'OCCUPIED'}
                      </div>
                    )}

                    <div className="text-[9px] text-right font-mono">
                      {isOpen ? 'DOOR OPEN' : 'SECURED'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Safety & Escrow Assurance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <div className="bg-white p-8 rounded-2xl border border-[#e1ddd0] space-y-4">
          <div className="w-10 h-10 rounded-full bg-[#c5ebd6] text-[#04281a] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <h3 className="font-serif text-[22px] text-[#1c1c17] font-semibold">
            The Escrow Safety Guard
          </h3>
          <p className="text-[14px] leading-relaxed text-[#414844]">
            Borrowers pay a modest $10 security deposit per volume. This amount is safely locked in
            escrow and never transferred to the lender unless a book is damaged or not returned.
            Once dropped off in any locker pod, the barcode is scanned and your deposit automatically
            returns within 2 hours.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-[#e1ddd0] space-y-4">
          <div className="w-10 h-10 rounded-full bg-[#ffdad2] text-[#3c0700] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">favorite</span>
          </div>
          <h3 className="font-serif text-[22px] text-[#1c1c17] font-semibold">
            Reader Care &amp; Marginal Notes
          </h3>
          <p className="text-[14px] leading-relaxed text-[#414844]">
            Books in Paper Haven travel from desk to desk. Neighbors often leave gentle bookmark notes
            or recommendations in chapter margins. Treat every spine with tenderness and return on
            time so the next neighbor in line can begin their journey.
          </p>
        </div>
      </div>
    </div>
  );
};
