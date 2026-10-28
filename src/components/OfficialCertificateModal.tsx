import React, { useState } from 'react';
import {
  X,
  Award,
  ShieldCheck,
  Printer,
  CheckCircle2,
  QrCode,
  Building2,
  Users,
  Copy,
  Check,
  Share2,
  ExternalLink
} from 'lucide-react';
import { FranchiseConfig } from '../types';
import { buildWhatsAppOfficialAppLinksUrl } from '../utils/storage';

interface OfficialCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseConfig: FranchiseConfig;
}

export const OfficialCertificateModal: React.FC<OfficialCertificateModalProps> = ({
  isOpen,
  onClose,
  franchiseConfig,
}) => {
  const [copiedPortal, setCopiedPortal] = useState<string | null>(null);
  const [whatsappRecipientMobile, setWhatsappRecipientMobile] = useState<string>(
    (franchiseConfig.phone || '9816054321').replace(/\D/g, '').slice(-10) || '9816054321'
  );

  if (!isOpen) return null;

  const baseOrigin =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://drightwellness.awpl.in/';

  const cnfAppUrl = `${baseOrigin}?app=cnf_app&auth=login`;
  const customerAppUrl = `${baseOrigin}?app=customer_app&auth=login`;
  const mainAdminAppUrl = `${baseOrigin}?app=main_app&auth=login`;

  const handleCopyLink = (key: string, url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedPortal(key);
    setTimeout(() => setCopiedPortal(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 md:p-6 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 print:border-none print:shadow-none print:max-w-none my-auto">
        {/* Header - Hidden on Print */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 bg-emerald-950 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-12 flex-col items-center justify-center rounded-xl bg-orange-500 text-black font-black border-2 border-black shadow">
              <span className="text-xs leading-none">AWPL</span>
              <span className="text-[7px] leading-none mt-0.5">OFFICIAL</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black">
                  Official AWPL Franchise Authorization &amp; Live App Hub
                </h2>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 uppercase">
                  ✓ Official Verified Release
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                Authorized Franchise Code:{' '}
                <span className="font-mono font-bold text-amber-300">
                  {franchiseConfig.franchiseCode}
                </span>{' '}
                • CIN: <span className="font-mono">{franchiseConfig.cinNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black px-3.5 py-1.5 text-xs font-black shadow transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Official Certificate</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-emerald-200 hover:bg-emerald-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Official Live App Portal Distribution Links (Hidden when printing certificate) */}
        <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800 print:hidden space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                Official Production Portal &amp; Play Store Links
              </span>
              <h3 className="text-sm font-black mt-1">
                Share C&amp;F App &amp; Customer App on WhatsApp (Direct Contact Picker or By Number)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Option A: Share Directly to Any Contact on WhatsApp Without Number */}
              <a
                href={buildWhatsAppOfficialAppLinksUrl('')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-black shadow cursor-pointer"
                title="Open WhatsApp Contact Picker directly without typing any phone number"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Option 1: Share to Direct Contact on WhatsApp (No Number)</span>
              </a>

              {/* Option B: Share by Entering Specific WhatsApp Number */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/90 border border-orange-500/50 rounded-xl p-1.5">
                <span className="text-[11px] font-bold text-orange-300 pl-1.5">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={whatsappRecipientMobile}
                  onChange={(e) =>
                    setWhatsappRecipientMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="10-Digit No."
                  className="w-28 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs font-mono font-black text-white"
                />
                <a
                  href={buildWhatsAppOfficialAppLinksUrl(whatsappRecipientMobile)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black px-3 py-1 text-xs font-black shadow cursor-pointer"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Option 2: Send to Number</span>
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* 1. C&F App Link */}
            <div className="rounded-xl bg-slate-800/90 border border-emerald-500/40 p-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-orange-400">
                    <Building2 className="h-3.5 w-3.5" /> 1. Official C&amp;F App
                  </span>
                  <p className="font-bold text-white mt-0.5">C&amp;F Billing &amp; Stock Portal</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">
                    {cnfAppUrl}
                  </p>
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(
                    cnfAppUrl
                  )}`}
                  alt="C&F App QR"
                  className="h-12 w-12 rounded bg-white p-0.5 shrink-0"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyLink('cnf', cnfAppUrl)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedPortal === 'cnf' ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy C&amp;F Link
                    </>
                  )}
                </button>
                <a
                  href={buildWhatsAppOfficialAppLinksUrl('', 'cnf')}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-emerald-300 font-bold text-[11px] flex items-center gap-1"
                  title="Share C&F App to any contact on WhatsApp"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Direct Contact</span>
                </a>
              </div>
            </div>

            {/* 2. Customer App Link */}
            <div className="rounded-xl bg-slate-800/90 border border-indigo-500/40 p-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-300">
                    <Users className="h-3.5 w-3.5" /> 2. Official Customer App
                  </span>
                  <p className="font-bold text-white mt-0.5">Customer Ordering &amp; DP/SP Store</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">
                    {customerAppUrl}
                  </p>
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(
                    customerAppUrl
                  )}`}
                  alt="Customer App QR"
                  className="h-12 w-12 rounded bg-white p-0.5 shrink-0"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyLink('customer', customerAppUrl)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedPortal === 'customer' ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Customer Link
                    </>
                  )}
                </button>
                <a
                  href={buildWhatsAppOfficialAppLinksUrl('', 'customer')}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-indigo-300 font-bold text-[11px] flex items-center gap-1"
                  title="Share Customer App to any contact on WhatsApp"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Direct Contact</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Certificate Body (Formal & Authentic styling) */}
        <div className="p-6 md:p-8 bg-amber-50/20 dark:bg-slate-950 print:bg-white max-h-[65vh] overflow-y-auto print:max-h-none">
          <div className="relative mx-auto rounded-xl border-8 border-double border-amber-600/40 bg-white p-6 sm:p-10 text-slate-900 shadow-sm print:border-amber-600 print:shadow-none">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
              <span className="text-8xl font-black rotate-[-25deg] tracking-widest text-slate-900 uppercase">
                AWPL VERIFIED
              </span>
            </div>

            {/* Certificate Header */}
            <div className="text-center space-y-2 border-b-2 border-emerald-900/20 pb-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md border-2 border-amber-500 overflow-hidden">
                <img
                  src="/assets/aistudio/IMG-20260717-WA0000_7d91f3de.jpg"
                  alt="Asclepius Wellness Private Limited Official Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <h2 className="text-xs font-black tracking-widest text-emerald-900 uppercase">
                Asclepius Wellness Private Limited (AWPL)
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">
                CIN: {franchiseConfig.cinNumber} • {franchiseConfig.corporateAwplAddress}
              </p>
              <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-emerald-950 pt-1">
                OFFICIAL CERTIFICATE OF FRANCHISE &amp; C&amp;F AUTHORIZATION
              </h1>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-widest">
                Official Authorized C&amp;F &amp; Franchise Hub — {franchiseConfig.name}
              </p>
            </div>

            {/* Certificate Statement */}
            <div className="py-6 text-center space-y-4">
              <p className="text-xs text-slate-600 italic">This is to officially certify that</p>

              <div className="space-y-1">
                <h3 className="text-2xl font-serif font-black text-emerald-900 tracking-wide uppercase">
                  {franchiseConfig.name} ({franchiseConfig.shortName || 'DRW'})
                </h3>
                <p className="text-xs font-bold text-slate-700">
                  Franchise &amp; C&amp;F Owner:{' '}
                  <span className="text-emerald-950 font-black">
                    {franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner}
                  </span>
                </p>
                <p className="text-xs text-slate-600 max-w-lg mx-auto">
                  {franchiseConfig.address}
                </p>
              </div>

              <p className="text-xs text-slate-700 max-w-xl mx-auto leading-relaxed pt-2">
                is an officially registered and authorized C&amp;F / Franchise Center operating under{' '}
                <strong>Asclepius Wellness Private Limited</strong> for billing, inventory distribution, and online C&amp;F order fulfillment of genuine Ayush, wellness, personal care, and agricultural products under Franchise Code{' '}
                <strong className="font-mono text-emerald-900">
                  {franchiseConfig.franchiseCode}
                </strong>
                .
              </p>
            </div>

            {/* Statutory Compliance Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl bg-slate-50 p-4 border border-slate-200 text-[11px]">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">
                  GST Registration
                </span>
                <span className="font-mono font-bold text-slate-900">{franchiseConfig.gstin}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">
                  PAN Number
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {franchiseConfig.panNumber}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">
                  FSSAI License
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {franchiseConfig.fssaiNumber}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">
                  Ayush / Drug License
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {franchiseConfig.dlNumber}
                </span>
              </div>
            </div>

            {/* Seal, QR, and Signatures */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-700">
              {/* Left: Security QR */}
              <div className="flex items-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent(
                    `AWPL-OFFICIAL-VERIFICATION|${franchiseConfig.franchiseCode}|${franchiseConfig.name}|GST:${franchiseConfig.gstin}|VALID-TILL-${franchiseConfig.authorizationValidTill}`
                  )}`}
                  alt="Official QR"
                  className="h-16 w-16 rounded border border-slate-300 p-0.5"
                />
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <p className="font-bold text-emerald-900 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Official Cryptographic QR
                  </p>
                  <p>Valid Through: {franchiseConfig.authorizationValidTill}</p>
                  <p>{franchiseConfig.isoCertification}</p>
                </div>
              </div>

              {/* Center: Official Seal Stamp */}
              <div className="relative flex items-center justify-center">
                <div className="h-20 w-20 rounded-full border-4 border-dashed border-emerald-800 flex flex-col items-center justify-center text-center p-1 text-emerald-900 rotate-[-12deg] shadow-xs">
                  <span className="text-[8px] font-black uppercase tracking-tighter">
                    OFFICIAL SEAL
                  </span>
                  <span className="text-[10px] font-black">AWPL</span>
                  <span className="text-[7px] font-bold">
                    {franchiseConfig.shortName || 'DRW'} VERIFIED
                  </span>
                </div>
              </div>

              {/* Right: Signature */}
              <div className="text-center sm:text-right">
                <div className="font-serif italic font-bold text-emerald-950 text-sm">
                  Asclepius Wellness Pvt. Ltd.
                </div>
                <div className="h-8 flex items-center justify-center sm:justify-end">
                  <span className="font-serif italic text-xs text-emerald-800">
                    {franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner}
                  </span>
                </div>
                <p className="border-t border-slate-300 pt-1 font-bold text-[10px] text-slate-600">
                  Authorized C&amp;F Signatory • {franchiseConfig.name}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Official C&amp;F Bill Production Release • Authorized under Asclepius Wellness Private Limited
          </span>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

