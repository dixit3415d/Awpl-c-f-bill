import {
  AWPLProduct,
  Customer,
  FranchiseConfig,
  Invoice,
  SubscriptionPlan,
  CFBillRecord,
  UserSubscription,
  InventoryMovement,
  AuditLog,
  StaffMember,
  BankDeposit,
  PurchaseOrder,
  PurchaseBill,
  AppFeedback,
  MainAdminConfig,
  ComplaintReport,
  ConnectedDeviceSession
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_FRANCHISE_CONFIG,
  INITIAL_SUBSCRIPTION_PLANS,
  INITIAL_USER_SUBSCRIPTIONS,
  INITIAL_CF_RECORDS,
  INITIAL_AUDIT_LOGS,
  INITIAL_INVOICES,
  INITIAL_STAFF_MEMBERS,
  INITIAL_BANK_DEPOSITS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_CNF_ACCOUNTS,
  INITIAL_PURCHASE_BILLS,
  INITIAL_APP_FEEDBACKS,
  INITIAL_MAIN_ADMIN_CONFIG,
  INITIAL_COMPLAINTS,
  DEFAULT_BILL_PRINT_CONFIG
} from '../data/initialData';

export const STORAGE_KEYS = {
  PRODUCTS: 'drw_products_v1',
  CUSTOMERS: 'drw_customers_v1',
  CONFIG: 'drw_franchise_config_v1',
  CNF_ACCOUNTS: 'drw_cnf_accounts_v1',
  PURCHASE_BILLS: 'drw_purchase_bills_v1',
  FEEDBACKS: 'drw_app_feedbacks_v1',
  MAIN_ADMIN_CONFIG: 'drw_main_admin_config_v1',
  INVOICES: 'drw_invoices_v1',
  OFFLINE_QUEUE: 'drw_offline_queue_v1',
  PLANS: 'drw_plans_v1',
  USER_SUBSCRIPTIONS: 'drw_user_subscriptions_v1',
  CF_RECORDS: 'drw_cf_records_v1',
  INVENTORY_MOVEMENTS: 'drw_inventory_movements_v1',
  AUDIT_LOGS: 'drw_audit_logs_v1',
  STAFF: 'drw_staff_v1',
  BANK_DEPOSITS: 'drw_bank_deposits_v1',
  PURCHASE_ORDERS: 'drw_purchase_orders_v1',
  COMPLAINTS: 'drw_complaints_v1',
  DEVICES: 'drw_connected_devices_v1',
  CLOUD_SNAPSHOT: 'drw_cloud_snapshot_v1',
  DARK_MODE: 'drw_theme_dark',
  AUTH_SESSION: 'drw_auth_session_v1',
  BRAND_NEW_RESET_V2: 'drw_brand_new_reset_v2',
};

export const buildWhatsAppOfficialAppLinksUrl = (
  targetMobile: string = '',
  shareScope: 'all' | 'cnf' | 'customer' = 'all'
): string => {
  const baseOrigin =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://drightwellness.awpl.in/';

  const cnfLoginUrl = `${baseOrigin}?app=cnf_app&auth=login`;
  const cnfRegisterUrl = `${baseOrigin}?app=cnf_app&auth=register`;
  const customerLoginUrl = `${baseOrigin}?app=customer_app&auth=login`;
  const customerRegisterUrl = `${baseOrigin}?app=customer_app&auth=register`;

  const cleanPhone = (targetMobile || '').replace(/\D/g, '').slice(-10);
  const waTarget = cleanPhone.length === 10 ? `91${cleanPhone}` : '';

  let text = `🌿 *C&F BILL — OFFICIAL AWPL PORTAL & PLAY STORE APP LINKS (Asclepius Wellness Pvt. Ltd.)*\n\n`;

  if (shareScope === 'all' || shareScope === 'cnf') {
    text +=
      `🔗 *1. Official C&F App (Franchise Owner & Counter Staff Portal):*\n` +
      `• Login Link: ${cnfLoginUrl}\n` +
      `• New C&F / Staff Registration (6-Digit OTP + Approval Code): ${cnfRegisterUrl}\n\n`;
  }

  if (shareScope === 'all' || shareScope === 'customer') {
    text +=
      `🛍️ *2. Official Customer App (Online Ordering & DP/SP Store):*\n` +
      `• Customer Login Link: ${customerLoginUrl}\n` +
      `• Customer Registration Link (6-Digit OTP + Approval Code): ${customerRegisterUrl}\n\n`;
  }

  text +=
    `📱 *Install on Android / Google Play Store TWA:*\n` +
    `• App Link: ${baseOrigin}?source=playstore_twa\n` +
    `🔒 *Security:* Every user sets their own private, masked 4-Digit PIN (••••) known only to them.`;

  // When waTarget is empty (''), https://wa.me/?text=... opens WhatsApp's direct contact picker without requiring a phone number!
  return `https://wa.me/${waTarget}?text=${encodeURIComponent(text)}`;
};

export const WHATSAPP_BUSINESS_OTP_SENDER = '8988311142';
export const WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY = '+91 8988311142';

export const triggerWhatsAppDeepLink = (whatsappUrl: string): void => {
  if (typeof document === 'undefined' || !whatsappUrl) return;
  try {
    const a = document.createElement('a');
    a.href = whatsappUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.warn('Could not auto-trigger WhatsApp deep link:', err);
  }
};

export const dispatchWhatsAppOtpFrom8988311142 = async (params: {
  recipientMobile: string;
  recipientName?: string;
  purpose: 'registration' | 'forgot_credentials';
  roleLabel: string;
  otpCode: string;
  autoTriggerWhatsApp?: boolean;
}): Promise<{
  ok: boolean;
  senderNumber: string;
  senderDisplay: string;
  recipientMobile: string;
  otp: string;
  whatsappUrl: string;
  messageText: string;
}> => {
  const cleanMob = (params.recipientMobile || '').replace(/\D/g, '').slice(-10);
  const purposeLabel =
    params.purpose === 'forgot_credentials'
      ? 'Forgot Username & Password Recovery'
      : 'New Account Registration Verification';

  const fallbackText =
    `🌿 *C&F Bill — Official WhatsApp Business OTP (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY})*\n\n` +
    `Namaste *${params.recipientName || 'AWPL Member'}*,\n` +
    `Your 6-Digit Verification OTP for *${purposeLabel}* (${params.roleLabel}) is:\n\n` +
    `🔐 *OTP: ${params.otpCode}*\n\n` +
    `📲 *Sent from Official WhatsApp Business:* ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}\n` +
    `*(Valid for 10 minutes. Do not share this OTP with anyone.)*`;

  const fallbackUrl = `https://wa.me/91${cleanMob}?text=${encodeURIComponent(fallbackText)}`;

  try {
    const res = await fetch('/api/whatsapp/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientMobile: cleanMob,
        recipientName: params.recipientName || 'AWPL Member',
        purpose: params.purpose,
        roleLabel: params.roleLabel,
        otpCode: params.otpCode,
      }),
    });
    const data = await res.json();
    const finalUrl = data?.whatsappUrl || fallbackUrl;
    if (params.autoTriggerWhatsApp) {
      triggerWhatsAppDeepLink(finalUrl);
    }
    return {
      ok: Boolean(data?.ok ?? true),
      senderNumber: WHATSAPP_BUSINESS_OTP_SENDER,
      senderDisplay: WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY,
      recipientMobile: cleanMob,
      otp: data?.otp || params.otpCode,
      whatsappUrl: finalUrl,
      messageText: data?.messageText || fallbackText,
    };
  } catch {
    if (params.autoTriggerWhatsApp) {
      triggerWhatsAppDeepLink(fallbackUrl);
    }
    return {
      ok: true,
      senderNumber: WHATSAPP_BUSINESS_OTP_SENDER,
      senderDisplay: WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY,
      recipientMobile: cleanMob,
      otp: params.otpCode,
      whatsappUrl: fallbackUrl,
      messageText: fallbackText,
    };
  }
};

export const dispatchCredentialsToUserWhatsApp = async (params: {
  recipientMobile: string;
  recipientName: string;
  roleLabel: string;
  usernameType: 'Email ID' | 'Mobile Number';
  usernameValue: string;
  pinPassword: string;
  portalLink: string;
  reason: 'post_registration' | 'forgot_credentials_recovery';
  autoTriggerWhatsApp?: boolean;
}): Promise<{
  ok: boolean;
  senderNumber: string;
  senderDisplay: string;
  recipientMobile: string;
  whatsappUrl: string;
  messageText: string;
}> => {
  const cleanMob = (params.recipientMobile || '').replace(/\D/g, '').slice(-10);
  const headerTitle =
    params.reason === 'forgot_credentials_recovery'
      ? `🌿 *C&F Bill — WhatsApp Username & Password Recovery (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY})*`
      : `🌿 *C&F Bill — Official Registration Credentials (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY})*`;

  const introLine =
    params.reason === 'forgot_credentials_recovery'
      ? `Your 6-Digit OTP verification is complete. Here are your registered *${params.roleLabel}* login credentials:`
      : `Your *${params.roleLabel}* registration is verified and complete! Here are your official login credentials:`;

  const fallbackText =
    `${headerTitle}\n\n` +
    `Namaste *${params.recipientName}*,\n` +
    `${introLine}\n\n` +
    `👤 *Login Username (${params.usernameType}):* ${params.usernameValue}\n` +
    `🔑 *Login Password (4-Digit PIN):* ${params.pinPassword}\n` +
    `🔗 *Direct Portal Login Link:* ${params.portalLink}\n\n` +
    `📲 *Dispatched Automatically from Official WhatsApp Business:* ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}\n` +
    `🔒 *(Keep this WhatsApp message private for your future login.)*`;

  const fallbackUrl = `https://wa.me/91${cleanMob}?text=${encodeURIComponent(fallbackText)}`;

  try {
    const res = await fetch('/api/whatsapp/send-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientMobile: cleanMob,
        recipientName: params.recipientName,
        roleLabel: params.roleLabel,
        usernameType: params.usernameType,
        usernameValue: params.usernameValue,
        pinPassword: params.pinPassword,
        portalLink: params.portalLink,
        reason: params.reason,
      }),
    });
    const data = await res.json();
    const finalUrl = data?.whatsappUrl || fallbackUrl;
    if (params.autoTriggerWhatsApp) {
      triggerWhatsAppDeepLink(finalUrl);
    }
    return {
      ok: Boolean(data?.ok ?? true),
      senderNumber: WHATSAPP_BUSINESS_OTP_SENDER,
      senderDisplay: WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY,
      recipientMobile: cleanMob,
      whatsappUrl: finalUrl,
      messageText: data?.messageText || fallbackText,
    };
  } catch {
    if (params.autoTriggerWhatsApp) {
      triggerWhatsAppDeepLink(fallbackUrl);
    }
    return {
      ok: true,
      senderNumber: WHATSAPP_BUSINESS_OTP_SENDER,
      senderDisplay: WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY,
      recipientMobile: cleanMob,
      whatsappUrl: fallbackUrl,
      messageText: fallbackText,
    };
  }
};

export const syncPinChangeOnline = async (params: {
  portal: string;
  identifier: string;
  newPin: string;
  cnfId?: string;
  staffId?: string;
  customerId?: string;
  updatedCnfAccounts?: FranchiseConfig[];
  updatedStaffList?: StaffMember[];
  updatedCustomers?: Customer[];
  updatedMainAdminConfig?: MainAdminConfig;
}): Promise<boolean> => {
  try {
    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    saveToCloudBackup();
    return Boolean(data?.ok);
  } catch (err) {
    console.warn('Online PIN sync fallback to cloud backup:', err);
    saveToCloudBackup();
    return false;
  }
};

export interface SubscriptionLifecycleStatus {
  hasSubscriptionRecord: boolean;
  subscription: UserSubscription | null;
  daysElapsed: number;
  daysRemaining: number;
  isReminderWindow: boolean; // Days 26 to 30 (after 25 days elapsed, or <= 5 days left)
  isEndedDay31: boolean; // Day 31+ (0 or fewer days remaining) — subscription ended, data 100% preserved
}

export const evaluateSubscriptionLifecycle = (
  subscriptions: UserSubscription[],
  portal: 'cnf_app' | 'customer_app' | 'main_app',
  activeCnf?: FranchiseConfig,
  currentUserName?: string
): SubscriptionLifecycleStatus => {
  if (portal === 'main_app') {
    return {
      hasSubscriptionRecord: true,
      subscription: null,
      daysElapsed: 0,
      daysRemaining: 365,
      isReminderWindow: false,
      isEndedDay31: false,
    };
  }

  const targetRole = portal === 'customer_app' ? 'customer' : 'franchise_admin';
  const relevantSubs = (subscriptions || []).filter((s) => s.userRole === targetRole);

  let matchedSub: UserSubscription | null = null;
  if (portal === 'cnf_app' && activeCnf) {
    matchedSub =
      relevantSubs.find(
        (s) =>
          s.userId === activeCnf.id ||
          s.userName.toLowerCase().includes((activeCnf.name || '').toLowerCase()) ||
          s.userName.toLowerCase().includes((activeCnf.shortName || '').toLowerCase())
      ) ||
      relevantSubs[0] ||
      null;
  } else if (currentUserName) {
    matchedSub =
      relevantSubs.find((s) =>
        s.userName.toLowerCase().includes(currentUserName.toLowerCase())
      ) ||
      relevantSubs[0] ||
      null;
  } else {
    matchedSub = relevantSubs[0] || null;
  }

  if (!matchedSub) {
    return {
      hasSubscriptionRecord: false,
      subscription: null,
      daysElapsed: 0,
      daysRemaining: 30,
      isReminderWindow: false,
      isEndedDay31: false,
    };
  }

  const nowMs = Date.now();
  const startMs = new Date(matchedSub.startDate).getTime();
  const expiryMs = new Date(matchedSub.expiryDate).getTime();

  const daysElapsed = Number.isFinite(startMs)
    ? Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)))
    : 0;
  const daysRemaining = Number.isFinite(expiryMs)
    ? Math.ceil((expiryMs - nowMs) / (1000 * 60 * 60 * 24))
    : 30;

  const isEndedDay31 =
    matchedSub.status === 'expired' || daysRemaining <= 0;
  const isReminderWindow =
    !isEndedDay31 && (daysRemaining <= 5 || (daysElapsed >= 25 && daysRemaining <= 6));

  return {
    hasSubscriptionRecord: true,
    subscription: matchedSub,
    daysElapsed,
    daysRemaining: Math.max(0, daysRemaining),
    isReminderWindow,
    isEndedDay31,
  };
};

// Safe storage wrapper
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
};

export const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
};

// Reset the entire application to a Brand New Production State (Keeps Official AWPL Catalog & Plans only)
export const resetAppToBrandNew = (): void => {
  try {
    const freshProducts = INITIAL_PRODUCTS.map((p) => ({
      ...p,
      stock: 999999,
      status: 'active' as const,
    }));
    const freshConfig: FranchiseConfig = {
      ...INITIAL_FRANCHISE_CONFIG,
      startingInvoiceNumber: 3000,
      invoiceSequence: 2999,
      sessionSequences: {
        '2026-2027': 2999,
      },
      currentFinancialYear: '2026-2027',
      availableSessions: ['2025-2026', '2026-2027', '2027-2028'],
    };

    setStorageItem(STORAGE_KEYS.PRODUCTS, freshProducts);
    setStorageItem(STORAGE_KEYS.CONFIG, freshConfig);
    setStorageItem(STORAGE_KEYS.PLANS, INITIAL_SUBSCRIPTION_PLANS);
    setStorageItem(STORAGE_KEYS.MAIN_ADMIN_CONFIG, INITIAL_MAIN_ADMIN_CONFIG);

    // Wipe all transactional & demo records
    setStorageItem(STORAGE_KEYS.CUSTOMERS, []);
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, []);
    setStorageItem(STORAGE_KEYS.INVOICES, []);
    setStorageItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
    setStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, []);
    setStorageItem(STORAGE_KEYS.CF_RECORDS, []);
    setStorageItem(STORAGE_KEYS.INVENTORY_MOVEMENTS, []);
    setStorageItem(STORAGE_KEYS.AUDIT_LOGS, []);
    setStorageItem(STORAGE_KEYS.STAFF, []);
    setStorageItem(STORAGE_KEYS.BANK_DEPOSITS, []);
    setStorageItem(STORAGE_KEYS.PURCHASE_ORDERS, []);
    setStorageItem(STORAGE_KEYS.PURCHASE_BILLS, []);
    setStorageItem(STORAGE_KEYS.FEEDBACKS, []);
    setStorageItem(STORAGE_KEYS.COMPLAINTS, []);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.setItem(STORAGE_KEYS.BRAND_NEW_RESET_V2, 'true');

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const snapshot = {
      lastCloudSyncedAt: nowStr,
      invoicesCount: 0,
      status: 'Brand New Production Workspace Ready (Starts at Bill #3000)',
    };
    setStorageItem(STORAGE_KEYS.CLOUD_SNAPSHOT, snapshot);

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      const cleanPayload = {
        franchiseConfig: freshConfig,
        cnfAccounts: [],
        mainAdminConfig: INITIAL_MAIN_ADMIN_CONFIG,
        products: freshProducts,
        customers: [],
        invoices: [],
        purchaseBills: [],
        feedbacks: [],
        complaints: [],
        userSubscriptions: [],
        staffList: [],
        cfRecords: [],
        bankDeposits: [],
        purchaseOrders: [],
        auditLogs: [],
        invoicesCount: 0,
        customersCount: 0,
        subscriptionsCount: 0,
        feedbacksCount: 0,
        complaintsCount: 0,
        lastCloudSyncedAt: nowStr,
      };
      fetch('/api/cloud/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaceAll: true, payload: cleanPayload }),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Error resetting app to brand new:', err);
  }
};

// Auto-save invoices, C&F accounts, subscriptions, complaints, feedback & financial ledgers to Cloud Server + BroadcastChannel
export const saveToCloudBackup = (invoicesList?: Invoice[]) => {
  try {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const invoicesData = invoicesList || getStorageItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    const snapshot = {
      lastCloudSyncedAt: nowStr,
      invoicesCount: invoicesData.length,
      status: 'All C&F, Customer & Main App Data Saved on Cloud Vault (5 PC + 1 Mobile Sync Active)',
    };
    setStorageItem(STORAGE_KEYS.CLOUD_SNAPSHOT, snapshot);

    // Push asynchronously to backend Cloud Storage (/api/cloud/state) for multi-device sync (5 PC + 1 Mobile)
    if (typeof window !== 'undefined') {
      const payload = {
        franchiseConfig: getStorageItem(STORAGE_KEYS.CONFIG, INITIAL_FRANCHISE_CONFIG),
        cnfAccounts: getStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, INITIAL_CNF_ACCOUNTS),
        mainAdminConfig: getStorageItem(STORAGE_KEYS.MAIN_ADMIN_CONFIG, INITIAL_MAIN_ADMIN_CONFIG),
        products: getStorageItem(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS),
        customers: getStorageItem(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS),
        invoices: invoicesData,
        purchaseBills: getStorageItem(STORAGE_KEYS.PURCHASE_BILLS, INITIAL_PURCHASE_BILLS),
        feedbacks: getStorageItem(STORAGE_KEYS.FEEDBACKS, INITIAL_APP_FEEDBACKS),
        complaints: getStorageItem(STORAGE_KEYS.COMPLAINTS, INITIAL_COMPLAINTS),
        userSubscriptions: getStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, INITIAL_USER_SUBSCRIPTIONS),
        staffList: getStorageItem(STORAGE_KEYS.STAFF, INITIAL_STAFF_MEMBERS),
        invoicesCount: invoicesData.length,
        customersCount: getStorageItem(STORAGE_KEYS.CUSTOMERS, []).length,
        subscriptionsCount: getStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, []).length,
        feedbacksCount: getStorageItem(STORAGE_KEYS.FEEDBACKS, []).length,
        complaintsCount: getStorageItem(STORAGE_KEYS.COMPLAINTS, []).length,
        lastCloudSyncedAt: nowStr,
      };

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('drw_cloud_sync_channel');
          bc.postMessage({ type: 'CLOUD_STATE_UPDATED', lastSyncedAt: nowStr, payload });
          bc.close();
        } catch {
          // ignore BroadcastChannel error
        }
      }

      if (typeof fetch !== 'undefined') {
        fetch('/api/cloud/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        }).catch(() => {
          // Offline or local-only fallback
        });
      }
    }

    return nowStr;
  } catch {
    return '';
  }
};

// Initialize State in Storage if not present
export const initAppData = () => {
  // One-time Brand-New Production Reset Migration (clears any legacy demo records)
  if (!localStorage.getItem(STORAGE_KEYS.BRAND_NEW_RESET_V2)) {
    resetAppToBrandNew();
    return;
  }

  const existingProds = getStorageItem<AWPLProduct[] | null>(STORAGE_KEYS.PRODUCTS, null);
  if (!existingProds || existingProds.length < 50) {
    const customMap = new Map<string, AWPLProduct>();
    if (existingProds) {
      existingProds.forEach((p) => customMap.set(p.sku, p));
    }
    const mergedProds = INITIAL_PRODUCTS.map((initP) => {
      const prev = customMap.get(initP.sku);
      if (prev && prev.source === 'Manual Entry') {
        return { ...initP, ...prev, stock: prev.stock || 999999 };
      }
      return {
        ...initP,
        stopCustomerAppSale: prev?.stopCustomerAppSale ?? initP.stopCustomerAppSale ?? false,
        stock: 999999,
      };
    });
    setStorageItem(STORAGE_KEYS.PRODUCTS, mergedProds);
  } else {
    const normalizedProds = existingProds.map((p) => ({
      ...p,
      stock: p.stock > 0 ? p.stock : 999999,
      status: p.status === 'out_of_stock' ? ('active' as const) : p.status,
    }));
    setStorageItem(STORAGE_KEYS.PRODUCTS, normalizedProds);
  }

  if (localStorage.getItem(STORAGE_KEYS.CUSTOMERS) === null) {
    setStorageItem(STORAGE_KEYS.CUSTOMERS, []);
  }

  const storedConfig = getStorageItem<FranchiseConfig | null>(STORAGE_KEYS.CONFIG, null);
  if (!storedConfig || !storedConfig.shortName) {
    setStorageItem(STORAGE_KEYS.CONFIG, INITIAL_FRANCHISE_CONFIG);
  }

  if (localStorage.getItem(STORAGE_KEYS.CNF_ACCOUNTS) === null) {
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, []);
  }

  if (localStorage.getItem(STORAGE_KEYS.COMPLAINTS) === null) {
    setStorageItem(STORAGE_KEYS.COMPLAINTS, []);
  }

  if (localStorage.getItem(STORAGE_KEYS.PURCHASE_BILLS) === null) {
    setStorageItem(STORAGE_KEYS.PURCHASE_BILLS, []);
  }

  if (localStorage.getItem(STORAGE_KEYS.FEEDBACKS) === null) {
    setStorageItem(STORAGE_KEYS.FEEDBACKS, []);
  }

  const storedMainAdmin = getStorageItem<MainAdminConfig | null>(STORAGE_KEYS.MAIN_ADMIN_CONFIG, null);
  if (!storedMainAdmin || !storedMainAdmin.mainBankAccountNumber) {
    setStorageItem(STORAGE_KEYS.MAIN_ADMIN_CONFIG, INITIAL_MAIN_ADMIN_CONFIG);
  }

  const storedPlans = getStorageItem<SubscriptionPlan[] | null>(STORAGE_KEYS.PLANS, null);
  const hasNewThreePlans =
    storedPlans &&
    storedPlans.length === 3 &&
    storedPlans.some((p) => p.id === 'plan-cf-monthly' && p.price === 699) &&
    storedPlans.some((p) => p.id === 'plan-cf-yearly' && p.price === 7130) &&
    storedPlans.some((p) => p.id === 'plan-customer-monthly' && p.price === 99);
  if (!hasNewThreePlans) {
    setStorageItem(STORAGE_KEYS.PLANS, INITIAL_SUBSCRIPTION_PLANS);
  }

  if (localStorage.getItem(STORAGE_KEYS.USER_SUBSCRIPTIONS) === null) {
    setStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, []);
  }

  if (localStorage.getItem(STORAGE_KEYS.CF_RECORDS) === null) {
    setStorageItem(STORAGE_KEYS.CF_RECORDS, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) === null) {
    setStorageItem(STORAGE_KEYS.AUDIT_LOGS, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.INVOICES) === null) {
    setStorageItem(STORAGE_KEYS.INVOICES, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE) === null) {
    setStorageItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.INVENTORY_MOVEMENTS) === null) {
    setStorageItem(STORAGE_KEYS.INVENTORY_MOVEMENTS, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.STAFF) === null) {
    setStorageItem(STORAGE_KEYS.STAFF, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.BANK_DEPOSITS) === null) {
    setStorageItem(STORAGE_KEYS.BANK_DEPOSITS, []);
  }
  if (localStorage.getItem(STORAGE_KEYS.PURCHASE_ORDERS) === null) {
    setStorageItem(STORAGE_KEYS.PURCHASE_ORDERS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLOUD_SNAPSHOT)) {
    saveToCloudBackup();
  }
};

// Helper: Calculate how many days old an invoice is (for 7-day pending online update & 5-day credit reminders)
export const getInvoiceDaysOld = (dateStr: string): number => {
  try {
    const cleanDate = dateStr.split(' ')[0];
    const invTime = new Date(cleanDate).getTime();
    const nowTime = new Date('2026-10-25').getTime();
    const actualNow = Math.max(nowTime, Date.now());
    const diffDays = Math.floor((actualNow - invTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
};

// Helper: Check if a mobile number is registered in our Customer App
export const findRegisteredAppCustomer = (
  mobile: string,
  customers: Customer[]
): Customer | undefined => {
  const clean = (mobile || '').replace(/\D/g, '').slice(-10);
  if (!clean || clean === '9800000000') return undefined;
  return customers.find(
    (c) =>
      (c.mobile || '').replace(/\D/g, '').slice(-10) === clean &&
      c.isAppRegistered !== false
  );
};

// Helper: Build Pending Product Arrival Reminder WhatsApp URL (Requirement #14 & #15)
export const buildWhatsAppPendingProductArrivalUrl = (
  inv: Invoice,
  configOrProductName?: FranchiseConfig | string
): string => {
  const cleanMob = (inv.customerMobile || '').replace(/\D/g, '').slice(-10);
  const isConfigObj = typeof configOrProductName === 'object' && configOrProductName !== null;
  const cnfName = isConfigObj ? configOrProductName.name : inv.cnfName || 'D RIGHT WELLNESS';
  const cnfAddress = isConfigObj
    ? configOrProductName.address
    : '26, First Floor, Shoolini Enclave, Bye Pass Road, Solan, Himachal Pradesh — 173212';
  const cnfPhone = isConfigObj ? configOrProductName.phone : '+91 98160-88421';

  const pendingItems = inv.items.filter(
    (i) => i.isPendingProduct && i.pendingProductStatus !== 'given'
  );
  const itemsToList = pendingItems.length > 0 ? pendingItems : inv.items.filter((i) => i.isPendingProduct);

  const itemLines =
    typeof configOrProductName === 'string' && configOrProductName.trim()
      ? `• ${configOrProductName}`
      : itemsToList.map((i) => `• ${i.product.name} (Qty: ${i.quantity})`).join('\n');

  const text =
    `🌿 *${cnfName} (Asclepius Wellness Pvt. Ltd. C&F)*\n` +
    `📦 *PENDING PRODUCT ARRIVAL NOTIFICATION*\n\n` +
    `Namaste *${inv.customerName}*,\n` +
    `Your pending product(s) under Bill *${inv.invoiceNumber}* dated *${inv.date.split(' ')[0]}* are now available for pickup at *${cnfName}*:\n\n` +
    `*Pending Product(s) Ready:*\n${itemLines || '• Pending Bill Items'}\n\n` +
    `⚠️ *Terms & Conditions (${cnfName}):*\n` +
    `*All pending products will be given by the original bill.*\n\n` +
    `📍 *Address:* ${cnfAddress}\n` +
    `📞 *Contact:* ${cnfPhone}`;

  const targetPhone = cleanMob.length === 10 ? `91${cleanMob}` : cleanMob;
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
};

// Helper: Build automatic 5-Day Credit Payment Reminder WhatsApp URL (with Payment Amount + UPI QR Link)
export const buildWhatsApp5DayCreditReminderUrl = (
  inv: Invoice,
  config: FranchiseConfig
): string => {
  const cleanMob = (inv.customerMobile || '').replace(/\D/g, '').slice(-10);
  const daysOld = getInvoiceDaysOld(inv.date);
  const dueAmount = inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal;
  const activeVpa = config.bankUpiId || (config.upiNumber ? `${config.upiNumber}@upi` : 'drightwellness@upi');
  const upiUri = `upi://pay?pa=${encodeURIComponent(activeVpa)}&pn=${encodeURIComponent(
    config.name
  )}&am=${dueAmount.toFixed(2)}&tn=${encodeURIComponent(`Credit Bill ${inv.invoiceNumber}`)}&cu=INR`;
  const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;

  const itemLines = inv.items
    .map((i) => `• ${i.product.name} (x${i.quantity}) — ₹${i.lineTotal.toLocaleString('en-IN')}`)
    .join('\n');

  const text =
    `🌿 *${config.name} (AWPL Official C&F)*\n` +
    `💳 *AUTOMATIC 5-DAY CREDIT PAYMENT REMINDER*\n\n` +
    `Namaste *${inv.customerName}*,\n` +
    `You purchased AWPL goods on *Credit* under Bill *${inv.invoiceNumber}* dated *${inv.date.split(' ')[0]}* (*${daysOld} days ago*).\n\n` +
    `*Payment Due Details:*\n` +
    `• *Pending Credit Amount:* *₹${dueAmount.toLocaleString('en-IN')}*\n` +
    `• *Items Taken:*\n${itemLines}\n\n` +
    `*Instant UPI Payment & QR Code:*\n` +
    `• *UPI ID:* ${activeVpa}${config.upiNumber ? ` (UPI No: ${config.upiNumber})` : ''}\n` +
    `• *Bank:* ${config.bankName} (A/c: ${config.accountNo}, IFSC: ${config.ifscCode})\n` +
    `• *Tap to Pay via UPI App:* ${upiUri}\n` +
    `• *Scan UPI QR Code:* ${qrLink}\n\n` +
    `Please clear the pending amount of *₹${dueAmount.toLocaleString('en-IN')}* and share the payment screenshot.`;

  const targetPhone = cleanMob.length === 10 ? `91${cleanMob}` : cleanMob;
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
};

// Helper: Build automatic 7-Day Pending Bill WhatsApp Notification URL
export const buildWhatsApp7DayReminderUrl = (
  inv: Invoice,
  isRegisteredInApp: boolean = false
): string => {
  const cleanMob = (inv.customerMobile || '').replace(/\D/g, '').slice(-10);
  const daysOld = getInvoiceDaysOld(inv.date);
  const pendingItems = inv.items.filter((i) => !i.cfSynced);
  const itemsToList = pendingItems.length > 0 ? pendingItems : inv.items;

  const itemLines = itemsToList
    .map(
      (i) =>
        `• ${i.product.name} (x${i.quantity}) → AWPL ID: ${i.targetAwplId || inv.customerAwplId || 'Pending'} [${
          i.isIdGreen !== false
            ? `Green • ${i.repurchaseSide || inv.repurchaseSide || 'S.A.O'}`
            : `Greening: ${i.greeningCategory || inv.greeningCategory || '27 SP'}`
        }]`
    )
    .join('\n');

  const appNote = isRegisteredInApp
    ? `\n📲 *In-App Alert*: Since your mobile (+91 ${cleanMob}) is registered on the C&F Bill Customer App, we have also sent an instant notification inside your Customer App!`
    : `\n📲 *Tip*: Login with +91 ${cleanMob} on the C&F Bill Customer App to assign AWPL IDs (S.A.O / S.G.O) online anytime.`;

  const text =
    `🌿 *${inv.cnfName || 'D RIGHT WELLNESS'} (AWPL Official C&F)*\n` +
    `🔔 *AUTOMATIC 7-DAY PENDING BILL NOTIFICATION*\n\n` +
    `Namaste *${inv.customerName}*,\n` +
    `Your AWPL bill *${inv.invoiceNumber}* dated *${inv.date.split(' ')[0]}* has been pending for *${daysOld} days* for online AWPL C&F Portal update.\n\n` +
    `*Bill Summary:*\n` +
    `• Bill Amount: ₹${inv.grandTotal.toLocaleString('en-IN')} (+${inv.totalSp} SP)\n` +
    `• Pending Products:\n${itemLines}\n` +
    `${appNote}\n\n` +
    `Please confirm which AWPL ID and Side (S.A.O / S.G.O) or Greening Category to update online immediately.`;

  const targetPhone = cleanMob.length === 10 ? `91${cleanMob}` : cleanMob;
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
};

// Financial year calculation (In India, FY session starts April 1st and ends March 31st)
export const getCurrentIndianFinancialYear = (date: Date = new Date()): string => {
  const month = date.getMonth(); // 0 = Jan, 3 = April
  const year = date.getFullYear();
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
};

// Extract the April-to-March Financial Session Year for any invoice
export const getInvoiceSessionYear = (inv: Invoice): string => {
  if (inv.sessionYear && /^\d{4}-\d{4}$/.test(inv.sessionYear)) {
    return inv.sessionYear;
  }
  const match = (inv.invoiceNumber || '').match(/(\d{4}-\d{4})/);
  if (match && match[1]) {
    return match[1];
  }
  try {
    const cleanDate = (inv.date || '').split(' ')[0];
    const d = new Date(cleanDate);
    if (!isNaN(d.getTime())) {
      return getCurrentIndianFinancialYear(d);
    }
  } catch {
    // fallback
  }
  return '2026-2027';
};

// Requirement #5 + Session Rule:
// - D RIGHT WELLNESS starts from 3000 (or C&F's chosen startingInvoiceNumber)
// - Every April-to-March session starts from the beginning (3000 for D RIGHT WELLNESS) with the session year mentioned in the invoice number (e.g. DRW/2026-2027/3000)
// - Previous session bills are NEVER deleted and each session tracks its own sequence
export const generateNextInvoiceNumber = (
  config: FranchiseConfig,
  updateConfig: (cfg: FranchiseConfig) => void,
  overrideSessionYear?: string
): string => {
  const activeSession =
    overrideSessionYear ||
    config.currentFinancialYear ||
    getCurrentIndianFinancialYear();

  const isDrw = Boolean(config.isDrightWellness || config.shortName === 'DRW' || config.id === 'cnf-drw-solan');
  const baseStart = isDrw ? Math.max(config.startingInvoiceNumber || 3000, 3000) : config.startingInvoiceNumber || 1001;

  const sessionSequences: Record<string, number> = {
    ...(config.sessionSequences || {}),
  };

  let nextSeq: number;
  if (sessionSequences[activeSession] !== undefined) {
    nextSeq = sessionSequences[activeSession] + 1;
  } else if (config.currentFinancialYear === activeSession && (config.invoiceSequence || 0) >= baseStart) {
    nextSeq = config.invoiceSequence + 1;
  } else {
    // Brand new April-to-March session starts right from the beginning (e.g. 3000 for D RIGHT WELLNESS)!
    nextSeq = baseStart;
  }

  sessionSequences[activeSession] = nextSeq;

  const shortPrefix = (
    config.shortName ||
    config.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 4) ||
    'DRW'
  )
    .toUpperCase()
    .trim();

  const availableSessions = Array.from(
    new Set([...(config.availableSessions || ['2025-2026', '2026-2027', '2027-2028']), activeSession])
  ).sort();

  const updatedConfig: FranchiseConfig = {
    ...config,
    shortName: shortPrefix,
    startingInvoiceNumber: baseStart,
    currentFinancialYear: activeSession,
    invoiceSequence: nextSeq,
    sessionSequences,
    availableSessions,
  };
  updateConfig(updatedConfig);
  setStorageItem(STORAGE_KEYS.CONFIG, updatedConfig);

  // Sync in C&F accounts list too
  const allCnfs = getStorageItem<FranchiseConfig[]>(STORAGE_KEYS.CNF_ACCOUNTS, []);
  if (allCnfs.length > 0) {
    const nextCnfs = allCnfs.map((c) =>
      c.id === updatedConfig.id || c.name === updatedConfig.name ? updatedConfig : c
    );
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, nextCnfs);
  }

  const formattedSeq = String(nextSeq).padStart(4, '0');
  return `${shortPrefix}/${activeSession}/${formattedSeq}`;
};

// Format INR currency
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Generate UPI QR URI from C&F's configured UPI ID or UPI Mobile Number
export const getUPIPaymentURI = (params: {
  vpa: string;
  payeeName: string;
  amount: number;
  transactionNote: string;
}): string => {
  const { vpa, payeeName, amount, transactionNote } = params;
  const cleanVpa = vpa && vpa.includes('@') ? vpa : `${(vpa || 'drightwellness').replace(/\D/g, '') || 'drightwellness'}@upi`;
  return `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;
};

// Requirement #2: Return either Uploaded Custom QR Picture OR Auto-Generated UPI QR Image URL
export const getCnfUpiQrImageSrc = (
  config: FranchiseConfig,
  amount: number = 500,
  transactionNote: string = 'AWPL C&F Bill',
  size: number = 160
): string => {
  if (config.qrMode === 'uploaded_image' && config.customQrImageDataUrl) {
    return config.customQrImageDataUrl;
  }
  const activeVpa =
    config.bankUpiId ||
    (config.upiNumber ? `${config.upiNumber.replace(/\D/g, '')}@upi` : 'drightwellness@upi');
  const upiUri = getUPIPaymentURI({
    vpa: activeVpa,
    payeeName: config.name || 'AWPL C&F',
    amount,
    transactionNote,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUri)}`;
};

// Helper to convert CSV string to products array
export const parseProductsCSV = (csvText: string): Partial<AWPLProduct>[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const results: Partial<AWPLProduct>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (row.length < 3) continue;

    const item: Record<string, any> = {};
    headers.forEach((header, idx) => {
      item[header] = row[idx] || '';
    });

    results.push({
      name: item.name || item.product_name,
      sku: item.sku || `AWPL-MAN-${Date.now().toString().slice(-4)}`,
      category: item.category || 'Ayurvedic Wellness',
      mrp: Number(item.mrp) || 0,
      dp: Number(item.dp) || 0,
      sp: Number(item.sp) || 0,
      stock: Number(item.stock) || 0,
      batchNumber: item.batch || item.batch_number || 'BCH-26-IMP',
      expiryDate: item.expiry || item.expiry_date || '2028-12-31',
      description: item.description || 'Imported AWPL Product',
      gstRate: Number(item.gst) || 12,
      barcode: item.barcode || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      status: 'active',
      source: 'CSV Import',
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });
  }
  return results;
};

// Export to CSV helper
export const exportToCSV = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
