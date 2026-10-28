import React, { useState } from 'react';
import { Smartphone, Monitor, X, CheckCircle2, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showDeviceGuide, setShowDeviceGuide] = useState(false);

  return (
    <>
      {/* Direct Install Button when Chromium/Android prompt is ready */}
      {isInstallable && !isInstalled ? (
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-2.5 sm:px-3 py-1.5 text-[11px] font-black shadow transition cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Install Android / PC App</span>
          <span className="sm:hidden">Install</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowDeviceGuide(true)}
          className="flex items-center gap-1 rounded-xl border border-emerald-700 bg-emerald-950/70 hover:bg-emerald-800 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 transition cursor-pointer"
          title="Android Mobile & PC Desktop App Guide"
        >
          <Smartphone className="h-3.5 w-3.5 text-amber-400" />
          <Monitor className="h-3.5 w-3.5 text-emerald-400 hidden sm:inline" />
          <span className="hidden lg:inline">Android & PC</span>
        </button>
      )}

      {showDeviceGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" />
                <Monitor className="h-5 w-5 text-amber-500" />
                <h3 className="font-black text-base">
                  Works on Android Mobile & PC Desktop
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceGuide(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 space-y-1.5">
                <p className="font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" />
                  1. On Android Phone / Tablet:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Open in <strong>Chrome on Android</strong> and tap the 3-dot menu <strong>⋮ → Install App / Add to Home Screen</strong>.
                  </li>
                  <li>
                    Touch-optimized bottom navigation bar, mobile camera barcode scanner, UPI QR generation, and 1-tap WhatsApp bill sharing.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1.5">
                <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-amber-500" />
                  2. On PC / Laptop (Windows, Mac, Linux):
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Click the <strong>Install icon</strong> in the Chrome/Edge address bar to run as a standalone PC desktop window.
                  </li>
                  <li>
                    Supports <strong>F1–F4</strong> function keys, <strong>USB Laser Barcode Scanners</strong>, <strong>A4 GST Tax Invoice</strong> & <strong>80mm Thermal Printer</strong> output.
                  </li>
                </ul>
              </div>

              {isIOS && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                  On iPhone/iPad Safari: Tap Share → Add to Home Screen.
                </p>
              )}

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Offline billing queue enabled on both Android & PC</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDeviceGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 font-black text-xs text-white cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
