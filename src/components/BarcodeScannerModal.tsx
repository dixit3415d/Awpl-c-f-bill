import React, { useState } from 'react';
import { Camera, X, Barcode, Check, Search } from 'lucide-react';
import { AWPLProduct } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductFound: (product: AWPLProduct) => void;
  products: AWPLProduct[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onProductFound,
  products,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isScanningSim, setIsScanningSim] = useState(true);

  if (!isOpen) return null;

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    const clean = manualCode.trim();
    const match = products.find(
      (p) => p.barcode === clean || p.sku.toLowerCase() === clean.toLowerCase()
    );

    if (match) {
      onProductFound(match);
      setManualCode('');
      setErrorMsg('');
      onClose();
    } else {
      setErrorMsg(`No AWPL product found matching barcode or SKU: "${clean}"`);
    }
  };

  const handleQuickPick = (product: AWPLProduct) => {
    onProductFound(product);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 bg-emerald-700 text-white">
          <div className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            <h3 className="font-semibold text-lg">Barcode POS Scanner</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-emerald-100 hover:bg-emerald-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Laser Scanner Viewport Simulation */}
          <div className="relative flex flex-col items-center justify-center rounded-xl bg-slate-950 p-6 text-white overflow-hidden border-2 border-emerald-500/50">
            <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
            <Camera className="h-12 w-12 text-slate-500 mb-2 animate-bounce" />
            <p className="text-xs text-slate-400 font-mono tracking-wider">
              ALIGN BARCODE INSIDE CAMERA FRAME
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300 border border-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Optical Sensor Active
            </span>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
              {errorMsg}
            </div>
          )}

          {/* Manual Barcode or SKU Input */}
          <form onSubmit={handleManualSearch} className="space-y-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Manual Barcode or SKU Entry (Gun Scanner compatible)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  autoFocus
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Scan or enter e.g. 8906085110012 or AWPL-IMM-001"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <Search className="h-4 w-4" />
                Add
              </button>
            </div>
          </form>

          {/* Quick Barcode Testing Shortcuts */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Simulate Barcode Tap (Quick Test):
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {products.slice(0, 6).map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleQuickPick(prod)}
                  className="flex flex-col items-start rounded-lg border border-slate-200 p-2 text-left hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:bg-slate-800 transition"
                >
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate w-full">
                    {prod.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {prod.barcode}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-5 py-3 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
