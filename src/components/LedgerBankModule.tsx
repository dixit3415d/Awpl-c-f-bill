import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Banknote,
  QrCode,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ShoppingBag,
  Clock,
  CheckCircle2,
  MessageCircle,
  Download,
  Building2,
  Wallet
} from 'lucide-react';
import {
  AuditLog,
  BankDeposit,
  FranchiseConfig,
  Invoice,
  PurchaseOrder,
  Role
} from '../types';
import {
  buildWhatsApp5DayCreditReminderUrl,
  exportToCSV,
  formatINR,
  getInvoiceDaysOld,
  getUPIPaymentURI,
  saveToCloudBackup,
  setStorageItem
} from '../utils/storage';

interface LedgerBankModuleProps {
  invoices: Invoice[];
  bankDeposits: BankDeposit[];
  purchaseOrders: PurchaseOrder[];
  franchiseConfig: FranchiseConfig;
  currentUserRole: Role;
  currentUserName: string;
  onUpdateBankDeposits: (deposits: BankDeposit[]) => void;
  onUpdatePurchaseOrders: (orders: PurchaseOrder[]) => void;
  onAddAuditLog: (log: AuditLog) => void;
}

export const LedgerBankModule: React.FC<LedgerBankModuleProps> = ({
  invoices,
  bankDeposits,
  purchaseOrders,
  franchiseConfig,
  currentUserRole,
  currentUserName,
  onUpdateBankDeposits,
  onUpdatePurchaseOrders,
  onAddAuditLog,
}) => {
  const [activeTab, setActiveTab] = useState<'all_transactions' | 'bank_deposits' | 'purchase_orders' | 'credit_reminders'>('all_transactions');

  // Deposit Cash to Bank Modal
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  // Create Purchase Order (PO) Modal (Requirement #6: PO amount is deducted/minus from Bank Balance)
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poNumberInput, setPoNumberInput] = useState('');
  const [poSupplierInput, setPoSupplierInput] = useState('Asclepius Wellness Pvt. Ltd. (AWPL Head Office)');
  const [poItemsSummary, setPoItemsSummary] = useState('');
  const [poAmountInput, setPoAmountInput] = useState('');
  const [poPaymentMode, setPoPaymentMode] = useState<'Bank Transfer / NEFT / RTGS' | 'UPI' | 'Cheque'>('Bank Transfer / NEFT / RTGS');
  const [poNotesInput, setPoNotesInput] = useState('');

  // 5-Day Credit Reminder QR Modal
  const [selectedCreditInv, setSelectedCreditInv] = useState<Invoice | null>(null);

  // Requirement #6: Calculate Cash, UPI, Bank Deposits, Purchase Orders (deducted from Bank Balance), Cash in Hand & Live Bank Balance
  const ledgerSummary = useMemo(() => {
    let totalCashReceived = 0;
    let totalUpiReceived = 0;
    let totalCardReceived = 0;
    let totalCreditPending = 0;

    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'cancelled') return;

      if (inv.paymentMethod === 'Split (Cash + UPI)' && inv.splitDetails) {
        totalCashReceived += inv.splitDetails.cashAmount || 0;
        totalUpiReceived += inv.splitDetails.upiAmount || 0;
      } else if (inv.paymentMethod === 'Cash') {
        totalCashReceived += inv.amountPaid || inv.grandTotal;
      } else if (inv.paymentMethod === 'UPI') {
        totalUpiReceived += inv.amountPaid || inv.grandTotal;
      } else if (inv.paymentMethod === 'Card') {
        totalCardReceived += inv.amountPaid || inv.grandTotal;
      }

      if (inv.balanceDue > 0 || inv.paymentMethod === 'Credit') {
        totalCreditPending += inv.balanceDue || inv.grandTotal;
      }
    });

    const totalCashDepositedToBank = bankDeposits.reduce((sum, d) => sum + d.amount, 0);
    const totalPurchaseOrderDeductions = purchaseOrders.reduce((sum, po) => sum + po.amount, 0);

    // Cash in Hand = Total Cash Received from Bills - Cash Deposited into Bank
    const cashInHand = totalCashReceived - totalCashDepositedToBank;

    // Bank Balance = Direct UPI + Card + Cash Deposited in Bank - Purchase Orders (PO)
    const bankBalance =
      totalUpiReceived + totalCardReceived + totalCashDepositedToBank - totalPurchaseOrderDeductions;

    return {
      totalCashReceived,
      totalUpiReceived,
      totalCardReceived,
      totalCreditPending,
      totalCashDepositedToBank,
      totalPurchaseOrderDeductions,
      cashInHand,
      bankBalance,
    };
  }, [invoices, bankDeposits, purchaseOrders]);

  // Unified chronological ledger entries
  const unifiedLedgerRows = useMemo(() => {
    const rows: {
      id: string;
      date: string;
      type: 'Bill Payment' | 'Bank Deposit' | 'Purchase Order (PO)';
      reference: string;
      party: string;
      cashAmount: number;
      upiAmount: number;
      bankDepositAmount: number;
      poDeductionAmount: number;
      bankImpact: number;
      details: string;
    }[] = [];

    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'cancelled') return;
      const cAmt =
        inv.paymentMethod === 'Split (Cash + UPI)' && inv.splitDetails
          ? inv.splitDetails.cashAmount
          : inv.paymentMethod === 'Cash'
          ? inv.amountPaid
          : 0;
      const uAmt =
        inv.paymentMethod === 'Split (Cash + UPI)' && inv.splitDetails
          ? inv.splitDetails.upiAmount
          : inv.paymentMethod === 'UPI' || inv.paymentMethod === 'Card'
          ? inv.amountPaid
          : 0;

      rows.push({
        id: `led-inv-${inv.id}`,
        date: inv.date,
        type: 'Bill Payment',
        reference: inv.invoiceNumber,
        party: `${inv.customerName} (${inv.customerMobile})`,
        cashAmount: cAmt,
        upiAmount: uAmt,
        bankDepositAmount: 0,
        poDeductionAmount: 0,
        bankImpact: uAmt,
        details:
          inv.paymentMethod === 'Split (Cash + UPI)'
            ? `Both: Cash ${formatINR(cAmt)} + UPI ${formatINR(uAmt)}`
            : inv.paymentMethod === 'Credit'
            ? `Credit Bill (Due: ${formatINR(inv.balanceDue)})`
            : `${inv.paymentMethod} Payment`,
      });
    });

    bankDeposits.forEach((dep) => {
      rows.push({
        id: `led-dep-${dep.id}`,
        date: dep.date,
        type: 'Bank Deposit',
        reference: dep.referenceNo,
        party: `${dep.bankName} (${dep.accountNo})`,
        cashAmount: -dep.amount,
        upiAmount: 0,
        bankDepositAmount: dep.amount,
        poDeductionAmount: 0,
        bankImpact: dep.amount,
        details: dep.notes || 'Cash deposited into franchise bank account',
      });
    });

    purchaseOrders.forEach((po) => {
      rows.push({
        id: `led-po-${po.id}`,
        date: po.date,
        type: 'Purchase Order (PO)',
        reference: po.poNumber,
        party: po.supplierName,
        cashAmount: 0,
        upiAmount: 0,
        bankDepositAmount: 0,
        poDeductionAmount: po.amount,
        bankImpact: -po.amount,
        details: `PO Deducted from Bank: ${po.itemsSummary}`,
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, bankDeposits, purchaseOrders]);

  // 5-Day Credit Overdue Invoices
  const creditBills = useMemo(() => {
    return invoices.filter(
      (inv) => inv.paymentStatus !== 'cancelled' && (inv.paymentMethod === 'Credit' || inv.balanceDue > 0)
    );
  }, [invoices]);

  // Handle Deposit Cash to Bank
  const handleAddBankDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) return;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newDep: BankDeposit = {
      id: `dep-${Date.now()}`,
      date: now,
      amount: amt,
      bankName: franchiseConfig.bankName,
      accountNo: franchiseConfig.accountNo,
      referenceNo: depositRef.trim() || `DEP-SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
      depositedBy: currentUserName,
      notes: depositNotes.trim() || 'Cash sales deposited in bank account',
    };

    const next = [newDep, ...bankDeposits];
    onUpdateBankDeposits(next);
    setStorageItem('drw_bank_deposits_v1', next);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: now,
      action: `Cash Deposited in Bank (${formatINR(amt)})`,
      category: 'Billing',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Deposited ${formatINR(amt)} into ${franchiseConfig.bankName} (${franchiseConfig.accountNo}). Ref: ${newDep.referenceNo}`,
    });

    setDepositAmount('');
    setDepositRef('');
    setDepositNotes('');
    setIsDepositModalOpen(false);
  };

  // Handle Create Purchase Order (PO) — automatically deducts from Bank Balance
  const handleCreatePurchaseOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(poAmountInput);
    if (!amt || amt <= 0) return;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: poNumberInput.trim() || `PO-AWPL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: now,
      supplierName: poSupplierInput.trim() || 'Asclepius Wellness Pvt. Ltd.',
      itemsSummary: poItemsSummary.trim() || 'AWPL C&F Stock Replenishment Order',
      amount: amt,
      paymentMode: poPaymentMode,
      status: 'Paid & Deducted from Bank',
      createdBy: currentUserName,
      notes: poNotesInput.trim() || 'Deducted from franchise bank balance',
    };

    const next = [newPo, ...purchaseOrders];
    onUpdatePurchaseOrders(next);
    setStorageItem('drw_purchase_orders_v1', next);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: now,
      action: `Purchase Order Created & Deducted from Bank (${formatINR(amt)})`,
      category: 'Billing',
      user: `${currentUserName} (${currentUserRole})`,
      details: `PO #${newPo.poNumber} for ${formatINR(amt)} subtracted from Bank Balance (${poSupplierInput}).`,
    });

    setPoNumberInput('');
    setPoItemsSummary('');
    setPoAmountInput('');
    setPoNotesInput('');
    setIsPOModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 p-5 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-amber-400" />
            <h2 className="text-xl font-black tracking-tight">
              Payment Ledgers, Bank Deposits & Purchase Orders (PO)
            </h2>
          </div>
          <p className="mt-1 text-xs text-emerald-200">
            Track exact Cash vs UPI collections, record Cash Deposited in Bank, and create Purchase Orders (automatically deducted from Bank Balance).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 text-xs font-black shadow transition"
          >
            <Plus className="h-4 w-4" />
            <span>Deposit Cash in Bank</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPOModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 text-xs font-black shadow transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>New Purchase Order (Minus Bank)</span>
          </button>

          <button
            type="button"
            onClick={() => exportToCSV(`DRW_Payment_Ledger_${new Date().toISOString().slice(0, 10)}`, unifiedLedgerRows)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500 px-3 py-2 text-xs font-bold transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Ledger CSV</span>
          </button>
        </div>
      </div>

      {/* Requirement #6: Top Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Cash Received</span>
            <Banknote className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">
            {formatINR(ledgerSummary.totalCashReceived)}
          </p>
          <p className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            Cash in Hand: {formatINR(ledgerSummary.cashInHand)}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total UPI Received</span>
            <QrCode className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-black text-emerald-700 dark:text-emerald-400">
            {formatINR(ledgerSummary.totalUpiReceived)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Credited directly to Bank A/c
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Deposited in Bank</span>
            <ArrowUpRight className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-black text-blue-700 dark:text-blue-400">
            +{formatINR(ledgerSummary.totalCashDepositedToBank)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {bankDeposits.length} Bank Deposit Slips
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Purchase Orders (PO)</span>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-2 text-xl font-black text-red-600 dark:text-red-400">
            -{formatINR(ledgerSummary.totalPurchaseOrderDeductions)}
          </p>
          <p className="mt-1 text-[11px] text-red-600 font-semibold">
            Minus from Bank ({purchaseOrders.length} POs)
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-900 text-white p-4 shadow-md border-2 border-amber-400">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-200">
            <span>Net Bank Balance</span>
            <Landmark className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-300">
            {formatINR(ledgerSummary.bankBalance)}
          </p>
          <p className="mt-1 text-[10px] text-emerald-200 font-mono truncate">
            {franchiseConfig.bankName} ({franchiseConfig.accountNo})
          </p>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('all_transactions')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'all_transactions'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          All Ledger Transactions ({unifiedLedgerRows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bank_deposits')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'bank_deposits'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          Cash Deposited in Bank ({bankDeposits.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('purchase_orders')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'purchase_orders'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          Purchase Orders — Minus from Bank ({purchaseOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('credit_reminders')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'credit_reminders'
              ? 'bg-red-600 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          Credit Bills & 5-Day Payment QR Reminders ({creditBills.length})
        </button>
      </div>

      {/* TAB 1: All Ledger Transactions */}
      {activeTab === 'all_transactions' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type & Ref #</th>
                  <th className="py-3 px-4">Customer / Bank / Supplier</th>
                  <th className="py-3 px-4 text-right">Cash (₹)</th>
                  <th className="py-3 px-4 text-right">UPI (₹)</th>
                  <th className="py-3 px-4 text-right">Deposited in Bank</th>
                  <th className="py-3 px-4 text-right">PO Deducted</th>
                  <th className="py-3 px-4 text-right">Net Bank Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {unifiedLedgerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{row.date}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                          row.type === 'Bill Payment'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : row.type === 'Bank Deposit'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {row.type}
                      </span>
                      <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                        {row.reference}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{row.party}</div>
                      <div className="text-[11px] text-slate-500">{row.details}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700 dark:text-amber-400">
                      {row.cashAmount !== 0 ? formatINR(row.cashAmount) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      {row.upiAmount > 0 ? formatINR(row.upiAmount) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700 dark:text-blue-400">
                      {row.bankDepositAmount > 0 ? `+${formatINR(row.bankDepositAmount)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      {row.poDeductionAmount > 0 ? `-${formatINR(row.poDeductionAmount)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-black">
                      {row.bankImpact > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">+{formatINR(row.bankImpact)}</span>
                      ) : row.bankImpact < 0 ? (
                        <span className="text-red-600">{formatINR(row.bankImpact)}</span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Bank Deposits */}
      {activeTab === 'bank_deposits' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                Cash Deposited in Bank Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Total Cash Deposited: <strong>{formatINR(ledgerSummary.totalCashDepositedToBank)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDepositModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold"
            >
              + Record Bank Deposit
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Slip / Reference No</th>
                  <th className="py-3 px-4">Bank & Account</th>
                  <th className="py-3 px-4">Deposited By</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Deposit Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bankDeposits.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 font-mono">{d.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 dark:text-blue-400">{d.referenceNo}</td>
                    <td className="py-3 px-4">{d.bankName} ({d.accountNo})</td>
                    <td className="py-3 px-4">{d.depositedBy}</td>
                    <td className="py-3 px-4 text-slate-500">{d.notes}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700 dark:text-emerald-400">
                      +{formatINR(d.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Purchase Orders (Deducted from Bank Balance) */}
      {activeTab === 'purchase_orders' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                Purchase Orders (PO) — Automatically Deducted from Bank Balance
              </h3>
              <p className="text-xs text-slate-500">
                Total PO Deductions: <strong className="text-red-600">-{formatINR(ledgerSummary.totalPurchaseOrderDeductions)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPOModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
            >
              + Create Purchase Order (PO)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier / Depot</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Amount Deducted from Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="py-3 px-4 font-mono">{po.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{po.poNumber}</td>
                    <td className="py-3 px-4 font-semibold">{po.supplierName}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{po.itemsSummary}</td>
                    <td className="py-3 px-4">{po.paymentMode}</td>
                    <td className="py-3 px-4 text-right font-black text-red-600">
                      -{formatINR(po.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Credit Bills & 5-Day Payment Reminders with Amount & UPI QR */}
      {activeTab === 'credit_reminders' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              Credit Bills & Automatic 5-Day Payment Reminders (with Amount & UPI QR)
            </h3>
            <p className="text-xs text-slate-500">
              Any person taking goods on Credit receives an automatic payment reminder after 5 days with exact Payment Amount & UPI QR code.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice # & Date</th>
                  <th className="py-3 px-4">Customer & Mobile</th>
                  <th className="py-3 px-4 text-center">Days on Credit</th>
                  <th className="py-3 px-4 text-right">Credit Balance Due</th>
                  <th className="py-3 px-4 text-right">5-Day Reminder & QR Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {creditBills.map((inv) => {
                  const dOld = getInvoiceDaysOld(inv.date);
                  const isOverdue5d = dOld >= 5;
                  return (
                    <tr key={inv.id}>
                      <td className="py-3 px-4 font-mono font-bold">{inv.invoiceNumber} ({inv.date})</td>
                      <td className="py-3 px-4 font-bold">{inv.customerName} (+91 {inv.customerMobile})</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            isOverdue5d ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {dOld} Days {isOverdue5d ? '(5+ Days Reminder Active)' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600">
                        {formatINR(inv.balanceDue || inv.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCreditInv(inv)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold shadow-xs"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>View Amount & Payment QR / Send Reminder</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record Cash Deposited in Bank */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Deposit Cash in Bank Account
            </h3>
            <form onSubmit={handleAddBankDeposit} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Cash Deposit Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-black text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Bank Deposit Slip / Reference No.
                </label>
                <input
                  type="text"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  placeholder="e.g. SBI-SOL-DEP-2026-99"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Remarks</label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="e.g. Counter cash deposited into SBI Solan"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-700 text-white font-black shadow"
                >
                  Save Bank Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Purchase Order (Minus from Bank Balance) */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Create Purchase Order (Deducted from Bank Balance)
            </h3>
            <form onSubmit={handleCreatePurchaseOrder} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Purchase Order Amount (₹) — Minus from Bank *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={poAmountInput}
                  onChange={(e) => setPoAmountInput(e.target.value)}
                  placeholder="e.g. 12500"
                  className="mt-1 w-full rounded-xl border border-red-300 dark:border-red-700 p-2.5 font-black text-sm text-red-600 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">PO Number</label>
                <input
                  type="text"
                  value={poNumberInput}
                  onChange={(e) => setPoNumberInput(e.target.value)}
                  placeholder="Auto: PO-AWPL-2026-..."
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Supplier / AWPL Depot</label>
                <input
                  type="text"
                  value={poSupplierInput}
                  onChange={(e) => setPoSupplierInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Items Ordered Summary *</label>
                <input
                  type="text"
                  required
                  value={poItemsSummary}
                  onChange={(e) => setPoItemsSummary(e.target.value)}
                  placeholder="e.g. Immunodoc 30 Units, OrthoDoc 20 Units"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPOModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow"
                >
                  Save PO & Minus Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 5-Day Credit Reminder QR */}
      {selectedCreditInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                5-Day Credit Payment Reminder & QR
              </h3>
              <button onClick={() => setSelectedCreditInv(null)} className="font-bold text-slate-400">
                ✕
              </button>
            </div>
            {(() => {
              const due = selectedCreditInv.balanceDue || selectedCreditInv.grandTotal;
              const uri = getUPIPaymentURI({
                vpa: franchiseConfig.bankUpiId,
                payeeName: franchiseConfig.name,
                amount: due,
                transactionNote: selectedCreditInv.invoiceNumber,
              });
              const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;
              const wa = buildWhatsApp5DayCreditReminderUrl(selectedCreditInv, franchiseConfig);
              return (
                <div className="space-y-3 text-center">
                  <img src={qr} alt="Credit QR" className="h-40 w-40 mx-auto rounded-xl border p-2 bg-white" />
                  <p className="text-lg font-black text-emerald-700">Amount Due: {formatINR(due)}</p>
                  <p className="text-slate-500">
                    Customer: {selectedCreditInv.customerName} (+91 {selectedCreditInv.customerMobile})
                  </p>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Send 5-Day Credit Reminder & QR on WhatsApp</span>
                  </a>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
