import React from 'react';
import { X, Keyboard, Monitor, Scan, Sparkles, Check } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F1', desc: 'Navigate to Dashboard' },
    { key: 'F2', desc: 'Focus Product Search / Barcode Gun Input' },
    { key: 'F3', desc: 'Open Invoices List' },
    { key: 'F4', desc: 'Open AWPL Catalog' },
    { key: 'F8', desc: 'Toggle Price Mode (DP / MRP)' },
    { key: 'F9', desc: 'Complete Bill & Instant Checkout' },
    { key: 'F10', desc: 'Clear Current Cart' },
    { key: 'F11', desc: 'Toggle Fullscreen Cash Counter' },
    { key: '/', desc: 'Quick Focus Search (when not in input)' },
    { key: 'Enter', desc: 'Auto-add scanned product to cart' },
    { key: 'Esc', desc: 'Close open modal or popup' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                PC & Desktop Keyboard Shortcuts
              </h3>
              <p className="text-xs text-slate-500">
                Optimized for fast PC counter billing and USB barcode guns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300 mb-3">
            <Scan className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
            <p>
              <strong>USB Barcode Scanner Support:</strong> Any standard USB or Bluetooth handheld barcode scanner works automatically. Simply scan the product and it will add immediately to the bill.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {shortcuts.map((sc, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {sc.desc}
                </span>
                <kbd className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px] font-black text-slate-800 dark:text-slate-200 shadow-xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
            <Monitor className="h-3.5 w-3.5" />
            <span>PC Desktop Mode Active</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
