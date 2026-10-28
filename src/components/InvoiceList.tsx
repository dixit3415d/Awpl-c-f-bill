import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Download,
  Printer,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Sparkles,
  Building2,
  Check,
  Edit3,
  RefreshCw,
  ShieldCheck,
  Bell,
  MessageCircle,
  Smartphone,
  Trash2,
  Cloud,
  QrCode,
  Banknote,
  Edit,
  Plus,
  Minus,
  Mail,
  Share2,
  FileDown
} from 'lucide-react';
import {
  AuditLog,
  AWPLProduct,
  Customer,
  FranchiseConfig,
  Invoice,
  PaymentMethod,
  PaymentStatus,
  Role,
  CartItem,
  CFSyncStatus,
  AWPLRepurchaseSide,
  AWPLGreeningCategory
} from '../types';
import {
  exportToCSV,
  formatINR,
  getInvoiceDaysOld,
  setStorageItem,
  saveToCloudBackup,
  findRegisteredAppCustomer,
  buildWhatsApp7DayReminderUrl,
  buildWhatsApp5DayCreditReminderUrl,
  buildWhatsAppPendingProductArrivalUrl,
  getCnfUpiQrImageSrc,
  getInvoiceSessionYear,
  STORAGE_KEYS
} from '../utils/storage';
import { InvoicePrintModal } from './InvoicePrintModal';
import { InvoicePdfShareModal } from './InvoicePdfShareModal';
import {
  downloadInvoicePdf,
  shareInvoicePdfOnWhatsApp,
  exportFilteredInvoicesRegisterPdf
} from '../utils/invoicePdfGenerator';

interface InvoiceListProps {
  invoices: Invoice[];
  products?: AWPLProduct[];
  customers?: Customer[];
  franchiseConfig: FranchiseConfig;
  onUpdateConfig?: (cfg: FranchiseConfig) => void;
  currentUserRole: Role;
  currentUserName: string;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onAddAuditLog: (log: AuditLog) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  products = [],
  customers = [],
  franchiseConfig,
  onUpdateConfig,
  currentUserRole,
  currentUserName,
  onUpdateInvoices,
  onAddAuditLog,
}) => {
  const isCFUser = currentUserRole !== 'customer';
  // Requirement #4: Dedicated Search by Bill Number + general search + April-March Session Filter
  const [billNumberSearch, setBillNumberSearch] = useState('');
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cfFilter, setCfFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [pdfShareInvoice, setPdfShareInvoice] = useState<Invoice | null>(null);
  const [cloudBanner, setCloudBanner] = useState<string | null>(null);

  // Payment-Gated Print Bill Modal (Requirement #4: If UPI or Credit payment not yet received, confirm payment received before Print Bill)
  const [pendingPaymentPrintInv, setPendingPaymentPrintInv] = useState<Invoice | null>(null);
  const [confirmPayMode, setConfirmPayMode] = useState<PaymentMethod>('UPI');
  const [confirmSplitCash, setConfirmSplitCash] = useState<string>('');
  const [confirmSplitUpi, setConfirmSplitUpi] = useState<string>('');

  // Requirement #3: 5-Day Credit Payment Reminder Modal (with Payment Amount + UPI QR Code)
  const [creditReminderInvoice, setCreditReminderInvoice] = useState<Invoice | null>(null);

  // Requirement #3 (New): Update / Regenerate Invoice Modal (Add more items, reduce or increase item quantity)
  const [editingBill, setEditingBill] = useState<Invoice | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustMobile, setEditCustMobile] = useState('');
  const [editAwplId, setEditAwplId] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('Cash');
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('paid');
  const [editSplitCash, setEditSplitCash] = useState<string>('');
  const [editSplitUpi, setEditSplitUpi] = useState<string>('');
  const [editItems, setEditItems] = useState<CartItem[]>([]);
  const [regenProductSearch, setRegenProductSearch] = useState('');
  const [regenPriceMode, setRegenPriceMode] = useState<'dp' | 'mrp'>('dp');

  // Requirement #4: Delete Bill Modal (plus Audit Cancel)
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);

  // Cancellation Modal state
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // C&F Item Sync Management Modal state
  const [managingCfInvoice, setManagingCfInvoice] = useState<Invoice | null>(null);
  const [cfBillNumberInput, setCfBillNumberInput] = useState('');
  const [cfIdNumberInput, setCfIdNumberInput] = useState('');
  const [itemsCfState, setItemsCfState] = useState<{
    [itemIndex: number]: {
      cfSynced: boolean;
      cfBillNumber: string;
      cfIdNumber: string;
      cfRemarks: string;
      targetAwplId: string;
      isIdGreen: boolean;
      repurchaseSide: AWPLRepurchaseSide;
      greeningCategory: AWPLGreeningCategory;
    };
  }>({});

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const billQ = billNumberSearch.trim().toLowerCase();
      const matchesBillNo =
        !billQ ||
        inv.invoiceNumber.toLowerCase().includes(billQ) ||
        (inv.cfBillNumber && inv.cfBillNumber.toLowerCase().includes(billQ));

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerMobile.includes(q) ||
        (inv.customerAwplId && inv.customerAwplId.toLowerCase().includes(q)) ||
        (inv.cfBillNumber && inv.cfBillNumber.toLowerCase().includes(q)) ||
        (inv.cfIdNumber && inv.cfIdNumber.toLowerCase().includes(q)) ||
        inv.items.some(
          (it) =>
            it.product.name.toLowerCase().includes(q) ||
            it.product.sku.toLowerCase().includes(q) ||
            (it.targetAwplId && it.targetAwplId.toLowerCase().includes(q))
        );

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'credit_5d'
          ? (inv.paymentMethod === 'Credit' || inv.balanceDue > 0) &&
            getInvoiceDaysOld(inv.date) >= 5 &&
            inv.paymentStatus !== 'cancelled'
          : statusFilter === 'cancelled'
          ? inv.paymentStatus === 'cancelled'
          : inv.paymentStatus === statusFilter);

      const invCfStatus = inv.cfSyncStatus || 'pending';
      const daysOld = getInvoiceDaysOld(inv.date);
      const isPending7Days = invCfStatus !== 'synced' && daysOld >= 7 && inv.paymentStatus !== 'cancelled';

      const matchesCf =
        cfFilter === 'all' ||
        (cfFilter === 'reminder_7d' ? isPending7Days : invCfStatus === cfFilter);

      const invSession = getInvoiceSessionYear(inv);
      const matchesSession = sessionFilter === 'all' || invSession === sessionFilter;

      return matchesBillNo && matchesSearch && matchesStatus && matchesCf && matchesSession;
    });
  }, [invoices, billNumberSearch, search, statusFilter, cfFilter, sessionFilter]);

  // All available April-March Financial Sessions across invoices & config
  const allSessionsList = useMemo(() => {
    const set = new Set<string>(['2025-2026', '2026-2027', '2027-2028']);
    if (franchiseConfig.currentFinancialYear) set.add(franchiseConfig.currentFinancialYear);
    (franchiseConfig.availableSessions || []).forEach((s) => set.add(s));
    invoices.forEach((inv) => set.add(getInvoiceSessionYear(inv)));
    return Array.from(set).sort();
  }, [invoices, franchiseConfig.currentFinancialYear, franchiseConfig.availableSessions]);

  const handleSwitchActiveBillingSession = (targetSession: string) => {
    if (!onUpdateConfig) return;
    const isDrw = Boolean(
      franchiseConfig.isDrightWellness ||
        franchiseConfig.shortName === 'DRW' ||
        franchiseConfig.id === 'cnf-drw-solan'
    );
    const baseStart = isDrw ? Math.max(franchiseConfig.startingInvoiceNumber || 3000, 3000) : franchiseConfig.startingInvoiceNumber || 1001;
    const sessionSeqs = { ...(franchiseConfig.sessionSequences || {}) };
    const existingSeq = sessionSeqs[targetSession];
    const nextConfig: FranchiseConfig = {
      ...franchiseConfig,
      startingInvoiceNumber: baseStart,
      currentFinancialYear: targetSession,
      invoiceSequence: existingSeq !== undefined ? existingSeq : baseStart - 1,
      sessionSequences: sessionSeqs,
      availableSessions: Array.from(new Set([...allSessionsList, targetSession])).sort(),
    };
    onUpdateConfig(nextConfig);
    setStorageItem(STORAGE_KEYS.CONFIG, nextConfig);
    saveToCloudBackup();
    const nextPreviewSeq = existingSeq !== undefined ? existingSeq + 1 : baseStart;
    setCloudBanner(
      `Active April–March Billing Session switched to ${targetSession}! Next Invoice will be ${
        franchiseConfig.shortName || 'DRW'
      }/${targetSession}/${nextPreviewSeq} (All previous session bills remain preserved & editable in Cloud).`
    );
    setTimeout(() => setCloudBanner(null), 6000);
  };

  // Totals & C&F Stats
  const {
    totalRevenue,
    totalSpRecorded,
    activeCount,
    cfSyncedCount,
    cfPendingCount,
    reminder7dCount,
    credit5dCount,
  } = useMemo(() => {
    let rev = 0;
    let sp = 0;
    let count = 0;
    let synced = 0;
    let pending = 0;
    let over7d = 0;
    let over5dCredit = 0;

    filteredInvoices.forEach((inv) => {
      if (inv.paymentStatus !== 'cancelled') {
        rev += inv.grandTotal;
        sp += inv.totalSp;
        count += 1;
        const dOld = getInvoiceDaysOld(inv.date);
        if (inv.cfSyncStatus === 'synced') {
          synced += 1;
        } else {
          pending += 1;
          if (dOld >= 7) {
            over7d += 1;
          }
        }
        if ((inv.paymentMethod === 'Credit' || inv.balanceDue > 0) && dOld >= 5) {
          over5dCredit += 1;
        }
      }
    });

    return {
      totalRevenue: rev,
      totalSpRecorded: sp,
      activeCount: count,
      cfSyncedCount: synced,
      cfPendingCount: pending,
      reminder7dCount: over7d,
      credit5dCount: over5dCredit,
    };
  }, [filteredInvoices]);

  // Requirement #4: Print Bill Gated on Payment Received
  // - If Cash (or payment already received): opens Print Bill immediately
  // - If UPI or Credit where payment is NOT yet received: opens Confirm Payment Received modal first, then prints!
  const handleOpenPrint = (invoice: Invoice) => {
    const isPaymentReceived =
      invoice.paymentMethod === 'Cash' ||
      invoice.paymentReceivedConfirmed === true ||
      (invoice.paymentStatus === 'paid' && invoice.balanceDue === 0);

    if (!isPaymentReceived) {
      setPendingPaymentPrintInv(invoice);
      setConfirmPayMode(invoice.paymentMethod === 'Credit' ? 'UPI' : invoice.paymentMethod);
      setConfirmSplitCash(String(invoice.splitDetails?.cashAmount || Math.floor(invoice.grandTotal / 2)));
      setConfirmSplitUpi(String(invoice.splitDetails?.upiAmount || invoice.grandTotal - Math.floor(invoice.grandTotal / 2)));
      return;
    }

    setSelectedInvoice(invoice);
    setIsPrintModalOpen(true);
  };

  // Confirm Payment Received for Pending UPI / Credit Bill -> Save to Cloud & Open Print Bill
  const handleConfirmPaymentAndPrint = () => {
    if (!pendingPaymentPrintInv) return;
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const isSplit = confirmPayMode === 'Split (Cash + UPI)';
    const cNum = isSplit ? Number(confirmSplitCash) || 0 : confirmPayMode === 'Cash' ? pendingPaymentPrintInv.grandTotal : 0;
    const uNum = isSplit ? Number(confirmSplitUpi) || 0 : confirmPayMode === 'UPI' ? pendingPaymentPrintInv.grandTotal : 0;

    const updatedInv: Invoice = {
      ...pendingPaymentPrintInv,
      paymentMethod: confirmPayMode,
      paymentStatus: 'paid',
      paymentReceivedConfirmed: true,
      amountPaid: pendingPaymentPrintInv.grandTotal,
      balanceDue: 0,
      splitDetails: isSplit ? { cashAmount: cNum, upiAmount: uNum } : undefined,
      cloudSavedAt: nowTime,
    };

    const nextList = invoices.map((i) => (i.id === updatedInv.id ? updatedInv : i));
    onUpdateInvoices(nextList);
    setStorageItem('drw_invoices_v1', nextList);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Payment Received & Bill Printed (${updatedInv.invoiceNumber})`,
      category: 'Billing',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Payment confirmed via ${confirmPayMode} (${formatINR(updatedInv.grandTotal)}). Saved to Cloud & Printed.`,
    });

    setPendingPaymentPrintInv(null);
    setSelectedInvoice(updatedInv);
    setIsPrintModalOpen(true);
  };

  // Open Update / Regenerate Invoice Modal (Requirement #3: Add more items, reduce or increase item quantity)
  const handleOpenEditBill = (inv: Invoice) => {
    setEditingBill(inv);
    setEditCustName(inv.customerName);
    setEditCustMobile(inv.customerMobile);
    setEditAwplId(inv.customerAwplId || '');
    setEditPaymentMethod(inv.paymentMethod);
    setEditPaymentStatus(inv.paymentStatus);
    setEditSplitCash(String(inv.splitDetails?.cashAmount ?? Math.floor(inv.grandTotal / 2)));
    setEditSplitUpi(String(inv.splitDetails?.upiAmount ?? inv.grandTotal - Math.floor(inv.grandTotal / 2)));
    setEditItems(inv.items.map((it) => ({ ...it })));
    setRegenProductSearch('');
  };

  // Add a product from catalog into the Invoice being regenerated
  const handleAddProductToRegenBill = (prod: AWPLProduct) => {
    setEditItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === prod.id);
      const rate = regenPriceMode === 'dp' ? prod.dp : prod.mrp;
      if (existingIdx > -1) {
        return prev.map((row, idx) =>
          idx === existingIdx
            ? {
                ...row,
                quantity: row.quantity + 1,
                lineTotal: row.unitPrice * (row.quantity + 1),
                spEarned: row.product.sp * (row.quantity + 1),
              }
            : row
        );
      }
      const newItem: CartItem = {
        product: prod,
        quantity: 1,
        selectedPriceType: regenPriceMode,
        unitPrice: rate,
        discountPercent: 0,
        taxAmount: Math.round((rate * prod.gstRate) / (100 + prod.gstRate)),
        lineTotal: rate,
        spEarned: prod.sp,
        targetAwplId: editAwplId.trim().toUpperCase() || editingBill?.customerAwplId,
        cfSynced: editingBill?.cfSyncStatus === 'synced',
        cfBillNumber: editingBill?.cfBillNumber,
        cfIdNumber: editingBill?.cfIdNumber,
      };
      return [...prev, newItem];
    });
  };

  // Save Regenerated / Updated Bill & Auto-Save to Cloud
  const commitRegeneratedBill = (openPrintAfterSave: boolean) => {
    if (!editingBill) return;

    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const activeItems = editItems.filter((it) => it.quantity > 0);
    if (activeItems.length === 0) return;

    const newSubtotal = activeItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const newSp = activeItems.reduce((s, it) => s + it.product.sp * it.quantity, 0);
    const newTax = Math.round(
      activeItems.reduce(
        (s, it) => s + it.unitPrice * it.quantity * (it.product.gstRate / (100 + it.product.gstRate)),
        0
      )
    );
    const newGrandTotal = Math.max(0, newSubtotal - editingBill.discountTotal);

    const isSplit = editPaymentMethod === 'Split (Cash + UPI)';
    const isCredit = editPaymentMethod === 'Credit';
    const cNum = isSplit ? Number(editSplitCash) || 0 : editPaymentMethod === 'Cash' ? newGrandTotal : 0;
    const uNum = isSplit ? Number(editSplitUpi) || 0 : editPaymentMethod === 'UPI' ? newGrandTotal : 0;
    const paidAmt = isCredit ? 0 : isSplit ? cNum + uNum : newGrandTotal;
    const balDue = isCredit ? newGrandTotal : Math.max(0, newGrandTotal - paidAmt);
    const cleanMob = editCustMobile.replace(/\D/g, '').slice(-10) || editCustMobile.trim();
    const isRegApp = Boolean(findRegisteredAppCustomer(cleanMob, customers));
    const nextRegenCount = (editingBill.regeneratedCount || 0) + 1;

    const updatedBill: Invoice = {
      ...editingBill,
      customerName: editCustName.trim() || editingBill.customerName,
      customerMobile: cleanMob,
      customerAwplId: editAwplId.trim().toUpperCase() || undefined,
      isRegisteredAppCustomer: isRegApp,
      items: activeItems.map((it) => ({
        ...it,
        lineTotal: it.unitPrice * it.quantity,
        spEarned: it.product.sp * it.quantity,
        targetAwplId: editAwplId.trim().toUpperCase() || it.targetAwplId,
      })),
      subtotal: newSubtotal,
      taxTotal: newTax,
      grandTotal: newGrandTotal,
      totalSp: newSp,
      paymentMethod: editPaymentMethod,
      paymentStatus: isCredit ? 'pending' : balDue > 0 ? 'partially_paid' : editPaymentStatus,
      paymentReceivedConfirmed: !isCredit && balDue === 0,
      amountPaid: paidAmt,
      balanceDue: balDue,
      splitDetails: isSplit ? { cashAmount: cNum, upiAmount: uNum } : undefined,
      cloudSavedAt: nowTime,
      regeneratedCount: nextRegenCount,
      lastRegeneratedAt: nowTime,
    };

    const nextInvoices = invoices.map((inv) => (inv.id === updatedBill.id ? updatedBill : inv));
    onUpdateInvoices(nextInvoices);
    setStorageItem('drw_invoices_v1', nextInvoices);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Invoice Regenerated & Updated (${updatedBill.invoiceNumber} • v${nextRegenCount})`,
      category: 'Billing',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Regenerated Bill #${updatedBill.invoiceNumber}: ${activeItems.length} item(s), Total ${formatINR(
        newGrandTotal
      )} (${newSp} SP), Mode: ${editPaymentMethod}.`,
    });

    setEditingBill(null);
    setCloudBanner(
      `Invoice #${updatedBill.invoiceNumber} regenerated (v${nextRegenCount}) with ${activeItems.length} items & saved to Cloud!`
    );
    setTimeout(() => setCloudBanner(null), 4000);

    if (openPrintAfterSave) {
      setSelectedInvoice(updatedBill);
      setIsPrintModalOpen(true);
    }
  };

  const handleSaveEditedBill = (e: React.FormEvent) => {
    e.preventDefault();
    commitRegeneratedBill(false);
  };

  // Delete Bill & Save to Cloud (Requirement #4)
  const handleConfirmDeleteBill = () => {
    if (!deletingInvoice) return;
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const nextInvoices = invoices.filter((inv) => inv.id !== deletingInvoice.id);
    onUpdateInvoices(nextInvoices);
    setStorageItem('drw_invoices_v1', nextInvoices);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Bill Deleted (${deletingInvoice.invoiceNumber})`,
      category: 'Billing',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Deleted Bill #${deletingInvoice.invoiceNumber} (${deletingInvoice.customerName} • ${formatINR(
        deletingInvoice.grandTotal
      )}) and synced Cloud Backup.`,
    });

    setCloudBanner(`Bill #${deletingInvoice.invoiceNumber} deleted and Cloud Backup updated.`);
    setDeletingInvoice(null);
    setTimeout(() => setCloudBanner(null), 4000);
  };

  // Open C&F Item Sync Manager Modal
  const handleOpenCfManager = (invoice: Invoice) => {
    setManagingCfInvoice(invoice);
    const defaultBillNo =
      invoice.cfBillNumber ||
      `AWPL-CF-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const defaultIdNo =
      invoice.cfIdNumber ||
      (invoice.customerAwplId
        ? `CF-DS-${invoice.customerAwplId.slice(-4)}`
        : `CF-ID-${Math.floor(10000 + Math.random() * 90000)}`);

    setCfBillNumberInput(defaultBillNo);
    setCfIdNumberInput(defaultIdNo);

    const itemMap: {
      [key: number]: {
        cfSynced: boolean;
        cfBillNumber: string;
        cfIdNumber: string;
        cfRemarks: string;
        targetAwplId: string;
        isIdGreen: boolean;
        repurchaseSide: AWPLRepurchaseSide;
        greeningCategory: AWPLGreeningCategory;
      };
    } = {};

    invoice.items.forEach((it, idx) => {
      itemMap[idx] = {
        cfSynced: it.cfSynced ?? (invoice.cfSyncStatus === 'synced'),
        cfBillNumber: it.cfBillNumber || defaultBillNo,
        cfIdNumber: it.cfIdNumber || defaultIdNo,
        cfRemarks: it.cfRemarks || (it.cfSynced ? 'Cleared in AWPL C&F portal' : 'Pending C&F portal entry'),
        targetAwplId: it.targetAwplId || invoice.customerAwplId || '',
        isIdGreen: it.isIdGreen ?? invoice.isIdGreen ?? true,
        repurchaseSide: it.repurchaseSide || invoice.repurchaseSide || 'S.A.O',
        greeningCategory: it.greeningCategory || invoice.greeningCategory || '27 SP',
      };
    });

    setItemsCfState(itemMap);
  };

  // Toggle single item sync in modal
  const handleToggleItemSync = (idx: number) => {
    setItemsCfState((prev) => {
      const current = prev[idx] || {
        cfSynced: false,
        cfBillNumber: cfBillNumberInput,
        cfIdNumber: cfIdNumberInput,
        cfRemarks: '',
        targetAwplId: managingCfInvoice?.customerAwplId || '',
        isIdGreen: true,
        repurchaseSide: 'S.A.O' as AWPLRepurchaseSide,
        greeningCategory: '27 SP' as AWPLGreeningCategory,
      };
      const nextSync = !current.cfSynced;
      return {
        ...prev,
        [idx]: {
          ...current,
          cfSynced: nextSync,
          cfBillNumber: nextSync ? current.cfBillNumber || cfBillNumberInput : '',
          cfIdNumber: nextSync ? current.cfIdNumber || cfIdNumberInput : '',
          cfRemarks: nextSync
            ? `Updated in AWPL C&F portal (${current.targetAwplId || 'AWPL ID'} • ${current.repurchaseSide})`
            : 'Pending C&F portal entry',
        },
      };
    });
  };

  // Bulk mark all items synced
  const handleMarkAllItems = (synced: boolean) => {
    setItemsCfState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const k = Number(key);
        next[k] = {
          ...next[k],
          cfSynced: synced,
          cfBillNumber: synced ? next[k].cfBillNumber || cfBillNumberInput : '',
          cfIdNumber: synced ? next[k].cfIdNumber || cfIdNumberInput : '',
          cfRemarks: synced
            ? `Updated in AWPL C&F portal (${next[k].targetAwplId || 'AWPL ID'} • ${next[k].repurchaseSide})`
            : 'Pending C&F portal entry',
        };
      });
      return next;
    });
  };

  // Save C&F Portal changes to Invoice and persist
  const handleSaveCfStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCfInvoice) return;

    const trimmedBill = cfBillNumberInput.trim();
    const trimmedId = cfIdNumberInput.trim();
    if (!trimmedBill || !trimmedId) return;

    const updatedItems: CartItem[] = managingCfInvoice.items.map((it, idx) => {
      const itemState = itemsCfState[idx];
      const isSynced = itemState ? itemState.cfSynced : false;
      const targetId = itemState?.targetAwplId?.trim().toUpperCase() || it.targetAwplId || managingCfInvoice.customerAwplId;
      const isGreen = itemState?.isIdGreen ?? it.isIdGreen ?? managingCfInvoice.isIdGreen ?? true;
      const side: AWPLRepurchaseSide = itemState?.repurchaseSide || it.repurchaseSide || 'S.A.O';
      const greenCat: AWPLGreeningCategory = itemState?.greeningCategory || it.greeningCategory || managingCfInvoice.greeningCategory || '27 SP';

      return {
        ...it,
        targetAwplId: targetId,
        isIdGreen: isGreen,
        repurchaseSide: isGreen ? side : undefined,
        greeningCategory: !isGreen ? greenCat : undefined,
        cfSynced: isSynced,
        cfBillNumber: isSynced ? (itemState?.cfBillNumber?.trim() || trimmedBill) : undefined,
        cfIdNumber: isSynced ? (itemState?.cfIdNumber?.trim() || trimmedId) : undefined,
        cfSyncedAt: isSynced
          ? it.cfSyncedAt || new Date().toISOString().replace('T', ' ').slice(0, 16)
          : undefined,
        cfRemarks:
          itemState?.cfRemarks ||
          (isSynced
            ? `Cleared in C&F portal (${targetId} • ${isGreen ? `Side: ${side}` : `Greening: ${greenCat}`})`
            : 'Pending C&F portal entry'),
      };
    });

    const uniqueIds = Array.from(new Set(updatedItems.map((i) => i.targetAwplId).filter(Boolean)));
    const syncedItemsCount = updatedItems.filter((i) => i.cfSynced).length;
    let nextInvoiceCfStatus: CFSyncStatus = 'pending';
    if (syncedItemsCount === updatedItems.length) {
      nextInvoiceCfStatus = 'synced';
    } else if (syncedItemsCount > 0) {
      nextInvoiceCfStatus = 'partially_synced';
    }

    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === managingCfInvoice.id) {
        return {
          ...inv,
          items: updatedItems,
          awplAllocationMode: (uniqueIds.length > 1 ? 'multiple_ids' : 'same_id') as 'same_id' | 'multiple_ids',
          cfBillNumber: trimmedBill,
          cfIdNumber: trimmedId,
          cfSyncStatus: nextInvoiceCfStatus,
          cfSyncedAt: nextInvoiceCfStatus !== 'pending' ? (inv.cfSyncedAt || nowTimestamp) : undefined,
          cloudSavedAt: nowTimestamp,
          cfNotes: `AWPL C&F Portal: ${syncedItemsCount}/${updatedItems.length} items updated under Online Bill #${trimmedBill} & ID #${trimmedId} (${uniqueIds.join(', ')}).`,
        };
      }
      return inv;
    });

    onUpdateInvoices(updatedInvoices);
    setStorageItem('drw_invoices_v1', updatedInvoices);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTimestamp,
      action: `AWPL C&F Portal Update (${managingCfInvoice.invoiceNumber})`,
      category: 'C&F Portal',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Online C&F Bill No: ${trimmedBill} | C&F ID: ${trimmedId} | AWPL IDs: ${uniqueIds.join(', ')} | Status: ${nextInvoiceCfStatus.toUpperCase()}`,
    });

    setManagingCfInvoice(null);
  };

  const handleExportCSV = () => {
    const rows = filteredInvoices.map((inv) => {
      const syncedItems = inv.items.filter((it) => it.cfSynced);
      return {
        InvoiceNumber: inv.invoiceNumber,
        Date: inv.date,
        CustomerName: inv.customerName,
        CustomerMobile: inv.customerMobile,
        AWPL_ID: inv.customerAwplId || 'N/A',
        ItemsCount: inv.items.length,
        TotalSP: inv.totalSp,
        GrandTotal: inv.grandTotal,
        PaymentMethod: inv.paymentMethod,
        SplitCash: inv.splitDetails ? inv.splitDetails.cashAmount : 0,
        SplitUPI: inv.splitDetails ? inv.splitDetails.upiAmount : 0,
        BalanceDue: inv.balanceDue,
        PaymentStatus: inv.paymentStatus,
        CF_Online_Bill_Number: inv.cfBillNumber || 'N/A',
        CF_ID_Number: inv.cfIdNumber || 'N/A',
        CF_Sync_Status: (inv.cfSyncStatus || 'pending').toUpperCase(),
        CF_Items_Updated: `${syncedItems.length} of ${inv.items.length}`,
      };
    });

    exportToCSV(`DRW_Invoices_CF_Track_${new Date().toISOString().slice(0, 10)}`, rows);
  };

  // Audited Cancellation process
  const handleConfirmCancellation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingInvoice || !cancellationReason.trim()) return;

    const updated = invoices.map((inv) => {
      if (inv.id === cancellingInvoice.id) {
        return {
          ...inv,
          paymentStatus: 'cancelled' as PaymentStatus,
          cancelledAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          cancellationReason: cancellationReason.trim(),
        };
      }
      return inv;
    });

    onUpdateInvoices(updated);
    setStorageItem('drw_invoices_v1', updated);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Invoice Cancelled (${cancellingInvoice.invoiceNumber})`,
      category: 'Billing',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Reason: ${cancellationReason.trim()} | Customer: ${cancellingInvoice.customerName}`,
    });

    setCancellingInvoice(null);
    setCancellationReason('');
  };

  return (
    <div className="space-y-5">
      {/* Cloud Sync Toast */}
      {cloudBanner && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-emerald-600" />
            <span>{cloudBanner}</span>
          </div>
          <button onClick={() => setCloudBanner(null)} className="text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Invoices (Cloud Saved)
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {filteredInvoices.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
              {activeCount} Active
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filtered Sales Revenue
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {formatINR(totalRevenue)}
            </span>
            <span className="text-xs text-slate-500">Excl. cancelled</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            5-Day Overdue Credit Bills
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-red-600 dark:text-red-400">
              {credit5dCount}
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'credit_5d' ? 'all' : 'credit_5d')}
              className="text-[11px] font-bold text-red-700 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-full hover:underline"
            >
              {statusFilter === 'credit_5d' ? 'Show All' : 'Filter 5d+ Credit'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 text-emerald-600" />
            C&F Portal Clearance
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
              {cfSyncedCount}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                {cfPendingCount} Pending
              </span>
              {reminder7dCount > 0 && (
                <span className="text-[10px] font-bold text-red-700 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full">
                  {reminder7dCount} &ge;7d
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* April to March Financial Session Switcher & Preserved Cloud Session Archive Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-4 shadow-md border border-emerald-700/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                April to March Financial Session Cloud Engine
              </span>
              <span className="rounded-md bg-emerald-900/90 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                Starting Bill No: #{franchiseConfig.isDrightWellness || franchiseConfig.shortName === 'DRW' ? 3000 : franchiseConfig.startingInvoiceNumber || 1001} per Session
              </span>
              <span className="rounded-md bg-indigo-900/90 border border-indigo-400/50 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                ✓ Previous Sessions Never Deleted &amp; Fully Editable
              </span>
            </div>
            <p className="text-xs text-emerald-100">
              Active Billing Session:{' '}
              <strong className="text-amber-300 font-mono">
                {franchiseConfig.currentFinancialYear || '2026-2027'} (1st April – 31st March)
              </strong>{' '}
              • Every new session starts from{' '}
              <strong className="text-white font-mono">
                {franchiseConfig.shortName || 'DRW'}/{franchiseConfig.currentFinancialYear || '2026-2027'}/
                {franchiseConfig.isDrightWellness || franchiseConfig.shortName === 'DRW'
                  ? 3000
                  : franchiseConfig.startingInvoiceNumber || 1001}
              </strong>
              . Switch session below to view or edit previous session bills.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-bold text-emerald-300">
              Active Billing Session (Apr–Mar):
            </label>
            <select
              value={franchiseConfig.currentFinancialYear || '2026-2027'}
              onChange={(e) => handleSwitchActiveBillingSession(e.target.value)}
              className="rounded-xl bg-slate-950 border border-orange-400 px-3 py-1.5 text-xs font-mono font-black text-orange-400 cursor-pointer"
            >
              {allSessionsList.map((sess) => (
                <option key={sess} value={sess}>
                  Session {sess} (Apr {sess.split('-')[0]} – Mar {sess.split('-')[1]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clickable Session Filter Tabs (View All Sessions, Previous Session 2025-2026, Current Session 2026-2027, Next Session 2027-2028) */}
        <div className="mt-3 pt-3 border-t border-emerald-800/70 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-slate-300">
            Filter &amp; Edit Bills by Session:
          </span>
          <button
            type="button"
            onClick={() => setSessionFilter('all')}
            className={`px-3 py-1 rounded-xl font-black text-[11px] transition cursor-pointer ${
              sessionFilter === 'all'
                ? 'bg-orange-500 text-black shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Sessions ({invoices.length} Bills)
          </button>
          {allSessionsList.map((sess) => {
            const countInSess = invoices.filter((i) => getInvoiceSessionYear(i) === sess).length;
            const isPrev = sess < (franchiseConfig.currentFinancialYear || '2026-2027');
            return (
              <button
                key={sess}
                type="button"
                onClick={() => setSessionFilter(sess)}
                className={`px-3 py-1 rounded-xl font-black text-[11px] transition cursor-pointer ${
                  sessionFilter === sess
                    ? 'bg-orange-500 text-black shadow-xs'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {sess} {isPrev ? '(Previous Session • Editable)' : ''} [{countInSess} Bills]
              </button>
            );
          })}
        </div>
      </div>

      {/* Requirement #4: Dedicated Search by Bill Number + Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Dedicated Bill Number Search */}
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            <input
              type="text"
              value={billNumberSearch}
              onChange={(e) => setBillNumberSearch(e.target.value)}
              placeholder="Search Bill No (e.g. 3000)..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border-2 border-emerald-500/70 bg-emerald-50/30 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Customer Name, Mobile, AWPL ID, or Product..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="pending">Credit / Pending</option>
              <option value="credit_5d">5+ Days Credit Reminder ({credit5dCount})</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={cfFilter}
              onChange={(e) => setCfFilter(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 focus:outline-none"
            >
              <option value="all">All C&F Sync Status</option>
              <option value="synced">Online Done — Fully Synced</option>
              <option value="partially_synced">Partially Synced</option>
              <option value="pending">Pending C&F Online Sync</option>
              <option value="reminder_7d">7+ Days Pending Online Reminder ({reminder7dCount})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              saveToCloudBackup();
              setCloudBanner('All bills & ledger records saved to Cloud Backup!');
              setTimeout(() => setCloudBanner(null), 3500);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs transition cursor-pointer"
          >
            <Cloud className="h-4 w-4" />
            <span>Save All to Cloud</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const savedName = exportFilteredInvoicesRegisterPdf(
                filteredInvoices,
                franchiseConfig,
                sessionFilter === 'all' ? 'All Sessions' : `Session ${sessionFilter}`
              );
              setCloudBanner(`Exported Invoice Register PDF: ${savedName}`);
              setTimeout(() => setCloudBanner(null), 4000);
            }}
            disabled={filteredInvoices.length === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 shadow-xs transition cursor-pointer"
            title="Export Filtered Invoices as a PDF Register Report"
          >
            <FileDown className="h-4 w-4" />
            <span>Export Register PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredInvoices.length === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Invoice Records Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Invoice # & Date</th>
                <th className="py-3 px-4">Customer & App Status</th>
                <th className="py-3 px-4 text-center">Items & SP</th>
                <th className="py-3 px-4">AWPL C&F Portal Clearance</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 text-right">Bill Actions (PDF / WhatsApp / Email / Print / Edit)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-500">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-orange-400" />
                    <p className="font-black text-sm text-slate-800 dark:text-slate-200">
                      {invoices.length === 0
                        ? `No Invoices Generated Yet — Ready to Start from #${franchiseConfig.startingInvoiceNumber || 3000}`
                        : 'No invoices match your Bill Number or filter'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {invoices.length === 0
                        ? `Open POS Billing (F2) to generate your first GST tax invoice (${franchiseConfig.shortName || 'DRW'}/${franchiseConfig.invoiceYear || '2026-2027'}/${franchiseConfig.startingInvoiceNumber || 3000}) and export or share it on WhatsApp & Email as a PDF.`
                        : 'Try clearing your search query or switching the session filter above.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isCancelled = inv.paymentStatus === 'cancelled';
                  const syncedCount = inv.items.filter((it) => it.cfSynced).length;
                  const totalItems = inv.items.length;
                  const isFullySynced = inv.cfSyncStatus === 'synced' || syncedCount === totalItems;
                  const isPartiallySynced = inv.cfSyncStatus === 'partially_synced' || (syncedCount > 0 && syncedCount < totalItems);
                  const daysOld = getInvoiceDaysOld(inv.date);
                  const isPending7Days = !isFullySynced && !isCancelled && daysOld >= 7;
                  const isCreditOverdue5Days =
                    !isCancelled && (inv.paymentMethod === 'Credit' || inv.balanceDue > 0) && daysOld >= 5;
                  const isRegisteredApp = Boolean(
                    inv.isRegisteredAppCustomer ?? findRegisteredAppCustomer(inv.customerMobile, customers)
                  );
                  const waReminder7dUrl = isPending7Days
                    ? buildWhatsApp7DayReminderUrl(inv, isRegisteredApp)
                    : '';
                  const isPaymentReceived =
                    inv.paymentMethod === 'Cash' ||
                    inv.paymentReceivedConfirmed === true ||
                    (inv.paymentStatus === 'paid' && inv.balanceDue === 0);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                        isCancelled
                          ? 'opacity-60 bg-red-50/20'
                          : isCreditOverdue5Days
                          ? 'bg-amber-50/40 dark:bg-amber-950/15'
                          : isPending7Days
                          ? 'bg-red-50/30 dark:bg-red-950/10'
                          : ''
                      }`}
                    >
                      {/* Invoice & Date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {inv.invoiceNumber}
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Cloud className="h-2.5 w-2.5" />
                            Cloud
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {inv.date} ({daysOld}d ago)
                        </span>
                        {isCreditOverdue5Days && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => setCreditReminderInvoice(inv)}
                              className="inline-flex items-center gap-1 rounded bg-red-600 text-white px-2 py-0.5 text-[9px] font-black shadow-xs hover:bg-red-700"
                            >
                              <QrCode className="h-2.5 w-2.5" />
                              5-Day Credit Reminder ({formatINR(inv.balanceDue)} + QR)
                            </button>
                          </div>
                        )}
                        {isPending7Days && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="inline-flex items-center gap-0.5 rounded bg-red-600 px-1.5 py-0.2 text-[9px] font-black text-white">
                              <Bell className="h-2.5 w-2.5" />
                              {daysOld}d Pending Online
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Customer Details */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1 flex-wrap">
                          <span>{inv.customerName}</span>
                          {isRegisteredApp ? (
                            <span className="rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[9px] font-bold">
                              ✓ App Registered
                            </span>
                          ) : (
                            <span className="rounded bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 px-1.5 py-0.2 text-[9px] font-bold">
                              📲 App QR on Bill
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {inv.customerMobile}
                          {inv.customerAwplId && (
                            <span className="ml-2 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                              [{inv.customerAwplId}]
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Items & SP + Pending Product Status (Requirement #15) */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-slate-700 dark:text-slate-300">
                          {inv.items.length} {inv.items.length === 1 ? 'item' : 'items'}
                        </span>
                        <div className="mt-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                          +{inv.totalSp} SP
                        </div>
                        {inv.items.some((it) => it.isPendingProduct) && (
                          <div className="mt-1 space-y-1">
                            {inv.items
                              .filter((it) => it.isPendingProduct)
                              .map((pItem, pIdx) => {
                                const isGiven = pItem.pendingProductStatus === 'given';
                                const waArrivalUrl = buildWhatsAppPendingProductArrivalUrl(
                                  inv,
                                  pItem.product.name
                                );
                                return (
                                  <div
                                    key={pIdx}
                                    className={`rounded-lg border p-1.5 text-[9px] text-left space-y-1 ${
                                      isGiven
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                                        : 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200'
                                    }`}
                                  >
                                    <div className="font-black flex items-center justify-between gap-1">
                                      <span className="truncate">
                                        {isGiven ? '✓ GIVEN:' : '⚠ PENDING:'} {pItem.product.name}
                                      </span>
                                    </div>
                                    {!isGiven && isCFUser && (
                                      <div className="flex flex-wrap gap-1 pt-0.5">
                                        {isRegisteredApp ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                                              const nextList = invoices.map((row) =>
                                                row.id === inv.id
                                                  ? {
                                                      ...row,
                                                      items: row.items.map((ci) =>
                                                        ci.product.id === pItem.product.id
                                                          ? { ...ci, pendingArrivalNotifiedAt: nowTime }
                                                          : ci
                                                      ),
                                                    }
                                                  : row
                                              );
                                              onUpdateInvoices(nextList);
                                              setStorageItem('drw_invoices_v1', nextList);
                                              saveToCloudBackup();
                                              setCloudBanner(
                                                `Pending Product Arrival Reminder sent to Registered Customer App (+91 ${inv.customerMobile}) for ${pItem.product.name}!`
                                              );
                                              setTimeout(() => setCloudBanner(null), 4000);
                                            }}
                                            className="rounded bg-blue-600 text-white px-1.5 py-0.5 font-black hover:bg-blue-700"
                                            title="Registered on App: Send In-App Arrival Notification"
                                          >
                                            📲 Notify in App
                                          </button>
                                        ) : (
                                          <a
                                            href={waArrivalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => {
                                              const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                                              const nextList = invoices.map((row) =>
                                                row.id === inv.id
                                                  ? {
                                                      ...row,
                                                      items: row.items.map((ci) =>
                                                        ci.product.id === pItem.product.id
                                                          ? { ...ci, pendingArrivalNotifiedAt: nowTime }
                                                          : ci
                                                      ),
                                                    }
                                                  : row
                                              );
                                              onUpdateInvoices(nextList);
                                              setStorageItem('drw_invoices_v1', nextList);
                                              saveToCloudBackup();
                                            }}
                                            className="rounded bg-emerald-600 text-white px-1.5 py-0.5 font-black hover:bg-emerald-700"
                                            title="Unregistered on App: Send WhatsApp Arrival Reminder"
                                          >
                                            💬 WhatsApp Arrived
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                                            const nextList = invoices.map((row) => {
                                              if (row.id !== inv.id) return row;
                                              const nextItems = row.items.map((ci) =>
                                                ci.product.id === pItem.product.id
                                                  ? {
                                                      ...ci,
                                                      pendingProductStatus: 'given' as const,
                                                      pendingGivenAt: nowTime,
                                                    }
                                                  : ci
                                              );
                                              const stillHasPending = nextItems.some(
                                                (ci) => ci.isPendingProduct && ci.pendingProductStatus !== 'given'
                                              );
                                              return {
                                                ...row,
                                                items: nextItems,
                                                hasPendingProducts: stillHasPending,
                                              };
                                            });
                                            onUpdateInvoices(nextList);
                                            setStorageItem('drw_invoices_v1', nextList);
                                            saveToCloudBackup();
                                            setCloudBanner(
                                              `Marked "${pItem.product.name}" as GIVEN against Original Bill #${inv.invoiceNumber}!`
                                            );
                                            setTimeout(() => setCloudBanner(null), 4000);
                                          }}
                                          className="rounded bg-amber-500 text-slate-950 px-1.5 py-0.5 font-black hover:bg-amber-400"
                                        >
                                          ✓ Mark Given
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </td>

                      {/* AWPL C&F Portal Clearance Column */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isFullySynced ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                Online Done ({syncedCount}/{totalItems})
                              </span>
                            ) : isPartiallySynced ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                Partial ({syncedCount}/{totalItems})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                <Clock className="h-3 w-3" />
                                Pending Online
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenCfManager(inv)}
                              className="text-[10px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                            >
                              <Edit3 className="h-2.5 w-2.5" />
                              Online Portal
                            </button>
                          </div>

                          {inv.cfBillNumber && (
                            <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300">
                              Bill: <strong>{inv.cfBillNumber}</strong> | ID: <strong>{inv.cfIdNumber}</strong>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-black text-slate-900 dark:text-white text-sm">
                          {formatINR(inv.grandTotal)}
                        </div>
                        {inv.balanceDue > 0 && (
                          <div className="text-[10px] font-bold text-red-600">
                            Due: {formatINR(inv.balanceDue)}
                          </div>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                          {inv.paymentMethod === 'Split (Cash + UPI)' ? 'Both (Cash+UPI)' : inv.paymentMethod}
                        </span>
                        {inv.splitDetails && (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                            Cash: {formatINR(inv.splitDetails.cashAmount)} | UPI: {formatINR(inv.splitDetails.upiAmount)}
                          </div>
                        )}
                        <div className="mt-0.5">
                          <span
                            className={`inline-block rounded-full px-2 py-0.2 text-[9px] font-bold uppercase ${
                              inv.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : inv.paymentStatus === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {inv.paymentStatus}
                          </span>
                        </div>
                      </td>

                      {/* Actions: Print Bill (Payment-Gated), Update Bill, Delete Bill */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isCreditOverdue5Days && (
                            <button
                              type="button"
                              onClick={() => setCreditReminderInvoice(inv)}
                              className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-2 py-1 text-[10px] font-black text-slate-950 shadow-xs transition"
                              title="Send 5-Day Credit Payment Reminder with Amount & QR"
                            >
                              <QrCode className="h-3 w-3" />
                              <span>5d Pay QR</span>
                            </button>
                          )}

                          {isPending7Days && (
                            <a
                              href={waReminder7dUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2 py-1 text-[10px] font-black text-white shadow-xs transition"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>7d WA</span>
                            </a>
                          )}

                          {/* 1-Click Download PDF Invoice */}
                          <button
                            type="button"
                            onClick={() => {
                              const savedPdf = downloadInvoicePdf(inv, franchiseConfig, 'a4');
                              setCloudBanner(
                                `Exported PDF Invoice: ${savedPdf} (${inv.customerName})`
                              );
                              setTimeout(() => setCloudBanner(null), 4000);
                              onAddAuditLog({
                                id: `log-${Date.now()}`,
                                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
                                action: `Invoice PDF Exported (${inv.invoiceNumber})`,
                                category: 'Billing',
                                user: `${currentUserName} (${currentUserRole})`,
                                details: `Downloaded PDF receipt ${savedPdf} for ${inv.customerName}.`,
                              });
                            }}
                            className="flex items-center gap-1 rounded-lg bg-orange-500 hover:bg-orange-600 px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition cursor-pointer"
                            title="Download Professionally Formatted A4 PDF Invoice"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </button>

                          {/* 1-Click Share PDF on WhatsApp */}
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await shareInvoicePdfOnWhatsApp(inv, franchiseConfig, 'a4', false);
                              setCloudBanner(
                                res.method === 'native_file_share'
                                  ? `Shared ${res.filename} directly on WhatsApp!`
                                  : `Downloaded ${res.filename} & opened WhatsApp chat (+91 ${inv.customerMobile})!`
                              );
                              setTimeout(() => setCloudBanner(null), 4500);
                              onAddAuditLog({
                                id: `log-${Date.now()}`,
                                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
                                action: `Invoice PDF Shared on WhatsApp (${inv.invoiceNumber})`,
                                category: 'Billing',
                                user: `${currentUserName} (${currentUserRole})`,
                                details: `Shared PDF (${res.filename}) on WhatsApp to +91 ${inv.customerMobile}.`,
                              });
                            }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-black text-white shadow-xs transition cursor-pointer"
                            title="Share PDF Invoice on WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>WA PDF</span>
                          </button>

                          {/* Email / Share PDF Hub Modal */}
                          <button
                            type="button"
                            onClick={() => setPdfShareInvoice(inv)}
                            className="flex items-center gap-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-300 px-2 py-1 text-[11px] font-bold text-orange-800 transition cursor-pointer"
                            title="Email PDF Receipt, Choose Thermal/A4 PDF, or Share on WhatsApp"
                          >
                            <Mail className="h-3 w-3 text-orange-600" />
                            <span>Email / Share</span>
                          </button>

                          {/* Requirement #4: Print Bill (Immediate if Cash/Paid; confirms payment first if pending UPI/Credit) */}
                          <button
                            onClick={() => handleOpenPrint(inv)}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                              isPaymentReceived
                                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                                : 'bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200'
                            }`}
                            title={
                              isPaymentReceived
                                ? 'Payment Received — Print Bill Now'
                                : 'Receive Payment first to unlock Print Bill'
                            }
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>{isPaymentReceived ? 'Print' : 'Receive Pay & Print'}</span>
                          </button>

                          {/* Requirement #4: Update Bill */}
                          {isCFUser && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditBill(inv)}
                              className="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition"
                              title="Update / Edit Bill"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Update</span>
                            </button>
                          )}

                          {/* Requirement #4: Delete Bill */}
                          {isCFUser && (
                            <button
                              type="button"
                              onClick={() => setDeletingInvoice(inv)}
                              className="flex items-center gap-1 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2 py-1 text-[11px] font-bold text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white transition"
                              title="Delete Bill & Update Cloud"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requirement #3: 5-Day Credit Payment Reminder Modal (with Payment Amount + UPI QR Code) */}
      {creditReminderInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <span className="rounded bg-red-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                  5-Day Credit Payment Reminder
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Bill #{creditReminderInvoice.invoiceNumber} — Payment Due
                </h3>
              </div>
              <button
                onClick={() => setCreditReminderInvoice(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>

            {(() => {
              const dueAmount = creditReminderInvoice.balanceDue || creditReminderInvoice.grandTotal;
              const qrUrl = getCnfUpiQrImageSrc(
                franchiseConfig,
                dueAmount,
                `Credit Bill ${creditReminderInvoice.invoiceNumber}`,
                200
              );
              const waUrl = buildWhatsApp5DayCreditReminderUrl(creditReminderInvoice, franchiseConfig);

              return (
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 border border-red-200 dark:border-red-800">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Customer: {creditReminderInvoice.customerName} (+91 {creditReminderInvoice.customerMobile})
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                      Goods taken on Credit <strong>{getInvoiceDaysOld(creditReminderInvoice.date)} days ago</strong> ({creditReminderInvoice.date}).
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border-2 border-emerald-500 text-center">
                    <img
                      src={qrUrl}
                      alt="Credit Payment QR"
                      className="h-40 w-40 rounded-xl bg-white p-2 border border-slate-200 shadow"
                    />
                    <p className="mt-2.5 text-lg font-black text-emerald-800 dark:text-emerald-300">
                      Payment Amount Due: {formatINR(dueAmount)}
                    </p>
                    <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      Scan QR to Pay via UPI: {franchiseConfig.bankUpiId}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-center flex items-center justify-center gap-1.5 shadow"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>Send Amount & QR on WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const inv = creditReminderInvoice;
                        setCreditReminderInvoice(null);
                        handleOpenPrint(inv);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
                    >
                      Mark Paid & Print
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Requirement #4: Payment-Gated Print Bill Modal */}
      {pendingPaymentPrintInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase">
                  Payment Required Before Printing
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Receive Payment for Bill #{pendingPaymentPrintInv.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setPendingPaymentPrintInv(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-300">
              Print Bill is unlocked immediately for Cash or once UPI/Credit payment ({formatINR(pendingPaymentPrintInv.grandTotal)}) is received:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'UPI', 'Split (Cash + UPI)'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setConfirmPayMode(m)}
                  className={`py-2 px-2 rounded-xl font-bold border ${
                    confirmPayMode === m
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {m === 'Split (Cash + UPI)' ? 'Both (Cash+UPI)' : m}
                </button>
              ))}
            </div>

            {confirmPayMode === 'Split (Cash + UPI)' && (
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="font-bold block mb-1">Cash Amount (₹)</label>
                  <input
                    type="number"
                    value={confirmSplitCash}
                    onChange={(e) => {
                      setConfirmSplitCash(e.target.value);
                      const c = Number(e.target.value) || 0;
                      setConfirmSplitUpi(String(Math.max(0, pendingPaymentPrintInv.grandTotal - c)));
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">UPI Amount (₹)</label>
                  <input
                    type="number"
                    value={confirmSplitUpi}
                    onChange={(e) => setConfirmSplitUpi(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 p-1.5 font-bold bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingPaymentPrintInv(null)}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPaymentAndPrint}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Payment Received — Save & Print Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement #3 (New): Update / Regenerate Invoice Modal (Add More Items, Reduce or Increase Item Quantity) */}
      {editingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs my-auto">
            <div className="flex items-start justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                    Requirement #3 • Update & Regenerate Invoice
                  </span>
                  {editingBill.regeneratedCount ? (
                    <span className="rounded bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-bold">
                      Previously Regenerated {editingBill.regeneratedCount}x
                    </span>
                  ) : null}
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  Update / Regenerate Bill #{editingBill.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Add more products from catalog, increase or reduce item quantities, remove items, and regenerate the bill.
                </p>
              </div>
              <button
                onClick={() => setEditingBill(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveEditedBill} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={editCustName}
                    onChange={(e) => setEditCustName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={editCustMobile}
                    onChange={(e) => setEditCustMobile(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">AWPL ID</label>
                  <input
                    type="text"
                    value={editAwplId}
                    onChange={(e) => setEditAwplId(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
              </div>

              {/* Add More Items to Regenerated Bill */}
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-emerald-700" />
                    <span>Add More Items to This Bill (Search AWPL Catalog)</span>
                  </label>
                  <div className="flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 p-0.5 border border-emerald-300 dark:border-emerald-700 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setRegenPriceMode('dp')}
                      className={`px-2 py-0.5 rounded ${
                        regenPriceMode === 'dp' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                      }`}
                    >
                      Add at DP Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegenPriceMode('mrp')}
                      className={`px-2 py-0.5 rounded ${
                        regenPriceMode === 'mrp' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                      }`}
                    >
                      Add at MRP Rate
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={regenProductSearch}
                    onChange={(e) => setRegenProductSearch(e.target.value)}
                    placeholder="Type product name, SKU, or category to add to this invoice..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pt-1">
                  {products
                    .filter((p) => {
                      const q = regenProductSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.sku.toLowerCase().includes(q) ||
                        p.category.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 12)
                    .map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddProductToRegenBill(prod)}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-left transition"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                            {prod.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {regenPriceMode.toUpperCase()}: {formatINR(regenPriceMode === 'dp' ? prod.dp : prod.mrp)} • {prod.sp} SP
                          </p>
                        </div>
                        <span className="rounded-lg bg-emerald-700 text-white px-2 py-1 text-[10px] font-black shrink-0">
                          + Add
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Editable Items List with - / + Qty & Remove */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-800 dark:text-slate-200">
                    Current Bill Items ({editItems.length}) — Increase / Reduce Quantity or Remove
                  </label>
                  <span className="font-black text-emerald-700 dark:text-emerald-400">
                    New Regenerated Total:{' '}
                    {formatINR(
                      Math.max(
                        0,
                        editItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) -
                          editingBill.discountTotal
                      )
                    )}{' '}
                    ({editItems.reduce((s, i) => s + i.product.sp * i.quantity, 0)} SP)
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {editItems.map((it, idx) => (
                    <div
                      key={`${it.product.id}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white">{it.product.name}</p>
                        <p className="text-[10px] text-slate-500">
                          SKU: {it.product.sku} • Rate: {formatINR(it.unitPrice)} ({it.selectedPriceType.toUpperCase()}) •{' '}
                          {it.product.sp * it.quantity} SP
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((prev) =>
                              prev
                                .map((row, rIdx) =>
                                  rIdx === idx ? { ...row, quantity: row.quantity - 1 } : row
                                )
                                .filter((row) => row.quantity > 0)
                            );
                          }}
                          className="h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Reduce Quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => {
                            const q = Math.max(1, Number(e.target.value) || 1);
                            setEditItems((prev) =>
                              prev.map((row, rIdx) => (rIdx === idx ? { ...row, quantity: q } : row))
                            );
                          }}
                          className="w-14 rounded-lg border border-slate-300 dark:border-slate-700 p-1 text-center font-black bg-white dark:bg-slate-800"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((prev) =>
                              prev.map((row, rIdx) =>
                                rIdx === idx ? { ...row, quantity: row.quantity + 1 } : row
                              )
                            );
                          }}
                          className="h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Increase Quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>

                        <span className="font-black w-20 text-right text-slate-900 dark:text-white">
                          {formatINR(it.unitPrice * it.quantity)}
                        </span>

                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                            }
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Remove Item from Bill"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Mode: Cash, UPI, Both (Cash + UPI), Credit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Payment Mode (Cash / UPI / Both / Credit)
                  </label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-bold bg-white dark:bg-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Split (Cash + UPI)">Both (Cash + UPI)</option>
                    <option value="Credit">Credit</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Payment Status</label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value as PaymentStatus)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-bold bg-white dark:bg-slate-800"
                  >
                    <option value="paid">Paid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="pending">Pending (Credit)</option>
                  </select>
                </div>
              </div>

              {editPaymentMethod === 'Split (Cash + UPI)' && (
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 p-3 border border-emerald-300 dark:border-emerald-800">
                  <div>
                    <label className="font-bold text-emerald-900 dark:text-emerald-300">
                      How Much in Cash (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editSplitCash}
                      onChange={(e) => setEditSplitCash(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 font-black bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-emerald-900 dark:text-emerald-300">
                      How Much in UPI (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editSplitUpi}
                      onChange={(e) => setEditSplitUpi(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 font-black bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow flex items-center gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Regenerate & Save Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => commitRegeneratedBill(true)}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Regenerate & Print Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requirement #4: Delete Bill Confirmation Modal */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-red-600">
              <Trash2 className="h-6 w-6" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Bill #{deletingInvoice.invoiceNumber}?
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete Bill <strong>#{deletingInvoice.invoiceNumber}</strong> ({deletingInvoice.customerName} • {formatINR(deletingInvoice.grandTotal)})? This change will immediately sync to Cloud Backup.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingInvoice(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBill}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow"
              >
                Confirm Delete Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C&F Portal Item-by-Item Tracking & Update Modal */}
      {managingCfInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    AWPL C&F Portal Item Synchronization & Multi-ID Mapping
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
                      {managingCfInvoice.invoiceNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customer: <strong className="text-slate-800 dark:text-slate-200">{managingCfInvoice.customerName}</strong> ({managingCfInvoice.customerMobile})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setManagingCfInvoice(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveCfStatus} className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Official AWPL C&F Portal Credentials (Online Invoice Bill & ID Number)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newBill = `AWPL-CF-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                      setCfBillNumberInput(newBill);
                    }}
                    className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Auto-Generate Online Bill #
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Online C&F Bill Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={cfBillNumberInput}
                      onChange={(e) => setCfBillNumberInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Online C&F ID Number / Distributor Reference *
                    </label>
                    <input
                      type="text"
                      required
                      value={cfIdNumberInput}
                      onChange={(e) => setCfIdNumberInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Invoice Items — AWPL ID Allocation & Online C&F Status
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMarkAllItems(true)}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"
                    >
                      ✓ Select All Synced
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkAllItems(false)}
                      className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg"
                    >
                      Mark All Pending
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 text-center">Online Done</th>
                        <th className="py-2.5 px-3">Product Name & Qty</th>
                        <th className="py-2.5 px-3">Target AWPL ID</th>
                        <th className="py-2.5 px-3">Online C&F Bill # & ID #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {managingCfInvoice.items.map((it, idx) => {
                        const itemState = itemsCfState[idx] || {
                          cfSynced: false,
                          cfBillNumber: cfBillNumberInput,
                          cfIdNumber: cfIdNumberInput,
                          cfRemarks: '',
                          targetAwplId: it.targetAwplId || managingCfInvoice.customerAwplId || '',
                          isIdGreen: true,
                          repurchaseSide: 'S.A.O' as AWPLRepurchaseSide,
                          greeningCategory: '27 SP' as AWPLGreeningCategory,
                        };

                        return (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={itemState.cfSynced}
                                onChange={() => handleToggleItemSync(idx)}
                                className="h-4 w-4 rounded text-emerald-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-900 dark:text-white">{it.product.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                Qty: {it.quantity} • {it.spEarned} SP • {formatINR(it.lineTotal)}
                              </p>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={itemState.targetAwplId}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setItemsCfState((prev) => ({
                                    ...prev,
                                    [idx]: { ...prev[idx], targetAwplId: val },
                                  }));
                                }}
                                className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-[11px] font-bold"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="text"
                                  value={itemState.cfBillNumber}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItemsCfState((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], cfBillNumber: val },
                                    }));
                                  }}
                                  placeholder="Online C&F Bill #"
                                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-[10px]"
                                />
                                <input
                                  type="text"
                                  value={itemState.cfIdNumber}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItemsCfState((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], cfIdNumber: val },
                                    }));
                                  }}
                                  placeholder="Online C&F ID #"
                                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-[10px]"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setManagingCfInvoice(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow"
                >
                  <Check className="h-4 w-4" />
                  <span>Save & Sync Cloud</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print & Share Modal */}
      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        invoice={selectedInvoice}
        franchiseConfig={franchiseConfig}
        onUpdateConfig={onUpdateConfig}
      />

      {/* Invoice PDF Export, Email & WhatsApp Share Hub Modal */}
      <InvoicePdfShareModal
        isOpen={Boolean(pdfShareInvoice)}
        onClose={() => setPdfShareInvoice(null)}
        invoice={pdfShareInvoice}
        franchiseConfig={franchiseConfig}
        customers={customers}
        onOpenPrintModal={(inv) => handleOpenPrint(inv)}
        onActionLogged={(actionTitle, details) => {
          onAddAuditLog({
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            action: actionTitle,
            category: 'Billing',
            user: `${currentUserName} (${currentUserRole})`,
            details,
          });
        }}
      />
    </div>
  );
};
