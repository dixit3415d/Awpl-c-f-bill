import React, { useState, useMemo } from 'react';
import {
  Cloud,
  Landmark,
  Sparkles,
  Building2,
  Users,
  MessageSquare,
  CheckCircle2,
  Send,
  Plus,
  ArrowRight,
  Cpu,
  Percent,
  RefreshCw,
  ShieldAlert,
  Lock,
  Unlock,
  FileText,
  Image as ImageIcon,
  Eye,
  LogOut
} from 'lucide-react';
import {
  AppFeedback,
  AppPortalMode,
  AuditLog,
  ComplaintReport,
  Customer,
  FranchiseConfig,
  Invoice,
  MainAdminConfig,
  UserSubscription
} from '../types';
import {
  formatINR,
  getUPIPaymentURI,
  saveToCloudBackup,
  setStorageItem,
  STORAGE_KEYS
} from '../utils/storage';

interface MainAdminPortalProps {
  mainAdminConfig: MainAdminConfig;
  onUpdateMainAdminConfig: (cfg: MainAdminConfig) => void;
  cnfAccounts: FranchiseConfig[];
  onUpdateCnfAccounts: (list: FranchiseConfig[]) => void;
  activeCnfConfig: FranchiseConfig;
  onSelectActiveCnf: (cfg: FranchiseConfig) => void;
  onOpenRegisterCnf: () => void;
  customers: Customer[];
  invoices: Invoice[];
  userSubscriptions: UserSubscription[];
  onUpdateSubscriptions?: (list: UserSubscription[]) => void;
  feedbacks: AppFeedback[];
  onUpdateFeedbacks: (list: AppFeedback[]) => void;
  complaints: ComplaintReport[];
  onUpdateComplaints: (list: ComplaintReport[]) => void;
  onSwitchPortal: (portal: AppPortalMode) => void;
  onAddAuditLog: (log: AuditLog) => void;
  onLogout?: () => void;
}

export const MainAdminPortal: React.FC<MainAdminPortalProps> = ({
  mainAdminConfig,
  onUpdateMainAdminConfig,
  cnfAccounts,
  onUpdateCnfAccounts,
  activeCnfConfig,
  onSelectActiveCnf,
  onOpenRegisterCnf,
  customers,
  invoices,
  userSubscriptions,
  onUpdateSubscriptions,
  feedbacks,
  onUpdateFeedbacks,
  complaints,
  onUpdateComplaints,
  onSwitchPortal,
  onAddAuditLog,
  onLogout,
}) => {
  const [subTab, setSubTab] = useState<
    'overview_settlement' | 'cnfs_customers' | 'complaints_ai' | 'gemini_studio' | 'feedbacks'
  >('overview_settlement');
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Personal Subscription Update State (Main Admin Personal Authority)
  const [personalSubTargetType, setPersonalSubTargetType] = useState<'cnf' | 'customer'>('cnf');
  const [personalSubSelectedCnfId, setPersonalSubSelectedCnfId] = useState<string>(
    cnfAccounts[0]?.id || cnfAccounts[0]?.name || ''
  );
  const [personalSubSelectedCustId, setPersonalSubSelectedCustId] = useState<string>(
    customers[0]?.id || ''
  );
  const [personalSubCustomName, setPersonalSubCustomName] = useState<string>('');
  const [personalSubPlanPreset, setPersonalSubPlanPreset] = useState<
    'cnf_monthly_699' | 'cnf_yearly_7130' | 'customer_monthly_99' | 'personal_custom_vip'
  >('cnf_monthly_699');
  const [personalSubCustomDays, setPersonalSubCustomDays] = useState<number>(30);
  const [personalSubCustomAmount, setPersonalSubCustomAmount] = useState<number>(699);
  const [personalSubNote, setPersonalSubNote] = useState<string>(
    'Personal Subscription Activated Directly by Main Admin (Payment Received Personally)'
  );

  // Manual Main Admin Bank Account & Cloud Cost Form State
  const [adminAccountNo, setAdminAccountNo] = useState(mainAdminConfig.mainBankAccountNumber);
  const [adminIfsc, setAdminIfsc] = useState(mainAdminConfig.mainBankIfsc);
  const [adminBankName, setAdminBankName] = useState(mainAdminConfig.mainBankName);
  const [adminUpiId, setAdminUpiId] = useState(mainAdminConfig.mainUpiId);
  const [adminUpiNumber, setAdminUpiNumber] = useState(mainAdminConfig.mainUpiNumber);
  const [cloudCostPerCnf, setCloudCostPerCnf] = useState<number>(
    mainAdminConfig.cloudMonthlyFixedCostPerCnf
  );
  const [cloudCostPerCustomer, setCloudCostPerCustomer] = useState<number>(
    mainAdminConfig.cloudMonthlyFixedCostPerCustomer
  );
  const [cloudDeductionPct, setCloudDeductionPct] = useState<number>(
    mainAdminConfig.cloudCostDeductionPercent
  );
  const [defaultUpiFeeEnabled, setDefaultUpiFeeEnabled] = useState<boolean>(
    mainAdminConfig.defaultUpiTransactionFeeEnabled
  );
  const [defaultUpiFeePct, setDefaultUpiFeePct] = useState<number>(
    mainAdminConfig.defaultUpiTransactionFeePercent
  );

  // Google Gemini App Feature Updater State
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [isCallingGemini, setIsCallingGemini] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiResponse, setGeminiResponse] = useState<{
    summary: string;
    featureTitle: string;
    targetPortal: string;
    suggestedConfigPatch?: {
      globalAnnouncementBanner?: string;
      defaultUpiTransactionFeeEnabled?: boolean;
      defaultUpiTransactionFeePercent?: number;
      cloudCostDeductionPercent?: number;
      cloudMonthlyFixedCostPerCnf?: number;
      cloudMonthlyFixedCostPerCustomer?: number;
      newDynamicFeatureRule?: string;
    };
    implementationSteps: string[];
  } | null>(null);

  // Feedback & Complaint Reply State
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const [verifyingComplaintId, setVerifyingComplaintId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<ComplaintReport | null>(null);
  const [permissionRequestReason, setPermissionRequestReason] = useState<Record<string, string>>({});

  // Personal Subscription Update Handler (By Main Admin Personal Authority)
  const handlePersonalSubscriptionUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    let targetUserId = `usr-${Date.now().toString().slice(-4)}`;
    let targetUserName = personalSubCustomName.trim();
    const isCust = personalSubTargetType === 'customer';

    if (isCust) {
      const foundCust = customers.find((c) => c.id === personalSubSelectedCustId);
      if (foundCust) {
        targetUserId = foundCust.id;
        targetUserName =
          targetUserName || `${foundCust.name} (+91 ${foundCust.mobile})`;
      } else {
        targetUserName = targetUserName || 'AWPL Customer (Personal Update)';
      }
    } else {
      const foundCnf = cnfAccounts.find(
        (c) => (c.id || c.name) === personalSubSelectedCnfId
      );
      if (foundCnf) {
        targetUserId = foundCnf.id || `cnf-${foundCnf.shortName || 'DRW'}`;
        targetUserName =
          targetUserName ||
          `${foundCnf.name} (${foundCnf.cfOwnerName || foundCnf.franchiseOwner})`;
      } else {
        targetUserName = targetUserName || `${activeCnfConfig.name}`;
      }
    }

    let durationDays = 30;
    let amountPaid = 699;
    let planId = 'plan-cf-monthly';
    let planName = 'C&F Monthly Plan (₹699/mo)';

    if (personalSubPlanPreset === 'cnf_monthly_699') {
      durationDays = 30;
      amountPaid = 699;
      planId = 'plan-cf-monthly';
      planName = 'C&F Monthly Plan (₹699/mo • Personal Admin Update)';
    } else if (personalSubPlanPreset === 'cnf_yearly_7130') {
      durationDays = 365;
      amountPaid = 7130;
      planId = 'plan-cf-yearly';
      planName = 'C&F Yearly Plan (₹7,130/yr • Personal Admin Update)';
    } else if (personalSubPlanPreset === 'customer_monthly_99') {
      durationDays = 30;
      amountPaid = 99;
      planId = 'plan-customer-monthly';
      planName = 'Customer VIP Monthly Plan (₹99/mo • Personal Admin Update)';
    } else {
      durationDays = Math.max(1, Number(personalSubCustomDays) || 30);
      amountPaid = Math.max(0, Number(personalSubCustomAmount) || 0);
      planId = isCust ? 'plan-customer-monthly' : 'plan-cf-custom-personal';
      planName = `Personal Admin Direct Subscription (${durationDays} Days)`;
    }

    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + durationDays);
    const paymentRef = `PERSONAL-ADMIN-${Date.now().toString().slice(-6)}`;

    const newSub: UserSubscription = {
      id: `sub-personal-${Date.now()}`,
      userId: targetUserId,
      userName: targetUserName,
      userRole: isCust ? 'customer' : 'franchise_admin',
      planId,
      planName,
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      status: 'active',
      paymentRef,
      amountPaid,
      autoRenew: true,
      settledToAccount: `${mainAdminConfig.mainAdminName} Personal Update (${adminUpiId} • A/c ${adminAccountNo})`,
      settledStatus: 'Credited to Owner A/c',
    };

    // Replace existing subscription for the same userId/userName or prepend
    const filteredExisting = userSubscriptions.filter(
      (s) => s.userId !== targetUserId && s.userName !== targetUserName
    );
    const updatedSubs = [newSub, ...filteredExisting];

    if (onUpdateSubscriptions) {
      onUpdateSubscriptions(updatedSubs);
    }
    setStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, updatedSubs);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Personal Subscription Updated by Main Admin: ${targetUserName}`,
      category: 'Subscription',
      user: `${mainAdminConfig.mainAdminName} (Main Admin Personal Override)`,
      details: `${planName} | Valid till ${newSub.expiryDate} | Amount: ${formatINR(amountPaid)} | Note: ${personalSubNote}`,
    });

    setPersonalSubCustomName('');
    setStatusToast(
      `✓ Personal Subscription Updated for "${targetUserName}" (${planName}, Valid till ${newSub.expiryDate})!`
    );
    setTimeout(() => setStatusToast(null), 4500);
  };

  // Quick 1-Click Extend / Toggle Subscription for Any Existing User
  const handleQuickExtendSubscription = (sub: UserSubscription, extraDays: number) => {
    const baseDate =
      sub.expiryDate && new Date(sub.expiryDate) > new Date()
        ? new Date(sub.expiryDate)
        : new Date();
    baseDate.setDate(baseDate.getDate() + extraDays);
    const nextExpiry = baseDate.toISOString().split('T')[0];

    const updatedSubs = userSubscriptions.map((s) =>
      s.id === sub.id
        ? {
            ...s,
            status: 'active' as const,
            expiryDate: nextExpiry,
            paymentRef: `PERSONAL-EXT-${Date.now().toString().slice(-5)}`,
          }
        : s
    );

    if (onUpdateSubscriptions) {
      onUpdateSubscriptions(updatedSubs);
    }
    setStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, updatedSubs);
    saveToCloudBackup();

    setStatusToast(
      `✓ Personally extended subscription for ${sub.userName} by +${extraDays} days (New Expiry: ${nextExpiry})!`
    );
    setTimeout(() => setStatusToast(null), 4000);
  };

  // Calculate Gross Subscription Revenue, Cloud Payment Deduction & Net Payout to Main Admin Bank Account
  const settlementMetrics = useMemo(() => {
    let grossCnfSubRevenue = 0;
    let grossCustomerSubRevenue = 0;
    let activeCnfSubsCount = 0;
    let activeCustomerSubsCount = 0;

    userSubscriptions.forEach((s) => {
      if (s.status === 'active') {
        if (
          s.userRole === 'customer' ||
          s.planId === 'plan-customer-monthly' ||
          s.amountPaid === 99
        ) {
          grossCustomerSubRevenue += s.amountPaid;
          activeCustomerSubsCount += 1;
        } else {
          grossCnfSubRevenue += s.amountPaid;
          activeCnfSubsCount += 1;
        }
      }
    });

    const totalGrossSubRevenue = grossCnfSubRevenue + grossCustomerSubRevenue;
    const cnfCloudCost =
      activeCnfSubsCount * cloudCostPerCnf +
      Math.round((grossCnfSubRevenue * cloudDeductionPct) / 100);
    const customerCloudCost =
      activeCustomerSubsCount * cloudCostPerCustomer +
      Math.round((grossCustomerSubRevenue * cloudDeductionPct) / 100);
    const totalCloudDeduction = cnfCloudCost + customerCloudCost;
    const netSettledToMainAdminAccount = Math.max(0, totalGrossSubRevenue - totalCloudDeduction);

    return {
      grossCnfSubRevenue,
      grossCustomerSubRevenue,
      activeCnfSubsCount,
      activeCustomerSubsCount,
      totalGrossSubRevenue,
      cnfCloudCost,
      customerCloudCost,
      totalCloudDeduction,
      netSettledToMainAdminAccount,
    };
  }, [userSubscriptions, cloudCostPerCnf, cloudCostPerCustomer, cloudDeductionPct]);

  const handleSaveMainAdminBankAndCloud = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: MainAdminConfig = {
      ...mainAdminConfig,
      mainBankAccountNumber: adminAccountNo.trim(),
      mainBankIfsc: adminIfsc.trim().toUpperCase(),
      mainBankName: adminBankName.trim(),
      mainUpiId: adminUpiId.trim(),
      mainUpiNumber: adminUpiNumber.trim(),
      cloudMonthlyFixedCostPerCnf: Number(cloudCostPerCnf) || 0,
      cloudMonthlyFixedCostPerCustomer: Number(cloudCostPerCustomer) || 0,
      cloudCostDeductionPercent: Number(cloudDeductionPct) || 0,
      defaultUpiTransactionFeeEnabled: defaultUpiFeeEnabled,
      defaultUpiTransactionFeePercent: Number(defaultUpiFeePct) || 0,
    };

    onUpdateMainAdminConfig(updated);
    setStorageItem(STORAGE_KEYS.MAIN_ADMIN_CONFIG, updated);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: 'Updated Main App Payout Bank Account & Cloud Cost Deduction',
      category: 'Subscription',
      user: mainAdminConfig.mainAdminName,
      details: `Main A/c: ${updated.mainBankAccountNumber} (${updated.mainBankIfsc}) | Net Settled after Cloud Deduction: ${formatINR(
        settlementMetrics.netSettledToMainAdminAccount
      )}`,
    });

    setStatusToast('Main App Bank Account & Cloud Deduction Settings Saved to Cloud Vault!');
    setTimeout(() => setStatusToast(null), 4000);
  };

  // Requirement #5: Privacy-Protected Access to Other C&F Portals
  // Main App can access another C&F portal ONLY after that C&F grants permission to resolve their problem.
  const handleRequestCnfPermission = (targetCnf: FranchiseConfig) => {
    const reason =
      (permissionRequestReason[targetCnf.id || targetCnf.name] || '').trim() ||
      'Main App Admin requests temporary troubleshooting access to resolve your reported C&F portal issue.';
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const updatedAccounts = cnfAccounts.map((c) => {
      if (c.id === targetCnf.id || c.name === targetCnf.name) {
        return {
          ...c,
          privacyAccessPermission: {
            grantedToMainApp: false,
            requestedByMainApp: true,
            requestReason: reason,
            requestedAt: nowTime,
          },
        };
      }
      return c;
    });

    onUpdateCnfAccounts(updatedAccounts);
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, updatedAccounts);
    if (activeCnfConfig.id === targetCnf.id || activeCnfConfig.name === targetCnf.name) {
      const matched = updatedAccounts.find(
        (c) => c.id === targetCnf.id || c.name === targetCnf.name
      );
      if (matched) setStorageItem(STORAGE_KEYS.FRANCHISE_CONFIG, matched);
    }
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Main App Requested Privacy Permission from ${targetCnf.name}`,
      category: 'Security',
      user: mainAdminConfig.mainAdminName,
      details: `Reason: ${reason}. Access remains locked until ${targetCnf.name} owner approves in C&F App.`,
    });

    setStatusToast(
      `Privacy Permission Request sent to ${targetCnf.name}! Main App can open their portal only after they approve.`
    );
    setTimeout(() => setStatusToast(null), 4500);
  };

  // Requirement #4: Re-run Google Gemini AI Genuineness Verification on a Complaint
  const handleReverifyWithGemini = async (cmp: ComplaintReport) => {
    setVerifyingComplaintId(cmp.id);
    try {
      const res = await fetch('/api/gemini/verify-complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submittedByPortal: cmp.submittedByPortal,
          submitterName: cmp.submitterName,
          submitterMobile: cmp.submitterMobile,
          cnfName: cmp.cnfName,
          subject: cmp.subject,
          description: cmp.description,
          relatedInvoiceNumber: cmp.relatedInvoiceNumber,
          attachmentName: cmp.attachmentName,
          attachmentType: cmp.attachmentType,
          attachmentDataUrl: cmp.attachmentDataUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.result) {
        const nextStatus: ComplaintReport['aiVerificationStatus'] = data.result.isGenuine
          ? 'Genuine'
          : 'Suspicious';
        const nextScore = Number(data.result.confidenceScore) || 88;
        const nextReason = data.result.aiVerificationReason || cmp.aiVerificationReason;
        const updatedList = complaints.map((item) =>
          item.id === cmp.id
            ? {
                ...item,
                aiVerificationStatus: nextStatus,
                aiConfidenceScore: nextScore,
                aiVerificationReason: nextReason,
              }
            : item
        );
        onUpdateComplaints(updatedList);
        setStorageItem(STORAGE_KEYS.COMPLAINTS, updatedList);
        saveToCloudBackup();
        setStatusToast(
          `Google Gemini AI verified Report #${cmp.id.slice(-5)}: ${nextStatus.toUpperCase()} (${nextScore}% confidence)!`
        );
        setTimeout(() => setStatusToast(null), 4000);
      }
    } catch {
      // ignore
    } finally {
      setVerifyingComplaintId(null);
    }
  };

  // Requirement #4: Resolve Genuine Report with Full Main App Authority
  const handleResolveComplaintByMainApp = (cmp: ComplaintReport) => {
    const note =
      (resolutionDrafts[cmp.id] || '').trim() ||
      'Verified genuine by AI and resolved directly by Main App Admin with full authority.';
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const updatedList = complaints.map((item) =>
      item.id === cmp.id
        ? {
            ...item,
            status: 'Resolved_By_Main_App' as const,
            mainAdminResolutionNote: note,
            resolvedAt: nowTime,
          }
        : item
    );
    onUpdateComplaints(updatedList);
    setStorageItem(STORAGE_KEYS.COMPLAINTS, updatedList);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Main App Resolved Complaint (${cmp.subject})`,
      category: 'Security',
      user: mainAdminConfig.mainAdminName,
      details: `Submitter: ${cmp.submitterName} | AI Status: ${cmp.aiVerificationStatus} | Resolution: ${note}`,
    });

    setStatusToast(`Resolved complaint "${cmp.subject}" with Full Main App Authority!`);
    setTimeout(() => setStatusToast(null), 4000);
  };

  // Call Server-Side Google Gemini API (/api/gemini/main-app-assistant)
  const handleRunGeminiUpdater = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiPrompt.trim()) return;
    setIsCallingGemini(true);
    setGeminiError(null);

    try {
      const res = await fetch('/api/gemini/main-app-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: geminiPrompt.trim(),
          currentMainConfig: mainAdminConfig,
          statsSummary: {
            registeredCnfs: cnfAccounts.length,
            registeredCustomers: customers.length,
            totalInvoices: invoices.length,
            netSubscriptionPayout: settlementMetrics.netSettledToMainAdminAccount,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gemini request failed');
      }
      setGeminiResponse(data.result);
    } catch (err: any) {
      setGeminiError(err?.message || 'Unable to reach server-side Gemini endpoint.');
    } finally {
      setIsCallingGemini(false);
    }
  };

  // Apply Gemini Suggested Config Update Live
  const handleApplyGeminiPatch = () => {
    if (!geminiResponse) return;
    const patch = geminiResponse.suggestedConfigPatch || {};
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const nextRules = patch.newDynamicFeatureRule
      ? [patch.newDynamicFeatureRule, ...mainAdminConfig.dynamicFeatureRules]
      : [
          `${geminiResponse.featureTitle}: ${geminiResponse.summary}`,
          ...mainAdminConfig.dynamicFeatureRules,
        ];

    const updated: MainAdminConfig = {
      ...mainAdminConfig,
      globalAnnouncementBanner:
        patch.globalAnnouncementBanner || mainAdminConfig.globalAnnouncementBanner,
      defaultUpiTransactionFeeEnabled:
        patch.defaultUpiTransactionFeeEnabled ?? mainAdminConfig.defaultUpiTransactionFeeEnabled,
      defaultUpiTransactionFeePercent:
        patch.defaultUpiTransactionFeePercent ?? mainAdminConfig.defaultUpiTransactionFeePercent,
      cloudCostDeductionPercent:
        patch.cloudCostDeductionPercent ?? mainAdminConfig.cloudCostDeductionPercent,
      cloudMonthlyFixedCostPerCnf:
        patch.cloudMonthlyFixedCostPerCnf ?? mainAdminConfig.cloudMonthlyFixedCostPerCnf,
      cloudMonthlyFixedCostPerCustomer:
        patch.cloudMonthlyFixedCostPerCustomer ?? mainAdminConfig.cloudMonthlyFixedCostPerCustomer,
      dynamicFeatureRules: nextRules,
      lastGeminiUpdateAt: nowTime,
    };

    onUpdateMainAdminConfig(updated);
    setStorageItem(STORAGE_KEYS.MAIN_ADMIN_CONFIG, updated);
    setDefaultUpiFeeEnabled(updated.defaultUpiTransactionFeeEnabled);
    setDefaultUpiFeePct(updated.defaultUpiTransactionFeePercent);
    setCloudDeductionPct(updated.cloudCostDeductionPercent);
    setCloudCostPerCnf(updated.cloudMonthlyFixedCostPerCnf);
    setCloudCostPerCustomer(updated.cloudMonthlyFixedCostPerCustomer);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Google Gemini Feature Update Applied: ${geminiResponse.featureTitle}`,
      category: 'Security',
      user: 'Main Admin via Google Gemini',
      details: geminiResponse.summary,
    });

    setStatusToast(`Applied Gemini Feature Update: "${geminiResponse.featureTitle}" across C&F Bill!`);
    setTimeout(() => setStatusToast(null), 4000);
  };

  const handleSaveFeedbackReply = (fbId: string) => {
    const reply = (replyDrafts[fbId] || '').trim();
    if (!reply) return;
    const updated = feedbacks.map((f) =>
      f.id === fbId ? { ...f, status: 'Reviewed' as const, adminReply: reply } : f
    );
    onUpdateFeedbacks(updated);
    setStorageItem(STORAGE_KEYS.FEEDBACKS, updated);
    saveToCloudBackup();
    setStatusToast('Reply sent and synced to C&F / Customer App!');
    setTimeout(() => setStatusToast(null), 3000);
  };

  const mainAdminQrUri = getUPIPaymentURI({
    vpa: adminUpiId || 'drightwellness@upi',
    payeeName: 'C&F Bill Main Admin',
    amount: settlementMetrics.netSettledToMainAdminAccount || 699,
    transactionNote: 'Net Subscription Settlement',
  });
  const mainAdminQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    mainAdminQrUri
  )}`;

  return (
    <div className="space-y-6">
      {/* Top Main App Hero Banner */}
      <div className="rounded-2xl bg-slate-900 border-2 border-orange-500/80 text-white p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-16 rounded-2xl bg-orange-500 text-black font-black flex flex-col items-center justify-center border-2 border-black shadow-lg shrink-0">
              <span className="text-base leading-none tracking-tighter">AWPL</span>
              <span className="text-[8px] font-black uppercase mt-0.5">MAIN APP</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-orange-500 text-black px-2.5 py-0.5 text-[10px] font-black uppercase">
                  3rd Separate Portal • Main Admin Authority App
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <Cloud className="h-3 w-3" /> {mainAdminConfig.cloudProviderName}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                C&F Bill — Main Admin Control Center (Full Authority, Privacy Lock & AI Verification)
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Central Cloud Database • Privacy-Protected C&F Access (Permission Required) • AI Complaint Verification (Picture/PDF) • Google Gemini Feature Studio
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSwitchPortal('cnf_app')}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 shadow transition"
            >
              <Building2 className="h-4 w-4" />
              <span>Open C&F App</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchPortal('customer_app')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Users className="h-4 w-4" />
              <span>Open Customer App</span>
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                title="Log Out of Main Admin Vault and Lock Secret Access"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out &amp; Lock Vault</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-navigation inside Main App */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('overview_settlement')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
              subTab === 'overview_settlement'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Landmark className="h-4 w-4" />
            <span>1. Subscription Payout & Cloud Deduction</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('cnfs_customers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
              subTab === 'cnfs_customers'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>2. Registered C&Fs ({cnfAccounts.length}) & Privacy Access</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('complaints_ai')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
              subTab === 'complaints_ai'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <span>3. Complaints & AI Verification ({complaints.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('gemini_studio')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
              subTab === 'gemini_studio'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>4. Google Gemini Feature Updater</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('feedbacks')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
              subTab === 'feedbacks'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>5. App Feedback ({feedbacks.length})</span>
          </button>
        </div>
      </div>

      {statusToast && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-400 p-4 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* TAB 1: SUBSCRIPTION SETTLEMENT AFTER CLOUD COST DEDUCTION + MANUAL BANK ACCOUNT */}
      {subTab === 'overview_settlement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Gross Subscription Collected
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {formatINR(settlementMetrics.totalGrossSubRevenue)}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                C&F: {formatINR(settlementMetrics.grossCnfSubRevenue)} | Customer:{' '}
                {formatINR(settlementMetrics.grossCustomerSubRevenue)}
              </span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-amber-300 dark:border-amber-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                Less: Cloud Hosting Deduction
              </span>
              <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                -{formatINR(settlementMetrics.totalCloudDeduction)}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                C&F Cloud: {formatINR(settlementMetrics.cnfCloudCost)} | Cust Cloud:{' '}
                {formatINR(settlementMetrics.customerCloudCost)}
              </span>
            </div>

            <div className="rounded-2xl bg-emerald-900 text-white p-5 border-2 border-emerald-500 shadow-md">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                Net Payout to Main Admin A/c
              </span>
              <span className="text-2xl font-black font-mono text-amber-300 mt-1 block">
                {formatINR(settlementMetrics.netSettledToMainAdminAccount)}
              </span>
              <span className="text-[11px] text-emerald-100 mt-1 block font-mono">
                Credited to A/c: {adminAccountNo}
              </span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Total Cloud Records Stored
              </span>
              <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">
                {invoices.length + customers.length + cnfAccounts.length}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {cnfAccounts.length} C&Fs • {customers.length} Customers • {invoices.length} Bills
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveMainAdminBankAndCloud}
              className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
            >
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                  Main App Manual Account Entry
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Main Admin Bank Account (Where Subscription Payout Comes After Cloud Deduction)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Main Admin Account Number (Manual) *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminAccountNo}
                    onChange={(e) => setAdminAccountNo(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-emerald-500 p-2.5 font-mono font-black bg-emerald-50/20 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">IFSC Code *</label>
                  <input
                    type="text"
                    required
                    value={adminIfsc}
                    onChange={(e) => setAdminIfsc(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Bank Name & Branch *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminBankName}
                    onChange={(e) => setAdminBankName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-semibold bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Main Admin UPI ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUpiId}
                    onChange={(e) => setAdminUpiId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Main Admin UPI Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={adminUpiNumber}
                    onChange={(e) => setAdminUpiNumber(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-black text-slate-800 dark:text-slate-200 mb-2">
                  Cloud Payment Deduction & Future UPI Transaction Fee Controls
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400">
                      Cloud Cost / C&F App (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cloudCostPerCnf}
                      onChange={(e) => setCloudCostPerCnf(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400">
                      Cloud Cost / Customer App (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cloudCostPerCustomer}
                      onChange={(e) => setCloudCostPerCustomer(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400">
                      Cloud Infrastructure %
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={50}
                      value={cloudDeductionPct}
                      onChange={(e) => setCloudDeductionPct(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={defaultUpiFeeEnabled}
                      onChange={(e) => setDefaultUpiFeeEnabled(e.target.checked)}
                      className="h-4 w-4 rounded text-amber-600"
                    />
                    <Percent className="h-4 w-4 text-amber-600" />
                    <span>Enable Default UPI Transaction Fee Across App</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Fee %:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={defaultUpiFeePct}
                      onChange={(e) => setDefaultUpiFeePct(Number(e.target.value))}
                      className="w-20 rounded-lg border border-amber-400 p-1.5 font-mono font-bold bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow transition"
                >
                  Save Main App Bank Account & Cloud Deduction
                </button>
              </div>
            </form>

            <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 flex flex-col justify-between text-center space-y-4">
              <div>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-3 py-1 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                  MAIN ADMIN PAYOUT QR
                </span>
                <div className="my-3 flex justify-center">
                  <img
                    src={mainAdminQrSrc}
                    alt="Main Admin UPI QR"
                    className="h-36 w-36 rounded-xl bg-white p-2 border border-slate-200 shadow"
                  />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  A/c: <span className="font-mono">{adminAccountNo}</span>
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  IFSC: {adminIfsc} • UPI: {adminUpiId}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-left text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross C&F + Cust Subs:</span>
                  <span className="font-mono font-bold">
                    {formatINR(settlementMetrics.totalGrossSubRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Cloud Cost Deduction:</span>
                  <span className="font-mono font-bold">
                    -{formatINR(settlementMetrics.totalCloudDeduction)}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 font-black text-emerald-700 dark:text-emerald-400">
                  <span>Net Credited to A/c:</span>
                  <span className="font-mono">
                    {formatINR(settlementMetrics.netSettledToMainAdminAccount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PERSONAL SUBSCRIPTION UPDATE PANEL (MAIN ADMIN PERSONAL OVERRIDE FOR ANY C&F OR CUSTOMER) */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-6 border-2 border-amber-400 shadow-lg space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/15 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-amber-400 text-black px-2.5 py-0.5 text-[10px] font-black uppercase">
                    Main Admin Personal Authority
                  </span>
                  <span className="rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                    ✓ Built-in Auto-Payment Gateway Active Across All Apps
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black mt-1.5">
                  Personal Subscription Update (Activate / Extend Any C&F or Customer Directly by Main Admin)
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Whenever any user pays via the built-in Payment Gateway, their subscription auto-activates automatically. In addition, you can personally update, activate, or extend any C&F or Customer subscription right here:
                </p>
              </div>
            </div>

            <form onSubmit={handlePersonalSubscriptionUpdate} className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
              <div className="md:col-span-3">
                <label className="font-bold text-amber-300 block mb-1">
                  1. Select User Type *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonalSubTargetType('cnf');
                      setPersonalSubPlanPreset('cnf_monthly_699');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black border transition ${
                      personalSubTargetType === 'cnf'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    C&F Franchise
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonalSubTargetType('customer');
                      setPersonalSubPlanPreset('customer_monthly_99');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black border transition ${
                      personalSubTargetType === 'customer'
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Customer App
                  </button>
                </div>
              </div>

              <div className="md:col-span-4">
                <label className="font-bold text-amber-300 block mb-1">
                  2. Select {personalSubTargetType === 'cnf' ? 'C&F Account' : 'Customer Account'} *
                </label>
                {personalSubTargetType === 'cnf' ? (
                  <select
                    value={personalSubSelectedCnfId}
                    onChange={(e) => setPersonalSubSelectedCnfId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white p-2.5 font-bold"
                  >
                    {cnfAccounts.map((c) => (
                      <option key={c.id || c.name} value={c.id || c.name}>
                        {c.name} [{c.shortName || 'DRW'}] — {c.cfOwnerName || c.franchiseOwner}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={personalSubSelectedCustId}
                    onChange={(e) => setPersonalSubSelectedCustId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white p-2.5 font-bold"
                  >
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} (+91 {cust.mobile}) {cust.awplId ? `• ${cust.awplId}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={personalSubCustomName}
                  onChange={(e) => setPersonalSubCustomName(e.target.value)}
                  placeholder="Or type custom User Name / Mobile No. (Optional)"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800/80 text-white px-3 py-2 text-[11px]"
                />
              </div>

              <div className="md:col-span-5">
                <label className="font-bold text-amber-300 block mb-1">
                  3. Choose Subscription Plan to Activate Personally *
                </label>
                <select
                  value={personalSubPlanPreset}
                  onChange={(e) =>
                    setPersonalSubPlanPreset(
                      e.target.value as
                        | 'cnf_monthly_699'
                        | 'cnf_yearly_7130'
                        | 'customer_monthly_99'
                        | 'personal_custom_vip'
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white p-2.5 font-bold"
                >
                  <option value="cnf_monthly_699">
                    C&F Monthly Plan — ₹699 / 30 Days (Unlimited Billing)
                  </option>
                  <option value="cnf_yearly_7130">
                    C&F Yearly Plan — ₹7,130 / 365 Days (15% Discount)
                  </option>
                  <option value="customer_monthly_99">
                    Customer VIP Monthly Plan — ₹99 / 30 Days
                  </option>
                  <option value="personal_custom_vip">
                    Personal Custom / Complimentary VIP Validity (Set Days & Amount)
                  </option>
                </select>

                {personalSubPlanPreset === 'personal_custom_vip' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-[10px] text-slate-300 block">Validity (Days):</span>
                      <input
                        type="number"
                        min={1}
                        value={personalSubCustomDays}
                        onChange={(e) => setPersonalSubCustomDays(Number(e.target.value))}
                        className="w-full rounded-lg border border-amber-400 bg-slate-800 text-white px-2.5 py-1.5 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-300 block">Amount Paid (₹):</span>
                      <input
                        type="number"
                        min={0}
                        value={personalSubCustomAmount}
                        onChange={(e) => setPersonalSubCustomAmount(Number(e.target.value))}
                        className="w-full rounded-lg border border-amber-400 bg-slate-800 text-white px-2.5 py-1.5 font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-8">
                <input
                  type="text"
                  value={personalSubNote}
                  onChange={(e) => setPersonalSubNote(e.target.value)}
                  placeholder="Personal activation remark..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-3 py-2.5"
                />
              </div>

              <div className="md:col-span-4 flex items-center">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black shadow-md flex items-center justify-center gap-1.5 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Update Subscription Personally</span>
                </button>
              </div>
            </form>

            {/* Existing User Subscriptions Table with 1-Click Personal Extend */}
            <div className="pt-3 border-t border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  All Active & Personal User Subscriptions ({userSubscriptions.length})
                </span>
                <span className="text-[11px] text-slate-300">
                  1-Click Personal Validity Extension by Main Admin
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/90">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-[10px] uppercase font-bold text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">Subscriber (C&F / Customer)</th>
                      <th className="py-2.5 px-3">Plan & Status</th>
                      <th className="py-2.5 px-3">Amount & Gateway / Personal Ref</th>
                      <th className="py-2.5 px-3">Valid Till</th>
                      <th className="py-2.5 px-3 text-right">Personal Admin Quick Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {userSubscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {sub.userName}
                          <span className="block text-[10px] text-slate-400 uppercase">
                            {sub.userRole === 'customer' ? 'Customer App' : 'C&F Franchise'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-emerald-300 block">{sub.planName}</span>
                          <span className="inline-block mt-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.2 text-[10px] font-black text-emerald-300 uppercase">
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-amber-300">{formatINR(sub.amountPaid)}</span>
                          <span className="block text-[10px] text-slate-400">
                            Ref: {sub.paymentRef || 'DIRECT'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">
                          {sub.expiryDate}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickExtendSubscription(sub, 30)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px]"
                            >
                              +30 Days
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickExtendSubscription(sub, 365)}
                              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px]"
                            >
                              +1 Year
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL REGISTERED AWPL C&Fs & PRIVACY-LOCKED PORTAL ACCESS (REQUIREMENT #5) */}
      {subTab === 'cnfs_customers' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase">
                Official AWPL Privacy Protocol • Zero Data Leak &amp; Strict C&amp;F Consent Protection
              </span>
              <h3 className="font-black text-base text-slate-900 dark:text-white mt-1">
                Registered AWPL C&Fs ({cnfAccounts.length}) — Permission-Gated Portal Access
              </h3>
              <p className="text-xs text-slate-500">
                Main App can access another C&F portal <strong>ONLY after that C&F grants permission</strong> to resolve their problem. No C&F data can be leaked or accessed without consent.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenRegisterCnf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs shadow"
            >
              <Plus className="h-4 w-4" />
              <span>+ Register New AWPL C&F</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cnfAccounts.map((cnf) => {
              const isActive = cnf.id === activeCnfConfig.id || cnf.name === activeCnfConfig.name;
              const isPermInf = Boolean(cnf.isDrightWellness || cnf.infinityStockPermanent);
              const isAccessGranted =
                Boolean(cnf.isDrightWellness) ||
                cnf.privacyAccessPermission?.grantedToMainApp === true;
              const isPendingApproval =
                !isAccessGranted && cnf.privacyAccessPermission?.requestedByMainApp === true;

              return (
                <div
                  key={cnf.id || cnf.name}
                  className={`rounded-2xl bg-white dark:bg-slate-900 p-5 border-2 transition ${
                    isActive
                      ? 'border-emerald-600 shadow-md'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded bg-orange-100 dark:bg-orange-950/70 px-2 py-0.5 text-[10px] font-black text-orange-800 dark:text-orange-300">
                          Asclepius Wellness Private Limited Franchise
                        </span>
                        {isAccessGranted ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                            <Unlock className="h-3 w-3" /> Permission Granted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-950 px-2 py-0.5 text-[10px] font-black text-red-800 dark:text-red-300">
                            <Lock className="h-3 w-3" /> Privacy Locked (No Direct Access)
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                        {cnf.name}
                      </h4>
                      <p className="text-xs text-slate-500">{cnf.address}</p>
                    </div>
                    <span className="rounded-lg bg-slate-900 text-orange-400 font-mono font-black px-2.5 py-1 text-xs">
                      Prefix: {cnf.shortName || 'DRW'}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Franchise / C&F Owner</span>
                      <span className="font-bold">{cnf.cfOwnerName || cnf.franchiseOwner}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Mobile & Email</span>
                      <span className="font-mono">{cnf.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Bank & UPI QR</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {cnf. qrMode === 'uploaded_image' ? 'Uploaded QR Image' : cnf.bankUpiId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Stock Inventory Mode</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {isPermInf
                          ? '∞ Permanent Infinity Stock'
                          : cnf.infinityStockEnabled
                          ? '∞ Infinity Stock (Toggle ON)'
                          : 'Purchase Bill Stock Mode'}
                      </span>
                    </div>
                  </div>

                  {/* Requirement #5: Enforce Privacy Permission before opening another C&F's Portal */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {isAccessGranted ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          ✓ C&F Owner has granted Main App access permission
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectActiveCnf(cnf);
                            onSwitchPortal('cnf_app');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1 shadow"
                        >
                          <span>Open C&F Portal</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-red-900 dark:text-red-200 flex items-center gap-1">
                            <Lock className="h-3.5 w-3.5" />
                            Encrypted C&F Data Protected — Permission Required
                          </span>
                          {isPendingApproval && (
                            <span className="rounded bg-amber-400 text-black px-2 py-0.5 text-[10px] font-black">
                              ⏳ Request Sent to C&F
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={permissionRequestReason[cnf.id || cnf.name] || ''}
                            onChange={(e) =>
                              setPermissionRequestReason((prev) => ({
                                ...prev,
                                [cnf.id || cnf.name]: e.target.value,
                              }))
                            }
                            placeholder="Reason to request access (e.g. Resolve Invoice / Ledger issue)..."
                            className="flex-1 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleRequestCnfPermission(cnf)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] shrink-0"
                          >
                            {isPendingApproval ? 'Resend Request' : 'Request Permission'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLAINTS & AI GENUINENESS VERIFICATION HUB (REQUIREMENT #4) */}
      {subTab === 'complaints_ai' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="rounded bg-red-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                Official AWPL Dispute Desk • AI Genuineness Verification + Picture/PDF Proof
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                C&F & Customer Complaint Reports ({complaints.length})
              </h3>
              <p className="text-xs text-slate-500">
                Google Gemini AI checks whether each report & uploaded Picture/PDF proof is genuine. Main App has full authority to resolve genuine complaints.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {complaints.map((cmp) => {
              const isGenuine = cmp.aiVerificationStatus === 'Genuine';
              const isResolved = cmp.status === 'Resolved_By_Main_App';

              return (
                <div
                  key={cmp.id}
                  className={`rounded-2xl bg-white dark:bg-slate-900 p-5 border-2 space-y-3 text-xs ${
                    isResolved
                      ? 'border-blue-500/70'
                      : isGenuine
                      ? 'border-emerald-500/80 shadow-sm'
                      : 'border-amber-400'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded bg-slate-900 text-orange-400 px-2 py-0.5 text-[10px] font-black uppercase">
                          {cmp.submittedByPortal === 'customer_app'
                            ? 'Customer App Report'
                            : `C&F App Report (${cmp.cnfName || 'C&F'})`}
                        </span>
                        <span
                          className={`rounded px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            isGenuine
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400'
                              : 'bg-amber-100 text-amber-900 border border-amber-400'
                          }`}
                        >
                          🤖 Gemini AI Check: {cmp.aiVerificationStatus} ({cmp.aiConfidenceScore}% Confidence)
                        </span>
                        <span
                          className={`rounded px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            isResolved
                              ? 'bg-blue-600 text-white'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {isResolved ? '✓ Resolved by Main App Authority' : 'Open — Action Required'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1.5">
                        {cmp.subject}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Submitted by: <strong>{cmp.submitterName}</strong> (+91 {cmp.submitterMobile}) •{' '}
                        {cmp.relatedInvoiceNumber ? `Invoice #${cmp.relatedInvoiceNumber} • ` : ''}
                        {cmp.createdAt}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReverifyWithGemini(cmp)}
                      disabled={verifyingComplaintId === cmp.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 font-black text-[11px] shadow"
                    >
                      <Sparkles
                        className={`h-3.5 w-3.5 ${
                          verifyingComplaintId === cmp.id ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {verifyingComplaintId === cmp.id
                          ? 'AI Checking...'
                          : 'Re-Verify Genuineness with AI'}
                      </span>
                    </button>
                  </div>

                  <p className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                    {cmp.description}
                  </p>

                  {/* AI Verification Analysis Box */}
                  {cmp.aiVerificationReason && (
                    <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3 flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-emerald-950 dark:text-emerald-300 block">
                          Google Gemini AI Genuineness Assessment:
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                          {cmp.aiVerificationReason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Uploaded Picture / PDF Attachment Viewer */}
                  {cmp.attachmentName && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-3 border border-slate-300 dark:border-slate-700">
                      <div className="flex items-center gap-2.5">
                        {cmp.attachmentType === 'pdf' ? (
                          <FileText className="h-5 w-5 text-red-600" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-emerald-600" />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            Uploaded Device Proof: {cmp.attachmentName} ({cmp.attachmentType?.toUpperCase()})
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Uploaded from user device with complaint report
                          </p>
                        </div>
                      </div>
                      {cmp.attachmentDataUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(cmp)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5 font-bold text-[11px]"
                        >
                          <Eye className="h-3.5 w-3.5 text-amber-400" />
                          <span>View Uploaded {cmp.attachmentType === 'pdf' ? 'PDF' : 'Picture'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Main App Full Authority Resolution Controls */}
                  {isResolved ? (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800 p-3 text-blue-950 dark:text-blue-200">
                      <strong>✓ Resolved by Main App Authority ({cmp.resolvedAt}):</strong>{' '}
                      {cmp.mainAdminResolutionNote}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={resolutionDrafts[cmp.id] || ''}
                        onChange={(e) =>
                          setResolutionDrafts((prev) => ({ ...prev, [cmp.id]: e.target.value }))
                        }
                        placeholder="Enter Main App official resolution order (e.g. Approved pending product dispatch / Credited UPI ledger)..."
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleResolveComplaintByMainApp(cmp)}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black flex items-center justify-center gap-1.5 shadow shrink-0"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Resolve Report (Main App Authority)</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: GOOGLE GEMINI AI APP FEATURE UPDATER */}
      {subTab === 'gemini_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center shadow">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Powered by Google Gemini (Server-Side API)
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Google Gemini Main App Feature & Configuration Updater
                </h3>
              </div>
            </div>

            <form onSubmit={handleRunGeminiUpdater} className="space-y-3">
              <textarea
                rows={4}
                value={geminiPrompt}
                onChange={(e) => setGeminiPrompt(e.target.value)}
                placeholder="e.g. Enable a 1.5% UPI transaction fee option, set a new festival announcement banner for all C&Fs, or add a new pending product verification rule..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="submit"
                disabled={isCallingGemini || !geminiPrompt.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition"
              >
                {isCallingGemini ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Google Gemini is generating feature update...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate App Update with Google Gemini</span>
                  </>
                )}
              </button>
            </form>

            {geminiError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 p-3 text-xs text-red-800 dark:text-red-200">
                {geminiError}
              </div>
            )}

            {geminiResponse && (
              <div className="rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border-2 border-blue-500/60 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                    Target: {geminiResponse.targetPortal}
                  </span>
                  <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                    Ready to Apply Live
                  </span>
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                  {geminiResponse.featureTitle}
                </h4>
                <p className="text-slate-700 dark:text-slate-300">{geminiResponse.summary}</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                  {geminiResponse.implementationSteps.map((st, idx) => (
                    <li key={idx}>{st}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleApplyGeminiPatch}
                  className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Apply This Gemini Update to Live App</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-600" />
              <span>Active App Rules & Gemini Updates</span>
            </h4>
            {mainAdminConfig.globalAnnouncementBanner && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 p-3">
                <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300 block">
                  Live Global App Banner
                </span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {mainAdminConfig.globalAnnouncementBanner}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {mainAdminConfig.dynamicFeatureRules.map((rule, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 border border-slate-200 dark:border-slate-700 flex items-start gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: C&F & CUSTOMER APP FEEDBACK HUB */}
      {subTab === 'feedbacks' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-black text-base text-slate-900 dark:text-white">
            All Feedback from Other C&Fs & Customers ({feedbacks.length})
          </h3>
          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div
                key={fb.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white">
                      {fb.submitterName} (+91 {fb.submitterMobile})
                    </span>
                    <span className="rounded bg-orange-100 dark:bg-orange-950 px-2 py-0.5 text-[10px] font-black text-orange-800 dark:text-orange-300">
                      {fb.submittedByPortal === 'customer_app'
                        ? 'Customer App'
                        : `C&F App (${fb.cnfName || 'C&F'})`}
                    </span>
                    <span className="font-black text-amber-500">{'★'.repeat(fb.rating)}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{fb.createdAt}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">{fb.message}</p>

                {fb.adminReply ? (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-2.5 text-emerald-900 dark:text-emerald-200">
                    <strong>Main Admin Reply:</strong> {fb.adminReply}
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={replyDrafts[fb.id] || ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [fb.id]: e.target.value }))
                      }
                      placeholder="Write a reply to this C&F or Customer..."
                      className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-slate-50 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveFeedbackReply(fb.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white font-bold flex items-center gap-1"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Reply</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachment Preview Modal (Picture or PDF) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                Uploaded Proof: {previewAttachment.attachmentName}
              </h4>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                ✕ Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex justify-center bg-slate-100 dark:bg-slate-950 p-4 rounded-xl">
              {previewAttachment.attachmentType === 'pdf' ? (
                <iframe
                  src={previewAttachment.attachmentDataUrl}
                  title="Uploaded PDF"
                  className="w-full h-96 rounded border"
                />
              ) : (
                <img
                  src={previewAttachment.attachmentDataUrl}
                  alt="Uploaded Proof"
                  className="max-h-96 object-contain rounded-lg shadow"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
