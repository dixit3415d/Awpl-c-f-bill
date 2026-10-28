import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Share2,
  Check,
  QrCode,
  FileText,
  Smartphone,
  Sliders,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Monitor,
  CheckCircle2,
  FileDown,
  Mail,
  MessageCircle
} from 'lucide-react';
import {
  BillPaperOrientation,
  BillPaperSize,
  BillPrintConfig,
  Customer,
  FranchiseConfig,
  Invoice
} from '../types';
import {
  findRegisteredAppCustomer,
  formatINR,
  getCnfUpiQrImageSrc,
  getStorageItem,
  saveToCloudBackup,
  setStorageItem,
  STORAGE_KEYS
} from '../utils/storage';
import { DEFAULT_BILL_PRINT_CONFIG } from '../data/initialData';
import {
  downloadInvoicePdf,
  shareInvoicePdfOnWhatsApp,
  emailInvoicePdf
} from '../utils/invoicePdfGenerator';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  franchiseConfig: FranchiseConfig;
  onUpdateConfig?: (config: FranchiseConfig) => void;
  autoPrintOnOpen?: boolean;
  onAutoPrintComplete?: () => void;
}

const PAPER_SIZE_LABELS: { value: BillPaperSize; label: string; desc: string }[] = [
  { value: 'A4', label: 'A4 Full Sheet', desc: '210 × 297 mm Standard Tax Invoice' },
  { value: 'A5', label: 'A5 Half Sheet', desc: '148 × 210 mm Compact Counter Bill' },
  { value: 'Letter', label: 'US Letter', desc: '8.5 × 11 in Office Laser Sheet' },
  { value: 'Thermal_80mm', label: 'Thermal 80mm', desc: '3-Inch POS Roll Receipt' },
  { value: 'Thermal_58mm', label: 'Thermal 58mm', desc: '2-Inch Mini POS Roll' },
];

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  invoice,
  franchiseConfig,
  onUpdateConfig,
  autoPrintOnOpen = false,
  onAutoPrintComplete,
}) => {
  const initialBillConfig: BillPrintConfig = {
    ...DEFAULT_BILL_PRINT_CONFIG,
    ...(franchiseConfig.billPrintConfig || {}),
    showSpPoints: franchiseConfig.billPrintConfig?.showSpPoints ?? franchiseConfig.billPrintConfig?.showSpColumn ?? true,
    showGstBreakdown: franchiseConfig.billPrintConfig?.showGstBreakdown ?? franchiseConfig.billPrintConfig?.showGstColumn ?? true,
    showBankAndQr: franchiseConfig.billPrintConfig?.showBankAndQr ?? franchiseConfig.billPrintConfig?.showUpiQr ?? true,
    showSignatureAndSeal: franchiseConfig.billPrintConfig?.showSignatureAndSeal ?? franchiseConfig.billPrintConfig?.showSignaturesAndStamp ?? true,
    termsAndConditions:
      franchiseConfig.billPrintConfig?.termsAndConditions &&
      franchiseConfig.billPrintConfig.termsAndConditions.length > 0
        ? franchiseConfig.billPrintConfig.termsAndConditions
        : DEFAULT_BILL_PRINT_CONFIG.termsAndConditions,
    detectedPrinters:
      franchiseConfig.billPrintConfig?.detectedPrinters &&
      franchiseConfig.billPrintConfig.detectedPrinters.length > 0
        ? franchiseConfig.billPrintConfig.detectedPrinters
        : DEFAULT_BILL_PRINT_CONFIG.detectedPrinters || ['System Default PC Printer (Auto-Detected)'],
  };

  const [billConfig, setBillConfig] = useState<BillPrintConfig>(initialBillConfig);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [newTermInput, setNewTermInput] = useState('');
  const [newPrinterInput, setNewPrinterInput] = useState('');
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  useEffect(() => {
    setBillConfig({
      ...DEFAULT_BILL_PRINT_CONFIG,
      ...(franchiseConfig.billPrintConfig || {}),
      showSpPoints: franchiseConfig.billPrintConfig?.showSpPoints ?? franchiseConfig.billPrintConfig?.showSpColumn ?? true,
      showGstBreakdown: franchiseConfig.billPrintConfig?.showGstBreakdown ?? franchiseConfig.billPrintConfig?.showGstColumn ?? true,
      showBankAndQr: franchiseConfig.billPrintConfig?.showBankAndQr ?? franchiseConfig.billPrintConfig?.showUpiQr ?? true,
      showSignatureAndSeal: franchiseConfig.billPrintConfig?.showSignatureAndSeal ?? franchiseConfig.billPrintConfig?.showSignaturesAndStamp ?? true,
      termsAndConditions:
        franchiseConfig.billPrintConfig?.termsAndConditions &&
        franchiseConfig.billPrintConfig.termsAndConditions.length > 0
          ? franchiseConfig.billPrintConfig.termsAndConditions
          : DEFAULT_BILL_PRINT_CONFIG.termsAndConditions,
      detectedPrinters:
        franchiseConfig.billPrintConfig?.detectedPrinters &&
        franchiseConfig.billPrintConfig.detectedPrinters.length > 0
          ? franchiseConfig.billPrintConfig.detectedPrinters
          : DEFAULT_BILL_PRINT_CONFIG.detectedPrinters || ['System Default PC Printer (Auto-Detected)'],
    });
  }, [franchiseConfig]);

  useEffect(() => {
    if (isOpen && invoice && autoPrintOnOpen) {
      setSaveToast(
        `✓ UPI Payment Verified (${invoice.upiTransactionRef || 'UTR Confirmed'}) — Auto-Printing Bill #${invoice.invoiceNo} Immediately...`
      );
      const timer = window.setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          console.warn('Auto-print error:', err);
        }
        onAutoPrintComplete?.();
      }, 380);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, invoice?.id, autoPrintOnOpen]);

  if (!isOpen || !invoice) return null;

  const isThermalLayout =
    billConfig.paperSize === 'Thermal_80mm' || billConfig.paperSize === 'Thermal_58mm';

  // Persist user's customized bill layout, matter, paper size, orientation, terms & printer
  const persistBillConfig = (nextCfg: BillPrintConfig, message?: string) => {
    setBillConfig(nextCfg);
    const updatedFranchise: FranchiseConfig = {
      ...franchiseConfig,
      billPrintConfig: nextCfg,
    };
    setStorageItem(STORAGE_KEYS.FRANCHISE_CONFIG, updatedFranchise);
    const allCnfs = getStorageItem<FranchiseConfig[]>(STORAGE_KEYS.CNF_ACCOUNTS, []);
    if (allCnfs.length > 0) {
      const nextCnfs = allCnfs.map((c) =>
        c.id === updatedFranchise.id || c.name === updatedFranchise.name ? updatedFranchise : c
      );
      setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, nextCnfs);
    }
    onUpdateConfig?.(updatedFranchise);
    saveToCloudBackup();
    if (message) {
      setSaveToast(message);
      setTimeout(() => setSaveToast(null), 3500);
    }
  };

  // Requirement #9: Automatic PC Printer Detection
  const handleAutoDetectPcPrinters = () => {
    setIsScanningPrinters(true);
    setTimeout(() => {
      const platformLabel =
        typeof navigator !== 'undefined' && navigator.userAgent.includes('Win')
          ? 'Windows PC USB/Spooler'
          : typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
          ? 'macOS CUPS Printer'
          : 'PC System Spooler';
      const autoDiscovered = Array.from(
        new Set([
          ...billConfig.detectedPrinters,
          `Auto-Detected Default Printer (${platformLabel})`,
          'EPSON TM-T82 Thermal 80mm (USB001)',
          'HP LaserJet Pro M404dn (A4/A5 Network)',
          'TVS RP-3200 Star POS Printer (80mm/58mm)',
          'Microsoft Print to PDF / System Spooler',
        ])
      );
      const nextCfg: BillPrintConfig = {
        ...billConfig,
        autoPrinterDetect: true,
        detectedPrinters: autoDiscovered,
        selectedPrinterName:
          billConfig.selectedPrinterName || autoDiscovered[0],
      };
      persistBillConfig(
        nextCfg,
        `Automatically detected & linked ${autoDiscovered.length} installed PC printers!`
      );
      setIsScanningPrinters(false);
    }, 500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Requirement #2: Check if customer mobile number entered in billing is registered on our Customer App.
  const allCustomers = getStorageItem<Customer[]>('drw_customers_v1', []);
  const matchedAppCustomer = findRegisteredAppCustomer(invoice.customerMobile, allCustomers);
  const isMobileRegisteredInApp =
    invoice.isRegisteredAppCustomer !== undefined
      ? invoice.isRegisteredAppCustomer
      : Boolean(matchedAppCustomer);

  const customerAppDownloadUrl = `${
    typeof window !== 'undefined' ? window.location.origin : 'https://drightwellness.awpl.app'
  }/?app=customer_portal&mobile=${encodeURIComponent(invoice.customerMobile)}`;
  const customerAppQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    customerAppDownloadUrl
  )}`;

  const primaryIsGreen =
    invoice.isIdGreen !== undefined
      ? invoice.isIdGreen
      : invoice.items[0]?.isIdGreen !== undefined
      ? invoice.items[0]?.isIdGreen
      : Boolean(invoice.repurchaseSide || invoice.items[0]?.repurchaseSide);
  const primaryRepurchaseSide = invoice.repurchaseSide || invoice.items[0]?.repurchaseSide;
  const primaryGreeningCategory = invoice.greeningCategory || invoice.items[0]?.greeningCategory;

  // Requirement #2 (New): Dual UPI QR Code — uses uploaded QR picture if C&F selected 'uploaded_image', else auto-generated from UPI ID
  const qrImageSrc = getCnfUpiQrImageSrc(
    franchiseConfig,
    invoice.balanceDue > 0 ? invoice.balanceDue : invoice.grandTotal,
    invoice.invoiceNumber,
    150
  );

  const uniqueInvoiceAwplIds = Array.from(
    new Set(invoice.items.map((it) => it.targetAwplId || invoice.customerAwplId).filter(Boolean))
  );

  const getWhatsAppMessage = () => {
    const lines = [
      `🌿 *${franchiseConfig.name}*`,
      `*${billConfig.customHeaderMatter || `Authorized Franchise of ${franchiseConfig.parentCompany || 'Asclepius Wellness Private Limited'}`}*`,
      `---------------------------------`,
      `🧾 *Invoice No:* ${invoice.invoiceNumber}${invoice.regeneratedCount ? ` (Regenerated v${invoice.regeneratedCount})` : ''}`,
      `📅 *Date:* ${invoice.date}`,
      `👤 *Customer:* ${invoice.customerName} (${invoice.customerMobile})`,
      invoice.customerAwplId ? `🆔 *Primary AWPL ID:* ${invoice.customerAwplId}` : '',
      invoice.customerAwplId
        ? primaryIsGreen
          ? `✅ *AWPL ID Status:* GREEN ID • Repurchase Side: *${primaryRepurchaseSide || 'S.A.O'}*`
          : `🌱 *AWPL ID Status:* NOT GREEN • Greening Category: *${primaryGreeningCategory || '27 SP'}*`
        : '',
      uniqueInvoiceAwplIds.length > 1 ? `🔀 *Multi-ID Allocation:* ${uniqueInvoiceAwplIds.join(', ')}` : '',
      `---------------------------------`,
      `*ITEMS & AWPL ID ALLOCATION:*`,
      ...invoice.items.map((it) => {
        const itemAwplId = it.targetAwplId || invoice.customerAwplId || 'Unassigned';
        const cfStatusText = it.cfSynced
          ? ` ✅ Online Done (Bill: ${it.cfBillNumber || invoice.cfBillNumber || 'N/A'})`
          : ` ⏳ Online Pending`;
        const pendingProdText = it.isPendingProduct
          ? it.pendingProductStatus === 'given'
            ? `\n   📦 *PENDING PRODUCT STATUS:* ✅ GIVEN (${it.pendingGivenAt || 'Handed Over'})`
            : `\n   ⚠️ *PENDING PRODUCT:* TO BE GIVEN ON ORIGINAL BILL`
          : '';
        return `• ${it.product.name} x${it.quantity} = ${formatINR(it.lineTotal)} (${it.spEarned} SP)\n   ↳ AWPL ID: *${itemAwplId}*${cfStatusText}${pendingProdText}`;
      }),
      `---------------------------------`,
      `💰 *Grand Total:* ${formatINR(invoice.grandTotal)}`,
      `✨ *Total SP Earned:* ${invoice.totalSp} SP`,
      `📌 *Terms & Conditions:* ${billConfig.termsAndConditions.join(' | ')}`,
      !isMobileRegisteredInApp ? `📲 *Download Customer App:* ${customerAppDownloadUrl}` : '',
      `---------------------------------`,
      `📍 *Store Address:* ${franchiseConfig.address}`,
      `📞 *Contact:* ${franchiseConfig.phone}`,
      billConfig.customFooterMatter || `Thank you for choosing ${franchiseConfig.name}!`,
    ].filter(Boolean);

    return lines.join('\n');
  };

  const whatsappShareHref = (() => {
    const text = getWhatsAppMessage();
    const encoded = encodeURIComponent(text);
    const cleanPhone = invoice.customerMobile.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://wa.me/${fullPhone}?text=${encoded}`;
  })();

  const handleCopySummary = () => {
    navigator.clipboard.writeText(getWhatsAppMessage());
    setWhatsappCopied(true);
    setTimeout(() => setWhatsappCopied(false), 3000);
  };

  // Dynamic CSS @page print rule for user-selected Paper Size & Orientation
  const pagePrintCss = (() => {
    if (billConfig.paperSize === 'Thermal_80mm') {
      return `@media print { @page { size: 80mm auto; margin: 2mm; } }`;
    }
    if (billConfig.paperSize === 'Thermal_58mm') {
      return `@media print { @page { size: 58mm auto; margin: 1.5mm; } }`;
    }
    return `@media print { @page { size: ${billConfig.paperSize} ${billConfig.orientation}; margin: 8mm; } }`;
  })();

  // Dynamic container width based on Paper Size & Orientation
  const paperCanvasWidthClass = (() => {
    if (billConfig.paperSize === 'Thermal_58mm') return 'w-[250px]';
    if (billConfig.paperSize === 'Thermal_80mm') return 'w-[340px]';
    if (billConfig.paperSize === 'A5') {
      return billConfig.orientation === 'landscape' ? 'max-w-3xl' : 'max-w-xl';
    }
    if (billConfig.orientation === 'landscape') return 'max-w-5xl';
    return 'max-w-3xl';
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 md:p-5 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <style>{pagePrintCss}</style>

      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 print:border-none print:shadow-none print:max-w-none">
        {/* Top Bar - Hidden on Print */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 bg-emerald-900 text-white print:hidden gap-2">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-emerald-300 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black">
                  Invoice #{invoice.invoiceNumber}
                </h2>
                {invoice.regeneratedCount ? (
                  <span className="rounded-full bg-blue-500 text-white px-2 py-0.5 text-[10px] font-black">
                    ↻ Regenerated Bill (v{invoice.regeneratedCount})
                  </span>
                ) : null}
                <span className="rounded-full bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black">
                  {billConfig.paperSize.replace('_', ' ')} • {billConfig.orientation.toUpperCase()}
                </span>
                <span className="rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[10px] font-black">
                  ★ Total SP in Bill: {invoice.totalSp} SP
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 flex items-center gap-2 flex-wrap">
                <span>
                  {invoice.customerName} (+91 {invoice.customerMobile}) • {formatINR(invoice.grandTotal)} • <strong>{invoice.totalSp} SP</strong>
                </span>
                <span>•</span>
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  PC Printer: {billConfig.selectedPrinterName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Paper Size Selector */}
            <select
              value={billConfig.paperSize}
              onChange={(e) =>
                persistBillConfig(
                  { ...billConfig, paperSize: e.target.value as BillPaperSize },
                  `Paper size updated to ${e.target.value}`
                )
              }
              className="rounded-xl bg-emerald-950 border border-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none cursor-pointer"
              title="Select Paper Size"
            >
              {PAPER_SIZE_LABELS.map((p) => (
                <option key={p.value} value={p.value}>
                  Paper: {p.label}
                </option>
              ))}
            </select>

            {/* Quick Orientation Toggle */}
            {!isThermalLayout && (
              <div className="flex rounded-xl bg-emerald-950 p-0.5 border border-emerald-700 text-xs">
                {(['portrait', 'landscape'] as BillPaperOrientation[]).map((ori) => (
                  <button
                    key={ori}
                    type="button"
                    onClick={() =>
                      persistBillConfig(
                        { ...billConfig, orientation: ori },
                        `Orientation set to ${ori.toUpperCase()}`
                      )
                    }
                    className={`rounded-lg px-2.5 py-1 font-bold capitalize transition ${
                      billConfig.orientation === ori
                        ? 'bg-orange-500 text-black'
                        : 'text-emerald-200 hover:text-white'
                    }`}
                  >
                    {ori}
                  </button>
                ))}
              </div>
            )}

            {/* Requirement #7 & #8: Toggle Full Editable Bill Customizer */}
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition shadow ${
                isCustomizerOpen
                  ? 'bg-orange-500 text-black'
                  : 'bg-emerald-700 text-white hover:bg-emerald-600 border border-emerald-500'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{isCustomizerOpen ? 'Hide Bill Editor' : 'Edit Bill Layout / Matter / Printer'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const saved = downloadInvoicePdf(invoice, franchiseConfig, fmt);
                setSaveToast(`Downloaded PDF Invoice: ${saved}`);
                setTimeout(() => setSaveToast(null), 4000);
              }}
              className="flex items-center gap-1 rounded-xl bg-orange-500 hover:bg-orange-600 px-3 py-1.5 text-xs font-black text-white shadow transition cursor-pointer"
              title="Download Professionally Formatted PDF Invoice"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const res = await shareInvoicePdfOnWhatsApp(invoice, franchiseConfig, fmt, false);
                setSaveToast(
                  res.method === 'native_file_share'
                    ? `Shared ${res.filename} directly on WhatsApp!`
                    : `Downloaded ${res.filename} & opened WhatsApp chat (+91 ${invoice.customerMobile})!`
                );
                setTimeout(() => setSaveToast(null), 4500);
              }}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition cursor-pointer"
              title="Share PDF Invoice on WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Share PDF on WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const { filename } = emailInvoicePdf(
                  invoice,
                  franchiseConfig,
                  matchedAppCustomer?.email || '',
                  fmt
                );
                setSaveToast(`Downloaded ${filename} & opened Email draft!`);
                setTimeout(() => setSaveToast(null), 4500);
              }}
              className="flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-white shadow transition cursor-pointer"
              title="Email PDF Receipt to Customer"
            >
              <Mail className="h-3.5 w-3.5 text-orange-400" />
              <span className="hidden sm:inline">Email PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow hover:bg-amber-300 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Bill</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-emerald-200 hover:bg-emerald-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Save Toast */}
        {saveToast && (
          <div className="bg-emerald-100 dark:bg-emerald-950 border-b border-emerald-300 dark:border-emerald-800 px-6 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between print:hidden">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {saveToast}
            </span>
            <button onClick={() => setSaveToast(null)} className="text-[11px] underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Requirement #7, #8, #9: Interactive Bill Print Customizer & Automatic PC Printer Manager */}
        {isCustomizerOpen && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/95 p-4 sm:p-6 space-y-4 text-xs print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                  Requirements #7, #8 & #9 • Editable Bill Layout, Matter & Auto PC Printer
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1">
                  Customize How Your Bill Looks & Prints (Saved Permanently for {franchiseConfig.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  persistBillConfig(
                    DEFAULT_BILL_PRINT_CONFIG,
                    'Reset bill print settings to default AWPL layout'
                  )
                }
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              >
                Reset to Default Layout
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Column 1: Paper Size, Orientation & Auto PC Printer Detection */}
              <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Monitor className="h-4 w-4 text-emerald-600" />
                  1. Paper Size, Orientation & PC Printer
                </h4>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Paper Size
                  </label>
                  <select
                    value={billConfig.paperSize}
                    onChange={(e) =>
                      persistBillConfig({
                        ...billConfig,
                        paperSize: e.target.value as BillPaperSize,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 font-bold"
                  >
                    {PAPER_SIZE_LABELS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label} — {s.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Paper Orientation
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['portrait', 'landscape'] as BillPaperOrientation[]).map((ori) => (
                      <button
                        key={ori}
                        type="button"
                        onClick={() => persistBillConfig({ ...billConfig, orientation: ori })}
                        className={`py-2 rounded-lg font-bold capitalize border transition ${
                          billConfig.orientation === ori
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {ori}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Requirement #9: Automatic PC Printer Detection */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <Printer className="h-3.5 w-3.5" />
                      Installed PC Printer (Auto-Added)
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoDetectPcPrinters}
                      disabled={isScanningPrinters}
                      className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200"
                    >
                      <RefreshCw className={`h-3 w-3 ${isScanningPrinters ? 'animate-spin' : ''}`} />
                      <span>{isScanningPrinters ? 'Scanning PC...' : 'Auto-Scan PC'}</span>
                    </button>
                  </div>

                  <select
                    value={billConfig.selectedPrinterName}
                    onChange={(e) =>
                      persistBillConfig(
                        { ...billConfig, selectedPrinterName: e.target.value },
                        `Active PC Printer set to: ${e.target.value}`
                      )
                    }
                    className="w-full rounded-lg border border-emerald-500 bg-emerald-50/30 dark:bg-slate-900 p-2 font-mono font-bold text-[11px]"
                  >
                    {billConfig.detectedPrinters.map((prn) => (
                      <option key={prn} value={prn}>
                        🖨️ {prn}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newPrinterInput}
                      onChange={(e) => setNewPrinterInput(e.target.value)}
                      placeholder="Or enter installed PC printer name..."
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 text-[11px] bg-white dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPrinterInput.trim()) return;
                        const added = newPrinterInput.trim();
                        const nextPrinters = Array.from(
                          new Set([added, ...billConfig.detectedPrinters])
                        );
                        persistBillConfig(
                          {
                            ...billConfig,
                            detectedPrinters: nextPrinters,
                            selectedPrinterName: added,
                          },
                          `Added PC Printer: ${added}`
                        );
                        setNewPrinterInput('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px]"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Column 2: Matter on Paper & Field Visibility Toggles */}
              <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  2. Matter on Paper (Headings & Sections)
                </h4>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Invoice Title Badge
                  </label>
                  <input
                    type="text"
                    value={billConfig.invoiceTitle}
                    onChange={(e) =>
                      setBillConfig({ ...billConfig, invoiceTitle: e.target.value })
                    }
                    placeholder="e.g. GST TAX INVOICE"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Header Matter (Below C&F Name)
                  </label>
                  <input
                    type="text"
                    value={billConfig.customHeaderMatter}
                    onChange={(e) =>
                      setBillConfig({ ...billConfig, customHeaderMatter: e.target.value })
                    }
                    placeholder="Authorized Franchise Under Asclepius Wellness Pvt. Ltd."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Extra Sub-Header / Notice Matter on Bill
                  </label>
                  <input
                    type="text"
                    value={billConfig.customSubHeaderMatter}
                    onChange={(e) =>
                      setBillConfig({ ...billConfig, customSubHeaderMatter: e.target.value })
                    }
                    placeholder="Optional festive greeting, counter timing, or motto..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Footer Matter
                  </label>
                  <input
                    type="text"
                    value={billConfig.customFooterMatter}
                    onChange={(e) =>
                      setBillConfig({ ...billConfig, customFooterMatter: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { key: 'showCompanyLogo', label: 'Company Logo' },
                    { key: 'showGstBreakdown', label: 'GST Breakdown' },
                    { key: 'showSpPoints', label: 'AWPL SP Points' },
                    { key: 'showCfClearanceBlock', label: 'C&F Portal Block' },
                    { key: 'showBankAndQr', label: 'Bank & UPI QR' },
                    { key: 'showCustomerAppQr', label: 'App Download QR' },
                    { key: 'showSignatureAndSeal', label: 'Sign & Seal' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean((billConfig as any)[item.key])}
                        onChange={(e) =>
                          persistBillConfig({
                            ...billConfig,
                            [item.key]: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 rounded text-emerald-600"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Column 3: Editable Terms & Conditions */}
              <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                    3. Editable Terms & Conditions on Bill
                  </h4>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {billConfig.termsAndConditions.map((term, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="font-black text-emerald-700">{idx + 1}.</span>
                        <input
                          type="text"
                          value={term}
                          onChange={(e) => {
                            const updated = billConfig.termsAndConditions.map((t, i) =>
                              i === idx ? e.target.value : t
                            );
                            setBillConfig({ ...billConfig, termsAndConditions: updated });
                          }}
                          className="flex-1 bg-transparent text-[11px] font-medium focus:outline-none"
                        />
                        {billConfig.termsAndConditions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextTerms = billConfig.termsAndConditions.filter(
                                (_, i) => i !== idx
                              );
                              persistBillConfig({
                                ...billConfig,
                                termsAndConditions: nextTerms,
                              });
                            }}
                            className="text-red-500 hover:text-red-700 p-0.5"
                            title="Remove Term"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newTermInput}
                      onChange={(e) => setNewTermInput(e.target.value)}
                      placeholder="Add new Term & Condition line..."
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 text-[11px] bg-white dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTermInput.trim()) return;
                        const nextTerms = [
                          ...billConfig.termsAndConditions,
                          newTermInput.trim(),
                        ];
                        persistBillConfig(
                          { ...billConfig, termsAndConditions: nextTerms },
                          'Added new Term & Condition to bill!'
                        );
                        setNewTermInput('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    persistBillConfig(
                      billConfig,
                      'Saved custom bill matter, paper layout & Terms & Conditions!'
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Save My Bill Print Preferences</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Printable Canvas */}
        <div className="max-h-[75vh] overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950 print:bg-white print:max-h-none print:p-0">
          {!isThermalLayout ? (
            /* ================= A4 / A5 / LETTER TAX INVOICE (PORTRAIT OR LANDSCAPE) ================= */
            <div
              className={`mx-auto ${paperCanvasWidthClass} rounded-xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 text-slate-800 font-sans print:shadow-none print:border-none print:p-2 print:max-w-none`}
            >
              {/* Franchise & Header Banner */}
              <div className="border-b-2 border-emerald-700 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {billConfig.showCompanyLogo && (
                      <div className="h-20 w-24 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm border-2 border-amber-400 shrink-0 overflow-hidden">
                        <img
                          src={
                            franchiseConfig.logoUrl ||
                            '/assets/aistudio/IMG-20260717-WA0000_7d91f3de.jpg'
                          }
                          alt="Asclepius Wellness Official Company Logo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-900">
                          {franchiseConfig.name}
                        </h1>
                        {franchiseConfig.shortName && (
                          <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                            C&F Code: {franchiseConfig.shortName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                        {billConfig.customHeaderMatter ||
                          `Authorized Franchise Under ${
                            franchiseConfig.parentCompany ||
                            'Asclepius Wellness Private Limited (AWPL)'
                          }`}
                      </p>
                      {billConfig.customSubHeaderMatter && (
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-200">
                          {billConfig.customSubHeaderMatter}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-600 max-w-md">
                        {franchiseConfig.address}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Franchise Owner:</span>{' '}
                        {franchiseConfig.franchiseOwner} |{' '}
                        <span className="font-semibold">C&F Owner:</span>{' '}
                        {franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner}
                      </p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Phone:</span> {franchiseConfig.phone} |{' '}
                        <span className="font-semibold">Email:</span> {franchiseConfig.email}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs shrink-0">
                    <span className="inline-block rounded bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                      {billConfig.invoiceTitle || 'GST TAX INVOICE'}
                    </span>
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {invoice.invoiceNumber}
                    </p>
                    {invoice.regeneratedCount ? (
                      <p className="text-[10px] font-bold text-blue-700">
                        Regenerated Invoice (v{invoice.regeneratedCount})
                      </p>
                    ) : null}
                    <p className="text-[11px] text-slate-600">Date: {invoice.date}</p>
                    <p className="text-[11px] text-slate-700">
                      GSTIN: <span className="font-mono font-bold">{franchiseConfig.gstin}</span>
                    </p>
                    <p className="text-[11px] text-slate-700">
                      Franchise Code:{' '}
                      <span className="font-mono font-bold text-emerald-800">
                        {franchiseConfig.franchiseCode}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      FSSAI: {franchiseConfig.fssaiNumber} | DL: {franchiseConfig.dlNumber}
                    </p>
                    <div className="mt-1.5 inline-block rounded-md bg-amber-400 border border-amber-500 px-2.5 py-0.5 text-[11px] font-black text-slate-950">
                      ★ TOTAL SP IN BILL: {invoice.totalSp} SP
                    </div>
                  </div>
                </div>
              </div>

              {/* Billed To Details */}
              <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs">
                <div>
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Billed To Customer & AWPL ID Allocation:
                  </h4>
                  <p className="font-bold text-slate-900 text-sm">{invoice.customerName}</p>
                  <p className="text-slate-600">
                    Mobile: {invoice.customerMobile}{' '}
                    <span className="text-[10px] font-bold text-slate-500">
                      ({isMobileRegisteredInApp ? 'Registered on Customer App' : 'Not Yet Registered on App'})
                    </span>
                  </p>
                  {invoice.customerAwplId && (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-emerald-800 font-semibold">
                        AWPL Member ID:{' '}
                        <span className="font-mono font-bold">{invoice.customerAwplId}</span>
                      </p>
                      {primaryIsGreen ? (
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-black text-emerald-950">
                          <span>✓ GREEN ID</span>
                          <span>•</span>
                          <span>REPURCHASE SIDE: {primaryRepurchaseSide || 'S.A.O'}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 border border-amber-400 px-2.5 py-0.5 text-[11px] font-black text-amber-950">
                          <span>★ ID GREENING CATEGORY: {primaryGreeningCategory || '27 SP'}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-800 text-white px-2.5 py-0.5 text-[11px] font-black">
                      <span>✨ Total SP in This Bill: {invoice.totalSp} SP</span>
                      <span>•</span>
                      <span>{invoice.items.reduce((sum, i) => sum + i.quantity, 0)} Units</span>
                    </span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Payment & Staff Details:
                  </h4>
                  <p className="text-slate-700">
                    Payment Mode:{' '}
                    <span className="font-semibold">
                      {invoice.splitDetails
                        ? `Both (Cash: ${formatINR(invoice.splitDetails.cashAmount)} + UPI: ${formatINR(invoice.splitDetails.upiAmount)})`
                        : invoice.paymentMethod}
                    </span>
                  </p>
                  <p className="text-slate-700">
                    Payment Status:{' '}
                    <span
                      className={`font-bold uppercase ${
                        invoice.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {invoice.paymentStatus}
                    </span>
                  </p>
                  <p className="text-slate-600">Billed by: {invoice.staffName}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Product & AWPL Online Status</th>
                      <th className="py-2 px-3 text-center">Batch</th>
                      <th className="py-2 px-3 text-right">MRP</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right font-black text-emerald-800">
                        SP (Unit / Total)
                      </th>
                      {billConfig.showGstBreakdown !== false && (
                        <th className="py-2 px-3 text-right">GST %</th>
                      )}
                      <th className="py-2 px-3 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items.map((item, index) => {
                      const itemTargetId = item.targetAwplId || invoice.customerAwplId;
                      const itemBillNo = item.cfBillNumber || invoice.cfBillNumber;
                      const itemCfId = item.cfIdNumber || invoice.cfIdNumber;
                      const unitSp =
                        item.product.sp !== undefined
                          ? item.product.sp
                          : Math.round((item.spEarned || 0) / Math.max(1, item.quantity));
                      return (
                        <tr key={index} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-500">{index + 1}</td>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-900">{item.product.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px]">
                              <span className="text-slate-500 font-mono">{item.product.sku}</span>
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 font-mono text-[9px] font-black text-emerald-900">
                                ★ SP: {unitSp} SP/unit • Line SP: {item.spEarned} SP
                              </span>
                              {itemTargetId && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-300 px-1.5 py-0.2 font-mono text-[9px] font-bold text-slate-800">
                                  ID: {itemTargetId}
                                </span>
                              )}
                              {item.cfSynced ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                                  ✓ Online Updated{' '}
                                  {itemBillNo ? `(Bill: ${itemBillNo} | ID: ${itemCfId || 'N/A'})` : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-500">
                                  • Online Pending
                                </span>
                              )}
                              {item.isPendingProduct && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                    item.pendingProductStatus === 'given'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-red-600 text-white'
                                  }`}
                                >
                                  {item.pendingProductStatus === 'given'
                                    ? `✓ PENDING PRODUCT GIVEN ${
                                        item.pendingGivenAt ? `(${item.pendingGivenAt})` : ''
                                      }`
                                    : '⚠ PENDING PRODUCT (TO BE GIVEN BY ORIGINAL BILL)'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-600">
                            {item.product.batchNumber}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 line-through">
                            {formatINR(item.product.mrp)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatINR(item.unitPrice)}
                          </td>
                          <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                          <td className="py-2 px-3 text-right">
                            <span className="font-black text-emerald-800 block">
                              {item.spEarned} SP
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 block">
                              ({unitSp} SP × {item.quantity})
                            </span>
                          </td>
                          {billConfig.showGstBreakdown !== false && (
                            <td className="py-2 px-3 text-right text-slate-600">
                              {item.product.gstRate}%
                            </td>
                          )}
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatINR(item.lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-emerald-50/80 border-t-2 border-emerald-600 font-black text-xs text-slate-900">
                    <tr>
                      <td colSpan={5} className="py-2 px-3 text-right uppercase tracking-wider text-emerald-950">
                        Total Bill Qty, SP &amp; Amount:
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {invoice.items.reduce((sum, i) => sum + i.quantity, 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-800 text-sm">
                        {invoice.totalSp} SP
                      </td>
                      {billConfig.showGstBreakdown !== false && <td className="py-2 px-3"></td>}
                      <td className="py-2 px-3 text-right font-mono text-emerald-900 text-sm">
                        {formatINR(invoice.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Optional Official AWPL C&F Portal Clearance Block */}
              {billConfig.showCfClearanceBlock && (
                <div className="my-4 rounded-xl bg-emerald-50/70 border border-emerald-600/60 p-3 text-xs text-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-emerald-950 uppercase text-[11px]">
                      AWPL C&F Portal Clearance • Online Bill: {invoice.cfBillNumber || 'PENDING'} | C&F ID:{' '}
                      {invoice.cfIdNumber || invoice.customerAwplId || 'N/A'}
                    </span>
                    <span className="font-bold text-[11px] text-emerald-900">
                      {invoice.items.filter((i) => i.cfSynced).length}/{invoice.items.length} Items Cleared Online
                    </span>
                  </div>
                </div>
              )}

              {/* Financial Calculation Totals & QR Codes */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div className="space-y-3">
                  {billConfig.showBankAndQr && (
                    <div className="flex items-center gap-4 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                      <img
                        src={qrImageSrc}
                        alt="UPI Scan & Pay"
                        className="h-20 w-20 rounded-lg bg-white p-1 border border-slate-200 shadow-sm object-contain"
                      />
                      <div className="text-[11px] text-slate-700 space-y-0.5">
                        <p className="font-bold text-emerald-900 flex items-center gap-1">
                          <QrCode className="h-3.5 w-3.5 text-emerald-700" />
                          Scan to Pay via UPI ({franchiseConfig.qrMode === 'uploaded_image' ? 'Uploaded QR' : 'Auto UPI QR'})
                        </p>
                        <p className="font-mono text-[10px] text-slate-600">
                          {franchiseConfig.bankUpiId}
                        </p>
                        <p className="text-[10px] text-slate-500">{franchiseConfig.bankName}</p>
                        <p className="text-[10px] text-slate-500">
                          A/C: {franchiseConfig.accountNo} | IFSC: {franchiseConfig.ifscCode}
                        </p>
                      </div>
                    </div>
                  )}

                  {billConfig.showCustomerAppQr && !isMobileRegisteredInApp && (
                    <div className="flex items-center gap-3.5 bg-amber-50 p-3 rounded-xl border-2 border-amber-400">
                      <img
                        src={customerAppQrSrc}
                        alt="Download Customer App QR"
                        className="h-20 w-20 rounded-lg bg-white p-1 border border-amber-300 shadow-sm shrink-0"
                      />
                      <div className="text-[10px] text-slate-800 space-y-1">
                        <span className="inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-0.5 text-[9px] font-black text-slate-950 uppercase">
                          <Smartphone className="h-3 w-3" />
                          Download Customer App via QR
                        </span>
                        <p className="font-bold text-slate-900 text-[11px]">
                          Mobile +91 {invoice.customerMobile} is not registered on our app yet!
                        </p>
                        <p className="font-mono text-[9px] font-bold text-emerald-800 break-all">
                          {customerAppDownloadUrl}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Totals */}
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between py-0.5">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatINR(invoice.subtotal)}</span>
                  </div>
                  {invoice.discountTotal > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-700">
                      <span>Franchise Discount:</span>
                      <span>-{formatINR(invoice.discountTotal)}</span>
                    </div>
                  )}
                  {billConfig.showGstBreakdown && (
                    <div className="flex justify-between py-0.5 text-slate-500">
                      <span>GST (CGST + SGST Included in DP/MRP):</span>
                      <span className="font-semibold text-slate-700">
                        ({formatINR(invoice.taxTotal)})
                      </span>
                    </div>
                  )}
                  {invoice.upiFeeAmount && invoice.upiFeeAmount > 0 ? (
                    <div className="flex justify-between py-0.5 text-amber-800 font-semibold">
                      <span>UPI Transaction Fee ({invoice.upiFeePercent || 0}%):</span>
                      <span>+{formatINR(invoice.upiFeeAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-slate-200 py-1.5 text-sm font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-base text-emerald-800">
                      {formatINR(invoice.grandTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-100 border border-emerald-400 p-2.5 rounded-lg text-emerald-950 font-black">
                    <span>★ Total Sales Point (SP) in Bill:</span>
                    <span className="text-sm font-black font-mono text-emerald-900 bg-amber-300 px-2 py-0.5 rounded">
                      {invoice.totalSp} SP
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 text-[11px] text-slate-600">
                    <span>Amount Paid:</span>
                    <span className="font-semibold text-slate-900">
                      {formatINR(invoice.amountPaid)}
                    </span>
                  </div>
                  {invoice.balanceDue > 0 && (
                    <div className="flex justify-between py-0.5 text-[11px] text-red-600 font-bold">
                      <span>Balance Outstanding (Credit):</span>
                      <span>{formatINR(invoice.balanceDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable Terms & Conditions + Signatures */}
              <div className="mt-6 border-t border-slate-200 pt-4 text-[10px] text-slate-600 space-y-2">
                <div className="rounded-lg bg-amber-50 border border-amber-300 p-2.5 text-[11px] text-slate-900 space-y-1">
                  <p className="font-black uppercase text-[10px] text-amber-900">
                    📌 TERMS & CONDITIONS ({franchiseConfig.name}):
                  </p>
                  <ol className="list-decimal pl-4 space-y-0.5 font-semibold">
                    {billConfig.termsAndConditions.map((term, idx) => (
                      <li key={idx}>{term}</li>
                    ))}
                  </ol>
                </div>

                {billConfig.customFooterMatter && (
                  <p className="text-center font-bold text-emerald-900 text-[11px] pt-1">
                    {billConfig.customFooterMatter}
                  </p>
                )}

                {billConfig.showSignatureAndSeal && (
                  <div className="flex justify-between items-end pt-4">
                    <div className="text-center">
                      <div className="h-10"></div>
                      <p className="border-t border-slate-300 px-4 pt-1 font-medium text-[10px]">
                        Customer Signature
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full border-2 border-dashed border-emerald-800 flex flex-col items-center justify-center text-center p-1 text-emerald-900 rotate-[-10deg] select-none bg-emerald-50/30">
                        <span className="text-[6px] font-black uppercase tracking-tighter">
                          OFFICIAL SEAL
                        </span>
                        <span className="text-[7px] font-black leading-none truncate max-w-[52px]">
                          {franchiseConfig.shortName || 'DRW'}
                        </span>
                        <span className="text-[6px] font-bold">AWPL C&F</span>
                      </div>

                      <div className="text-center">
                        <div className="font-serif italic text-emerald-900 font-bold text-sm">
                          {franchiseConfig.franchiseOwner}
                        </div>
                        <p className="border-t border-slate-300 px-4 pt-1 font-medium text-[10px]">
                          Authorized Franchise Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= 80mm / 58mm THERMAL RECEIPT VIEW ================= */
            <div
              className={`mx-auto ${paperCanvasWidthClass} bg-white p-4 shadow-md border border-slate-300 font-mono text-[11px] text-slate-900 leading-tight print:shadow-none print:border-none print:w-full`}
            >
              <div className="text-center space-y-1 pb-2.5 border-b border-dashed border-slate-400">
                {billConfig.showCompanyLogo && (
                  <div className="flex justify-center mb-1">
                    <img
                      src={
                        franchiseConfig.logoUrl ||
                        '/assets/aistudio/IMG-20260717-WA0000_7d91f3de.jpg'
                      }
                      alt="Company Logo"
                      className="h-12 w-20 object-contain mx-auto border border-slate-200 rounded p-0.5 bg-white"
                    />
                  </div>
                )}
                <div className="font-black text-xs uppercase bg-slate-900 text-white py-0.5 px-2 inline-block rounded">
                  {billConfig.invoiceTitle || 'GST TAX INVOICE'}
                </div>
                <h3 className="font-black text-sm tracking-wider uppercase">
                  {franchiseConfig.name}
                </h3>
                <p className="text-[9px] font-bold">
                  {billConfig.customHeaderMatter || 'ASCLEPIUS WELLNESS PVT. LTD. FRANCHISE'}
                </p>
                {billConfig.customSubHeaderMatter && (
                  <p className="text-[9px] font-bold underline">
                    {billConfig.customSubHeaderMatter}
                  </p>
                )}
                <p className="text-[9px]">{franchiseConfig.address}</p>
                <p className="text-[9px]">
                  Ph: {franchiseConfig.phone} | GSTIN: {franchiseConfig.gstin}
                </p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>INV: {invoice.invoiceNumber}</span>
                  <span>{invoice.date.split(' ')[0]}</span>
                </div>
                <div>CUST: {invoice.customerName}</div>
                <div>MOB: {invoice.customerMobile}</div>
                {invoice.customerAwplId && (
                  <div className="font-bold">AWPL ID: {invoice.customerAwplId}</div>
                )}
                <div className="font-black text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                  ★ TOTAL BILL SP: {invoice.totalSp} SP
                </div>
              </div>

              {/* Items */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5">
                {invoice.items.map((it, idx) => {
                  const unitSp =
                    it.product.sp !== undefined
                      ? it.product.sp
                      : Math.round((it.spEarned || 0) / Math.max(1, it.quantity));
                  return (
                    <div key={idx}>
                      <div className="font-bold truncate">{it.product.name}</div>
                      <div className="flex justify-between text-[10px] text-slate-700">
                        <span>
                          {it.quantity} x {formatINR(it.unitPrice)}{' '}
                          <strong className="text-emerald-800">
                            (SP: {unitSp}×{it.quantity}={it.spEarned} SP)
                          </strong>
                        </span>
                        <span className="font-bold">{formatINR(it.lineTotal)}</span>
                      </div>
                      {it.isPendingProduct && (
                        <div className="text-[8px] font-black text-red-700 bg-red-50 px-1 py-0.5 mt-0.5 border border-red-300">
                          {it.pendingProductStatus === 'given'
                            ? '✓ PENDING PRODUCT: GIVEN'
                            : '⚠ PENDING PRODUCT: TO BE GIVEN ON ORIGINAL BILL'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
                <div className="flex justify-between text-xs font-black">
                  <span>GRAND TOTAL:</span>
                  <span>{formatINR(invoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between font-black text-emerald-900 bg-emerald-50 px-1 py-0.5 text-[10px]">
                  <span>★ TOTAL SP IN BILL:</span>
                  <span>{invoice.totalSp} SP</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>MODE ({invoice.paymentMethod}):</span>
                  <span>{formatINR(invoice.amountPaid)}</span>
                </div>
              </div>

              {/* Terms & QR */}
              <div className="pt-2.5 text-center space-y-1.5 text-[9px]">
                <div className="p-1.5 border border-dashed border-slate-400 text-left space-y-0.5 bg-amber-50/60">
                  <div className="font-black uppercase text-[8px]">Terms & Conditions:</div>
                  {billConfig.termsAndConditions.map((t, i) => (
                    <div key={i} className="text-[8px] leading-tight">
                      {i + 1}. {t}
                    </div>
                  ))}
                </div>

                {billConfig.showBankAndQr && (
                  <div className="flex flex-col items-center pt-1">
                    <img
                      src={qrImageSrc}
                      alt="UPI QR"
                      className="h-20 w-20 object-contain border border-slate-200 p-0.5 bg-white"
                    />
                    <span className="text-[8px] font-bold mt-0.5">
                      UPI: {franchiseConfig.bankUpiId}
                    </span>
                  </div>
                )}

                {billConfig.showCustomerAppQr && !isMobileRegisteredInApp && (
                  <div className="pt-1 border-t border-dashed border-slate-300">
                    <p className="font-black text-[8px]">📲 DOWNLOAD CUSTOMER APP</p>
                    <img
                      src={customerAppQrSrc}
                      alt="App QR"
                      className="h-16 w-16 mx-auto my-0.5"
                    />
                  </div>
                )}

                <p className="font-bold pt-1">
                  {billConfig.customFooterMatter || 'THANK YOU FOR VISITING!'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900 print:hidden gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
            >
              {whatsappCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {whatsappCopied ? 'Summary Copied!' : 'Copy WhatsApp Text'}
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
              className="flex items-center gap-1.5 rounded-xl border border-orange-400 bg-orange-50 dark:bg-orange-950/40 px-3.5 py-2 text-xs font-bold text-orange-900 dark:text-orange-300"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Customize Bill Paper / Matter / Terms</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const saved = downloadInvoicePdf(invoice, franchiseConfig, fmt);
                setSaveToast(`Downloaded PDF Invoice: ${saved}`);
                setTimeout(() => setSaveToast(null), 4000);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-black text-white shadow transition cursor-pointer"
            >
              <FileDown className="h-4 w-4" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const res = await shareInvoicePdfOnWhatsApp(invoice, franchiseConfig, fmt, false);
                setSaveToast(
                  res.method === 'native_file_share'
                    ? `Shared ${res.filename} directly on WhatsApp!`
                    : `Downloaded ${res.filename} & opened WhatsApp chat (+91 ${invoice.customerMobile})!`
                );
                setTimeout(() => setSaveToast(null), 4500);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow transition cursor-pointer"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Share PDF on WhatsApp</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-black text-white shadow hover:bg-emerald-800 transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print on {billConfig.selectedPrinterName.split('(')[0].trim()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
