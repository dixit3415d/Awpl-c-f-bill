import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  AlertCircle,
  PackageCheck,
  Building2,
  Download,
  Users,
  Sparkles,
  Calendar,
  CreditCard,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  BellRing,
  Smartphone,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import {
  AWPLProduct,
  CFBillRecord,
  Customer,
  FranchiseConfig,
  InAppNotification,
  Invoice,
  SubscriptionPlan,
  UserSubscription
} from '../types';
import { exportToCSV, formatINR } from '../utils/storage';

interface AdminDashboardProps {
  invoices: Invoice[];
  products: AWPLProduct[];
  customers: Customer[];
  cfRecords: CFBillRecord[];
  userSubscriptions: UserSubscription[];
  franchiseConfig: FranchiseConfig;
  inAppNotifications?: InAppNotification[];
  onNavigateTo: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  invoices,
  products,
  customers,
  cfRecords,
  userSubscriptions,
  franchiseConfig,
  inAppNotifications = [],
  onNavigateTo,
}) => {
  const [dateRange, setDateRange] = useState<'today' | 'this_month' | 'all'>('this_month');

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

    return invoices.filter((inv) => {
      if (inv.paymentStatus === 'cancelled') return false;
      const invDate = inv.date.split(' ')[0];
      if (dateRange === 'today') return invDate === todayStr;
      if (dateRange === 'this_month') return invDate.startsWith(currentMonthStr);
      return true;
    });
  }, [invoices, dateRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let salesRev = 0;
    let spSum = 0;
    let taxSum = 0;
    let discountSum = 0;
    let outstandingSum = 0;

    invoices.forEach((inv) => {
      if (inv.paymentStatus !== 'cancelled') {
        outstandingSum += inv.balanceDue;
      }
    });

    filteredInvoices.forEach((inv) => {
      salesRev += inv.grandTotal;
      spSum += inv.totalSp;
      taxSum += inv.taxTotal;
      discountSum += inv.discountTotal;
    });

    // Top selling products
    const productSalesMap: Record<string, { product: AWPLProduct; qty: number; revenue: number; sp: number }> = {};
    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'cancelled') return;
      inv.items.forEach((it) => {
        if (!productSalesMap[it.product.id]) {
          productSalesMap[it.product.id] = { product: it.product, qty: 0, revenue: 0, sp: 0 };
        }
        productSalesMap[it.product.id].qty += it.quantity;
        productSalesMap[it.product.id].revenue += it.lineTotal;
        productSalesMap[it.product.id].sp += it.spEarned;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // C&F pending
    const pendingCF = cfRecords.filter(
      (r) => r.status === 'Pending Verification' || r.status === 'Under Processing'
    );

    // Subscription MRR
    const subscriptionMRR = userSubscriptions.reduce((sum, s) => sum + s.amountPaid, 0);

    return {
      salesRev,
      spSum,
      taxSum,
      discountSum,
      outstandingSum,
      topProducts,
      pendingCF,
      subscriptionMRR,
    };
  }, [invoices, filteredInvoices, products, cfRecords, userSubscriptions]);

  const handleDownloadComprehensiveReport = () => {
    const rows = filteredInvoices.map((inv) => ({
      InvoiceNumber: inv.invoiceNumber,
      Date: inv.date,
      CustomerName: inv.customerName,
      Mobile: inv.customerMobile,
      AWPL_ID: inv.customerAwplId || 'Retail',
      TotalSP: inv.totalSp,
      GrandTotal: inv.grandTotal,
      PaymentMethod: inv.paymentMethod,
      PaymentStatus: inv.paymentStatus,
    }));

    exportToCSV(`DRW_Comprehensive_Report_${new Date().toISOString().slice(0, 10)}`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Franchise Operations & Financial Executive Dashboard
            </h2>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-400/50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
              ∞ Infinite Stock Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {franchiseConfig.name} • AWPL Code: {franchiseConfig.franchiseCode} • Solan, HP
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range pills */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'today' ? 'bg-white dark:bg-slate-700 shadow text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange('this_month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'this_month' ? 'bg-white dark:bg-slate-700 shadow text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === 'all' ? 'bg-white dark:bg-slate-700 shadow text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={handleDownloadComprehensiveReport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Explicitly separated Sales Revenue vs SP totals vs Subscriptions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Net Sales Revenue */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Sales Revenue ({dateRange.replace('_', ' ')})
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {formatINR(metrics.salesRev)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {filteredInvoices.length} invoices generated
          </p>
        </div>

        {/* KPI 2: Total AWPL Sales Points (SP) */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total AWPL SP Points
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {metrics.spSum} SP
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Official distributor points credit
          </p>
        </div>

        {/* KPI 3: C&F Pending Clearance */}
        <div
          onClick={() => onNavigateTo('cf_portal')}
          className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 cursor-pointer hover:border-emerald-500 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              C&F Solan Portal Clearance
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-700">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700 dark:text-purple-400">
            {invoices.filter((i) => i.cfSyncStatus === 'synced').length} Bills Cleared
          </div>
          <p className="mt-1 text-[11px] text-purple-600 dark:text-purple-300 font-semibold flex items-center gap-1">
            {inAppNotifications.length} Auto 7-Day Reminders • Track C&F →
          </p>
        </div>

        {/* KPI 4: App Subscription Revenue Credited to Owner A/c */}
        <div
          onClick={() => onNavigateTo('subscriptions')}
          className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 cursor-pointer hover:border-emerald-500 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Subscriptions in My A/c
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700 dark:text-blue-400">
            {formatINR(metrics.subscriptionMRR)}
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">
            C&F ₹699/₹7,130 • Cust ₹99 → {franchiseConfig.bankUpiId}
          </p>
        </div>
      </div>

      {/* Brand New C&F Welcome Banner when 0 Invoices Exist */}
      {invoices.length === 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-orange-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-2 border-orange-300 dark:border-orange-800/60 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 text-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
              Brand New Counter Ready • Session {franchiseConfig.invoiceYear || '2026-2027'}
            </span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Welcome to {franchiseConfig.name} ({franchiseConfig.shortName || 'DRW'})
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              All 66 official AWPL products are pre-loaded with DP, MRP, SP points, and GST rates. Your invoice counter is set to start cleanly at{' '}
              <strong className="font-mono text-orange-700 dark:text-orange-400">
                {(franchiseConfig.shortName || 'DRW')}/{franchiseConfig.invoiceYear || '2026-2027'}/{franchiseConfig.startingInvoiceNumber || 3000}
              </strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTo('billing')}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 text-xs font-black shadow-md transition cursor-pointer"
          >
            <span>Create First Invoice (#{franchiseConfig.startingInvoiceNumber || 3000}) →</span>
          </button>
        </div>
      )}

      {/* Middle Grid: Top Products & Automatic 7-Day Pending Bill Notification Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Selling AWPL Products (6 cols) */}
        <div className="lg:col-span-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-emerald-600" />
              Top Fast-Moving AWPL Products (∞ Stock)
            </h3>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
              All SKUs: ∞ Unlimited Supply
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {metrics.topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No product sales recorded yet.</p>
            ) : (
              metrics.topProducts.map((item, idx) => (
                <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{item.product.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {item.product.sku} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">Stock: ∞ Unlimited</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-slate-900 dark:text-white">
                      {item.qty} units ({formatINR(item.revenue)})
                    </p>
                    <p className="text-[10px] text-amber-600 font-bold">{item.sp} SP generated</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Automatic 7-Day Pending Bill Notifications: WhatsApp + Registered App User Alerts (6 cols) */}
        <div className="lg:col-span-6 rounded-2xl bg-white p-5 shadow-sm border border-amber-300 dark:bg-slate-900 dark:border-amber-800/70 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <BellRing className="h-4 w-4 text-amber-500" />
                Auto 7-Day Pending Bill Notifications (WhatsApp + In-App)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically triggered after 7 days via WhatsApp &amp; delivered In-App if mobile is registered.
              </p>
            </div>
            <button
              onClick={() => onNavigateTo('cf_portal')}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              Open C&F Portal →
            </button>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {inAppNotifications.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Zero bills pending over 7 days. All older C&F bills are updated online!
              </div>
            ) : (
              inAppNotifications.map((notif) => {
                const isRegistered = notif.channel === 'both_whatsapp_and_in_app';
                return (
                  <div
                    key={notif.id}
                    className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/25 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {notif.invoiceNumber}
                          </span>
                          <span className="rounded bg-red-600 text-white px-1.5 py-0.5 text-[9px] font-black">
                            {notif.daysPending} Days Pending
                          </span>
                          <span className="rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                            <MessageCircle className="h-2.5 w-2.5" />
                            Auto WhatsApp Triggered ✓
                          </span>
                          {isRegistered ? (
                            <span className="rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                              <Smartphone className="h-2.5 w-2.5" />
                              Registered on App: In-App Notified ✓
                            </span>
                          ) : (
                            <span className="rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 text-[9px] font-semibold">
                              WhatsApp Only (Number Not Registered)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 font-medium">
                          <strong>{notif.customerName}</strong> (+91 {notif.customerMobile}){' '}
                          {notif.awplId ? `[AWPL ID: ${notif.awplId}]` : ''} • {notif.pendingItemsCount} item(s) •{' '}
                          <strong>{formatINR(notif.totalAmount)}</strong> (+{notif.totalSp} SP)
                        </p>
                      </div>

                      <a
                        href={notif.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-[10px] font-black shadow-xs transition"
                        title="Open pre-filled WhatsApp 7-Day Pending Bill Notification"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>WhatsApp</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
