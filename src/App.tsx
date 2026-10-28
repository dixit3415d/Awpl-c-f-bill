/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Role,
  AppPortalMode,
  AWPLProduct,
  Customer,
  FranchiseConfig,
  Invoice,
  CFBillRecord,
  SubscriptionPlan,
  UserSubscription,
  InventoryMovement,
  AuditLog,
  StaffMember,
  InAppNotification,
  BankDeposit,
  PurchaseOrder,
  PurchaseBill,
  AppFeedback,
  ComplaintReport,
  MainAdminConfig,
  AuthSession
} from './types';
import {
  initAppData,
  getStorageItem,
  setStorageItem,
  getInvoiceDaysOld,
  findRegisteredAppCustomer,
  buildWhatsApp7DayReminderUrl,
  buildWhatsApp5DayCreditReminderUrl,
  buildWhatsAppPendingProductArrivalUrl,
  saveToCloudBackup,
  resetAppToBrandNew,
  evaluateSubscriptionLifecycle,
  formatINR,
  STORAGE_KEYS
} from './utils/storage';
import {
  INITIAL_MAIN_ADMIN_CONFIG,
  INITIAL_FRANCHISE_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_SUBSCRIPTION_PLANS
} from './data/initialData';
import { useOnlineStatus } from './hooks/usePWA';

// Components
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { OfflineBanner } from './components/OfflineBanner';
import { AdminDashboard } from './components/AdminDashboard';
import { POSBilling } from './components/POSBilling';
import { InvoiceList } from './components/InvoiceList';
import { LedgerBankModule } from './components/LedgerBankModule';
import { ProductCatalog } from './components/ProductCatalog';
import { CFPortalModule } from './components/CFPortalModule';
import { StaffManagementModule } from './components/StaffManagementModule';
import { CustomerPortal } from './components/CustomerPortal';
import { InventoryModule } from './components/InventoryModule';
import { SubscriptionModule } from './components/SubscriptionModule';
import { AuditCloudModule } from './components/AuditCloudModule';
import { MainAdminPortal } from './components/MainAdminPortal';
import { CnFSettingsAndRegisterModal } from './components/CnFSettingsAndRegisterModal';
import { FeedbackModal } from './components/FeedbackModal';
import { ComplaintReportModal } from './components/ComplaintReportModal';
import { DeviceSyncModal } from './components/DeviceSyncModal';
import { OfficialCertificateModal } from './components/OfficialCertificateModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { PortalAuthGateway } from './components/PortalAuthGateway';
import { GitFitHubModule } from './components/GitFitHubModule';

// Ensure localStorage seed & plan migrations run before initial state read
initAppData();

export default function App() {
  // Register service worker if available
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Online / Offline hook
  const isOnline = useOnlineStatus();
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // App Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return getStorageItem<boolean>('drw_theme_dark', false);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setStorageItem('drw_theme_dark', isDarkMode);
  }, [isDarkMode]);

  // Requirement #10: 3 Separate App Portals (C&F App, Customer App, and Main Admin App)
  const [activePortal, setActivePortal] = useState<AppPortalMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const appParam = params.get('app');
      if (appParam === 'customer_portal' || appParam === 'customer_app') return 'customer_app';
      if (appParam === 'main_app') return 'main_app';
    }
    const savedSession = getStorageItem<AuthSession | null>(STORAGE_KEYS.AUTH_SESSION, null);
    if (savedSession?.isAuthenticated && savedSession?.portal) {
      return savedSession.portal;
    }
    return 'cnf_app';
  });

  // Mandatory Login Session State (Everyone must use the app by login procedure)
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth')) {
        return null; // Force login/register gateway when opening a direct ?auth=login|register link
      }
    }
    return getStorageItem<AuthSession | null>(STORAGE_KEYS.AUTH_SESSION, null);
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalPortal, setAuthModalPortal] = useState<AppPortalMode>('cnf_app');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'change_pin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('auth');
      if (modeParam === 'register' || modeParam === 'change_pin') return modeParam;
    }
    return 'login';
  });

  // Staff Directory State
  const [staffList, setStaffList] = useState<StaffMember[]>(() =>
    getStorageItem<StaffMember[]>('drw_staff_v1', [])
  );

  // Current Role & User Identity
  const [currentUserRole, setCurrentUserRole] = useState<Role>(() => {
    const savedSession = getStorageItem<AuthSession | null>(STORAGE_KEYS.AUTH_SESSION, null);
    if (savedSession?.isAuthenticated && savedSession?.role) return savedSession.role;
    return activePortal === 'customer_app'
      ? 'customer'
      : activePortal === 'main_app'
      ? 'super_admin'
      : 'franchise_admin';
  });
  const [currentUserName, setCurrentUserName] = useState<string>(() => {
    const savedSession = getStorageItem<AuthSession | null>(STORAGE_KEYS.AUTH_SESSION, null);
    return savedSession?.userName || 'Dixit Sharma (DRW-ADMIN-01)';
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    activePortal === 'customer_app' ? 'customer_store' : 'dashboard'
  );

  // Modals: Certificate, Shortcuts, C&F Registration/Bank Settings, Feedback, Complaint, Device Sync
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isCnfSettingsOpen, setIsCnfSettingsOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState<boolean>(false);
  const [isDeviceSyncModalOpen, setIsDeviceSyncModalOpen] = useState<boolean>(false);
  const [quickAddProduct, setQuickAddProduct] = useState<AWPLProduct | null>(null);

  // Global PC Navigation Hotkeys (F1-F4, ?)
  useEffect(() => {
    const handleGlobalNavKeys = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInputActive = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      if (e.key === 'F1') {
        e.preventDefault();
        setActivePortal('cnf_app');
        setActiveTab('dashboard');
      } else if (e.key === 'F2' && !isInputActive) {
        e.preventDefault();
        setActivePortal('cnf_app');
        setActiveTab('billing');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActivePortal('cnf_app');
        setActiveTab('invoices');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActivePortal('cnf_app');
        setActiveTab('products');
      } else if (e.key === '?' && !isInputActive) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalNavKeys);
    return () => window.removeEventListener('keydown', handleGlobalNavKeys);
  }, []);

  // Main Datasets
  const [franchiseConfig, setFranchiseConfig] = useState<FranchiseConfig>(() =>
    getStorageItem<FranchiseConfig>('drw_franchise_config_v1', {} as any)
  );

  const [cnfAccounts, setCnfAccounts] = useState<FranchiseConfig[]>(() =>
    getStorageItem<FranchiseConfig[]>('drw_cnf_accounts_v1', [])
  );

  const [products, setProducts] = useState<AWPLProduct[]>(() =>
    getStorageItem<AWPLProduct[]>('drw_products_v1', [])
  );

  const [customers, setCustomers] = useState<Customer[]>(() =>
    getStorageItem<Customer[]>('drw_customers_v1', [])
  );

  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    getStorageItem<Invoice[]>('drw_invoices_v1', [])
  );

  const [offlineQueue, setOfflineQueue] = useState<Invoice[]>(() =>
    getStorageItem<Invoice[]>('drw_offline_queue_v1', [])
  );

  const [cfRecords, setCfRecords] = useState<CFBillRecord[]>(() =>
    getStorageItem<CFBillRecord[]>('drw_cf_records_v1', [])
  );

  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>(() =>
    getStorageItem<SubscriptionPlan[]>('drw_plans_v1', [])
  );

  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>(() =>
    getStorageItem<UserSubscription[]>('drw_user_subscriptions_v1', [])
  );

  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() =>
    getStorageItem<InventoryMovement[]>('drw_inventory_movements_v1', [])
  );

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    getStorageItem<AuditLog[]>('drw_audit_logs_v1', [])
  );

  const [bankDeposits, setBankDeposits] = useState<BankDeposit[]>(() =>
    getStorageItem<BankDeposit[]>('drw_bank_deposits_v1', [])
  );

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() =>
    getStorageItem<PurchaseOrder[]>('drw_purchase_orders_v1', [])
  );

  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>(() =>
    getStorageItem<PurchaseBill[]>('drw_purchase_bills_v1', [])
  );

  const [feedbacks, setFeedbacks] = useState<AppFeedback[]>(() =>
    getStorageItem<AppFeedback[]>('drw_app_feedbacks_v1', [])
  );

  const [complaints, setComplaints] = useState<ComplaintReport[]>(() =>
    getStorageItem<ComplaintReport[]>('drw_complaints_v1', [])
  );

  const [mainAdminConfig, setMainAdminConfig] = useState<MainAdminConfig>(() =>
    getStorageItem<MainAdminConfig>('drw_main_admin_config_v1', INITIAL_MAIN_ADMIN_CONFIG)
  );

  // Automatic 7-Day Pending Bill, 5-Day Credit Payment, and Pending Product Arrival Notification Engine
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    let invoicesModified = false;
    const generatedNotifs: InAppNotification[] = [];

    const nextInvoices = invoices.map((inv) => {
      if (inv.paymentStatus === 'cancelled') return inv;
      const daysOld = getInvoiceDaysOld(inv.date);
      const pendingItems = inv.items.filter((i) => !i.cfSynced);
      const isPendingBill = inv.cfSyncStatus !== 'synced' || pendingItems.length > 0;
      const regCust = findRegisteredAppCustomer(inv.customerMobile, customers);
      const isRegistered = Boolean(regCust);

      let updatedInv = { ...inv };

      // 1) 7-Day Online Pending Bill Reminder
      if (isPendingBill && daysOld >= 7) {
        const waUrl = buildWhatsApp7DayReminderUrl(inv, isRegistered);

        generatedNotifs.push({
          id: `notif-7d-${inv.id}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerMobile: inv.customerMobile,
          customerName: regCust?.name || inv.customerName,
          awplId: regCust?.awplId || inv.customerAwplId,
          daysPending: daysOld,
          pendingItemsCount: pendingItems.length || inv.items.length,
          totalAmount: inv.grandTotal,
          totalSp: inv.totalSp,
          message: `Auto 7-Day Alert: Invoice #${inv.invoiceNumber} (${daysOld} days old) has ${
            pendingItems.length || inv.items.length
          } item(s) pending online AWPL C&F update. Sent via WhatsApp${
            isRegistered ? ` & In-App to Registered Mobile +91 ${inv.customerMobile}` : ''
          }.`,
          whatsappUrl: waUrl,
          createdAt: inv.reminder7DaySentAt || nowTimestamp,
          channel: isRegistered ? 'both_whatsapp_and_in_app' : 'whatsapp_only',
          type: '7_day_online_pending',
        });

        if (
          !inv.autoWhatsappQueuedAt ||
          inv.isRegisteredAppCustomer !== isRegistered ||
          (isRegistered && !inv.autoInAppNotifiedAt)
        ) {
          invoicesModified = true;
          updatedInv = {
            ...updatedInv,
            reminder7DaySentAt: inv.reminder7DaySentAt || nowTimestamp,
            autoWhatsappQueuedAt: inv.autoWhatsappQueuedAt || nowTimestamp,
            isRegisteredAppCustomer: isRegistered,
            autoInAppNotifiedAt: isRegistered ? inv.autoInAppNotifiedAt || nowTimestamp : undefined,
          };
        }
      }

      // 2) 5-Day Credit Payment Reminder (with Payment Amount + UPI QR)
      const isCreditDue =
        (inv.paymentMethod === 'Credit' || inv.balanceDue > 0) &&
        inv.paymentStatus !== 'paid' &&
        daysOld >= 5;

      if (isCreditDue) {
        const dueAmount = inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal;
        const waCreditUrl = buildWhatsApp5DayCreditReminderUrl(inv, franchiseConfig);

        generatedNotifs.push({
          id: `notif-5d-credit-${inv.id}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerMobile: inv.customerMobile,
          customerName: regCust?.name || inv.customerName,
          awplId: regCust?.awplId || inv.customerAwplId,
          daysPending: daysOld,
          pendingItemsCount: inv.items.length,
          totalAmount: dueAmount,
          totalSp: inv.totalSp,
          message: `5-Day Credit Payment Reminder: ₹${dueAmount.toLocaleString('en-IN')} due on Bill #${
            inv.invoiceNumber
          } (${daysOld} days old). Sent with Payment Amount & UPI QR Code (${
            franchiseConfig.bankUpiId || 'dixitsharma@upi'
          }).`,
          whatsappUrl: waCreditUrl,
          createdAt: inv.creditReminder5DaySentAt || nowTimestamp,
          channel: isRegistered ? 'both_whatsapp_and_in_app' : 'whatsapp_only',
          type: 'credit_5day_due',
        });

        if (!inv.creditReminder5DaySentAt) {
          invoicesModified = true;
          updatedInv = {
            ...updatedInv,
            creditReminder5DaySentAt: nowTimestamp,
          };
        }
      }

      // 3) Pending Product Arrival Notification (Requirement #15)
      inv.items.forEach((it, idx) => {
        if (it.isPendingProduct && it.pendingProductStatus !== 'given') {
          const waPendUrl = buildWhatsAppPendingProductArrivalUrl(inv, it.product.name);
          generatedNotifs.push({
            id: `notif-pending-prod-${inv.id}-${idx}`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerMobile: inv.customerMobile,
            customerName: regCust?.name || inv.customerName,
            awplId: regCust?.awplId || inv.customerAwplId,
            daysPending: daysOld,
            pendingItemsCount: it.quantity,
            totalAmount: it.lineTotal,
            totalSp: it.spEarned,
            message: `Pending Product Alert: "${it.product.name}" (x${it.quantity}) on Bill #${
              inv.invoiceNumber
            } is Pending. ${
              isRegistered
                ? `Customer +91 ${inv.customerMobile} is Registered on App → Notified in Customer App!`
                : `Customer +91 ${inv.customerMobile} is Unregistered → Send WhatsApp Arrival Reminder!`
            }`,
            whatsappUrl: waPendUrl,
            createdAt: it.pendingArrivalNotifiedAt || inv.date,
            channel: isRegistered ? 'both_whatsapp_and_in_app' : 'whatsapp_only',
            type: 'pending_product_arrived',
          });
        }
      });

      return updatedInv;
    });

    setInAppNotifications(generatedNotifs);

    if (invoicesModified) {
      setInvoices(nextInvoices);
      setStorageItem('drw_invoices_v1', nextInvoices);
      saveToCloudBackup();
    }
  }, [invoices, customers, franchiseConfig]);

  // Switch between the 3 distinct App Portals: C&F App, Customer App, and Main App
  // Every portal requires its own login procedure!
  const handlePortalChange = (portal: AppPortalMode) => {
    setActivePortal(portal);
    if (portal === 'customer_app') {
      setCurrentUserRole('customer');
      setActiveTab('customer_store');
    } else if (portal === 'main_app') {
      setCurrentUserRole('super_admin');
      setActiveTab('dashboard');
    } else {
      setCurrentUserRole('franchise_admin');
      setActiveTab('dashboard');
    }
    if (!authSession || !authSession.isAuthenticated || authSession.portal !== portal) {
      setAuthModalPortal(portal);
      setAuthModalMode('login');
    }
  };

  // Handle Login / Registration Success from PortalAuthGateway
  const handleLoginSuccess = (
    session: AuthSession,
    selectedCnf?: FranchiseConfig,
    _selectedCustomer?: Customer
  ) => {
    const normalizedSession: AuthSession = {
      ...session,
      identifier:
        session.identifier ||
        (session.role === 'franchise_admin' || session.role === 'super_admin'
          ? session.userEmail
          : session.userMobile),
    };
    setAuthSession(normalizedSession);
    setStorageItem(STORAGE_KEYS.AUTH_SESSION, normalizedSession);
    setActivePortal(normalizedSession.portal);
    setCurrentUserRole(normalizedSession.role);
    setCurrentUserName(normalizedSession.userName);

    if (selectedCnf) {
      setFranchiseConfig(selectedCnf);
      setStorageItem(STORAGE_KEYS.CONFIG, selectedCnf);
      if (selectedCnf.customProducts && selectedCnf.customProducts.length > 0) {
        setProducts(selectedCnf.customProducts);
        setStorageItem(STORAGE_KEYS.PRODUCTS, selectedCnf.customProducts);
      }
    }

    if (normalizedSession.portal === 'customer_app') {
      setActiveTab('customer_store');
    } else {
      setActiveTab('dashboard');
    }

    setIsAuthModalOpen(false);
    saveToCloudBackup();
  };

  // Handle Logout — Clears session, records audit log, and returns to login screen
  const handleLogout = () => {
    const loggedOutPortal = activePortal;
    handleAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `User Logged Out (${loggedOutPortal})`,
      category: 'Security',
      user: currentUserName,
      details: `Session signed out cleanly from ${loggedOutPortal}.`,
    });
    setAuthSession(null);
    setStorageItem(STORAGE_KEYS.AUTH_SESSION, null);
    const nextPortal = loggedOutPortal === 'main_app' ? 'cnf_app' : loggedOutPortal;
    if (loggedOutPortal === 'main_app') {
      setActivePortal('cnf_app');
    }
    setAuthModalPortal(nextPortal);
    setAuthModalMode('login');
    setIsAuthModalOpen(false);
  };

  // Factory Reset App to Brand New State (Keeps official AWPL Product Catalog, wipes all demo/old records, starts at Bill #3000)
  const handleResetAppToBrandNew = () => {
    resetAppToBrandNew();
    setFranchiseConfig(INITIAL_FRANCHISE_CONFIG);
    setCnfAccounts([]);
    setProducts(INITIAL_PRODUCTS);
    setCustomers([]);
    setInvoices([]);
    setOfflineQueue([]);
    setCfRecords([]);
    setSubscriptionPlans(INITIAL_SUBSCRIPTION_PLANS);
    setUserSubscriptions([]);
    setInventoryMovements([]);
    setAuditLogs([]);
    setStaffList([]);
    setBankDeposits([]);
    setPurchaseOrders([]);
    setPurchaseBills([]);
    setFeedbacks([]);
    setComplaints([]);
    setMainAdminConfig(INITIAL_MAIN_ADMIN_CONFIG);
    setAuthSession(null);
    setAuthModalPortal('cnf_app');
    setAuthModalMode('register');
    setIsAuthModalOpen(false);
  };

  // Sync Offline Queue when online
  const handleSyncOfflineQueue = () => {
    if (offlineQueue.length === 0) return;
    setIsSyncingOffline(true);

    setTimeout(() => {
      const synced = invoices.map((inv) => ({
        ...inv,
        isSynced: true,
      }));
      setInvoices(synced);
      setStorageItem('drw_invoices_v1', synced);
      setOfflineQueue([]);
      setStorageItem('drw_offline_queue_v1', []);
      saveToCloudBackup();
      setIsSyncingOffline(false);

      handleAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        action: 'Offline Invoices Synchronized',
        category: 'Billing',
        user: `${currentUserName} (${currentUserRole})`,
        details: `Successfully synchronized ${offlineQueue.length} offline invoice(s) to cloud database.`,
      });
    }, 1200);
  };

  // Add Audit Log Helper
  const handleAddAuditLog = (log: AuditLog) => {
    setAuditLogs((prev) => {
      const updated = [log, ...prev];
      setStorageItem('drw_audit_logs_v1', updated);
      return updated;
    });
  };

  // Handle Full Backup Restore
  const handleRestoreFullBackup = (data: any) => {
    if (data.franchiseConfig) {
      setFranchiseConfig(data.franchiseConfig);
      setStorageItem('drw_franchise_config_v1', data.franchiseConfig);
    }
    if (data.cnfAccounts) {
      setCnfAccounts(data.cnfAccounts);
      setStorageItem('drw_cnf_accounts_v1', data.cnfAccounts);
    }
    if (data.products) {
      setProducts(data.products);
      setStorageItem('drw_products_v1', data.products);
    }
    if (data.customers) {
      setCustomers(data.customers);
      setStorageItem('drw_customers_v1', data.customers);
    }
    if (data.invoices) {
      setInvoices(data.invoices);
      setStorageItem('drw_invoices_v1', data.invoices);
    }
    if (data.cfRecords) {
      setCfRecords(data.cfRecords);
      setStorageItem('drw_cf_records_v1', data.cfRecords);
    }
    if (data.staffList) {
      setStaffList(data.staffList);
      setStorageItem('drw_staff_v1', data.staffList);
    }
    if (data.bankDeposits) {
      setBankDeposits(data.bankDeposits);
      setStorageItem('drw_bank_deposits_v1', data.bankDeposits);
    }
    if (data.purchaseOrders) {
      setPurchaseOrders(data.purchaseOrders);
      setStorageItem('drw_purchase_orders_v1', data.purchaseOrders);
    }
    if (data.purchaseBills) {
      setPurchaseBills(data.purchaseBills);
      setStorageItem('drw_purchase_bills_v1', data.purchaseBills);
    }
    if (data.feedbacks) {
      setFeedbacks(data.feedbacks);
      setStorageItem('drw_app_feedbacks_v1', data.feedbacks);
    }
    if (data.complaints) {
      setComplaints(data.complaints);
      setStorageItem('drw_complaints_v1', data.complaints);
    }
    if (data.mainAdminConfig) {
      setMainAdminConfig(data.mainAdminConfig);
      setStorageItem('drw_main_admin_config_v1', data.mainAdminConfig);
    }
    if (data.auditLogs) {
      setAuditLogs(data.auditLogs);
      setStorageItem('drw_audit_logs_v1', data.auditLogs);
    }
  };

  // Requirement #10: Simultaneous Real-Time Sync across up to 5 PCs and 1 Mobile
  const pullCloudState = async () => {
    try {
      const res = await fetch('/api/cloud/state');
      const json = await res.json();
      if (json?.ok && json?.data) {
        handleRestoreFullBackup(json.data);
      }
    } catch {
      // Offline fallback uses BroadcastChannel / localStorage
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    let devId = localStorage.getItem('drw_this_device_id');
    if (!devId) {
      devId = `dev-${isMob ? 'mob' : 'pc'}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('drw_this_device_id', devId);
    }

    fetch('/api/cloud/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: devId,
        cnfId: franchiseConfig.id || 'cnf-dright-solan',
        deviceType: isMob ? 'mobile' : 'pc',
        deviceName: isMob ? 'Franchise Mobile App' : 'POS Billing PC Terminal',
        platformInfo: isMob ? 'Mobile Web / Android PWA' : 'Desktop PC Browser',
        operatorName: currentUserName,
      }),
    }).catch(() => {});

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('drw_cloud_sync_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'CLOUD_STATE_UPDATED' && ev.data?.payload) {
          handleRestoreFullBackup(ev.data.payload);
        }
      };
    }

    return () => {
      bc?.close();
    };
  }, [franchiseConfig.id]);

  // Callback when an invoice is created from POS or Customer store
  const handleInvoiceCreated = (newInv: Invoice) => {
    setInvoices((prev) => [newInv, ...prev]);
    if (!isOnline) {
      setOfflineQueue((prev) => [newInv, ...prev]);
    }
    saveToCloudBackup();
  };

  // Select a specific Staff Member as active operator
  const handleSelectActiveStaff = (member: StaffMember) => {
    setActivePortal('cnf_app');
    setCurrentUserRole(member.role);
    setCurrentUserName(`${member.name} (${member.employeeCode})`);
    if (activeTab === 'customer_store') {
      setActiveTab('billing');
    }
  };

  // If role changes via role mode selector
  const handleRoleChange = (role: Role) => {
    setCurrentUserRole(role);
    if (role === 'customer') {
      setActivePortal('customer_app');
      setCurrentUserName('Customer Self-Order Mode');
      setActiveTab('customer_store');
    } else if (role === 'super_admin') {
      setActivePortal('main_app');
      setCurrentUserName(`${mainAdminConfig.mainAdminName} (Main Admin)`);
      setActiveTab('dashboard');
    } else {
      setActivePortal('cnf_app');
      const matchingStaff = staffList.find((s) => s.role === role && s.status === 'active');
      if (matchingStaff) {
        setCurrentUserName(`${matchingStaff.name} (${matchingStaff.employeeCode})`);
      } else {
        setCurrentUserName(`Operator (${role})`);
      }
      if (activeTab === 'customer_store') {
        setActiveTab('dashboard');
      }
    }
  };

  // Mandatory Login Gate: Everyone (C&F Owner, C&F Staff, Customer, Main Admin) must log in to use their portal
  const isPortalAuthenticated = Boolean(
    authSession && authSession.isAuthenticated && authSession.portal === activePortal
  );

  if (!isPortalAuthenticated) {
    return (
      <PortalAuthGateway
        initialPortal={activePortal}
        initialMode={authModalMode}
        cnfAccounts={cnfAccounts}
        activeCnfConfig={franchiseConfig}
        customers={customers}
        staffList={staffList}
        mainAdminConfig={mainAdminConfig}
        onLoginSuccess={handleLoginSuccess}
        onUpdateCnfAccounts={setCnfAccounts}
        onUpdateActiveCnf={setFranchiseConfig}
        onUpdateCustomers={setCustomers}
        onUpdateStaff={setStaffList}
        onUpdateMainAdminConfig={setMainAdminConfig}
        onAddAuditLog={handleAddAuditLog}
        isModal={false}
      />
    );
  }

  const subLifecycle = evaluateSubscriptionLifecycle(
    userSubscriptions,
    activePortal,
    franchiseConfig,
    currentUserName
  );

  const handleInstantSubscriptionRenew = async (
    durationDays: number = 30,
    amountPaid: number = activePortal === 'customer_app' ? 99 : 699
  ) => {
    const isCust = activePortal === 'customer_app';
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + durationDays);
    const paymentRef = `SUB-RENEW-${Date.now().toString().slice(-6)}`;

    const renewedSub: UserSubscription = {
      id: subLifecycle.subscription?.id || `sub-${Date.now()}`,
      userId:
        subLifecycle.subscription?.userId ||
        (isCust ? `cust-${Date.now().toString().slice(-4)}` : franchiseConfig.id || 'cnf-drw'),
      userName:
        subLifecycle.subscription?.userName ||
        (isCust ? currentUserName : `${franchiseConfig.name} (${currentUserName})`),
      userRole: isCust ? 'customer' : 'franchise_admin',
      planId: isCust
        ? 'plan-customer-monthly'
        : durationDays >= 365
        ? 'plan-cf-yearly'
        : 'plan-cf-monthly',
      planName: isCust
        ? 'Customer VIP Monthly Plan (₹99/mo)'
        : durationDays >= 365
        ? 'C&F Yearly Plan (₹7,130/yr)'
        : 'C&F Monthly Plan (₹699/mo)',
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      status: 'active',
      paymentRef,
      amountPaid,
      autoRenew: true,
      settledToAccount: `${franchiseConfig.name} (${franchiseConfig.bankUpiId})`,
      settledStatus: 'Credited to Owner A/c',
    };

    const filtered = userSubscriptions.filter(
      (s) => s.id !== renewedSub.id && s.userId !== renewedSub.userId && s.userName !== renewedSub.userName
    );
    const updatedSubs = [renewedSub, ...filtered];
    setUserSubscriptions(updatedSubs);
    setStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, updatedSubs);
    saveToCloudBackup();

    try {
      await fetch('/api/subscriptions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: renewedSub.userId,
          userName: renewedSub.userName,
          userRole: renewedSub.userRole,
          planId: renewedSub.planId,
          planName: renewedSub.planName,
          durationDays,
          amountPaid,
          paymentRef,
          settledToAccount: renewedSub.settledToAccount,
        }),
      });
    } catch {
      // local state already updated
    }

    handleAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Subscription Renewed Immediately: ${renewedSub.planName}`,
      category: 'Subscription',
      user: currentUserName,
      details: `Renewed for ${durationDays} days (${formatINR(amountPaid)}) • 100% of existing data resumed intact.`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50/50 via-white to-orange-50/30 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* Offline sync banner if disconnected or queue exists */}
      <OfflineBanner
        isOnline={isOnline}
        offlineQueueCount={offlineQueue.length}
        onSyncOfflineQueue={handleSyncOfflineQueue}
        isSyncing={isSyncingOffline}
      />

      {/* Main Header with 3-App Switcher (C&F App | Customer App | Main App) + Orange/Black AWPL Logo */}
      <Header
        franchiseConfig={franchiseConfig}
        cnfAccounts={cnfAccounts}
        onSelectCnf={(cfg) => {
          setFranchiseConfig(cfg);
          setStorageItem(STORAGE_KEYS.CONFIG, cfg);
          if (cfg.customProducts && cfg.customProducts.length > 0) {
            setProducts(cfg.customProducts);
            setStorageItem(STORAGE_KEYS.PRODUCTS, cfg.customProducts);
          }
          saveToCloudBackup();
        }}
        activePortal={activePortal}
        onPortalChange={handlePortalChange}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
        staffList={staffList}
        onRoleChange={handleRoleChange}
        onSelectStaff={handleSelectActiveStaff}
        onOpenStaffManager={() => {
          setActivePortal('cnf_app');
          setActiveTab('staff');
        }}
        onOpenCnfSettings={() => setIsCnfSettingsOpen(true)}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        onOpenComplaint={() => setIsComplaintModalOpen(true)}
        onOpenDeviceSync={() => setIsDeviceSyncModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isOnline={isOnline}
        offlineQueueCount={offlineQueue.length}
        onOpenCertificate={() => setIsCertificateModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        authSession={authSession}
        onOpenAuthModal={(portal, mode) => {
          setAuthModalPortal(portal || activePortal);
          setAuthModalMode(mode || 'login');
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onResetToBrandNew={handleResetAppToBrandNew}
        onOpenGitFit={() => {
          setActivePortal('cnf_app');
          setActiveTab('gitfit_hub');
        }}
      />

      {/* Navigation Bars (PC Top Bar + Android Mobile Bottom Bar & Drawer) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUserRole={currentUserRole}
        activePortal={activePortal}
        onLogout={handleLogout}
      />

      {/* Requirement #5: C&F Privacy Permission Request Banner (Shown in C&F App when Main App requests access) */}
      {activePortal === 'cnf_app' &&
        franchiseConfig.privacyAccessPermission?.accessRequestedByMainApp &&
        !franchiseConfig.privacyAccessPermission?.grantedToMainApp && (
          <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 print:hidden">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/70 border-2 border-amber-500 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="rounded bg-amber-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                  Official AWPL Privacy &amp; Consent Protocol • Main App Access Request
                </span>
                <p className="font-black text-slate-900 dark:text-white mt-1">
                  Main App Admin requested permission to access {franchiseConfig.name} portal:{' '}
                  <span className="font-normal text-slate-700 dark:text-slate-300">
                    "{franchiseConfig.privacyAccessPermission.requestReason || 'To resolve your reported issue'}"
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
                    const updatedCfg: FranchiseConfig = {
                      ...franchiseConfig,
                      privacyAccessPermission: {
                        ...franchiseConfig.privacyAccessPermission,
                        grantedToMainApp: true,
                        accessRequestedByMainApp: false,
                        grantedAt: nowTime,
                      },
                    };
                    setFranchiseConfig(updatedCfg);
                    setStorageItem(STORAGE_KEYS.CONFIG, updatedCfg);
                    const nextCnfs = cnfAccounts.map((c) =>
                      c.id === updatedCfg.id || c.name === updatedCfg.name ? updatedCfg : c
                    );
                    setCnfAccounts(nextCnfs);
                    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, nextCnfs);
                    saveToCloudBackup();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow"
                >
                  ✓ Grant Permission to Main App
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Continuous Renewal Reminder Notification Banner (Shown After 25 Days Elapsed / Days 26 to 30) */}
      {activePortal !== 'main_app' && subLifecycle.isReminderWindow && (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 print:hidden">
          <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-black text-amber-300 px-2 py-0.5 text-[10px] font-black uppercase">
                  🔔 Continuous Renewal Reminder (25+ Days Completed)
                </span>
                <span className="font-mono font-black text-white">
                  Only {subLifecycle.daysRemaining} Day(s) Remaining before Day 31 Expiry
                </span>
              </div>
              <p className="font-bold text-white/95">
                Your subscription ({subLifecycle.subscription?.planName}) expires on{' '}
                <strong className="underline">{subLifecycle.subscription?.expiryDate}</strong>. Please renew before the 31st day to avoid any pause in billing (100% of your data is always kept safe).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleInstantSubscriptionRenew(30, activePortal === 'customer_app' ? 99 : 699)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 text-orange-700 font-black shadow cursor-pointer"
              >
                ⚡ Renew Subscription Immediately ({activePortal === 'customer_app' ? '₹99/mo' : '₹699/mo'})
              </button>
              {activePortal === 'cnf_app' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('subscriptions')}
                  className="px-3 py-2 rounded-xl bg-black/30 hover:bg-black/50 text-white font-bold border border-white/30 cursor-pointer"
                >
                  View Plans
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 pb-24 lg:pb-8">
        {/* 31st-Day Non-Destructive Subscription Pause Gate (Zero Data Deleted — Resumes From Saved Data Immediately Upon Renewal) */}
        {activePortal !== 'main_app' &&
        subLifecycle.isEndedDay31 &&
        activeTab !== 'subscriptions' ? (
          <div className="max-w-3xl mx-auto my-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-orange-500 shadow-2xl overflow-hidden text-xs">
            <div className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 text-white p-6 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="rounded-full bg-amber-400 text-black px-3 py-0.5 text-[10px] font-black uppercase">
                  Day 31 Reached • Subscription Ended • 100% Data Preserved
                </span>
                <span className="font-mono text-[11px] text-emerald-300 font-bold">
                  ✓ Zero Data Deleted Guarantee
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black">
                Your 30-Day Subscription Cycle Has Ended on the 31st Day
              </h2>
              <p className="text-slate-300 leading-relaxed">
                Your subscription ({subLifecycle.subscription?.planName || 'Monthly Plan'}) expired on{' '}
                <strong>{subLifecycle.subscription?.expiryDate}</strong>. All your records are{' '}
                <strong className="text-emerald-300">100% safely stored and intact</strong>. Renew your subscription below (or click Admin Activate) to immediately resume work from your exact saved data:
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Preserved Data Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5">
                  <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 block">
                    {invoices.length}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Saved Invoices Intact
                  </span>
                </div>
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5">
                  <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 block">
                    {customers.length}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Saved Customers Intact
                  </span>
                </div>
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5">
                  <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 block">
                    {products.length}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Catalog &amp; Stock Intact
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleInstantSubscriptionRenew(
                      30,
                      activePortal === 'customer_app' ? 99 : 699
                    )
                  }
                  className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg cursor-pointer transition"
                >
                  ✓ Renew Monthly Plan ({activePortal === 'customer_app' ? '₹99' : '₹699'}) &amp; Resume Data Now
                </button>

                {activePortal === 'cnf_app' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('subscriptions');
                    }}
                    className="py-3.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs sm:text-sm shadow-lg cursor-pointer transition"
                  >
                    Open Full UPI Payment Gateway &amp; Yearly Plan →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInstantSubscriptionRenew(365, 999)}
                    className="py-3.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs sm:text-sm shadow-lg cursor-pointer transition"
                  >
                    ⚡ 1-Click Activate &amp; Resume Work
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Signed in as <strong>{currentUserName}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow cursor-pointer transition"
                >
                  Log Out / Switch User Account
                </button>
              </div>
            </div>
          </div>
        ) : activePortal === 'main_app' ? (
          <MainAdminPortal
            mainAdminConfig={mainAdminConfig}
            onUpdateMainAdminConfig={setMainAdminConfig}
            cnfAccounts={cnfAccounts}
            onUpdateCnfAccounts={setCnfAccounts}
            activeCnfConfig={franchiseConfig}
            onSelectActiveCnf={(cfg) => {
              setFranchiseConfig(cfg);
              setStorageItem('drw_franchise_config_v1', cfg);
              if (cfg.customProducts && cfg.customProducts.length > 0) {
                setProducts(cfg.customProducts);
                setStorageItem('drw_products_v1', cfg.customProducts);
              }
              setActivePortal('cnf_app');
              setActiveTab('dashboard');
            }}
            onOpenRegisterCnf={() => setIsCnfSettingsOpen(true)}
            customers={customers}
            invoices={invoices}
            userSubscriptions={userSubscriptions}
            onUpdateSubscriptions={setUserSubscriptions}
            feedbacks={feedbacks}
            onUpdateFeedbacks={setFeedbacks}
            complaints={complaints}
            onUpdateComplaints={setComplaints}
            onSwitchPortal={handlePortalChange}
            onAddAuditLog={handleAddAuditLog}
            onLogout={handleLogout}
          />
        ) : activePortal === 'customer_app' || activeTab === 'customer_store' ? (
          <CustomerPortal
            products={products}
            customers={customers}
            franchiseConfig={franchiseConfig}
            cnfAccounts={cnfAccounts}
            onUpdateCustomers={setCustomers}
            onUpdateProducts={(nextProds) => {
              setProducts(nextProds);
              setStorageItem('drw_products_v1', nextProds);
              const nextCnfs = cnfAccounts.map((c) =>
                c.id === franchiseConfig.id || c.name === franchiseConfig.name
                  ? { ...c, customProducts: nextProds }
                  : c
              );
              setCnfAccounts(nextCnfs);
              setStorageItem('drw_cnf_accounts_v1', nextCnfs);
              saveToCloudBackup();
            }}
            onUpdateConfig={setFranchiseConfig}
            invoices={invoices}
            onUpdateInvoices={setInvoices}
            cfRecords={cfRecords}
            onUpdateCFRecords={setCfRecords}
            onInvoiceCreated={handleInvoiceCreated}
            userSubscriptions={userSubscriptions}
            onUpdateSubscriptions={setUserSubscriptions}
            inAppNotifications={inAppNotifications}
            onOpenFeedback={() => setIsFeedbackModalOpen(true)}
            onLogout={handleLogout}
            onChangePin={() => {
              setAuthModalPortal('customer_app');
              setAuthModalMode('change_pin');
              setIsAuthModalOpen(true);
            }}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <AdminDashboard
                invoices={invoices}
                products={products}
                customers={customers}
                cfRecords={cfRecords}
                userSubscriptions={userSubscriptions}
                franchiseConfig={franchiseConfig}
                inAppNotifications={inAppNotifications}
                onNavigateTo={(tab) => setActiveTab(tab as NavTab)}
              />
            )}

            {activeTab === 'gitfit_hub' && (
              <GitFitHubModule
                franchiseConfig={franchiseConfig}
                cnfAccounts={cnfAccounts}
                products={products}
                userSubscriptions={userSubscriptions}
                currentUserName={currentUserName}
                onUpdateConfig={setFranchiseConfig}
                onUpdateCnfAccounts={setCnfAccounts}
                onUpdateProducts={(nextProds) => {
                  setProducts(nextProds);
                  setStorageItem(STORAGE_KEYS.PRODUCTS, nextProds);
                  saveToCloudBackup();
                }}
                onUpdateSubscriptions={setUserSubscriptions}
                onQuickSendToPos={(prod) => {
                  setQuickAddProduct(prod);
                  setActiveTab('billing');
                }}
                onNavigateToPos={() => setActiveTab('billing')}
                onAddAuditLog={handleAddAuditLog}
              />
            )}

            {activeTab === 'billing' && (
              <POSBilling
                products={products}
                customers={customers}
                franchiseConfig={franchiseConfig}
                onUpdateProducts={(nextProds) => {
                  setProducts(nextProds);
                  setStorageItem('drw_products_v1', nextProds);
                  const nextCnfs = cnfAccounts.map((c) =>
                    c.id === franchiseConfig.id || c.name === franchiseConfig.name
                      ? { ...c, customProducts: nextProds }
                      : c
                  );
                  setCnfAccounts(nextCnfs);
                  setStorageItem('drw_cnf_accounts_v1', nextCnfs);
                  saveToCloudBackup();
                }}
                onUpdateCustomers={setCustomers}
                onUpdateConfig={setFranchiseConfig}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                isOnline={isOnline}
                onInvoiceCreated={handleInvoiceCreated}
                quickAddProduct={quickAddProduct}
                onClearQuickAddProduct={() => setQuickAddProduct(null)}
              />
            )}

            {activeTab === 'invoices' && (
              <InvoiceList
                invoices={invoices}
                products={products}
                customers={customers}
                franchiseConfig={franchiseConfig}
                onUpdateConfig={setFranchiseConfig}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onUpdateInvoices={setInvoices}
                onAddAuditLog={handleAddAuditLog}
              />
            )}

            {activeTab === 'ledgers' && (
              <LedgerBankModule
                invoices={invoices}
                bankDeposits={bankDeposits}
                purchaseOrders={purchaseOrders}
                franchiseConfig={franchiseConfig}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onUpdateBankDeposits={setBankDeposits}
                onUpdatePurchaseOrders={setPurchaseOrders}
                onAddAuditLog={handleAddAuditLog}
              />
            )}

            {activeTab === 'products' && (
              <ProductCatalog
                products={products}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onUpdateProducts={(nextProds) => {
                  setProducts(nextProds);
                  setStorageItem('drw_products_v1', nextProds);
                  const nextCnfs = cnfAccounts.map((c) =>
                    c.id === franchiseConfig.id || c.name === franchiseConfig.name
                      ? { ...c, customProducts: nextProds }
                      : c
                  );
                  setCnfAccounts(nextCnfs);
                  setStorageItem('drw_cnf_accounts_v1', nextCnfs);
                  saveToCloudBackup();
                }}
                onAddAuditLog={handleAddAuditLog}
                onQuickSendToPos={(prod) => {
                  setQuickAddProduct(prod);
                  setActiveTab('billing');
                }}
              />
            )}

            {activeTab === 'cf_portal' && (
              <CFPortalModule
                cfRecords={cfRecords}
                invoices={invoices}
                customers={customers}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onUpdateCFRecords={setCfRecords}
                onUpdateInvoices={setInvoices}
                onAddAuditLog={handleAddAuditLog}
              />
            )}

            {activeTab === 'staff' && (
              <StaffManagementModule
                staffList={staffList}
                invoices={invoices}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onUpdateStaff={setStaffList}
                onSelectActiveStaff={handleSelectActiveStaff}
                onAddAuditLog={handleAddAuditLog}
                ownerApprovalCode={franchiseConfig.ownerApprovalCode}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryModule
                products={products}
                movements={inventoryMovements}
                franchiseConfig={franchiseConfig}
                purchaseBills={purchaseBills}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onUpdateProducts={(nextProds) => {
                  setProducts(nextProds);
                  setStorageItem('drw_products_v1', nextProds);
                  const nextCnfs = cnfAccounts.map((c) =>
                    c.id === franchiseConfig.id || c.name === franchiseConfig.name
                      ? { ...c, customProducts: nextProds }
                      : c
                  );
                  setCnfAccounts(nextCnfs);
                  setStorageItem('drw_cnf_accounts_v1', nextCnfs);
                  saveToCloudBackup();
                }}
                onUpdateMovements={setInventoryMovements}
                onUpdatePurchaseBills={setPurchaseBills}
                onUpdateConfig={setFranchiseConfig}
                onAddAuditLog={handleAddAuditLog}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionModule
                plans={subscriptionPlans}
                userSubscriptions={userSubscriptions}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                franchiseConfig={franchiseConfig}
                onUpdatePlans={setSubscriptionPlans}
                onUpdateSubscriptions={setUserSubscriptions}
                onUpdateConfig={setFranchiseConfig}
                onAddAuditLog={handleAddAuditLog}
              />
            )}

            {activeTab === 'audit' && (
              <AuditCloudModule
                auditLogs={auditLogs}
                franchiseConfig={franchiseConfig}
                currentUserRole={currentUserRole}
                currentUserName={currentUserName}
                onAddAuditLog={handleAddAuditLog}
                onRestoreFullBackup={handleRestoreFullBackup}
              />
            )}
          </>
        )}
      </main>

      {/* Official Legal & Franchise Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 text-center text-xs text-slate-500 print:hidden hidden lg:block">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            © {new Date().getFullYear()} <strong>C&amp;F Bill</strong> — <strong>{franchiseConfig.name}</strong> ({franchiseConfig.shortName || 'DRW'}). Authorized Franchise Under <strong>Asclepius Wellness Private Limited (AWPL)</strong>.
          </p>
          <p className="text-[11px] text-slate-400">
            Terms: All pending products will be given by the original bill • GSTIN: {franchiseConfig.gstin}
          </p>
        </div>
      </footer>

      {/* C&F Registration, Bank/UPI QR & Invoice Prefix Modal */}
      <CnFSettingsAndRegisterModal
        isOpen={isCnfSettingsOpen}
        onClose={() => setIsCnfSettingsOpen(false)}
        activeConfig={franchiseConfig}
        cnfAccounts={cnfAccounts}
        onUpdateActiveConfig={(cfg) => {
          setFranchiseConfig(cfg);
          setStorageItem('drw_franchise_config_v1', cfg);
          saveToCloudBackup();
        }}
        onUpdateCnfAccounts={(list) => {
          setCnfAccounts(list);
          setStorageItem('drw_cnf_accounts_v1', list);
          saveToCloudBackup();
        }}
        onAddAuditLog={handleAddAuditLog}
      />

      {/* Feedback Modal for C&Fs and Customers */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        portalMode={activePortal}
        defaultName={activePortal === 'customer_app' ? customers[0]?.name || 'Customer' : franchiseConfig.franchiseOwner}
        defaultMobile={activePortal === 'customer_app' ? customers[0]?.mobile || '' : franchiseConfig.phone}
        cnfName={franchiseConfig.name}
        feedbacks={feedbacks}
        onUpdateFeedbacks={setFeedbacks}
      />

      {/* Requirement #4: Complaint / Report Modal with Picture/PDF Upload & Gemini AI Verification */}
      <ComplaintReportModal
        isOpen={isComplaintModalOpen}
        onClose={() => setIsComplaintModalOpen(false)}
        portalMode={activePortal}
        defaultName={activePortal === 'customer_app' ? customers[0]?.name || 'Customer' : franchiseConfig.franchiseOwner}
        defaultMobile={activePortal === 'customer_app' ? customers[0]?.mobile || '' : franchiseConfig.phone}
        cnfId={franchiseConfig.id}
        cnfName={franchiseConfig.name}
        complaints={complaints}
        onUpdateComplaints={setComplaints}
      />

      {/* Requirement #10: Multi-Device Simultaneous Sync Modal (Max 5 PCs + 1 Mobile) */}
      <DeviceSyncModal
        isOpen={isDeviceSyncModalOpen}
        onClose={() => setIsDeviceSyncModalOpen(false)}
        franchiseConfig={franchiseConfig}
        operatorName={currentUserName}
        onPullCloudState={pullCloudState}
      />

      {/* Official Certificate Modal */}
      <OfficialCertificateModal
        isOpen={isCertificateModalOpen}
        onClose={() => setIsCertificateModalOpen(false)}
        franchiseConfig={franchiseConfig}
      />

      {/* PC Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Modal Portal Login / Registration / Change 4-Digit PIN Gateway */}
      {isAuthModalOpen && (
        <PortalAuthGateway
          initialPortal={authModalPortal}
          initialMode={authModalMode}
          cnfAccounts={cnfAccounts}
          activeCnfConfig={franchiseConfig}
          customers={customers}
          staffList={staffList}
          mainAdminConfig={mainAdminConfig}
          onLoginSuccess={handleLoginSuccess}
          onUpdateCnfAccounts={setCnfAccounts}
          onUpdateActiveCnf={setFranchiseConfig}
          onUpdateCustomers={setCustomers}
          onUpdateStaff={setStaffList}
          onUpdateMainAdminConfig={setMainAdminConfig}
          onAddAuditLog={handleAddAuditLog}
          onCloseModal={() => setIsAuthModalOpen(false)}
          isModal={true}
        />
      )}
    </div>
  );
}
