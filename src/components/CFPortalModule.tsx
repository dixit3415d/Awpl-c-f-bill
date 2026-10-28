import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Send,
  KeyRound,
  Download,
  ExternalLink,
  RefreshCw,
  Lock,
  UserCheck,
  AlertTriangle,
  FileSpreadsheet,
  Package,
  Layers,
  Edit3,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  BellRing,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import { CFBillRecord, AuditLog, Role, Invoice, CartItem, CFSyncStatus, AWPLProduct, AWPLRepurchaseSide, AWPLGreeningCategory, Customer } from '../types';
import {
  exportToCSV,
  formatINR,
  setStorageItem,
  saveToCloudBackup,
  getInvoiceDaysOld,
  findRegisteredAppCustomer,
  buildWhatsApp7DayReminderUrl,
  buildWhatsAppPendingProductArrivalUrl
} from '../utils/storage';

interface CFPortalModuleProps {
  cfRecords: CFBillRecord[];
  invoices: Invoice[];
  customers?: Customer[];
  currentUserRole: Role;
  currentUserName: string;
  onUpdateCFRecords: (records: CFBillRecord[]) => void;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onAddAuditLog: (log: AuditLog) => void;
}

interface FlattenedCFItem {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  daysOld: number;
  customerName: string;
  customerMobile: string;
  customerAwplId?: string;
  selectedCfDepotName?: string;
  isMultiIdInvoice: boolean;
  distinctInvoiceIds: string[];
  itemIndex: number;
  product: AWPLProduct;
  quantity: number;
  lineTotal: number;
  spEarned: number;
  targetAwplId?: string;
  targetAwplHolderName?: string;
  isIdGreen?: boolean;
  repurchaseSide?: AWPLRepurchaseSide;
  greeningCategory?: AWPLGreeningCategory;
  cfSynced: boolean;
  cfBillNumber?: string;
  cfIdNumber?: string;
  cfSyncedAt?: string;
  cfRemarks?: string;
  reminder7DaySentAt?: string;
  isRegisteredAppCustomer?: boolean;
  whatsappReminderUrl: string;
  isPendingProduct?: boolean;
  pendingProductStatus?: 'pending' | 'given';
  pendingGivenAt?: string;
  pendingArrivalNotifiedAt?: string;
  whatsappPendingArrivalUrl: string;
}

export const CFPortalModule: React.FC<CFPortalModuleProps> = ({
  cfRecords,
  invoices,
  customers = [],
  currentUserRole,
  currentUserName,
  onUpdateCFRecords,
  onUpdateInvoices,
  onAddAuditLog,
}) => {
  // Main Module Tab: 'invoice_items' or 'assistance_requests'
  const [activeSubTab, setActiveSubTab] = useState<'invoice_items' | 'assistance_requests'>('invoice_items');

  // Search & Filter state for Invoice Items
  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | 'synced' | 'pending' | 'overdue_7d' | 'pending_products'>('all');

  // Modal for editing a single item's C&F Bill / ID + Target AWPL ID + Green S.A.O / S.G.O
  const [editingItem, setEditingItem] = useState<FlattenedCFItem | null>(null);
  const [editTargetAwplId, setEditTargetAwplId] = useState('');
  const [editIsIdGreen, setEditIsIdGreen] = useState(true);
  const [editRepurchaseSide, setEditRepurchaseSide] = useState<AWPLRepurchaseSide>('S.A.O');
  const [editGreeningCategory, setEditGreeningCategory] = useState<AWPLGreeningCategory>('27 SP');
  const [editBillNumber, setEditBillNumber] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editSynced, setEditSynced] = useState(true);
  const [editRemarks, setEditRemarks] = useState('');
  const [reminderSentBanner, setReminderSentBanner] = useState<string | null>(null);

  // Assistance requests states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<CFBillRecord | null>(null);

  // New Request Submission Modal
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [reqAwplId, setReqAwplId] = useState('');
  const [reqCustomerName, setReqCustomerName] = useState('');
  const [reqMobile, setReqMobile] = useState('');
  const [reqOrderSummary, setReqOrderSummary] = useState('');
  const [reqSp, setReqSp] = useState<number>(27);
  const [reqAmount, setReqAmount] = useState<number>(2292);
  const [reqRemarks, setReqRemarks] = useState('');

  // OTP Verification Simulation
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  // Portal Submission Progress state
  const [submittingToPortal, setSubmittingToPortal] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    success: boolean;
    reference: string;
    message: string;
  } | null>(null);

  // Authorized Integration Gateway Status
  const [gatewayStatus] = useState<{
    connected: boolean;
    mode: 'Authorized C&F Semi-Automated Bridge' | 'Direct API Gateway';
    lastHeartbeat: string;
    branchId: string;
  }>({
    connected: true,
    mode: 'Authorized C&F Semi-Automated Bridge',
    lastHeartbeat: '2026-10-25 11:30 IST',
    branchId: 'SOL-CF-HP-01 (Solan Regional Depot Hub)',
  });

  // Flatten all items across invoices for granular C&F tracking
  const allInvoiceItems = useMemo<FlattenedCFItem[]>(() => {
    const list: FlattenedCFItem[] = [];
    invoices.forEach((inv) => {
      const daysOld = getInvoiceDaysOld(inv.date);
      const isReg = Boolean(
        inv.isRegisteredAppCustomer ?? findRegisteredAppCustomer(inv.customerMobile, customers)
      );
      const waUrl = buildWhatsApp7DayReminderUrl(inv, isReg);
      const distinctIds = Array.from(
        new Set(inv.items.map((i) => i.targetAwplId || inv.customerAwplId).filter(Boolean))
      ) as string[];
      const isMulti = distinctIds.length > 1 || inv.awplAllocationMode === 'multiple_ids';

      inv.items.forEach((it, idx) => {
        list.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.date,
          daysOld,
          customerName: inv.customerName,
          customerMobile: inv.customerMobile,
          customerAwplId: inv.customerAwplId,
          selectedCfDepotName: inv.selectedCfDepotName || 'D RIGHT WELLNESS — Solan Regional C&F Depot Hub (HP)',
          isMultiIdInvoice: isMulti,
          distinctInvoiceIds: distinctIds,
          itemIndex: idx,
          product: it.product,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
          spEarned: it.spEarned,
          targetAwplId: it.targetAwplId || inv.customerAwplId,
          targetAwplHolderName: it.targetAwplHolderName,
          isIdGreen: it.isIdGreen ?? inv.isIdGreen ?? true,
          repurchaseSide: it.repurchaseSide || inv.repurchaseSide || 'S.A.O',
          greeningCategory: it.greeningCategory || inv.greeningCategory || '27 SP',
          cfSynced: Boolean(it.cfSynced),
          cfBillNumber: it.cfBillNumber || inv.cfBillNumber,
          cfIdNumber: it.cfIdNumber || inv.cfIdNumber,
          cfSyncedAt: it.cfSyncedAt || inv.cfSyncedAt,
          cfRemarks: it.cfRemarks,
          reminder7DaySentAt: inv.reminder7DaySentAt,
          isRegisteredAppCustomer: isReg,
          whatsappReminderUrl: waUrl,
          isPendingProduct: Boolean(it.isPendingProduct),
          pendingProductStatus: it.pendingProductStatus,
          pendingGivenAt: it.pendingGivenAt,
          pendingArrivalNotifiedAt: it.pendingArrivalNotifiedAt,
          whatsappPendingArrivalUrl: buildWhatsAppPendingProductArrivalUrl(inv, it.product.name),
        });
      });
    });
    return list;
  }, [invoices, customers]);

  // Filtered invoice items
  const filteredInvoiceItems = useMemo(() => {
    return allInvoiceItems.filter((item) => {
      const q = itemSearch.toLowerCase();
      const matchSearch =
        item.invoiceNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.customerMobile.includes(q) ||
        (item.customerAwplId && item.customerAwplId.toLowerCase().includes(q)) ||
        (item.targetAwplId && item.targetAwplId.toLowerCase().includes(q)) ||
        item.product.name.toLowerCase().includes(q) ||
        item.product.sku.toLowerCase().includes(q) ||
        (item.cfBillNumber && item.cfBillNumber.toLowerCase().includes(q)) ||
        (item.cfIdNumber && item.cfIdNumber.toLowerCase().includes(q));

      const matchStatus =
        itemStatusFilter === 'all' ||
        (itemStatusFilter === 'synced'
          ? item.cfSynced
          : itemStatusFilter === 'pending'
          ? !item.cfSynced
          : itemStatusFilter === 'pending_products'
          ? Boolean(item.isPendingProduct)
          : !item.cfSynced && item.daysOld >= 7);

      return matchSearch && matchStatus;
    });
  }, [allInvoiceItems, itemSearch, itemStatusFilter]);

  // Invoice Items Statistics
  const totalItemCount = allInvoiceItems.length;
  const syncedItemCount = allInvoiceItems.filter((i) => i.cfSynced).length;
  const pendingItemCount = totalItemCount - syncedItemCount;
  const overdue7dCount = allInvoiceItems.filter((i) => !i.cfSynced && i.daysOld >= 7).length;
  const pendingProductsCount = allInvoiceItems.filter(
    (i) => i.isPendingProduct && i.pendingProductStatus !== 'given'
  ).length;
  const syncedSpPoints = allInvoiceItems
    .filter((i) => i.cfSynced)
    .reduce((sum, i) => sum + i.spEarned, 0);

  // Send 7-Day Pending Online Update Reminder to Customer (WhatsApp + In-App if Registered)
  const handleSend7DayReminder = (item: FlattenedCFItem) => {
    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const updatedInvoices = invoices.map((inv) =>
      inv.id === item.invoiceId
        ? {
            ...inv,
            reminder7DaySentAt: nowTimestamp,
            autoWhatsappQueuedAt: nowTimestamp,
            isRegisteredAppCustomer: item.isRegisteredAppCustomer,
            autoInAppNotifiedAt: item.isRegisteredAppCustomer ? nowTimestamp : undefined,
          }
        : inv
    );
    onUpdateInvoices(updatedInvoices);
    setStorageItem('drw_invoices_v1', updatedInvoices);

    setReminderSentBanner(
      `7-Day Pending Bill Notification dispatched via WhatsApp${
        item.isRegisteredAppCustomer ? ' & In-App (Registered Number)' : ''
      } to ${item.customerName} (+91 ${item.customerMobile}) for Invoice #${item.invoiceNumber} (${
        item.daysOld
      } days pending).`
    );

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTimestamp,
      action: `7-Day Pending Online Reminder Dispatched (${item.invoiceNumber})`,
      category: 'C&F Portal',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Notified ${item.customerName} (+91 ${item.customerMobile}) via WhatsApp${
        item.isRegisteredAppCustomer ? ' + In-App Alert' : ''
      } that ${item.product.name} on AWPL ID ${item.targetAwplId || 'Pending'} is pending online update (${
        item.daysOld
      } days).`,
    });
  };

  // Quick toggle item sync directly from table
  const handleToggleSingleItemSync = (item: FlattenedCFItem) => {
    const nextSync = !item.cfSynced;
    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const targetInvoice = invoices.find((inv) => inv.id === item.invoiceId);
    if (!targetInvoice) return;

    const defaultBill =
      item.cfBillNumber ||
      targetInvoice.cfBillNumber ||
      `AWPL-CF-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const defaultId =
      item.cfIdNumber ||
      targetInvoice.cfIdNumber ||
      (item.targetAwplId
        ? `CF-DS-${item.targetAwplId.slice(-4)}`
        : `CF-ID-${Math.floor(10000 + Math.random() * 90000)}`);

    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === item.invoiceId) {
        const updatedItems = inv.items.map((it, idx) => {
          if (idx === item.itemIndex) {
            return {
              ...it,
              cfSynced: nextSync,
              cfBillNumber: nextSync ? defaultBill : undefined,
              cfIdNumber: nextSync ? defaultId : undefined,
              cfSyncedAt: nextSync ? nowTimestamp : undefined,
              cfRemarks: nextSync
                ? `Online Done on ${it.targetAwplId || inv.customerAwplId || 'AWPL ID'} (${it.isIdGreen !== false ? `Green • ${it.repurchaseSide || 'S.A.O'}` : 'New ID'})`
                : 'Pending C&F online entry',
            };
          }
          return it;
        });

        const syncedCount = updatedItems.filter((i) => i.cfSynced).length;
        let cfStatus: CFSyncStatus = 'pending';
        if (syncedCount === updatedItems.length) {
          cfStatus = 'synced';
        } else if (syncedCount > 0) {
          cfStatus = 'partially_synced';
        }

        return {
          ...inv,
          items: updatedItems,
          cfBillNumber: inv.cfBillNumber || (nextSync ? defaultBill : undefined),
          cfIdNumber: inv.cfIdNumber || (nextSync ? defaultId : undefined),
          cfSyncStatus: cfStatus,
          cfSyncedAt: nextSync ? nowTimestamp : inv.cfSyncedAt,
        };
      }
      return inv;
    });

    onUpdateInvoices(updatedInvoices);
    setStorageItem('drw_invoices_v1', updatedInvoices);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTimestamp,
      action: `C&F Item Online Status: ${item.product.name}`,
      category: 'C&F Portal',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Invoice: ${item.invoiceNumber} | AWPL ID: ${item.targetAwplId || 'N/A'} (${item.repurchaseSide || 'S.A.O'}) | Online Done: ${nextSync ? 'YES' : 'NO'} | Online Bill: ${defaultBill} | C&F ID: ${defaultId}`,
    });
  };

  // Open item editor modal
  const handleOpenItemEditor = (item: FlattenedCFItem) => {
    setEditingItem(item);
    const targetInvoice = invoices.find((inv) => inv.id === item.invoiceId);
    setEditTargetAwplId(item.targetAwplId || item.customerAwplId || 'AWPL782910');
    setEditIsIdGreen(item.isIdGreen ?? true);
    setEditRepurchaseSide(item.repurchaseSide || 'S.A.O');
    setEditGreeningCategory(item.greeningCategory || '27 SP');
    setEditBillNumber(
      item.cfBillNumber ||
        targetInvoice?.cfBillNumber ||
        `AWPL-CF-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    );
    setEditIdNumber(
      item.cfIdNumber ||
        targetInvoice?.cfIdNumber ||
        (item.targetAwplId ? `CF-DS-${item.targetAwplId.slice(-4)}` : `CF-ID-${Math.floor(10000 + Math.random() * 90000)}`)
    );
    setEditSynced(item.cfSynced);
    setEditRemarks(item.cfRemarks || (item.cfSynced ? 'Online Done in AWPL C&F portal' : ''));
  };

  // Save item editor modal
  const handleSaveItemEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const trimmedBill = editBillNumber.trim();
    const trimmedId = editIdNumber.trim();
    const trimmedAwplId = editTargetAwplId.trim().toUpperCase();
    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === editingItem.invoiceId) {
        const updatedItems = inv.items.map((it, idx) => {
          if (idx === editingItem.itemIndex) {
            return {
              ...it,
              targetAwplId: trimmedAwplId,
              isIdGreen: editIsIdGreen,
              repurchaseSide: editIsIdGreen ? editRepurchaseSide : undefined,
              greeningCategory: !editIsIdGreen ? editGreeningCategory : undefined,
              cfSynced: editSynced,
              cfBillNumber: editSynced ? trimmedBill : undefined,
              cfIdNumber: editSynced ? trimmedId : undefined,
              cfSyncedAt: editSynced ? nowTimestamp : undefined,
              cfRemarks:
                editRemarks ||
                `Online ${editSynced ? 'Done' : 'Pending'} on ${trimmedAwplId} (${
                  editIsIdGreen ? `Green ID • ${editRepurchaseSide}` : `Greening: ${editGreeningCategory}`
                })`,
            };
          }
          return it;
        });

        const syncedCount = updatedItems.filter((i) => i.cfSynced).length;
        let cfStatus: CFSyncStatus = 'pending';
        if (syncedCount === updatedItems.length) {
          cfStatus = 'synced';
        } else if (syncedCount > 0) {
          cfStatus = 'partially_synced';
        }

        return {
          ...inv,
          items: updatedItems,
          cfBillNumber: inv.cfBillNumber || (editSynced ? trimmedBill : undefined),
          cfIdNumber: inv.cfIdNumber || (editSynced ? trimmedId : undefined),
          cfSyncStatus: cfStatus,
          cfSyncedAt: editSynced ? (inv.cfSyncedAt || nowTimestamp) : inv.cfSyncedAt,
        };
      }
      return inv;
    });

    onUpdateInvoices(updatedInvoices);
    setStorageItem('drw_invoices_v1', updatedInvoices);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTimestamp,
      action: `AWPL C&F Online Item Updated: ${editingItem.product.name}`,
      category: 'C&F Portal',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Invoice: ${editingItem.invoiceNumber} | Target AWPL ID: ${trimmedAwplId} (${editIsIdGreen ? editRepurchaseSide : 'New'}) | Online Bill: ${trimmedBill} | C&F ID: ${trimmedId} | Online Done: ${editSynced}`,
    });

    setEditingItem(null);
  };

  // Bulk mark all filtered items synced
  const handleBulkSyncFilteredItems = () => {
    if (filteredInvoiceItems.length === 0) return;
    const confirm = window.confirm(
      `Mark all ${filteredInvoiceItems.length} currently filtered items as UPDATED in AWPL C&F portal with generated Solan C&F Bill Numbers?`
    );
    if (!confirm) return;

    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const itemLookup = new Set(filteredInvoiceItems.map((i) => `${i.invoiceId}_${i.itemIndex}`));

    const updatedInvoices = invoices.map((inv) => {
      let modified = false;
      const targetBill =
        inv.cfBillNumber ||
        `AWPL-CF-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const targetId =
        inv.cfIdNumber ||
        (inv.customerAwplId ? `CF-DS-${inv.customerAwplId.slice(-4)}` : `CF-ID-${Math.floor(10000 + Math.random() * 90000)}`);

      const updatedItems = inv.items.map((it, idx) => {
        if (itemLookup.has(`${inv.id}_${idx}`)) {
          modified = true;
          return {
            ...it,
            cfSynced: true,
            cfBillNumber: it.cfBillNumber || targetBill,
            cfIdNumber: it.cfIdNumber || targetId,
            cfSyncedAt: it.cfSyncedAt || nowTimestamp,
            cfRemarks: 'Bulk updated in Solan C&F portal',
          };
        }
        return it;
      });

      if (modified) {
        const syncedCount = updatedItems.filter((i) => i.cfSynced).length;
        let cfStatus: CFSyncStatus = 'pending';
        if (syncedCount === updatedItems.length) {
          cfStatus = 'synced';
        } else if (syncedCount > 0) {
          cfStatus = 'partially_synced';
        }

        return {
          ...inv,
          items: updatedItems,
          cfBillNumber: inv.cfBillNumber || targetBill,
          cfIdNumber: inv.cfIdNumber || targetId,
          cfSyncStatus: cfStatus,
          cfSyncedAt: inv.cfSyncedAt || nowTimestamp,
        };
      }
      return inv;
    });

    onUpdateInvoices(updatedInvoices);
    setStorageItem('drw_invoices_v1', updatedInvoices);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTimestamp,
      action: `Bulk AWPL C&F Portal Update`,
      category: 'C&F Portal',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Bulk marked ${filteredInvoiceItems.length} items as updated in AWPL C&F Solan portal.`,
    });
  };

  // Export invoice C&F items report
  const handleExportItemsCSV = () => {
    const rows = filteredInvoiceItems.map((item) => ({
      InvoiceNumber: item.invoiceNumber,
      InvoiceDate: item.invoiceDate,
      CustomerName: item.customerName,
      CustomerMobile: item.customerMobile,
      CustomerAWPL_ID: item.customerAwplId || 'N/A',
      ProductName: item.product.name,
      ProductSKU: item.product.sku,
      BatchNumber: item.product.batchNumber,
      Quantity: item.quantity,
      LineTotal: item.lineTotal,
      SPEarned: item.spEarned,
      CF_Synced_Status: item.cfSynced ? 'UPDATED' : 'PENDING',
      Online_CF_Bill_Number: item.cfBillNumber || 'PENDING ALLOCATION',
      CF_ID_Number: item.cfIdNumber || 'PENDING',
      CF_Synced_Timestamp: item.cfSyncedAt || 'N/A',
      CF_Remarks: item.cfRemarks || '',
    }));

    exportToCSV(`AWPL_CF_Invoice_Items_${new Date().toISOString().slice(0, 10)}`, rows);
  };

  // Filtered assistance records
  const filteredRecords = useMemo(() => {
    return cfRecords.filter((rec) => {
      const matchSearch =
        rec.referenceNo.toLowerCase().includes(search.toLowerCase()) ||
        rec.awplCustomerId.toLowerCase().includes(search.toLowerCase()) ||
        rec.customerName.toLowerCase().includes(search.toLowerCase()) ||
        rec.customerMobile.includes(search);

      const matchStatus = statusFilter === 'all' || rec.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cfRecords, search, statusFilter]);

  // Totals for assistance records
  const pendingCount = cfRecords.filter(
    (r) => r.status === 'Pending Verification' || r.status === 'Under Processing'
  ).length;
  const totalPendingAmount = cfRecords.reduce((sum, r) => sum + r.pendingAmount, 0);

  // Handle OTP Trigger
  const handleSendOtp = () => {
    if (!reqMobile || reqMobile.length < 10) {
      alert('Please enter a valid 10-digit mobile number to receive C&F verification OTP.');
      return;
    }
    setOtpSent(true);
    alert(`[AWPL C&F Security OTP] A 6-digit verification code has been dispatched to ${reqMobile}. (Demo OTP: 492810)`);
  };

  const handleVerifyOtp = () => {
    if (enteredOtp === '492810' || enteredOtp === '123456' || enteredOtp.length === 6) {
      setIsOtpVerified(true);
    } else {
      alert('Invalid OTP. Please enter the 6-digit code received on customer mobile (e.g., 492810).');
    }
  };

  // Submit Assistance Bill to C&F Portal
  const handleSubmitCFRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOtpVerified) {
      alert('Customer OTP verification is required prior to submitting orders to AWPL C&F.');
      return;
    }

    setSubmittingToPortal(true);

    setTimeout(() => {
      setSubmittingToPortal(false);
      const generatedRef = `CF-HP-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newRecord: CFBillRecord = {
        id: `cf-${Date.now()}`,
        referenceNo: generatedRef,
        awplCustomerId: reqAwplId.toUpperCase(),
        customerName: reqCustomerName,
        customerMobile: reqMobile,
        itemsSummary: reqOrderSummary,
        totalSp: reqSp,
        pendingAmount: reqAmount,
        cfBranch: 'Solan C&F Depot Hub (HP)',
        status: 'Under Processing',
        createdDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        customerRemarks: reqRemarks,
        otpVerified: true,
        submissionId: `AWPL-SUB-${Date.now().toString().slice(-6)}`,
      };

      const updated = [newRecord, ...cfRecords];
      onUpdateCFRecords(updated);
      setStorageItem('drw_cf_records_v1', updated);

      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        action: `C&F Bill Submitted: ${generatedRef}`,
        category: 'C&F Portal',
        user: `${currentUserName} (${currentUserRole})`,
        details: `Customer: ${reqCustomerName} (${reqAwplId}), Amount: ${formatINR(reqAmount)}, SP: ${reqSp}`,
      });

      setSubmissionFeedback({
        success: true,
        reference: generatedRef,
        message: `Request successfully transmitted to Solan C&F Depot. Assigned Reference: ${generatedRef}. Awaiting official depot clearance.`,
      });

      setIsNewRequestOpen(false);
      setOtpSent(false);
      setIsOtpVerified(false);
      setEnteredOtp('');
    }, 1200);
  };

  // Update Status by Admin
  const handleUpdateRecordStatus = (
    rec: CFBillRecord,
    newStatus: CFBillRecord['status'],
    resolutionText?: string
  ) => {
    const updated = cfRecords.map((r) => {
      if (r.id === rec.id) {
        return {
          ...r,
          status: newStatus,
          adminResolution: resolutionText || r.adminResolution,
          lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        };
      }
      return r;
    });

    onUpdateCFRecords(updated);
    setStorageItem('drw_cf_records_v1', updated);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `C&F Order Status Updated: ${rec.referenceNo}`,
      category: 'C&F Portal',
      user: `${currentUserName} (${currentUserRole})`,
      details: `New Status: ${newStatus} | Note: ${resolutionText || 'None'}`,
    });

    setSelectedRecord(null);
  };

  return (
    <div className="space-y-5">
      {/* C&F Integration Gateway Header Card */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">AWPL C&F Portal Online Integration</h2>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Solan Depot Online
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300 max-w-2xl">
                Official tracking bridge between <strong className="text-white">D RIGHT WELLNESS</strong> and the{' '}
                <span className="font-semibold text-amber-400">{gatewayStatus.branchId}</span>. Track which specific
                invoice line items are updated in the C&F portal with verified <strong className="text-emerald-300">Online C&F Bill Numbers</strong> and <strong className="text-amber-300">C&F ID Numbers</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeSubTab === 'invoice_items' ? (
              <>
                <button
                  type="button"
                  onClick={handleBulkSyncFilteredItems}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow transition"
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>Sync All Filtered Items</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportItemsCSV}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  <Download className="h-4 w-4 text-emerald-400" />
                  <span>Export C&F Items CSV</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsNewRequestOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit C&F Order Assistance</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 flex border-b border-slate-700">
          <button
            type="button"
            onClick={() => setActiveSubTab('invoice_items')}
            className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition ${
              activeSubTab === 'invoice_items'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Invoice C&F Portal Item Updates ({syncedItemCount}/{totalItemCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('assistance_requests')}
            className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition ${
              activeSubTab === 'assistance_requests'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>C&F Depot Order Assistance ({pendingCount} pending)</span>
          </button>
        </div>

        {/* Status Metrics Strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
              C&F Updated Items
            </span>
            <span className="text-lg font-black text-emerald-400">
              {syncedItemCount} / {totalItemCount} Items
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
              Pending C&F Sync
            </span>
            <span className="text-lg font-black text-amber-400">{pendingItemCount} Items</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
              SP Points Cleared in C&F
            </span>
            <span className="text-lg font-black text-white flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-amber-400" />
              {syncedSpPoints} SP
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
              Depot Hub Node
            </span>
            <span className="font-semibold text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Solan Regional Hub
            </span>
          </div>
        </div>
      </div>

      {/* Submission Feedback Toast */}
      {submissionFeedback && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 border border-emerald-300 text-emerald-900 text-xs dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Transmission Confirmed: {submissionFeedback.reference}</p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                {submissionFeedback.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSubmissionFeedback(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 7-Day Reminder Sent Banner */}
      {reminderSentBanner && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/60 p-4 border border-amber-400 text-amber-950 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2.5">
            <BellRing className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="font-bold">{reminderSentBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setReminderSentBanner(null)}
            className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ================= TAB 1: INVOICE C&F PORTAL ITEM UPDATES ================= */}
      {activeSubTab === 'invoice_items' && (
        <div className="space-y-4">
          {/* Quick Filter Tabs: All | Pending for Online | Online Done | 7+ Days Overdue Reminder */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setItemStatusFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                itemStatusFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              All Invoice Items ({totalItemCount})
            </button>
            <button
              type="button"
              onClick={() => setItemStatusFilter('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                itemStatusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Bills Pending for Online ({pendingItemCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setItemStatusFilter('synced')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                itemStatusFilter === 'synced'
                  ? 'bg-emerald-700 text-white shadow'
                  : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Online Done — Products Updated ({syncedItemCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setItemStatusFilter('overdue_7d')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                itemStatusFilter === 'overdue_7d'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800'
              }`}
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>7+ Days Pending Online Reminder ({overdue7dCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setItemStatusFilter('pending_products')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                itemStatusFilter === 'pending_products'
                  ? 'bg-orange-500 text-black shadow'
                  : 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Pending Products on C&F Portal ({pendingProductsCount} Pending)</span>
            </button>
          </div>

          {/* Search and Bulk Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search by Product, Target AWPL ID, S.A.O/S.G.O, Online C&F Bill #, C&F ID #, or Invoice #..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkSyncFilteredItems}
                disabled={filteredInvoiceItems.length === 0}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition whitespace-nowrap"
              >
                Mark Filtered Online Done
              </button>
            </div>
          </div>

          {/* Granular Line Items Table */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3 text-center">Online Status</th>
                    <th className="py-3 px-4">Product Updated / Pending</th>
                    <th className="py-3 px-4">Invoice # & Linked C&F</th>
                    <th className="py-3 px-4">Assigned AWPL ID & Side (S.A.O / S.G.O)</th>
                    <th className="py-3 px-4">Online Invoice Bill No & ID No</th>
                    <th className="py-3 px-3 text-center">Qty & SP</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions & 7-Day Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoiceItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Package className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <p className="font-semibold">No invoice items match your filter</p>
                        <p className="text-xs mt-1">Try clearing your search query or generate bills from the POS / Customer App.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoiceItems.map((item, idx) => {
                      const isOverdue7Days = !item.cfSynced && item.daysOld >= 7;
                      return (
                        <tr
                          key={`${item.invoiceId}_${item.itemIndex}_${idx}`}
                          className={`transition ${
                            isOverdue7Days
                              ? 'bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20'
                              : item.cfSynced
                              ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                              : 'bg-amber-50/20 hover:bg-amber-50/50 dark:hover:bg-amber-950/20'
                          }`}
                        >
                          {/* Online Status Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSingleItemSync(item)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                                item.cfSynced
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                              title="Click to toggle Online Done / Pending Online"
                            >
                              {item.cfSynced ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  Online Done
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3 text-amber-600" />
                                  Pending Online
                                </>
                              )}
                            </button>
                            {isOverdue7Days && (
                              <span className="mt-1 block rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                                ⚠ {item.daysOld}d Pending!
                              </span>
                            )}
                          </td>

                          {/* Product + Pending Product Handover Status (Requirement #15) */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>{item.product.name}</span>
                              {item.isPendingProduct && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                    item.pendingProductStatus === 'given'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-red-600 text-white'
                                  }`}
                                >
                                  {item.pendingProductStatus === 'given'
                                    ? `✓ PRODUCT GIVEN (${item.pendingGivenAt || 'Handed Over'})`
                                    : '⚠ PENDING PRODUCT (ON ORIGINAL BILL)'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>{item.product.sku}</span>
                              <span>•</span>
                              <span>Batch: {item.product.batchNumber}</span>
                            </div>
                            {item.isPendingProduct && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                {item.pendingProductStatus !== 'given' ? (
                                  <>
                                    {item.isRegisteredAppCustomer ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                                          const nextList = invoices.map((inv) =>
                                            inv.id === item.invoiceId
                                              ? {
                                                  ...inv,
                                                  items: inv.items.map((ci, cIdx) =>
                                                    cIdx === item.itemIndex
                                                      ? { ...ci, pendingArrivalNotifiedAt: nowTime }
                                                      : ci
                                                  ),
                                                }
                                              : inv
                                          );
                                          onUpdateInvoices(nextList);
                                          setStorageItem('drw_invoices_v1', nextList);
                                          saveToCloudBackup();
                                          setReminderSentBanner(
                                            `Pending Product Arrival Reminder sent to Registered Customer App (+91 ${item.customerMobile}) for ${item.product.name}!`
                                          );
                                        }}
                                        className="rounded bg-blue-600 text-white px-2 py-0.5 text-[9px] font-black hover:bg-blue-700"
                                      >
                                        📲 Notify Arrival in App (Registered)
                                      </button>
                                    ) : (
                                      <a
                                        href={item.whatsappPendingArrivalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => {
                                          const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                                          const nextList = invoices.map((inv) =>
                                            inv.id === item.invoiceId
                                              ? {
                                                  ...inv,
                                                  items: inv.items.map((ci, cIdx) =>
                                                    cIdx === item.itemIndex
                                                      ? { ...ci, pendingArrivalNotifiedAt: nowTime }
                                                      : ci
                                                  ),
                                                }
                                              : inv
                                          );
                                          onUpdateInvoices(nextList);
                                          setStorageItem('drw_invoices_v1', nextList);
                                          saveToCloudBackup();
                                        }}
                                        className="rounded bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-black hover:bg-emerald-700"
                                      >
                                        💬 WhatsApp Arrival Reminder (Unregistered)
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                                        const nextList = invoices.map((inv) => {
                                          if (inv.id !== item.invoiceId) return inv;
                                          const nextItems = inv.items.map((ci, cIdx) =>
                                            cIdx === item.itemIndex
                                              ? {
                                                  ...ci,
                                                  pendingProductStatus: 'given' as const,
                                                  pendingGivenAt: nowTime,
                                                }
                                              : ci
                                          );
                                          return {
                                            ...inv,
                                            items: nextItems,
                                            hasPendingProducts: nextItems.some(
                                              (ci) => ci.isPendingProduct && ci.pendingProductStatus !== 'given'
                                            ),
                                          };
                                        });
                                        onUpdateInvoices(nextList);
                                        setStorageItem('drw_invoices_v1', nextList);
                                        saveToCloudBackup();
                                        setReminderSentBanner(
                                          `Pending Product "${item.product.name}" marked as GIVEN on Original Bill #${item.invoiceNumber}!`
                                        );
                                      }}
                                      className="rounded bg-amber-500 text-slate-950 px-2 py-0.5 text-[9px] font-black hover:bg-amber-400"
                                    >
                                      ✓ Mark Given
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextList = invoices.map((inv) => {
                                        if (inv.id !== item.invoiceId) return inv;
                                        const nextItems = inv.items.map((ci, cIdx) =>
                                          cIdx === item.itemIndex
                                            ? {
                                                ...ci,
                                                pendingProductStatus: 'pending' as const,
                                                pendingGivenAt: undefined,
                                              }
                                            : ci
                                        );
                                        return {
                                          ...inv,
                                          items: nextItems,
                                          hasPendingProducts: true,
                                        };
                                      });
                                      onUpdateInvoices(nextList);
                                      setStorageItem('drw_invoices_v1', nextList);
                                      saveToCloudBackup();
                                    }}
                                    className="rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[9px] font-bold hover:underline"
                                  >
                                    Revert to Pending
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Invoice # & Linked C&F + Customer */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {item.invoiceNumber}
                              </span>
                              {item.isMultiIdInvoice ? (
                                <span className="rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 text-[9px] font-black text-purple-800 dark:text-purple-300">
                                  MULTI-ID BILL ({item.distinctInvoiceIds.length} IDs)
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                  SAME ID
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                              {item.customerName} ({item.customerMobile})
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                              {item.invoiceDate} • {item.selectedCfDepotName}
                            </div>
                          </td>

                          {/* Assigned AWPL ID & Green ID Side (S.A.O / S.G.O) */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                ID: {item.targetAwplId || item.customerAwplId || 'UNASSIGNED'}
                              </span>
                              {item.isIdGreen !== false ? (
                                <span className="rounded bg-amber-100 dark:bg-amber-950 border border-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:text-amber-300">
                                  GREEN • {item.repurchaseSide || 'S.A.O'}
                                </span>
                              ) : (
                                <span className="rounded bg-amber-500 text-slate-950 px-2 py-0.5 text-[10px] font-black">
                                  GREENING: {item.greeningCategory || '27 SP'}
                                </span>
                              )}
                            </div>
                            {item.targetAwplHolderName && (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                Holder: {item.targetAwplHolderName}
                              </span>
                            )}
                          </td>

                          {/* Online C&F Bill No & ID No */}
                          <td className="py-3 px-4">
                            {item.cfSynced && item.cfBillNumber ? (
                              <div className="space-y-0.5 font-mono text-[11px]">
                                <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 block w-fit">
                                  Bill: {item.cfBillNumber}
                                </span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                                  C&F ID: {item.cfIdNumber || 'Verified'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold italic">
                                Pending Online Entry
                              </span>
                            )}
                          </td>

                          {/* Qty & SP */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {item.quantity}x
                            </span>
                            <span className="block text-[10px] font-black text-amber-700 dark:text-amber-400">
                              +{item.spEarned} SP
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                            {formatINR(item.lineTotal)}
                          </td>

                          {/* Actions & Automatic 7-Day WhatsApp + In-App Notification */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenItemEditor(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950 transition"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>{item.cfSynced ? 'Edit Online Info' : 'Update Online'}</span>
                              </button>

                              {!item.cfSynced && (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={item.whatsappReminderUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => handleSend7DayReminder(item)}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                                        isOverdue7Days
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                          : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                      }`}
                                      title="Send 7-Day Pending Bill Notification via WhatsApp"
                                    >
                                      <MessageCircle className="h-2.5 w-2.5" />
                                      <span>
                                        {isOverdue7Days ? 'Auto WhatsApp 7d ✓' : 'WhatsApp Remind'}
                                      </span>
                                    </a>
                                  </div>

                                  {isOverdue7Days && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                        item.isRegisteredAppCustomer
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                      }`}
                                    >
                                      <Smartphone className="h-2.5 w-2.5" />
                                      {item.isRegisteredAppCustomer
                                        ? 'Registered App: In-App Notified ✓'
                                        : 'WhatsApp Only'}
                                    </span>
                                  )}
                                </div>
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
        </div>
      )}

      {/* ================= TAB 2: ASSISTANCE REQUESTS ================= */}
      {activeSubTab === 'assistance_requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by C&F Reference No, AWPL ID, Customer Name..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All C&F Statuses</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Under Processing">Under Processing</option>
              <option value="Approved by C&F">Approved by C&F</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* C&F Records Table */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">C&F Reference & Date</th>
                    <th className="py-3 px-4">AWPL Customer ID(s)</th>
                    <th className="py-3 px-4">Items & S.A.O / S.G.O Summary</th>
                    <th className="py-3 px-4 text-center">Sales Points</th>
                    <th className="py-3 px-4 text-right">Bill Amount</th>
                    <th className="py-3 px-4 text-center">OTP Auth</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <p className="font-semibold">No C&F order records found</p>
                        <p className="text-xs mt-1">Submit assistance requests or adjust search filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {rec.referenceNo}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{rec.createdDate}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                            {rec.awplCustomerId}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            {rec.customerName} ({rec.customerMobile})
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <p className="truncate text-slate-700 dark:text-slate-300 font-medium">
                            {rec.itemsSummary}
                          </p>
                          <p className="text-[10px] text-slate-400">{rec.cfBranch}</p>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="font-black text-amber-700 dark:text-amber-400">
                            {rec.totalSp} SP
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white text-sm">
                          {formatINR(rec.pendingAmount)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {rec.otpVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-300">
                              <AlertCircle className="h-3 w-3" />
                              Unverified
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              rec.status === 'Approved by C&F' || rec.status === 'Resolved'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : rec.status === 'Dispatched'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : rec.status === 'Under Processing'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 transition"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Item C&F Credentials + Target AWPL ID + S.A.O / S.G.O Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Update Product Online in AWPL C&F Portal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {editingItem.product.name} (Qty: {editingItem.quantity} • +{editingItem.spEarned} SP)
              </p>
              <p className="text-slate-600 dark:text-slate-300 font-mono">
                SKU: {editingItem.product.sku} | Batch: {editingItem.product.batchNumber}
              </p>
              <p className="text-slate-500">
                Invoice: <strong>{editingItem.invoiceNumber}</strong> • Customer: {editingItem.customerName}
              </p>
            </div>

            <form onSubmit={handleSaveItemEdit} className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 p-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-900 dark:text-emerald-300">
                  <input
                    type="checkbox"
                    checked={editSynced}
                    onChange={(e) => setEditSynced(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Mark Product as Online Done (Updated in AWPL Portal)</span>
                </label>
              </div>

              {/* Target AWPL ID & Green ID Side (S.A.O / S.G.O) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Assigned AWPL ID (For this Item) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTargetAwplId}
                    onChange={(e) => setEditTargetAwplId(e.target.value.toUpperCase())}
                    placeholder="e.g. AWPL782910"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      {editIsIdGreen ? 'Repurchase Side (S.A.O / S.G.O)' : 'Greening Category'}
                    </label>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsIdGreen}
                        onChange={(e) => setEditIsIdGreen(e.target.checked)}
                      />
                      <span>ID is Green</span>
                    </label>
                  </div>
                  {editIsIdGreen ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['S.A.O', 'S.G.O'] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setEditRepurchaseSide(side)}
                          className={`py-2 rounded-xl font-black text-xs border transition ${
                            editRepurchaseSide === side
                              ? 'bg-amber-400 text-slate-950 border-amber-500'
                              : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          { value: '27 SP', label: '1. 27 SP' },
                          { value: '52 SP', label: '2. 52 SP' },
                          { value: '100 SP', label: '3. 100 SP' },
                          { value: 'Only Point Update', label: '4. Only Point Update' },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setEditGreeningCategory(cat.value)}
                          className={`py-1.5 px-2 rounded-lg font-black text-[10px] border transition ${
                            editGreeningCategory === cat.value
                              ? 'bg-amber-500 text-slate-950 border-amber-600'
                              : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Online Invoice / C&F Bill Number *
                </label>
                <input
                  type="text"
                  required
                  value={editBillNumber}
                  onChange={(e) => setEditBillNumber(e.target.value)}
                  placeholder="e.g. AWPL-CF-SOL-2026-8842"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Online C&F ID Number / Transaction ID *
                </label>
                <input
                  type="text"
                  required
                  value={editIdNumber}
                  onChange={(e) => setEditIdNumber(e.target.value)}
                  placeholder="e.g. CF-ID-90412 or DS ID"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  C&F Allocation / Dispatch Remarks
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Updated online on AWPL782910 (S.A.O)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Online C&F Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Management Modal for Assistance Requests */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  C&F Order: {selectedRecord.referenceNo}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  AWPL Customer ID: {selectedRecord.awplCustomerId}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1.5">
                <p>
                  <strong>Customer:</strong> {selectedRecord.customerName} ({selectedRecord.customerMobile})
                </p>
                <p>
                  <strong>Items:</strong> {selectedRecord.itemsSummary}
                </p>
                <p>
                  <strong>Total Value:</strong> {formatINR(selectedRecord.pendingAmount)} (
                  {selectedRecord.totalSp} SP)
                </p>
                <p>
                  <strong>Depot:</strong> {selectedRecord.cfBranch}
                </p>
                {selectedRecord.customerRemarks && (
                  <p>
                    <strong>Remarks:</strong> {selectedRecord.customerRemarks}
                  </p>
                )}
                {selectedRecord.adminResolution && (
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    <strong>Admin Note:</strong> {selectedRecord.adminResolution}
                  </p>
                )}
              </div>

              {(currentUserRole === 'super_admin' ||
                currentUserRole === 'franchise_admin' ||
                currentUserRole === 'support_staff') && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="font-bold text-slate-800 dark:text-white block">
                    Update Official C&F Status:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateRecordStatus(
                          selectedRecord,
                          'Approved by C&F',
                          'Approved at Solan C&F Depot counter; invoice cleared.'
                        )
                      }
                      className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-3 text-xs"
                    >
                      Mark Approved by C&F
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateRecordStatus(
                          selectedRecord,
                          'Dispatched',
                          'Dispatched via Solan depot express courier.'
                        )
                      }
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 text-xs"
                    >
                      Mark Dispatched
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateRecordStatus(
                          selectedRecord,
                          'Under Processing',
                          'Stock allocation in progress at depot.'
                        )
                      }
                      className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-3 text-xs"
                    >
                      Mark Under Processing
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateRecordStatus(
                          selectedRecord,
                          'Resolved',
                          'Issue reconciled with regional C&F manager.'
                        )
                      }
                      className="rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-3 text-xs"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New C&F Assistance Request Modal with OTP Security */}
      {isNewRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  C&F Bill Assistance Submission
                </h3>
              </div>
              <button
                onClick={() => setIsNewRequestOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitCFRequest} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    AWPL Customer / Distributor ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={reqAwplId}
                    onChange={(e) => setReqAwplId(e.target.value)}
                    placeholder="e.g. AWPL782910"
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={reqCustomerName}
                    onChange={(e) => setReqCustomerName(e.target.value)}
                    placeholder="e.g. Rameshwar Sharma"
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Registered Mobile Number *
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="tel"
                    required
                    value={reqMobile}
                    onChange={(e) => setReqMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition"
                  >
                    {otpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>
                </div>
              </div>

              {/* OTP Input Section */}
              {otpSent && !isOtpVerified && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4" />
                    Enter 6-Digit OTP sent to {reqMobile} (Demo Code: 492810):
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      placeholder="492810"
                      className="flex-1 rounded-lg border border-amber-400 bg-white dark:bg-slate-800 px-3 py-1.5 text-center font-mono font-bold tracking-widest text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                    >
                      Verify OTP
                    </button>
                  </div>
                </div>
              )}

              {isOtpVerified && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 p-2.5 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Customer Identity Verified via Official AWPL OTP</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Items Description *
                </label>
                <input
                  type="text"
                  required
                  value={reqOrderSummary}
                  onChange={(e) => setReqOrderSummary(e.target.value)}
                  placeholder="e.g. ImmunoDoc Ras (2), OrthoDoc Ras (1), DentaDoc (3)"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Total SP Points
                  </label>
                  <input
                    type="number"
                    value={reqSp}
                    onChange={(e) => setReqSp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-bold text-amber-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Bill Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={reqAmount}
                    onChange={(e) => setReqAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Customer Issue / Assistance Remarks
                </label>
                <textarea
                  rows={2}
                  value={reqRemarks}
                  onChange={(e) => setReqRemarks(e.target.value)}
                  placeholder="e.g. Payment deducted on 24th Oct, C&F invoice not yet generated..."
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewRequestOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isOtpVerified || submittingToPortal}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 shadow disabled:opacity-50"
                >
                  {submittingToPortal && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{submittingToPortal ? 'Submitting to Depot...' : 'Submit to C&F Depot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
