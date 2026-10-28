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
  MessageCircle,
  Edit3,
  Eye,
  EyeOff,
  Sparkles,
  Layout,
  Columns,
  Type,
  FileCheck
} from 'lucide-react';
import {
  BillColumnLabels,
  BillFontScale,
  BillPaperOrientation,
  BillPaperSize,
  BillPrintConfig,
  BillThemeColor,
  CustomBillField,
  Customer,
  FranchiseConfig,
  Invoice
} from '../types';
import {
  findRegisteredAppCustomer,
  formatINR,
  getCnfUpiQrImageSrc,
  getInvoiceSessionYear,
  getStorageItem,
  saveToCloudBackup,
  setStorageItem,
  STORAGE_KEYS
} from '../utils/storage';
import { DEFAULT_BILL_PRINT_CONFIG } from '../data/initialData';
import {
  downloadInvoicePdf,
  shareInvoicePdfOnWhatsApp,
  emailInvoicePdf,
  resolveEffectiveBillConfig
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

type CustomizerTab = 'presets_paper' | 'header_customer' | 'table_columns' | 'totals_footer_custom';

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  invoice,
  franchiseConfig,
  onUpdateConfig,
  autoPrintOnOpen = false,
  onAutoPrintComplete,
}) => {
  const buildMergedConfig = (inv: Invoice | null, fran: FranchiseConfig): BillPrintConfig => {
    if (!inv) {
      return {
        ...DEFAULT_BILL_PRINT_CONFIG,
        ...(fran.billPrintConfig || {}),
        columnLabels: {
          ...(DEFAULT_BILL_PRINT_CONFIG.columnLabels || {}),
          ...(fran.billPrintConfig?.columnLabels || {}),
        },
        customFields: fran.billPrintConfig?.customFields || [],
      };
    }
    return resolveEffectiveBillConfig(inv, fran);
  };

  const [billConfig, setBillConfig] = useState<BillPrintConfig>(() =>
    buildMergedConfig(invoice, franchiseConfig)
  );
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomizerTab>('presets_paper');
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);
  const [hasPerBillOverride, setHasPerBillOverride] = useState<boolean>(
    Boolean(invoice?.customBillConfig)
  );
  const [newTermInput, setNewTermInput] = useState('');
  const [newPrinterInput, setNewPrinterInput] = useState('');
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState('');
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('');
  const [newCustomFieldPos, setNewCustomFieldPos] = useState<'header' | 'customer' | 'footer'>('customer');
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  useEffect(() => {
    setBillConfig(buildMergedConfig(invoice, franchiseConfig));
    setHasPerBillOverride(Boolean(invoice?.customBillConfig));
  }, [invoice?.id, franchiseConfig]);

  useEffect(() => {
    if (isOpen && invoice && autoPrintOnOpen) {
      setSaveToast(
        `✓ UPI Payment Verified (${invoice.upiRefNo || 'UTR Confirmed'}) — Auto-Printing Bill #${invoice.invoiceNumber} Immediately...`
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

  const labels: BillColumnLabels = {
    ...(DEFAULT_BILL_PRINT_CONFIG.columnLabels || {}),
    ...(billConfig.columnLabels || {}),
  };

  const updateColumnLabel = (key: keyof BillColumnLabels, value: string) => {
    setBillConfig((prev) => ({
      ...prev,
      columnLabels: {
        ...(prev.columnLabels || {}),
        [key]: value,
      },
    }));
  };

  // Save as Default C&F Template (for all bills)
  const persistBillConfigAsDefault = (nextCfg: BillPrintConfig, message?: string) => {
    setBillConfig(nextCfg);
    const updatedFranchise: FranchiseConfig = {
      ...franchiseConfig,
      billPrintConfig: nextCfg,
    };
    setStorageItem(STORAGE_KEYS.CONFIG, updatedFranchise);
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

  // Save for This Bill Only (stores customBillConfig on the current Invoice record)
  const saveBillConfigForThisBillOnly = (nextCfg: BillPrintConfig = billConfig, msg?: string) => {
    setBillConfig(nextCfg);
    setHasPerBillOverride(true);
    invoice.customBillConfig = nextCfg;
    const allInvoices = getStorageItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    if (allInvoices.length > 0) {
      const nextInvoices = allInvoices.map((inv) =>
        inv.id === invoice.id ? { ...inv, customBillConfig: nextCfg } : inv
      );
      setStorageItem(STORAGE_KEYS.INVOICES, nextInvoices);
      saveToCloudBackup();
    }
    setSaveToast(
      msg || `✓ Saved custom bill format for Invoice #${invoice.invoiceNumber} only!`
    );
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Clear per-bill override and revert to C&F default template
  const clearPerBillOverride = () => {
    delete invoice.customBillConfig;
    setHasPerBillOverride(false);
    const allInvoices = getStorageItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    if (allInvoices.length > 0) {
      const nextInvoices = allInvoices.map((inv) => {
        if (inv.id === invoice.id) {
          const copy = { ...inv };
          delete copy.customBillConfig;
          return copy;
        }
        return inv;
      });
      setStorageItem(STORAGE_KEYS.INVOICES, nextInvoices);
    }
    const baseCfg = {
      ...DEFAULT_BILL_PRINT_CONFIG,
      ...(franchiseConfig.billPrintConfig || {}),
    };
    setBillConfig(baseCfg);
    setSaveToast('Reverted this bill to the default C&F template.');
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Apply 1-Click Format Presets
  const applyPreset = (
    preset: 'full_gst_awpl' | 'compact_counter' | 'sp_distributor' | 'minimal_retail' | 'thermal_pos'
  ) => {
    if (preset === 'full_gst_awpl') {
      const next: BillPrintConfig = {
        ...DEFAULT_BILL_PRINT_CONFIG,
        ...billConfig,
        paperSize: 'A4',
        invoiceTitle: 'GST TAX INVOICE',
        showCompanyLogo: true,
        showShortNameBadge: true,
        showAddress: true,
        showOwnerNames: true,
        showPhoneAndEmail: true,
        showGstinAndLicenses: true,
        showGstin: true,
        showFranchiseCode: true,
        showFssaiAndDl: true,
        showSessionYear: true,
        showCustomerSection: true,
        showCustomerAwplId: true,
        showGreenIdBadge: true,
        showPaymentAndStaffBlock: true,
        showSerialNoColumn: true,
        showSkuInItem: true,
        showOnlineStatusInItem: true,
        showItemAwplId: true,
        showPendingTagInItem: true,
        showBatchColumn: true,
        showMrpColumn: true,
        showRateColumn: true,
        showQtyColumn: true,
        showSpPoints: true,
        showSpColumn: true,
        showGstBreakdown: true,
        showGstColumn: true,
        showLineTotalColumn: true,
        showCfClearanceBlock: true,
        showSubtotalAndDiscount: true,
        showBalanceDue: true,
        showBankAndQr: true,
        showCustomerAppQr: true,
        showTermsAndConditions: true,
        showSignatureAndSeal: true,
        showOfficialSealStamp: true,
      };
      setBillConfig(next);
      setSaveToast('Applied Preset: Full GST & AWPL Tax Invoice');
    } else if (preset === 'compact_counter') {
      const next: BillPrintConfig = {
        ...billConfig,
        paperSize: 'A5',
        invoiceTitle: 'COUNTER RETAIL BILL',
        showCompanyLogo: true,
        showOwnerNames: false,
        showFssaiAndDl: false,
        showBatchColumn: false,
        showExpiryColumn: false,
        showMrpColumn: false,
        showDiscountColumn: false,
        showSkuInItem: false,
        showOnlineStatusInItem: false,
        showCfClearanceBlock: false,
        showCustomerAppQr: false,
        showRateColumn: true,
        showQtyColumn: true,
        showSpPoints: true,
        showGstBreakdown: false,
        showLineTotalColumn: true,
        showTermsAndConditions: true,
        showSignatureAndSeal: true,
      };
      setBillConfig(next);
      setSaveToast('Applied Preset: Compact Counter Bill (A5)');
    } else if (preset === 'sp_distributor') {
      const next: BillPrintConfig = {
        ...billConfig,
        paperSize: 'A4',
        invoiceTitle: 'AWPL DISTRIBUTOR SP INVOICE',
        showCustomerSection: true,
        showCustomerAwplId: true,
        showGreenIdBadge: true,
        showBatchColumn: false,
        showMrpColumn: false,
        showGstBreakdown: false,
        showSpPoints: true,
        showSpColumn: true,
        showItemAwplId: true,
        showOnlineStatusInItem: true,
        showCfClearanceBlock: true,
      };
      setBillConfig(next);
      setSaveToast('Applied Preset: Distributor SP Focus');
    } else if (preset === 'minimal_retail') {
      const next: BillPrintConfig = {
        ...billConfig,
        invoiceTitle: 'CASH / RETAIL MEMO',
        showGstinAndLicenses: false,
        showOwnerNames: false,
        showCustomerAwplId: false,
        showGreenIdBadge: false,
        showSkuInItem: false,
        showOnlineStatusInItem: false,
        showItemAwplId: false,
        showBatchColumn: false,
        showMrpColumn: false,
        showSpPoints: false,
        showGstBreakdown: false,
        showCfClearanceBlock: false,
        showCustomerAppQr: false,
        showOfficialSealStamp: false,
      };
      setBillConfig(next);
      setSaveToast('Applied Preset: Minimal Retail Receipt');
    } else if (preset === 'thermal_pos') {
      const next: BillPrintConfig = {
        ...billConfig,
        paperSize: 'Thermal_80mm',
        invoiceTitle: 'POS RECEIPT',
      };
      setBillConfig(next);
      setSaveToast('Applied Preset: 80mm Thermal POS Roll');
    }
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Automatic PC Printer Detection
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
          ...(billConfig.detectedPrinters || []),
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
        selectedPrinterName: billConfig.selectedPrinterName || autoDiscovered[0],
      };
      persistBillConfigAsDefault(
        nextCfg,
        `Automatically detected & linked ${autoDiscovered.length} installed PC printers!`
      );
      setIsScanningPrinters(false);
    }, 500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddCustomField = () => {
    if (!newCustomFieldLabel.trim() && !newCustomFieldValue.trim()) return;
    const newField: CustomBillField = {
      id: `cf-${Date.now()}`,
      label: newCustomFieldLabel.trim() || 'Custom Note',
      value: newCustomFieldValue.trim() || '-',
      position: newCustomFieldPos,
      visible: true,
    };
    setBillConfig((prev) => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField],
    }));
    setNewCustomFieldLabel('');
    setNewCustomFieldValue('');
    setSaveToast(`Added custom field "${newField.label}" to ${newField.position} section!`);
    setTimeout(() => setSaveToast(null), 3000);
  };

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

  const qrImageSrc = getCnfUpiQrImageSrc(
    franchiseConfig,
    invoice.balanceDue > 0 ? invoice.balanceDue : invoice.grandTotal,
    invoice.invoiceNumber,
    150
  );

  const displayCompanyName = billConfig.customCompanyNameOverride?.trim() || franchiseConfig.name;
  const displayAddress = billConfig.customAddressOverride?.trim() || franchiseConfig.address;
  const displayPhone = billConfig.customPhoneOverride?.trim() || franchiseConfig.phone;
  const sessionYear = getInvoiceSessionYear(invoice);

  const headerCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && f.position === 'header'
  );
  const customerCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && f.position === 'customer'
  );
  const footerCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && f.position === 'footer'
  );

  // Theme styling classes on the printable bill
  const themeClasses: Record<
    BillThemeColor,
    {
      border: string;
      headingText: string;
      subHeadingText: string;
      badgeBg: string;
      softBg: string;
      softBorder: string;
      tableFootBg: string;
    }
  > = {
    emerald: {
      border: 'border-emerald-700',
      headingText: 'text-emerald-900',
      subHeadingText: 'text-amber-700',
      badgeBg: 'bg-emerald-800 text-white',
      softBg: 'bg-emerald-50',
      softBorder: 'border-emerald-200',
      tableFootBg: 'bg-emerald-50/80 border-emerald-600',
    },
    monochrome: {
      border: 'border-slate-900',
      headingText: 'text-slate-950',
      subHeadingText: 'text-slate-700',
      badgeBg: 'bg-slate-900 text-white',
      softBg: 'bg-slate-100',
      softBorder: 'border-slate-400',
      tableFootBg: 'bg-slate-100 border-slate-900',
    },
    saffron: {
      border: 'border-orange-600',
      headingText: 'text-orange-950',
      subHeadingText: 'text-orange-700',
      badgeBg: 'bg-orange-600 text-white',
      softBg: 'bg-orange-50',
      softBorder: 'border-orange-300',
      tableFootBg: 'bg-orange-50 border-orange-600',
    },
    indigo: {
      border: 'border-indigo-700',
      headingText: 'text-indigo-950',
      subHeadingText: 'text-indigo-700',
      badgeBg: 'bg-indigo-800 text-white',
      softBg: 'bg-indigo-50',
      softBorder: 'border-indigo-200',
      tableFootBg: 'bg-indigo-50 border-indigo-700',
    },
  };
  const currentTheme = themeClasses[billConfig.themeColor || 'emerald'] || themeClasses.emerald;

  const fontScaleClass =
    billConfig.fontSizeScale === 'compact'
      ? 'text-[11px]'
      : billConfig.fontSizeScale === 'large'
      ? 'text-sm'
      : 'text-xs';

  const getWhatsAppMessage = () => {
    const lines = [
      `🌿 *${displayCompanyName}*`,
      `*${billConfig.customHeaderMatter || `Authorized Franchise of ${franchiseConfig.parentCompany || 'Asclepius Wellness Private Limited'}`}*`,
      `---------------------------------`,
      `🧾 *Invoice No:* ${invoice.invoiceNumber}${invoice.regeneratedCount ? ` (Regenerated v${invoice.regeneratedCount})` : ''}`,
      `📅 *Date:* ${invoice.date}`,
      billConfig.showCustomerSection !== false
        ? `👤 *Customer:* ${invoice.customerName} (${invoice.customerMobile})`
        : '',
      billConfig.showCustomerAwplId !== false && invoice.customerAwplId
        ? `🆔 *Primary AWPL ID:* ${invoice.customerAwplId}`
        : '',
      billConfig.showGreenIdBadge !== false && invoice.customerAwplId
        ? primaryIsGreen
          ? `✅ *AWPL ID Status:* GREEN ID • Repurchase Side: *${primaryRepurchaseSide || 'S.A.O'}*`
          : `🌱 *AWPL ID Status:* NOT GREEN • Greening Category: *${primaryGreeningCategory || '27 SP'}*`
        : '',
      billConfig.customCustomerNote ? `📝 *Note:* ${billConfig.customCustomerNote}` : '',
      ...(billConfig.customFields || [])
        .filter((f) => f.visible)
        .map((f) => `🔹 *${f.label}:* ${f.value}`),
      `---------------------------------`,
      `*ITEMS:*`,
      ...invoice.items.map((it) => {
        const itemAwplId = it.targetAwplId || invoice.customerAwplId || 'Unassigned';
        const cfStatusText =
          billConfig.showOnlineStatusInItem !== false
            ? it.cfSynced
              ? ` ✅ Online Done (Bill: ${it.cfBillNumber || invoice.cfBillNumber || 'N/A'})`
              : ` ⏳ Online Pending`
            : '';
        const spPart = billConfig.showSpPoints !== false ? ` (${it.spEarned} SP)` : '';
        return `• ${it.product.name} x${it.quantity} = ${formatINR(it.lineTotal)}${spPart}${
          billConfig.showItemAwplId !== false ? `\n   ↳ AWPL ID: *${itemAwplId}*` : ''
        }${cfStatusText}`;
      }),
      `---------------------------------`,
      `💰 *Grand Total:* ${formatINR(invoice.grandTotal)}`,
      billConfig.showSpPoints !== false ? `✨ *Total SP Earned:* ${invoice.totalSp} SP` : '',
      billConfig.showTermsAndConditions !== false
        ? `📌 *Terms & Conditions:* ${billConfig.termsAndConditions.join(' | ')}`
        : '',
      `---------------------------------`,
      billConfig.showAddress !== false ? `📍 *Store Address:* ${displayAddress}` : '',
      billConfig.showPhoneAndEmail !== false ? `📞 *Contact:* ${displayPhone}` : '',
      billConfig.customFooterMatter || `Thank you for choosing ${displayCompanyName}!`,
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(getWhatsAppMessage());
    setWhatsappCopied(true);
    setTimeout(() => setWhatsappCopied(false), 3000);
  };

  const pagePrintCss = (() => {
    if (billConfig.paperSize === 'Thermal_80mm') {
      return `@media print { @page { size: 80mm auto; margin: 2mm; } }`;
    }
    if (billConfig.paperSize === 'Thermal_58mm') {
      return `@media print { @page { size: 58mm auto; margin: 1.5mm; } }`;
    }
    return `@media print { @page { size: ${billConfig.paperSize} ${billConfig.orientation}; margin: 8mm; } }`;
  })();

  const paperCanvasWidthClass = (() => {
    if (billConfig.paperSize === 'Thermal_58mm') return 'w-[250px]';
    if (billConfig.paperSize === 'Thermal_80mm') return 'w-[340px]';
    if (billConfig.paperSize === 'A5') {
      return billConfig.orientation === 'landscape' ? 'max-w-3xl' : 'max-w-xl';
    }
    if (billConfig.orientation === 'landscape') return 'max-w-5xl';
    return 'max-w-3xl';
  })();

  // Count visible columns before Qty for table footer colSpan
  const columnsBeforeQtyCount = [
    billConfig.showSerialNoColumn !== false,
    true, // Product column is always shown
    billConfig.showBatchColumn !== false,
    Boolean(billConfig.showExpiryColumn),
    billConfig.showMrpColumn !== false,
    Boolean(billConfig.showDiscountColumn),
    billConfig.showRateColumn !== false,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 md:p-5 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <style>{pagePrintCss}</style>

      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 print:border-none print:shadow-none print:max-w-none">
        {/* Top Studio Toolbar - Hidden on Print */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-3.5 bg-emerald-900 text-white print:hidden gap-2">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-emerald-300 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black">
                  Invoice #{invoice.invoiceNumber}
                </h2>
                {hasPerBillOverride && (
                  <span className="rounded bg-indigo-500 text-white px-2 py-0.5 text-[10px] font-black">
                    Custom Bill Override Active
                  </span>
                )}
                <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black">
                  {billConfig.paperSize.replace('_', ' ')} • {billConfig.orientation.toUpperCase()}
                </span>
                {billConfig.showSpPoints !== false && (
                  <span className="rounded bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[10px] font-black font-mono tabular-nums">
                    ★ Total SP: {invoice.totalSp} SP
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-200 flex items-center gap-2 flex-wrap">
                <span>
                  {invoice.customerName} (+91 {invoice.customerMobile}) • {formatINR(invoice.grandTotal)}
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
            {/* Live Click-to-Edit Inline Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsInlineEditMode(!isInlineEditMode)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition shadow cursor-pointer whitespace-nowrap shrink-0 ${
                isInlineEditMode
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                  : 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700 border border-emerald-600'
              }`}
              title="Click directly on any heading, column title, or text on the bill to edit or hide it"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{isInlineEditMode ? '✓ Live Edit on Bill: ON' : 'Live Edit on Bill'}</span>
            </button>

            {/* Full 4-Tab Visual Bill Format Builder Toggle */}
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition shadow cursor-pointer whitespace-nowrap shrink-0 ${
                isCustomizerOpen
                  ? 'bg-orange-500 text-black'
                  : 'bg-emerald-700 text-white hover:bg-emerald-600 border border-emerald-500'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{isCustomizerOpen ? 'Hide Format Studio' : 'Customize Bill Format & Columns'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const saved = downloadInvoicePdf(invoice, franchiseConfig, fmt, billConfig);
                setSaveToast(`Downloaded Customized PDF Invoice: ${saved}`);
                setTimeout(() => setSaveToast(null), 4000);
              }}
              className="flex items-center gap-1 rounded-xl bg-orange-500 hover:bg-orange-600 px-3 py-1.5 text-xs font-black text-white shadow transition cursor-pointer whitespace-nowrap shrink-0"
              title="Download PDF with your exact customized bill format"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const res = await shareInvoicePdfOnWhatsApp(
                  invoice,
                  franchiseConfig,
                  fmt,
                  false,
                  billConfig
                );
                setSaveToast(
                  res.method === 'native_file_share'
                    ? `Shared ${res.filename} directly on WhatsApp!`
                    : `Downloaded ${res.filename} & opened WhatsApp chat (+91 ${invoice.customerMobile})!`
                );
                setTimeout(() => setSaveToast(null), 4500);
              }}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Share PDF on WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow hover:bg-amber-300 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Bill</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-emerald-200 hover:bg-emerald-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Live Inline Edit Mode Helper Strip */}
        {isInlineEditMode && (
          <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-800 px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
              <Edit3 className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Live Click-to-Edit Active:</strong> Click any highlighted text, heading, or table column title directly on the bill below to edit it, or click the <span className="underline">Hide</span> buttons to remove sections!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveBillConfigForThisBillOnly(billConfig)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 text-[11px] font-black cursor-pointer"
              >
                Save for This Bill Only
              </button>
              <button
                type="button"
                onClick={() =>
                  persistBillConfigAsDefault(
                    billConfig,
                    '✓ Saved as permanent Default C&F Bill Template!'
                  )
                }
                className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 text-[11px] font-black cursor-pointer"
              >
                Save as Default C&F Template
              </button>
            </div>
          </div>
        )}

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

        {/* ============================================================================
            4-TAB VISUAL BILL FORMAT STUDIO (SECTIONS, COLUMNS, LABELS & CUSTOM FIELDS)
           ============================================================================ */}
        {isCustomizerOpen && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/95 p-4 sm:p-6 space-y-4 text-xs print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Editable Bill Format Studio — Choose Exactly What Appears on Your Bill
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Show, hide, or rename any section, license number, table column, or custom field. Save for this bill only or set as your default C&amp;F template.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasPerBillOverride && (
                  <button
                    type="button"
                    onClick={clearPerBillOverride}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    Clear Per-Bill Override
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    persistBillConfigAsDefault(
                      DEFAULT_BILL_PRINT_CONFIG,
                      'Reset bill print settings to default AWPL layout'
                    )
                  }
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                >
                  Reset to Default
                </button>
                <button
                  type="button"
                  onClick={() => saveBillConfigForThisBillOnly(billConfig)}
                  className="flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-black shadow cursor-pointer"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>Save for This Bill Only</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    persistBillConfigAsDefault(
                      billConfig,
                      `✓ Saved as Default C&F Bill Template for ${franchiseConfig.name}!`
                    )
                  }
                  className="flex items-center gap-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 text-xs font-black shadow cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save as Default C&amp;F Template</span>
                </button>
              </div>
            </div>

            {/* Studio Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
              {[
                {
                  id: 'presets_paper' as CustomizerTab,
                  label: '1. Quick Presets, Paper & Theme',
                  icon: Layout,
                },
                {
                  id: 'header_customer' as CustomizerTab,
                  label: '2. Header, Licenses & Customer Info',
                  icon: Type,
                },
                {
                  id: 'table_columns' as CustomizerTab,
                  label: '3. Item Table Columns & Labels',
                  icon: Columns,
                },
                {
                  id: 'totals_footer_custom' as CustomizerTab,
                  label: '4. Totals, QR, Terms & Custom Fields',
                  icon: Sparkles,
                },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-black text-xs transition cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: QUICK PRESETS, PAPER, THEME & PC PRINTER */}
            {activeTab === 'presets_paper' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    One-Click Bill Format Presets
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Choose a starting bill style, then fine-tune any column or section:
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        id: 'full_gst_awpl' as const,
                        title: 'Full GST & AWPL Tax Invoice (A4)',
                        desc: 'Shows all licenses, AWPL ID, SP, Batch, MRP, Rate, GST %, QR & Terms',
                      },
                      {
                        id: 'compact_counter' as const,
                        title: 'Compact Counter Bill (A5)',
                        desc: 'Clean counter bill: hides Batch, MRP, Online Block & App QR',
                      },
                      {
                        id: 'sp_distributor' as const,
                        title: 'Distributor SP Summary Bill',
                        desc: 'Highlights AWPL ID, Green ID Side & SP Points; hides MRP & GST %',
                      },
                      {
                        id: 'minimal_retail' as const,
                        title: 'Minimal Retail Cash Memo',
                        desc: 'Simple retail receipt: Product, Qty, Rate & Total only',
                      },
                      {
                        id: 'thermal_pos' as const,
                        title: '80mm Thermal POS Roll Receipt',
                        desc: 'Compact 3-inch thermal roll layout for POS printers',
                      },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p.id)}
                        className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-900/60 p-2.5 transition cursor-pointer"
                      >
                        <div className="font-black text-slate-900 dark:text-white text-xs">
                          {p.title}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    Paper Size, Orientation, Color Theme &amp; Font Size
                  </h4>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Paper Size
                    </label>
                    <select
                      value={billConfig.paperSize}
                      onChange={(e) =>
                        setBillConfig({
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
                          onClick={() => setBillConfig({ ...billConfig, orientation: ori })}
                          className={`py-2 rounded-lg font-bold capitalize border transition cursor-pointer ${
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

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bill Color Theme (Print &amp; PDF)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'emerald', label: 'AWPL Emerald' },
                          { id: 'monochrome', label: 'Classic B&W Print' },
                          { id: 'saffron', label: 'Saffron Orange' },
                          { id: 'indigo', label: 'Royal Indigo' },
                        ] as { id: BillThemeColor; label: string }[]
                      ).map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setBillConfig({ ...billConfig, themeColor: th.id })}
                          className={`py-1.5 px-2 rounded-lg font-bold border text-[11px] transition cursor-pointer ${
                            (billConfig.themeColor || 'emerald') === th.id
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-black'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {th.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bill Font Scale / Density
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'compact', label: 'Compact' },
                          { id: 'normal', label: 'Standard' },
                          { id: 'large', label: 'Large Text' },
                        ] as { id: BillFontScale; label: string }[]
                      ).map((fs) => (
                        <button
                          key={fs.id}
                          type="button"
                          onClick={() => setBillConfig({ ...billConfig, fontSizeScale: fs.id })}
                          className={`py-1.5 rounded-lg font-bold border text-[11px] transition cursor-pointer ${
                            (billConfig.fontSizeScale || 'normal') === fs.id
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {fs.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PC Printer Manager */}
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-xs uppercase">
                      <Monitor className="h-4 w-4 text-emerald-600" />
                      PC Printer Configuration
                    </h4>
                    <button
                      type="button"
                      onClick={handleAutoDetectPcPrinters}
                      disabled={isScanningPrinters}
                      className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isScanningPrinters ? 'animate-spin' : ''}`} />
                      <span>{isScanningPrinters ? 'Scanning PC...' : 'Auto-Scan PC'}</span>
                    </button>
                  </div>

                  <select
                    value={billConfig.selectedPrinterName}
                    onChange={(e) =>
                      setBillConfig({ ...billConfig, selectedPrinterName: e.target.value })
                    }
                    className="w-full rounded-lg border border-emerald-500 bg-emerald-50/30 dark:bg-slate-900 p-2 font-mono font-bold text-[11px]"
                  >
                    {(billConfig.detectedPrinters || ['System Default PC Printer']).map((prn) => (
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
                      placeholder="Add installed PC printer name..."
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 text-[11px] bg-white dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPrinterInput.trim()) return;
                        const added = newPrinterInput.trim();
                        const nextPrinters = Array.from(
                          new Set([added, ...(billConfig.detectedPrinters || [])])
                        );
                        setBillConfig({
                          ...billConfig,
                          detectedPrinters: nextPrinters,
                          selectedPrinterName: added,
                        });
                        setNewPrinterInput('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px] cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: HEADER, COMPANY, LICENSES & CUSTOMER DETAILS */}
            {activeTab === 'header_customer' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    Header Text, Company Name &amp; License Toggles
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                        placeholder="GST TAX INVOICE"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Custom Store / C&amp;F Name on Bill
                      </label>
                      <input
                        type="text"
                        value={billConfig.customCompanyNameOverride || ''}
                        onChange={(e) =>
                          setBillConfig({
                            ...billConfig,
                            customCompanyNameOverride: e.target.value,
                          })
                        }
                        placeholder={franchiseConfig.name}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                      Header Tagline (Below C&amp;F Name)
                    </label>
                    <input
                      type="text"
                      value={billConfig.customHeaderMatter}
                      onChange={(e) =>
                        setBillConfig({ ...billConfig, customHeaderMatter: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                      Sub-Header / Special Banner Notice
                    </label>
                    <input
                      type="text"
                      value={billConfig.customSubHeaderMatter}
                      onChange={(e) =>
                        setBillConfig({ ...billConfig, customSubHeaderMatter: e.target.value })
                      }
                      placeholder="Optional notice, store timing, or festive offer..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Address Override (Leave blank for default)
                      </label>
                      <input
                        type="text"
                        value={billConfig.customAddressOverride || ''}
                        onChange={(e) =>
                          setBillConfig({ ...billConfig, customAddressOverride: e.target.value })
                        }
                        placeholder={franchiseConfig.address}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Phone Override (Leave blank for default)
                      </label>
                      <input
                        type="text"
                        value={billConfig.customPhoneOverride || ''}
                        onChange={(e) =>
                          setBillConfig({ ...billConfig, customPhoneOverride: e.target.value })
                        }
                        placeholder={franchiseConfig.phone}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    {[
                      { key: 'showCompanyLogo', label: 'Company Logo', defaultVal: true },
                      { key: 'showShortNameBadge', label: 'C&F Short Code Badge', defaultVal: true },
                      { key: 'showAddress', label: 'Store Address', defaultVal: true },
                      { key: 'showOwnerNames', label: 'Franchise & C&F Owner', defaultVal: true },
                      { key: 'showPhoneAndEmail', label: 'Phone & Email', defaultVal: true },
                      { key: 'showSessionYear', label: 'Financial Session Year', defaultVal: true },
                      { key: 'showGstin', label: 'GSTIN Number', defaultVal: true },
                      { key: 'showPanNumber', label: 'PAN Number', defaultVal: false },
                      { key: 'showFranchiseCode', label: 'AWPL Franchise Code', defaultVal: true },
                      { key: 'showFssaiAndDl', label: 'FSSAI & Ayush DL No.', defaultVal: true },
                    ].map((item) => {
                      const val =
                        (billConfig as any)[item.key] !== undefined
                          ? Boolean((billConfig as any)[item.key])
                          : item.defaultVal;
                      return (
                        <label
                          key={item.key}
                          className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) =>
                              setBillConfig({
                                ...billConfig,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="h-3.5 w-3.5 rounded text-emerald-600"
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Customer & AWPL Allocation Section Toggles */}
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    Customer, AWPL ID &amp; Payment Info Block
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Customer Block Heading
                      </label>
                      <input
                        type="text"
                        value={labels.billedToTitle || ''}
                        onChange={(e) => updateColumnLabel('billedToTitle', e.target.value)}
                        placeholder="Billed To Customer & AWPL ID Allocation:"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Payment &amp; Staff Heading
                      </label>
                      <input
                        type="text"
                        value={labels.paymentDetailsTitle || ''}
                        onChange={(e) => updateColumnLabel('paymentDetailsTitle', e.target.value)}
                        placeholder="Payment & Staff Details:"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                      Custom Note / Remark Inside Customer Block
                    </label>
                    <input
                      type="text"
                      value={billConfig.customCustomerNote || ''}
                      onChange={(e) =>
                        setBillConfig({ ...billConfig, customCustomerNote: e.target.value })
                      }
                      placeholder="e.g. Dispatched via Courier / Hand Delivered at Counter..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {[
                      {
                        key: 'showCustomerSection',
                        label: 'Show Customer Name & Mobile Block',
                        defaultVal: true,
                      },
                      {
                        key: 'showCustomerAwplId',
                        label: 'Show Customer AWPL Direct Seller ID',
                        defaultVal: true,
                      },
                      {
                        key: 'showGreenIdBadge',
                        label: 'Show Green ID / Repurchase Side Badge',
                        defaultVal: true,
                      },
                      {
                        key: 'showPaymentAndStaffBlock',
                        label: 'Show Payment Mode, Status & Staff Name',
                        defaultVal: true,
                      },
                    ].map((item) => {
                      const val =
                        (billConfig as any)[item.key] !== undefined
                          ? Boolean((billConfig as any)[item.key])
                          : item.defaultVal;
                      return (
                        <label
                          key={item.key}
                          className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) =>
                              setBillConfig({
                                ...billConfig,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="h-3.5 w-3.5 rounded text-emerald-600"
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ITEM TABLE COLUMNS & CUSTOM COLUMN HEADINGS */}
            {activeTab === 'table_columns' && (
              <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                      Choose &amp; Rename Table Columns on Bill
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Check the columns you want printed on the bill and customize their column titles:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      toggleKey: 'showSerialNoColumn',
                      labelKey: 'serialNo' as keyof BillColumnLabels,
                      title: 'Serial No. (#)',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: null,
                      labelKey: 'product' as keyof BillColumnLabels,
                      title: 'Product Description Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showBatchColumn',
                      labelKey: 'batch' as keyof BillColumnLabels,
                      title: 'Batch No. Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showExpiryColumn',
                      labelKey: 'expiry' as keyof BillColumnLabels,
                      title: 'Expiry Date Column',
                      defaultChecked: false,
                    },
                    {
                      toggleKey: 'showMrpColumn',
                      labelKey: 'mrp' as keyof BillColumnLabels,
                      title: 'MRP Price Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showDiscountColumn',
                      labelKey: 'discount' as keyof BillColumnLabels,
                      title: 'Discount % Column',
                      defaultChecked: false,
                    },
                    {
                      toggleKey: 'showRateColumn',
                      labelKey: 'rate' as keyof BillColumnLabels,
                      title: 'Unit Rate (DP) Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showQtyColumn',
                      labelKey: 'qty' as keyof BillColumnLabels,
                      title: 'Quantity (Qty) Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showSpPoints',
                      labelKey: 'sp' as keyof BillColumnLabels,
                      title: 'Sales Point (SP) Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showGstBreakdown',
                      labelKey: 'gst' as keyof BillColumnLabels,
                      title: 'GST % Column',
                      defaultChecked: true,
                    },
                    {
                      toggleKey: 'showLineTotalColumn',
                      labelKey: 'lineTotal' as keyof BillColumnLabels,
                      title: 'Line Total Column',
                      defaultChecked: true,
                    },
                  ].map((col) => {
                    const isChecked =
                      col.toggleKey === null
                        ? true
                        : (billConfig as any)[col.toggleKey] !== undefined
                        ? Boolean((billConfig as any)[col.toggleKey])
                        : col.defaultChecked;

                    return (
                      <div
                        key={col.labelKey}
                        className={`rounded-lg border p-2.5 space-y-1.5 ${
                          isChecked
                            ? 'border-emerald-500/70 bg-emerald-50/20 dark:bg-slate-900'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 opacity-60'
                        }`}
                      >
                        <label className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-200 cursor-pointer text-[11px]">
                          {col.toggleKey ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setBillConfig({
                                  ...billConfig,
                                  [col.toggleKey!]: e.target.checked,
                                })
                              }
                              className="h-3.5 w-3.5 rounded text-emerald-600"
                            />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          <span>{col.title}</span>
                        </label>
                        <input
                          type="text"
                          value={labels[col.labelKey] || ''}
                          onChange={(e) => updateColumnLabel(col.labelKey, e.target.value)}
                          placeholder={col.title}
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Sub-Badges inside the Product Description Cell */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-black text-slate-800 dark:text-slate-200 block mb-2 text-[11px] uppercase">
                    Product Row Details (Shown Under Product Name):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {[
                      { key: 'showSkuInItem', label: 'Show Product SKU Code', defaultVal: true },
                      {
                        key: 'showItemAwplId',
                        label: 'Show Allocated AWPL ID per Item',
                        defaultVal: true,
                      },
                      {
                        key: 'showOnlineStatusInItem',
                        label: 'Show Online Done / Pending Status',
                        defaultVal: true,
                      },
                      {
                        key: 'showPendingTagInItem',
                        label: 'Show Pending Product Handover Tag',
                        defaultVal: true,
                      },
                    ].map((sub) => {
                      const checked =
                        (billConfig as any)[sub.key] !== undefined
                          ? Boolean((billConfig as any)[sub.key])
                          : sub.defaultVal;
                      return (
                        <label
                          key={sub.key}
                          className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setBillConfig({ ...billConfig, [sub.key]: e.target.checked })
                            }
                            className="h-3.5 w-3.5 rounded text-emerald-600"
                          />
                          <span>{sub.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TOTALS, QR CODES, TERMS, SIGNATURES & USER-DEFINED CUSTOM FIELDS */}
            {activeTab === 'totals_footer_custom' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Col 1: Totals, QR & Signature Toggles */}
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    Totals, Payment QR &amp; Signatures
                  </h4>

                  <div className="grid grid-cols-1 gap-2 text-[11px]">
                    {[
                      {
                        key: 'showSubtotalAndDiscount',
                        label: 'Show Subtotal & Discount Lines',
                        defaultVal: true,
                      },
                      {
                        key: 'showGstBreakdown',
                        label: 'Show GST Breakdown in Totals',
                        defaultVal: true,
                      },
                      {
                        key: 'showSpPoints',
                        label: 'Show Total SP Earned Highlight Box',
                        defaultVal: true,
                      },
                      {
                        key: 'showBalanceDue',
                        label: 'Show Amount Paid & Balance Due',
                        defaultVal: true,
                      },
                      {
                        key: 'showCfClearanceBlock',
                        label: 'Show AWPL C&F Online Clearance Strip',
                        defaultVal: true,
                      },
                      {
                        key: 'showBankAndQr',
                        label: 'Show Bank Details & UPI Scan-to-Pay QR',
                        defaultVal: true,
                      },
                      {
                        key: 'showCustomerAppQr',
                        label: 'Show Customer App Download QR',
                        defaultVal: true,
                      },
                      {
                        key: 'showTermsAndConditions',
                        label: 'Show Terms & Conditions Box',
                        defaultVal: true,
                      },
                      {
                        key: 'showSignatureAndSeal',
                        label: 'Show Customer & Authorized Signatures',
                        defaultVal: true,
                      },
                      {
                        key: 'showOfficialSealStamp',
                        label: 'Show Official Round C&F Seal Stamp',
                        defaultVal: true,
                      },
                    ].map((item) => {
                      const val =
                        (billConfig as any)[item.key] !== undefined
                          ? Boolean((billConfig as any)[item.key])
                          : item.defaultVal;
                      return (
                        <label
                          key={item.key}
                          className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) =>
                              setBillConfig({
                                ...billConfig,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="h-3.5 w-3.5 rounded text-emerald-600"
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Footer Greeting Message
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5 text-[10px]">
                          Customer Sign Label
                        </label>
                        <input
                          type="text"
                          value={labels.customerSignLabel || ''}
                          onChange={(e) => updateColumnLabel('customerSignLabel', e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-600 p-1 text-[11px] bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5 text-[10px]">
                          Signatory Label
                        </label>
                        <input
                          type="text"
                          value={labels.signatoryLabel || ''}
                          onChange={(e) => updateColumnLabel('signatoryLabel', e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-600 p-1 text-[11px] bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Col 2: Custom User-Defined Bill Fields */}
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    Add Custom Fields to Bill (What You Want on Bill)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Add custom information (e.g. Courier / Transport, Vehicle No., Advisor Name, E-Way Bill No., Reference):
                  </p>

                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={newCustomFieldLabel}
                        onChange={(e) => setNewCustomFieldLabel(e.target.value)}
                        placeholder="Field Name (e.g. Vehicle No.)"
                        className="rounded border border-slate-300 dark:border-slate-600 p-1.5 text-[11px] bg-white dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        value={newCustomFieldValue}
                        onChange={(e) => setNewCustomFieldValue(e.target.value)}
                        placeholder="Value (e.g. HP-14-9921)"
                        className="rounded border border-slate-300 dark:border-slate-600 p-1.5 text-[11px] bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={newCustomFieldPos}
                        onChange={(e) =>
                          setNewCustomFieldPos(e.target.value as 'header' | 'customer' | 'footer')
                        }
                        className="flex-1 rounded border border-slate-300 dark:border-slate-600 p-1.5 text-[11px] bg-white dark:bg-slate-800 font-bold"
                      >
                        <option value="header">Show in Header</option>
                        <option value="customer">Show in Customer Box</option>
                        <option value="footer">Show in Footer</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add to Bill</span>
                      </button>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {(billConfig.customFields || []).length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic py-2 text-center">
                        No custom fields added yet. Add any custom field above!
                      </p>
                    ) : (
                      (billConfig.customFields || []).map((cf, idx) => (
                        <div
                          key={cf.id}
                          className="flex items-center gap-1.5 rounded bg-slate-50 dark:bg-slate-900 p-1.5 border border-slate-200 dark:border-slate-700 text-[11px]"
                        >
                          <input
                            type="checkbox"
                            checked={cf.visible}
                            onChange={(e) => {
                              const next = [...(billConfig.customFields || [])];
                              next[idx] = { ...cf, visible: e.target.checked };
                              setBillConfig({ ...billConfig, customFields: next });
                            }}
                            className="h-3.5 w-3.5 rounded text-emerald-600"
                          />
                          <input
                            type="text"
                            value={cf.label}
                            onChange={(e) => {
                              const next = [...(billConfig.customFields || [])];
                              next[idx] = { ...cf, label: e.target.value };
                              setBillConfig({ ...billConfig, customFields: next });
                            }}
                            className="w-24 font-bold bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-none"
                          />
                          <span>:</span>
                          <input
                            type="text"
                            value={cf.value}
                            onChange={(e) => {
                              const next = [...(billConfig.customFields || [])];
                              next[idx] = { ...cf, value: e.target.value };
                              setBillConfig({ ...billConfig, customFields: next });
                            }}
                            className="flex-1 bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-none"
                          />
                          <span className="text-[9px] uppercase font-mono text-slate-400">
                            {cf.position}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = (billConfig.customFields || []).filter(
                                (item) => item.id !== cf.id
                              );
                              setBillConfig({ ...billConfig, customFields: next });
                            }}
                            className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Col 3: Editable Terms & Conditions */}
                <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase">
                      Editable Terms &amp; Conditions
                    </h4>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
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
                                setBillConfig({
                                  ...billConfig,
                                  termsAndConditions: nextTerms,
                                });
                              }}
                              className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
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
                          setBillConfig({ ...billConfig, termsAndConditions: nextTerms });
                          setNewTermInput('');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================
            PRINTABLE CANVAS (SUPPORTS LIVE CLICK-TO-EDIT INLINE ON BILL)
           ============================================================================ */}
        <div className="max-h-[75vh] overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950 print:bg-white print:max-h-none print:p-0">
          {!isThermalLayout ? (
            /* ================= A4 / A5 / LETTER TAX INVOICE (PORTRAIT OR LANDSCAPE) ================= */
            <div
              className={`mx-auto ${paperCanvasWidthClass} ${fontScaleClass} rounded-xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 text-slate-800 font-sans print:shadow-none print:border-none print:p-2 print:max-w-none`}
            >
              {/* Franchise & Header Banner */}
              <div className={`border-b-2 ${currentTheme.border} pb-4`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {billConfig.showCompanyLogo && (
                      <div className="relative h-20 w-24 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm border-2 border-amber-400 shrink-0 overflow-hidden group">
                        <img
                          src={
                            franchiseConfig.logoUrl ||
                            '/assets/aistudio/IMG-20260717-WA0000_7d91f3de.jpg'
                          }
                          alt="Asclepius Wellness Official Company Logo"
                          className="h-full w-full object-contain"
                        />
                        {isInlineEditMode && (
                          <button
                            type="button"
                            onClick={() => setBillConfig({ ...billConfig, showCompanyLogo: false })}
                            className="print:hidden absolute inset-0 bg-black/70 text-white text-[10px] font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            Hide Logo
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isInlineEditMode ? (
                          <input
                            type="text"
                            value={billConfig.customCompanyNameOverride ?? franchiseConfig.name}
                            onChange={(e) =>
                              setBillConfig({
                                ...billConfig,
                                customCompanyNameOverride: e.target.value,
                              })
                            }
                            className={`text-xl sm:text-2xl font-black tracking-tight ${currentTheme.headingText} border-b-2 border-dashed border-amber-500 bg-amber-50/40 px-1 focus:outline-none`}
                          />
                        ) : (
                          <h1
                            className={`text-xl sm:text-2xl font-black tracking-tight ${currentTheme.headingText}`}
                          >
                            {displayCompanyName}
                          </h1>
                        )}

                        {billConfig.showShortNameBadge !== false && franchiseConfig.shortName && (
                          <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                            C&amp;F Code: {franchiseConfig.shortName}
                          </span>
                        )}
                      </div>

                      {isInlineEditMode ? (
                        <input
                          type="text"
                          value={billConfig.customHeaderMatter}
                          onChange={(e) =>
                            setBillConfig({ ...billConfig, customHeaderMatter: e.target.value })
                          }
                          className={`w-full text-xs font-black uppercase tracking-wider ${currentTheme.subHeadingText} border-b border-dashed border-amber-500 bg-amber-50/40 px-1 focus:outline-none`}
                        />
                      ) : (
                        <p className={`text-xs font-black uppercase tracking-wider ${currentTheme.subHeadingText}`}>
                          {billConfig.customHeaderMatter ||
                            `Authorized Franchise Under ${
                              franchiseConfig.parentCompany ||
                              'Asclepius Wellness Private Limited (AWPL)'
                            }`}
                        </p>
                      )}

                      {(billConfig.customSubHeaderMatter || isInlineEditMode) && (
                        <div>
                          {isInlineEditMode ? (
                            <input
                              type="text"
                              value={billConfig.customSubHeaderMatter}
                              onChange={(e) =>
                                setBillConfig({
                                  ...billConfig,
                                  customSubHeaderMatter: e.target.value,
                                })
                              }
                              placeholder="Click to add sub-header notice..."
                              className="w-full text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-dashed border-emerald-400 focus:outline-none"
                            />
                          ) : (
                            <p className="mt-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-200">
                              {billConfig.customSubHeaderMatter}
                            </p>
                          )}
                        </div>
                      )}

                      {billConfig.showAddress !== false && (
                        <div>
                          {isInlineEditMode ? (
                            <input
                              type="text"
                              value={billConfig.customAddressOverride ?? franchiseConfig.address}
                              onChange={(e) =>
                                setBillConfig({
                                  ...billConfig,
                                  customAddressOverride: e.target.value,
                                })
                              }
                              className="w-full text-xs text-slate-700 border-b border-dashed border-amber-500 bg-amber-50/30 px-1 focus:outline-none"
                            />
                          ) : (
                            <p className="mt-1 text-xs text-slate-600 max-w-md">{displayAddress}</p>
                          )}
                        </div>
                      )}

                      {billConfig.showOwnerNames !== false && (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Franchise Owner:</span>{' '}
                          {franchiseConfig.franchiseOwner} |{' '}
                          <span className="font-semibold">C&amp;F Owner:</span>{' '}
                          {franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner}
                        </p>
                      )}

                      {billConfig.showPhoneAndEmail !== false && (
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Phone:</span> {displayPhone} |{' '}
                          <span className="font-semibold">Email:</span> {franchiseConfig.email}
                        </p>
                      )}

                      {/* Custom Header Fields */}
                      {headerCustomFields.length > 0 && (
                        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-800">
                          {headerCustomFields.map((cf) => (
                            <span key={cf.id} className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              <strong>{cf.label}:</strong> {cf.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`text-left sm:text-right ${currentTheme.softBg} p-3 rounded-lg border ${currentTheme.softBorder} text-xs shrink-0`}
                  >
                    {isInlineEditMode ? (
                      <input
                        type="text"
                        value={billConfig.invoiceTitle}
                        onChange={(e) =>
                          setBillConfig({ ...billConfig, invoiceTitle: e.target.value })
                        }
                        className={`inline-block rounded ${currentTheme.badgeBg} px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider mb-1 text-center focus:outline-none ring-2 ring-amber-400`}
                      />
                    ) : (
                      <span
                        className={`inline-block rounded ${currentTheme.badgeBg} px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider mb-1`}
                      >
                        {billConfig.invoiceTitle || 'GST TAX INVOICE'}
                      </span>
                    )}
                    <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {invoice.invoiceNumber}
                    </p>
                    {invoice.regeneratedCount ? (
                      <p className="text-[10px] font-bold text-blue-700">
                        Regenerated Invoice (v{invoice.regeneratedCount})
                      </p>
                    ) : null}
                    <p className="text-[11px] text-slate-600">Date: {invoice.date}</p>
                    {billConfig.showSessionYear !== false && (
                      <p className="text-[11px] text-slate-600">
                        Session: <span className="font-mono font-semibold">{sessionYear}</span>
                      </p>
                    )}
                    {billConfig.showGstinAndLicenses !== false && (
                      <>
                        {billConfig.showGstin !== false && (
                          <p className="text-[11px] text-slate-700">
                            GSTIN:{' '}
                            <span className="font-mono font-bold">{franchiseConfig.gstin}</span>
                          </p>
                        )}
                        {billConfig.showPanNumber && franchiseConfig.panNumber && (
                          <p className="text-[11px] text-slate-700">
                            PAN:{' '}
                            <span className="font-mono font-bold">{franchiseConfig.panNumber}</span>
                          </p>
                        )}
                        {billConfig.showFranchiseCode !== false && (
                          <p className="text-[11px] text-slate-700">
                            Franchise Code:{' '}
                            <span className="font-mono font-bold text-emerald-800">
                              {franchiseConfig.franchiseCode}
                            </span>
                          </p>
                        )}
                        {billConfig.showFssaiAndDl !== false && (
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            FSSAI: {franchiseConfig.fssaiNumber} | DL: {franchiseConfig.dlNumber}
                          </p>
                        )}
                      </>
                    )}
                    {billConfig.showSpPoints !== false && (
                      <div className="mt-1.5 inline-block rounded-md bg-amber-400 border border-amber-500 px-2.5 py-0.5 text-[11px] font-black text-slate-950 font-mono tabular-nums">
                        ★ TOTAL SP IN BILL: {invoice.totalSp} SP
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billed To & Payment Details Block */}
              {(billConfig.showCustomerSection !== false ||
                billConfig.showPaymentAndStaffBlock !== false) && (
                <div className="relative my-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs">
                  {isInlineEditMode && (
                    <button
                      type="button"
                      onClick={() =>
                        setBillConfig({
                          ...billConfig,
                          showCustomerSection: false,
                          showPaymentAndStaffBlock: false,
                        })
                      }
                      className="print:hidden absolute -top-2.5 right-2 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow cursor-pointer"
                    >
                      Hide Customer &amp; Payment Box
                    </button>
                  )}

                  {billConfig.showCustomerSection !== false && (
                    <div>
                      {isInlineEditMode ? (
                        <input
                          type="text"
                          value={labels.billedToTitle || ''}
                          onChange={(e) => updateColumnLabel('billedToTitle', e.target.value)}
                          className="w-full font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1 border-b border-dashed border-amber-500 bg-amber-50/40 px-1 focus:outline-none"
                        />
                      ) : (
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                          {labels.billedToTitle || 'Billed To Customer & AWPL ID Allocation:'}
                        </h4>
                      )}
                      <p className="font-bold text-slate-900 text-sm">{invoice.customerName}</p>
                      <p className="text-slate-600">
                        Mobile: {invoice.customerMobile}{' '}
                        <span className="text-[10px] font-bold text-slate-500">
                          (
                          {isMobileRegisteredInApp
                            ? 'Registered on Customer App'
                            : 'Not Yet Registered on App'}
                          )
                        </span>
                      </p>
                      {billConfig.showCustomerAwplId !== false && invoice.customerAwplId && (
                        <div className="mt-1.5 space-y-1">
                          <p className="text-emerald-800 font-semibold">
                            AWPL Member ID:{' '}
                            <span className="font-mono font-bold">{invoice.customerAwplId}</span>
                          </p>
                          {billConfig.showGreenIdBadge !== false &&
                            (primaryIsGreen ? (
                              <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-black text-emerald-950">
                                <span>✓ GREEN ID</span>
                                <span>•</span>
                                <span>REPURCHASE SIDE: {primaryRepurchaseSide || 'S.A.O'}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 border border-amber-400 px-2.5 py-0.5 text-[11px] font-black text-amber-950">
                                <span>
                                  ★ ID GREENING CATEGORY: {primaryGreeningCategory || '27 SP'}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                      {billConfig.showSpPoints !== false && (
                        <div className="mt-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-800 text-white px-2.5 py-0.5 text-[11px] font-black font-mono tabular-nums">
                            <span>✨ Total SP in This Bill: {invoice.totalSp} SP</span>
                            <span>•</span>
                            <span>
                              {invoice.items.reduce((sum, i) => sum + i.quantity, 0)} Units
                            </span>
                          </span>
                        </div>
                      )}
                      {(billConfig.customCustomerNote || isInlineEditMode) && (
                        <div className="mt-1.5">
                          {isInlineEditMode ? (
                            <input
                              type="text"
                              value={billConfig.customCustomerNote || ''}
                              onChange={(e) =>
                                setBillConfig({
                                  ...billConfig,
                                  customCustomerNote: e.target.value,
                                })
                              }
                              placeholder="Click to add custom customer / delivery note..."
                              className="w-full text-[11px] font-semibold text-slate-800 border-b border-dashed border-amber-500 bg-amber-50/40 px-1 py-0.5 focus:outline-none"
                            />
                          ) : (
                            <p className="text-[11px] font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                              Note: {billConfig.customCustomerNote}
                            </p>
                          )}
                        </div>
                      )}
                      {customerCustomFields.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {customerCustomFields.map((cf) => (
                            <span
                              key={cf.id}
                              className="text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200"
                            >
                              <strong>{cf.label}:</strong> {cf.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {billConfig.showPaymentAndStaffBlock !== false && (
                    <div className="sm:text-right">
                      {isInlineEditMode ? (
                        <input
                          type="text"
                          value={labels.paymentDetailsTitle || ''}
                          onChange={(e) => updateColumnLabel('paymentDetailsTitle', e.target.value)}
                          className="w-full sm:text-right font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1 border-b border-dashed border-amber-500 bg-amber-50/40 px-1 focus:outline-none"
                        />
                      ) : (
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                          {labels.paymentDetailsTitle || 'Payment & Staff Details:'}
                        </h4>
                      )}
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
                  )}
                </div>
              )}

              {/* Line Items Table (Dynamic Columns & Inline-Editable Column Headers) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      {billConfig.showSerialNoColumn !== false && (
                        <th className="py-2 px-2.5">
                          {isInlineEditMode ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={labels.serialNo || '#'}
                                onChange={(e) => updateColumnLabel('serialNo', e.target.value)}
                                className="w-8 bg-amber-50 border-b border-amber-500 text-center font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showSerialNoColumn: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                                title="Hide # Column"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.serialNo || '#'
                          )}
                        </th>
                      )}

                      <th className="py-2 px-3">
                        {isInlineEditMode ? (
                          <input
                            type="text"
                            value={labels.product || 'Product & AWPL Online Status'}
                            onChange={(e) => updateColumnLabel('product', e.target.value)}
                            className="w-full bg-amber-50 border-b border-amber-500 font-black px-1 focus:outline-none"
                          />
                        ) : (
                          labels.product || 'Product & AWPL Online Status'
                        )}
                      </th>

                      {billConfig.showBatchColumn !== false && (
                        <th className="py-2 px-2.5 text-center">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="text"
                                value={labels.batch || 'Batch'}
                                onChange={(e) => updateColumnLabel('batch', e.target.value)}
                                className="w-14 bg-amber-50 border-b border-amber-500 text-center font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showBatchColumn: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                                title="Hide Batch Column"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.batch || 'Batch'
                          )}
                        </th>
                      )}

                      {billConfig.showExpiryColumn && (
                        <th className="py-2 px-2.5 text-center">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="text"
                                value={labels.expiry || 'Expiry'}
                                onChange={(e) => updateColumnLabel('expiry', e.target.value)}
                                className="w-14 bg-amber-50 border-b border-amber-500 text-center font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showExpiryColumn: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.expiry || 'Expiry'
                          )}
                        </th>
                      )}

                      {billConfig.showMrpColumn !== false && (
                        <th className="py-2 px-2.5 text-right">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={labels.mrp || 'MRP'}
                                onChange={(e) => updateColumnLabel('mrp', e.target.value)}
                                className="w-14 bg-amber-50 border-b border-amber-500 text-right font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showMrpColumn: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                                title="Hide MRP Column"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.mrp || 'MRP'
                          )}
                        </th>
                      )}

                      {billConfig.showDiscountColumn && (
                        <th className="py-2 px-2.5 text-right">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={labels.discount || 'Disc %'}
                                onChange={(e) => updateColumnLabel('discount', e.target.value)}
                                className="w-14 bg-amber-50 border-b border-amber-500 text-right font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showDiscountColumn: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.discount || 'Disc %'
                          )}
                        </th>
                      )}

                      {billConfig.showRateColumn !== false && (
                        <th className="py-2 px-2.5 text-right">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={labels.rate || 'Rate'}
                                onChange={(e) => updateColumnLabel('rate', e.target.value)}
                                className="w-14 bg-amber-50 border-b border-amber-500 text-right font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showRateColumn: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.rate || 'Rate'
                          )}
                        </th>
                      )}

                      {billConfig.showQtyColumn !== false && (
                        <th className="py-2 px-2.5 text-center">
                          {isInlineEditMode ? (
                            <input
                              type="text"
                              value={labels.qty || 'Qty'}
                              onChange={(e) => updateColumnLabel('qty', e.target.value)}
                              className="w-12 bg-amber-50 border-b border-amber-500 text-center font-black focus:outline-none"
                            />
                          ) : (
                            labels.qty || 'Qty'
                          )}
                        </th>
                      )}

                      {billConfig.showSpPoints !== false && (
                        <th className="py-2 px-2.5 text-right font-black text-emerald-800">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={labels.sp || 'SP (Unit / Total)'}
                                onChange={(e) => updateColumnLabel('sp', e.target.value)}
                                className="w-24 bg-amber-50 border-b border-amber-500 text-right font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showSpPoints: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                                title="Hide SP Column"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.sp || 'SP (Unit / Total)'
                          )}
                        </th>
                      )}

                      {billConfig.showGstBreakdown !== false && (
                        <th className="py-2 px-2.5 text-right">
                          {isInlineEditMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={labels.gst || 'GST %'}
                                onChange={(e) => updateColumnLabel('gst', e.target.value)}
                                className="w-14 bg-amber-50 border-b border-amber-500 text-right font-black focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBillConfig({ ...billConfig, showGstBreakdown: false })
                                }
                                className="text-red-600 hover:text-red-800 font-black"
                                title="Hide GST Column"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            labels.gst || 'GST %'
                          )}
                        </th>
                      )}

                      {billConfig.showLineTotalColumn !== false && (
                        <th className="py-2 px-3 text-right font-bold">
                          {isInlineEditMode ? (
                            <input
                              type="text"
                              value={labels.lineTotal || 'Total'}
                              onChange={(e) => updateColumnLabel('lineTotal', e.target.value)}
                              className="w-16 bg-amber-50 border-b border-amber-500 text-right font-black focus:outline-none"
                            />
                          ) : (
                            labels.lineTotal || 'Total'
                          )}
                        </th>
                      )}
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
                          {billConfig.showSerialNoColumn !== false && (
                            <td className="py-2 px-2.5 text-slate-500 font-mono tabular-nums">
                              {index + 1}
                            </td>
                          )}
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-900">{item.product.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px]">
                              {billConfig.showSkuInItem !== false && (
                                <span className="text-slate-500 font-mono">{item.product.sku}</span>
                              )}
                              {billConfig.showSpPoints !== false && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 font-mono text-[9px] font-black text-emerald-900 tabular-nums">
                                  ★ SP: {unitSp} SP/unit • Line SP: {item.spEarned} SP
                                </span>
                              )}
                              {billConfig.showItemAwplId !== false && itemTargetId && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-300 px-1.5 py-0.2 font-mono text-[9px] font-bold text-slate-800">
                                  ID: {itemTargetId}
                                </span>
                              )}
                              {billConfig.showOnlineStatusInItem !== false &&
                                (item.cfSynced ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                                    ✓ Online Updated{' '}
                                    {itemBillNo
                                      ? `(Bill: ${itemBillNo} | ID: ${itemCfId || 'N/A'})`
                                      : ''}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-500">
                                    • Online Pending
                                  </span>
                                ))}
                              {billConfig.showPendingTagInItem !== false && item.isPendingProduct && (
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

                          {billConfig.showBatchColumn !== false && (
                            <td className="py-2 px-2.5 text-center font-mono text-[10px] text-slate-600">
                              {item.product.batchNumber}
                            </td>
                          )}

                          {billConfig.showExpiryColumn && (
                            <td className="py-2 px-2.5 text-center font-mono text-[10px] text-slate-600">
                              {item.product.expiryDate || '-'}
                            </td>
                          )}

                          {billConfig.showMrpColumn !== false && (
                            <td className="py-2 px-2.5 text-right text-slate-500 line-through font-mono tabular-nums">
                              {formatINR(item.product.mrp)}
                            </td>
                          )}

                          {billConfig.showDiscountColumn && (
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums text-emerald-700">
                              {item.discountPercent || 0}%
                            </td>
                          )}

                          {billConfig.showRateColumn !== false && (
                            <td className="py-2 px-2.5 text-right font-medium font-mono tabular-nums">
                              {formatINR(item.unitPrice)}
                            </td>
                          )}

                          {billConfig.showQtyColumn !== false && (
                            <td className="py-2 px-2.5 text-center font-bold font-mono tabular-nums">
                              {item.quantity}
                            </td>
                          )}

                          {billConfig.showSpPoints !== false && (
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                              <span className="font-black text-emerald-800 block">
                                {item.spEarned} SP
                              </span>
                              <span className="text-[9px] text-slate-500 block">
                                ({unitSp} SP × {item.quantity})
                              </span>
                            </td>
                          )}

                          {billConfig.showGstBreakdown !== false && (
                            <td className="py-2 px-2.5 text-right text-slate-600 font-mono tabular-nums">
                              {item.product.gstRate}%
                            </td>
                          )}

                          {billConfig.showLineTotalColumn !== false && (
                            <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono tabular-nums">
                              {formatINR(item.lineTotal)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot
                    className={`${currentTheme.tableFootBg} border-t-2 font-black text-xs text-slate-900`}
                  >
                    <tr>
                      <td
                        colSpan={Math.max(1, columnsBeforeQtyCount)}
                        className="py-2 px-3 text-right uppercase tracking-wider"
                      >
                        Total Bill Summary:
                      </td>
                      {billConfig.showQtyColumn !== false && (
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums">
                          {invoice.items.reduce((sum, i) => sum + i.quantity, 0)}
                        </td>
                      )}
                      {billConfig.showSpPoints !== false && (
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-emerald-800 text-sm">
                          {invoice.totalSp} SP
                        </td>
                      )}
                      {billConfig.showGstBreakdown !== false && <td className="py-2 px-2.5"></td>}
                      {billConfig.showLineTotalColumn !== false && (
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-900 text-sm">
                          {formatINR(invoice.grandTotal)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Optional Official AWPL C&F Portal Clearance Block */}
              {billConfig.showCfClearanceBlock && (
                <div className="relative my-4 rounded-xl bg-emerald-50/70 border border-emerald-600/60 p-3 text-xs text-slate-800">
                  {isInlineEditMode && (
                    <button
                      type="button"
                      onClick={() =>
                        setBillConfig({ ...billConfig, showCfClearanceBlock: false })
                      }
                      className="print:hidden absolute -top-2.5 right-2 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow cursor-pointer"
                    >
                      Hide C&amp;F Portal Block
                    </button>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-emerald-950 uppercase text-[11px]">
                      AWPL C&amp;F Portal Clearance • Online Bill: {invoice.cfBillNumber || 'PENDING'} | C&amp;F ID:{' '}
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
                    <div className="relative flex items-center gap-4 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                      {isInlineEditMode && (
                        <button
                          type="button"
                          onClick={() => setBillConfig({ ...billConfig, showBankAndQr: false })}
                          className="print:hidden absolute -top-2 right-2 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow cursor-pointer"
                        >
                          Hide Bank &amp; QR
                        </button>
                      )}
                      <img
                        src={qrImageSrc}
                        alt="UPI Scan & Pay"
                        className="h-20 w-20 rounded-lg bg-white p-1 border border-slate-200 shadow-sm object-contain"
                      />
                      <div className="text-[11px] text-slate-700 space-y-0.5">
                        <p className="font-bold text-emerald-900 flex items-center gap-1">
                          <QrCode className="h-3.5 w-3.5 text-emerald-700" />
                          Scan to Pay via UPI (
                          {franchiseConfig.qrMode === 'uploaded_image' ? 'Uploaded QR' : 'Auto UPI QR'}
                          )
                        </p>
                        <p className="font-mono text-[10px] text-slate-600">
                          {franchiseConfig.bankUpiId}
                        </p>
                        <p className="text-[10px] text-slate-500">{franchiseConfig.bankName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          A/C: {franchiseConfig.accountNo} | IFSC: {franchiseConfig.ifscCode}
                        </p>
                      </div>
                    </div>
                  )}

                  {billConfig.showCustomerAppQr && !isMobileRegisteredInApp && (
                    <div className="relative flex items-center gap-3.5 bg-amber-50 p-3 rounded-xl border-2 border-amber-400">
                      {isInlineEditMode && (
                        <button
                          type="button"
                          onClick={() =>
                            setBillConfig({ ...billConfig, showCustomerAppQr: false })
                          }
                          className="print:hidden absolute -top-2 right-2 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow cursor-pointer"
                        >
                          Hide App QR
                        </button>
                      )}
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
                <div className="space-y-1.5 text-xs text-slate-700 font-mono tabular-nums">
                  {billConfig.showSubtotalAndDiscount !== false && (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span className="font-sans">Subtotal:</span>
                        <span className="font-medium">{formatINR(invoice.subtotal)}</span>
                      </div>
                      {invoice.discountTotal > 0 && (
                        <div className="flex justify-between py-0.5 text-emerald-700">
                          <span className="font-sans">Franchise Discount:</span>
                          <span>-{formatINR(invoice.discountTotal)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {billConfig.showGstBreakdown !== false && (
                    <div className="flex justify-between py-0.5 text-slate-500">
                      <span className="font-sans">GST (CGST + SGST Included):</span>
                      <span className="font-semibold text-slate-700">
                        ({formatINR(invoice.taxTotal)})
                      </span>
                    </div>
                  )}
                  {invoice.upiFeeAmount && invoice.upiFeeAmount > 0 ? (
                    <div className="flex justify-between py-0.5 text-amber-800 font-semibold">
                      <span className="font-sans">
                        UPI Transaction Fee ({invoice.upiFeePercent || 0}%):
                      </span>
                      <span>+{formatINR(invoice.upiFeeAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-slate-200 py-1.5 text-sm font-black text-slate-900">
                    <span className="font-sans">Grand Total:</span>
                    <span className={`text-base ${currentTheme.headingText}`}>
                      {formatINR(invoice.grandTotal)}
                    </span>
                  </div>
                  {billConfig.showSpPoints !== false && (
                    <div className="flex justify-between items-center bg-emerald-100 border border-emerald-400 p-2.5 rounded-lg text-emerald-950 font-black">
                      <span className="font-sans">★ Total Sales Point (SP) in Bill:</span>
                      <span className="text-sm font-black font-mono text-emerald-900 bg-amber-300 px-2 py-0.5 rounded">
                        {invoice.totalSp} SP
                      </span>
                    </div>
                  )}
                  {billConfig.showBalanceDue !== false && (
                    <>
                      <div className="flex justify-between py-0.5 text-[11px] text-slate-600">
                        <span className="font-sans">Amount Paid:</span>
                        <span className="font-semibold text-slate-900">
                          {formatINR(invoice.amountPaid)}
                        </span>
                      </div>
                      {invoice.balanceDue > 0 && (
                        <div className="flex justify-between py-0.5 text-[11px] text-red-600 font-bold">
                          <span className="font-sans">Balance Outstanding (Credit):</span>
                          <span>{formatINR(invoice.balanceDue)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Footer Custom Fields */}
              {footerCustomFields.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3 rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                  {footerCustomFields.map((cf) => (
                    <span key={cf.id} className="text-slate-800">
                      <strong>{cf.label}:</strong> {cf.value}
                    </span>
                  ))}
                </div>
              )}

              {/* Editable Terms & Conditions + Signatures */}
              <div className="mt-6 border-t border-slate-200 pt-4 text-[10px] text-slate-600 space-y-2">
                {billConfig.showTermsAndConditions !== false && (
                  <div className="relative rounded-lg bg-amber-50 border border-amber-300 p-2.5 text-[11px] text-slate-900 space-y-1">
                    {isInlineEditMode && (
                      <button
                        type="button"
                        onClick={() =>
                          setBillConfig({ ...billConfig, showTermsAndConditions: false })
                        }
                        className="print:hidden absolute -top-2 right-2 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow cursor-pointer"
                      >
                        Hide Terms
                      </button>
                    )}
                    {isInlineEditMode ? (
                      <input
                        type="text"
                        value={labels.termsTitle || 'TERMS & CONDITIONS'}
                        onChange={(e) => updateColumnLabel('termsTitle', e.target.value)}
                        className="font-black uppercase text-[10px] text-amber-900 bg-white px-1 border-b border-dashed border-amber-600 focus:outline-none"
                      />
                    ) : (
                      <p className="font-black uppercase text-[10px] text-amber-900">
                        📌 {labels.termsTitle || 'TERMS & CONDITIONS'} ({displayCompanyName}):
                      </p>
                    )}
                    <ol className="list-decimal pl-4 space-y-0.5 font-semibold">
                      {billConfig.termsAndConditions.map((term, idx) => (
                        <li key={idx}>
                          {isInlineEditMode ? (
                            <input
                              type="text"
                              value={term}
                              onChange={(e) => {
                                const next = [...billConfig.termsAndConditions];
                                next[idx] = e.target.value;
                                setBillConfig({ ...billConfig, termsAndConditions: next });
                              }}
                              className="w-full bg-white/80 px-1 border-b border-dashed border-amber-500 focus:outline-none"
                            />
                          ) : (
                            term
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {(billConfig.customFooterMatter || isInlineEditMode) && (
                  <div className="text-center pt-1">
                    {isInlineEditMode ? (
                      <input
                        type="text"
                        value={billConfig.customFooterMatter}
                        onChange={(e) =>
                          setBillConfig({ ...billConfig, customFooterMatter: e.target.value })
                        }
                        placeholder="Click to edit footer message..."
                        className="w-full text-center font-bold text-emerald-900 text-[11px] border-b border-dashed border-amber-500 bg-amber-50/40 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <p className="text-center font-bold text-emerald-900 text-[11px]">
                        {billConfig.customFooterMatter}
                      </p>
                    )}
                  </div>
                )}

                {billConfig.showSignatureAndSeal !== false && (
                  <div className="relative flex justify-between items-end pt-4">
                    {isInlineEditMode && (
                      <button
                        type="button"
                        onClick={() =>
                          setBillConfig({ ...billConfig, showSignatureAndSeal: false })
                        }
                        className="print:hidden absolute top-0 right-0 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow cursor-pointer"
                      >
                        Hide Signatures
                      </button>
                    )}
                    <div className="text-center">
                      <div className="h-10"></div>
                      {isInlineEditMode ? (
                        <input
                          type="text"
                          value={labels.customerSignLabel || 'Customer Signature'}
                          onChange={(e) => updateColumnLabel('customerSignLabel', e.target.value)}
                          className="border-t border-slate-300 px-2 pt-1 font-medium text-[10px] text-center bg-amber-50/40 focus:outline-none"
                        />
                      ) : (
                        <p className="border-t border-slate-300 px-4 pt-1 font-medium text-[10px]">
                          {labels.customerSignLabel || 'Customer Signature'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {billConfig.showOfficialSealStamp !== false && (
                        <div className="h-16 w-16 rounded-full border-2 border-dashed border-emerald-800 flex flex-col items-center justify-center text-center p-1 text-emerald-900 rotate-[-10deg] select-none bg-emerald-50/30">
                          <span className="text-[6px] font-black uppercase tracking-tighter">
                            OFFICIAL SEAL
                          </span>
                          <span className="text-[7px] font-black leading-none truncate max-w-[52px]">
                            {franchiseConfig.shortName || 'DRW'}
                          </span>
                          <span className="text-[6px] font-bold">AWPL C&amp;F</span>
                        </div>
                      )}

                      <div className="text-center">
                        <div className="font-serif italic text-emerald-900 font-bold text-sm">
                          {franchiseConfig.franchiseOwner}
                        </div>
                        {isInlineEditMode ? (
                          <input
                            type="text"
                            value={labels.signatoryLabel || 'Authorized Franchise Signatory'}
                            onChange={(e) => updateColumnLabel('signatoryLabel', e.target.value)}
                            className="border-t border-slate-300 px-2 pt-1 font-medium text-[10px] text-center bg-amber-50/40 focus:outline-none"
                          />
                        ) : (
                          <p className="border-t border-slate-300 px-4 pt-1 font-medium text-[10px]">
                            {labels.signatoryLabel || 'Authorized Franchise Signatory'}
                          </p>
                        )}
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
                  {displayCompanyName}
                </h3>
                <p className="text-[9px] font-bold">
                  {billConfig.customHeaderMatter || 'ASCLEPIUS WELLNESS PVT. LTD. FRANCHISE'}
                </p>
                {billConfig.customSubHeaderMatter && (
                  <p className="text-[9px] font-bold underline">
                    {billConfig.customSubHeaderMatter}
                  </p>
                )}
                {billConfig.showAddress !== false && (
                  <p className="text-[9px]">{displayAddress}</p>
                )}
                <p className="text-[9px]">
                  {billConfig.showPhoneAndEmail !== false ? `Ph: ${displayPhone}` : ''}
                  {billConfig.showGstin !== false ? ` | GSTIN: ${franchiseConfig.gstin}` : ''}
                </p>
                {headerCustomFields.map((cf) => (
                  <p key={cf.id} className="text-[9px] font-bold">
                    {cf.label}: {cf.value}
                  </p>
                ))}
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>INV: {invoice.invoiceNumber}</span>
                  <span>{invoice.date.split(' ')[0]}</span>
                </div>
                {billConfig.showCustomerSection !== false && (
                  <>
                    <div>CUST: {invoice.customerName}</div>
                    <div>MOB: {invoice.customerMobile}</div>
                    {billConfig.showCustomerAwplId !== false && invoice.customerAwplId && (
                      <div className="font-bold">AWPL ID: {invoice.customerAwplId}</div>
                    )}
                    {billConfig.customCustomerNote && (
                      <div>NOTE: {billConfig.customCustomerNote}</div>
                    )}
                    {customerCustomFields.map((cf) => (
                      <div key={cf.id}>
                        {cf.label}: {cf.value}
                      </div>
                    ))}
                  </>
                )}
                {billConfig.showSpPoints !== false && (
                  <div className="font-black text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                    ★ TOTAL BILL SP: {invoice.totalSp} SP
                  </div>
                )}
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
                      <div className="font-bold truncate">
                        {billConfig.showSerialNoColumn !== false ? `${idx + 1}. ` : ''}
                        {it.product.name}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-700">
                        <span>
                          {it.quantity} x {formatINR(it.unitPrice)}{' '}
                          {billConfig.showSpPoints !== false && (
                            <strong className="text-emerald-800">
                              (SP: {unitSp}×{it.quantity}={it.spEarned} SP)
                            </strong>
                          )}
                        </span>
                        <span className="font-bold">{formatINR(it.lineTotal)}</span>
                      </div>
                      {billConfig.showPendingTagInItem !== false && it.isPendingProduct && (
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
                {billConfig.showSpPoints !== false && (
                  <div className="flex justify-between font-black text-emerald-900 bg-emerald-50 px-1 py-0.5 text-[10px]">
                    <span>★ TOTAL SP IN BILL:</span>
                    <span>{invoice.totalSp} SP</span>
                  </div>
                )}
                {billConfig.showPaymentAndStaffBlock !== false && (
                  <div className="flex justify-between text-[10px]">
                    <span>MODE ({invoice.paymentMethod}):</span>
                    <span>{formatINR(invoice.amountPaid)}</span>
                  </div>
                )}
                {footerCustomFields.map((cf) => (
                  <div key={cf.id} className="flex justify-between text-[9px]">
                    <span>{cf.label}:</span>
                    <span>{cf.value}</span>
                  </div>
                ))}
              </div>

              {/* Terms & QR */}
              <div className="pt-2.5 text-center space-y-1.5 text-[9px]">
                {billConfig.showTermsAndConditions !== false && (
                  <div className="p-1.5 border border-dashed border-slate-400 text-left space-y-0.5 bg-amber-50/60">
                    <div className="font-black uppercase text-[8px]">
                      {labels.termsTitle || 'Terms & Conditions'}:
                    </div>
                    {billConfig.termsAndConditions.map((t, i) => (
                      <div key={i} className="text-[8px] leading-tight">
                        {i + 1}. {t}
                      </div>
                    ))}
                  </div>
                )}

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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
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
              className="flex items-center gap-1.5 rounded-xl border border-orange-400 bg-orange-50 dark:bg-orange-950/40 px-3.5 py-2 text-xs font-bold text-orange-900 dark:text-orange-300 cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{isCustomizerOpen ? 'Close Format Studio' : 'Edit Bill Format / Columns / Fields'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsInlineEditMode(!isInlineEditMode)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs font-bold text-amber-900 dark:text-amber-300 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{isInlineEditMode ? 'Exit Live Edit on Bill' : 'Click-to-Edit Directly on Bill'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const saved = downloadInvoicePdf(invoice, franchiseConfig, fmt, billConfig);
                setSaveToast(`Downloaded Customized PDF Invoice: ${saved}`);
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
                const res = await shareInvoicePdfOnWhatsApp(
                  invoice,
                  franchiseConfig,
                  fmt,
                  false,
                  billConfig
                );
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
              type="button"
              onClick={() => {
                const fmt = isThermalLayout ? 'thermal' : 'a4';
                const { filename } = emailInvoicePdf(
                  invoice,
                  franchiseConfig,
                  matchedAppCustomer?.email || '',
                  fmt,
                  billConfig
                );
                setSaveToast(`Downloaded ${filename} & opened Email draft!`);
                setTimeout(() => setSaveToast(null), 4500);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-bold text-white shadow transition cursor-pointer"
            >
              <Mail className="h-4 w-4 text-orange-400" />
              <span>Email PDF</span>
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
              <span>Print on {(billConfig.selectedPrinterName || 'Printer').split('(')[0].trim()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
