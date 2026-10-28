import React, { useState } from 'react';
import {
  X,
  Share2,
  Users,
  Phone,
  Smartphone,
  Copy,
  Check,
  Download,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Building2,
  QrCode
} from 'lucide-react';
import { FranchiseConfig } from '../types';
import { buildWhatsAppOfficialAppLinksUrl } from '../utils/storage';

interface WhatsAppAndPlayStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseConfig: FranchiseConfig;
  initialTab?: 'whatsapp' | 'playstore';
}

export const WhatsAppAndPlayStoreModal: React.FC<WhatsAppAndPlayStoreModalProps> = ({
  isOpen,
  onClose,
  franchiseConfig,
  initialTab = 'whatsapp',
}) => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'playstore'>(initialTab);
  const [shareScope, setShareScope] = useState<'all' | 'cnf' | 'customer'>('all');
  const [targetNumber, setTargetNumber] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseOrigin =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://drightwellness.awpl.in/';

  const cnfAppUrl = `${baseOrigin}?app=cnf_app&auth=login`;
  const customerAppUrl = `${baseOrigin}?app=customer_app&auth=login`;
  const playStoreTwaUrl = `${baseOrigin}?source=playstore_twa`;

  // Option A: Without phone number -> opens WhatsApp native contact picker
  const directContactPickerWhatsAppUrl = buildWhatsAppOfficialAppLinksUrl('', shareScope);

  // Option B: With added 10-digit mobile number -> opens chat with that specific number
  const cleanTenDigitNumber = targetNumber.replace(/\D/g, '').slice(0, 10);
  const specificNumberWhatsAppUrl = buildWhatsAppOfficialAppLinksUrl(
    cleanTenDigitNumber,
    shareScope
  );

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadJson = (filename: string, data: Record<string, unknown> | unknown[]) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const twaManifestData = {
    packageId: 'in.awpl.drightwellness.cnfbill',
    host: typeof window !== 'undefined' ? window.location.host : 'drightwellness.awpl.in',
    name: 'C&F Bill — AWPL Billing & Store',
    launcherName: 'C&F Bill',
    display: 'standalone',
    themeColor: '#ea580c',
    navigationColor: '#0f172a',
    backgroundColor: '#ffffff',
    enableNotifications: true,
    startUrl: '/?source=playstore_twa',
    iconUrl: `${baseOrigin.replace(/\/$/, '')}/pwa-512x512.svg`,
    maskableIconUrl: `${baseOrigin.replace(/\/$/, '')}/pwa-512x512.svg`,
    appVersionName: '2.5.0',
    appVersionCode: 25,
    signingKey: {
      path: './android.keystore',
      alias: 'cnfbill-playstore-key',
    },
    generatorApp: 'bubblewrap-cli',
    webManifestUrl: `${baseOrigin.replace(/\/$/, '')}/manifest.webmanifest`,
    fallbackType: 'customtabs',
    orientation: 'default',
  };

  const assetLinksData = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'in.awpl.drightwellness.cnfbill',
        sha256_cert_fingerprints: [
          '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5',
        ],
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-500 shadow-2xl overflow-hidden my-auto text-slate-900 dark:text-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 px-5 py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white text-orange-600 flex items-center justify-center font-black shadow">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-100 block">
                Official App Distribution &amp; Google Play Store Hub
              </span>
              <h2 className="text-base sm:text-lg font-black">
                Share C&amp;F Bill on WhatsApp &amp; Google Play Store Package
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <Share2 className="h-4 w-4" />
            <span>1. WhatsApp Share (Direct Contact &amp; By Number)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('playstore')}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'playstore'
                ? 'bg-orange-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>2. Google Play Store &amp; Android APK/AAB</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto text-xs">
          {activeTab === 'whatsapp' ? (
            <>
              {/* Select Which Portal Link to Share */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                <label className="font-black text-slate-800 dark:text-slate-200 block uppercase tracking-wider text-[10px]">
                  Step 1: Choose Which App Link(s) to Include in WhatsApp Message
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setShareScope('all')}
                    className={`py-2.5 px-3 rounded-xl font-black border text-left transition cursor-pointer ${
                      shareScope === 'all'
                        ? 'bg-orange-500 text-black border-orange-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span className="block text-xs">All Official App Links</span>
                    <span className="block text-[10px] opacity-80 font-semibold">
                      C&amp;F App + Customer App + Play Store
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareScope('cnf')}
                    className={`py-2.5 px-3 rounded-xl font-black border text-left transition cursor-pointer ${
                      shareScope === 'cnf'
                        ? 'bg-orange-500 text-black border-orange-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span className="block text-xs">Only C&amp;F App Link</span>
                    <span className="block text-[10px] opacity-80 font-semibold">
                      For C&amp;F Owners &amp; Counter Staff
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareScope('customer')}
                    className={`py-2.5 px-3 rounded-xl font-black border text-left transition cursor-pointer ${
                      shareScope === 'customer'
                        ? 'bg-orange-500 text-black border-orange-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span className="block text-xs">Only Customer App Link</span>
                    <span className="block text-[10px] opacity-80 font-semibold">
                      For AWPL Customers &amp; Distributors
                    </span>
                  </button>
                </div>
              </div>

              {/* BOTH WHATSAPP SHARE OPTIONS SIDE BY SIDE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OPTION A: SHARE DIRECTLY TO ANY CONTACT ON WHATSAPP WITHOUT NUMBER */}
                <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                        Option A • Without Phone Number
                      </span>
                      <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Share to Direct Contact on WhatsApp (No Number Needed)
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      Opens your WhatsApp Contact &amp; Group Picker directly. Select any saved contact, customer, or WhatsApp group without typing a mobile number.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <a
                      href={directContactPickerWhatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Share2 className="h-4 w-4" />
                      <span>Open WhatsApp &amp; Pick Any Contact</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <span className="block text-center text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">
                      ✓ Uses native `wa.me/?text=...` Contact Selector
                    </span>
                  </div>
                </div>

                {/* OPTION B: SHARE BY ENTERING A SPECIFIC WHATSAPP NUMBER */}
                <div className="rounded-2xl border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-orange-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                        Option B • By Added Mobile Number
                      </span>
                      <Phone className="h-5 w-5 text-orange-600" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Share by Entering a WhatsApp Mobile Number
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      Enter any 10-digit WhatsApp mobile number below (even if not saved in your phone contacts) to send the app link directly to that number.
                    </p>

                    <div className="pt-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Recipient 10-Digit WhatsApp Number:
                      </label>
                      <div className="flex items-center rounded-xl border-2 border-orange-400 bg-white dark:bg-slate-900 overflow-hidden">
                        <span className="px-3 py-2.5 bg-orange-100 dark:bg-slate-800 font-mono font-black text-orange-800 dark:text-orange-300 border-r border-orange-300">
                          +91
                        </span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={cleanTenDigitNumber}
                          onChange={(e) =>
                            setTargetNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
                          }
                          placeholder="Enter 10-digit mobile number"
                          className="w-full px-3 py-2.5 font-mono font-black text-sm bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <a
                      href={
                        cleanTenDigitNumber.length === 10
                          ? specificNumberWhatsAppUrl
                          : directContactPickerWhatsAppUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className={`w-full py-3 px-4 rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer ${
                        cleanTenDigitNumber.length === 10
                          ? 'bg-orange-600 hover:bg-orange-700 text-white'
                          : 'bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Phone className="h-4 w-4" />
                      <span>
                        {cleanTenDigitNumber.length === 10
                          ? `Send Link to +91 ${cleanTenDigitNumber}`
                          : 'Enter 10-Digit Number Above to Send'}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <span className="block text-center text-[10px] text-orange-800 dark:text-orange-300 font-semibold">
                      ✓ Direct WhatsApp Number Link (`wa.me/91XXXXXXXXXX`)
                    </span>
                  </div>
                </div>
              </div>

              {/* Copyable Direct Portal Links */}
              <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Direct Copyable Portal URLs (Main Admin Remains Hidden &amp; Private)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-800 p-3 flex items-center justify-between gap-2 border border-slate-700">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-orange-400 uppercase flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> 1. C&amp;F App Link
                      </span>
                      <p className="font-mono text-[11px] text-slate-300 truncate mt-0.5">
                        {cnfAppUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('cnf', cnfAppUrl)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-black text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cnf' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'cnf' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-800 p-3 flex items-center justify-between gap-2 border border-slate-700">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1">
                        <Users className="h-3 w-3" /> 2. Customer App Link
                      </span>
                      <p className="font-mono text-[11px] text-slate-300 truncate mt-0.5">
                        {customerAppUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('cust', customerAppUrl)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cust' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'cust' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* GOOGLE PLAY STORE & ANDROID TWA PACKAGE TAB */
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950 text-white p-5 border-2 border-orange-500 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-3 py-0.5 text-[10px] font-black uppercase">
                    ✓ Google Play Store TWA &amp; Standalone PWA Ready
                  </span>
                  <span className="font-mono text-[11px] text-orange-300 font-bold">
                    Package ID: in.awpl.drightwellness.cnfbill
                  </span>
                </div>
                <h3 className="text-base font-black">
                  Google Play Store Android App Bundle (.AAB / .APK) &amp; Instant Install
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong>C&amp;F Bill ({franchiseConfig.name})</strong> is configured with an installable Web App Manifest, offline-capable Service Worker, and server-hosted Digital Asset Links (<code className="text-amber-300">/.well-known/assetlinks.json</code>) for Google Play Store Trusted Web Activity (TWA) deployment.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadJson('twa-manifest.json', twaManifestData)}
                    className="py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download twa-manifest.json</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadJson('assetlinks.json', assetLinksData)}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Download assetlinks.json</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy('playstore_url', playStoreTwaUrl)}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'playstore_url' ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Copied TWA URL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-amber-400" />
                        <span>Copy Play Store Start URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4">
                <div className="md:col-span-8 space-y-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Google Play Console Publishing Commands (Bubblewrap CLI)</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300">
                    Run these 3 commands with your downloaded <code className="font-mono font-bold">twa-manifest.json</code> to generate the signed <code className="font-mono font-bold">app-release-bundle.aab</code> for Google Play Console:
                  </p>
                  <pre className="rounded-xl bg-slate-950 text-emerald-300 p-3 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`npx @bubblewrap/cli init --manifest=${baseOrigin.replace(/\/$/, '')}/manifest.webmanifest
npx @bubblewrap/cli build
# Uploads app-release-bundle.aab to Google Play Console -> Production`}
                  </pre>
                </div>

                <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <QrCode className="h-4 w-4 text-orange-600 mb-1" />
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                      playStoreTwaUrl
                    )}`}
                    alt="Mobile App Install QR"
                    className="h-24 w-24 rounded-lg border border-slate-200 p-1 bg-white"
                  />
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 mt-1.5">
                    Scan on Android to Install App
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-semibold">
            C&amp;F Bill • Official AWPL Counter &amp; Online Distribution
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-black text-slate-800 dark:text-white cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
