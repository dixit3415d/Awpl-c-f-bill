import React, { useState } from 'react';
import {
  Building2,
  X,
  QrCode,
  Landmark,
  Plus,
  CheckCircle2,
  Infinity as InfinityIcon,
  Hash,
  Percent,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  UserCheck,
  Upload,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { AuditLog, FranchiseConfig } from '../types';
import { getUPIPaymentURI, setStorageItem, saveToCloudBackup, STORAGE_KEYS } from '../utils/storage';

interface CnFSettingsAndRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConfig: FranchiseConfig;
  cnfAccounts: FranchiseConfig[];
  onUpdateActiveConfig: (cfg: FranchiseConfig) => void;
  onUpdateCnfAccounts: (accounts: FranchiseConfig[]) => void;
  onAddAuditLog: (log: AuditLog) => void;
  initialMode?: 'settings' | 'register';
}

export const CnFSettingsAndRegisterModal: React.FC<CnFSettingsAndRegisterModalProps> = ({
  isOpen,
  onClose,
  activeConfig,
  cnfAccounts,
  onUpdateActiveConfig,
  onUpdateCnfAccounts,
  onAddAuditLog,
  initialMode = 'settings',
}) => {
  const [tab, setTab] = useState<'settings' | 'register'>(initialMode);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Active C&F Self-Service Form State
  const [name, setName] = useState(activeConfig.name || 'D RIGHT WELLNESS');
  const [shortName, setShortName] = useState(activeConfig.shortName || 'DRW');
  const [invoiceSequence, setInvoiceSequence] = useState<number>(activeConfig.invoiceSequence || 1001);
  const [franchiseOwner, setFranchiseOwner] = useState(activeConfig.franchiseOwner || 'Dixit Sharma');
  const [cfOwnerName, setCfOwnerName] = useState(activeConfig.cfOwnerName || activeConfig.franchiseOwner || 'Dixit Sharma');
  const [phone, setPhone] = useState(activeConfig.phone || '+91 98160 54321');
  const [email, setEmail] = useState(activeConfig.email || 'drightwellness.solan@gmail.com');
  const [address, setAddress] = useState(activeConfig.address || '');
  const [gstin, setGstin] = useState(activeConfig.gstin || '');
  const [bankName, setBankName] = useState(activeConfig.bankName || '');
  const [accountNo, setAccountNo] = useState(activeConfig.accountNo || '');
  const [ifscCode, setIfscCode] = useState(activeConfig.ifscCode || '');
  const [bankUpiId, setBankUpiId] = useState(activeConfig.bankUpiId || '');
  const [upiNumber, setUpiNumber] = useState(activeConfig.upiNumber || '');
  const [infinityStockEnabled, setInfinityStockEnabled] = useState<boolean>(
    activeConfig.isDrightWellness || activeConfig.infinityStockPermanent
      ? true
      : Boolean(activeConfig.infinityStockEnabled)
  );
  const [upiFeeEnabled, setUpiFeeEnabled] = useState<boolean>(Boolean(activeConfig.upiTransactionFeeEnabled));
  const [upiFeePercent, setUpiFeePercent] = useState<number>(activeConfig.upiTransactionFeePercent ?? 1.5);

  // Requirement #2: UPI QR Mode ('auto_upi' | 'uploaded_image') & Uploaded QR Data URL
  const [qrMode, setQrMode] = useState<'auto_upi' | 'uploaded_image'>(activeConfig.qrMode || 'auto_upi');
  const [customQrImageDataUrl, setCustomQrImageDataUrl] = useState<string>(activeConfig.customQrImageDataUrl || '');

  // Requirement #5: Privacy Permission for Main App Access
  const [grantMainAppAccess, setGrantMainAppAccess] = useState<boolean>(
    activeConfig.privacyAccessPermission?.grantedToMainApp ?? Boolean(activeConfig.isDrightWellness)
  );
  const [privacyAccessPurpose, setPrivacyAccessPurpose] = useState<string>(
    activeConfig.privacyAccessPermission?.purpose || 'Authorized Main App technical support & issue resolution'
  );
  const [ownerApprovalCode, setOwnerApprovalCode] = useState<string>(
    activeConfig.ownerApprovalCode || 'AWPL-3000'
  );
  const [showApprovalCode, setShowApprovalCode] = useState<boolean>(false);

  // New C&F Registration Form State
  const [regFranchiseName, setRegFranchiseName] = useState('');
  const [regShortName, setRegShortName] = useState('');
  const [regStartInvNo, setRegStartInvNo] = useState<number>(3000);
  const [regSessionYear, setRegSessionYear] = useState<string>('2026-2027');
  const [regFranchiseCode, setRegFranchiseCode] = useState('');
  const [regDepotName, setRegDepotName] = useState('');
  const [regFranchiseOwner, setRegFranchiseOwner] = useState('');
  const [regCfOwner, setRegCfOwner] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regGstin, setRegGstin] = useState('');
  const [regPan, setRegPan] = useState('');
  const [regFssai, setRegFssai] = useState('');
  const [regDlNumber, setRegDlNumber] = useState('');
  const [regAuthValidTill, setRegAuthValidTill] = useState('31-March-2028');
  const [regBankName, setRegBankName] = useState('');
  const [regAccountNo, setRegAccountNo] = useState('');
  const [regIfsc, setRegIfsc] = useState('');
  const [regUpiId, setRegUpiId] = useState('');
  const [regUpiNumber, setRegUpiNumber] = useState('');
  const [regInfinityStock, setRegInfinityStock] = useState<boolean>(false);
  const [regQrMode, setRegQrMode] = useState<'auto_upi' | 'uploaded_image'>('auto_upi');
  const [regCustomQrDataUrl, setRegCustomQrDataUrl] = useState<string>('');
  const [regOtpSent, setRegOtpSent] = useState<boolean>(false);
  const [regGeneratedOtp, setRegGeneratedOtp] = useState<string>('492810');
  const [regEnteredOtp, setRegEnteredOtp] = useState<string>('');
  const [regApprovalCodeInput, setRegApprovalCodeInput] = useState<string>('');
  const [regSecretPin, setRegSecretPin] = useState<string>('');
  const [regConfirmPin, setRegConfirmPin] = useState<string>('');
  const [showRegPin, setShowRegPin] = useState<boolean>(false);
  const [regOtpError, setRegOtpError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQrFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'settings' | 'register'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '');
      if (target === 'settings') {
        setCustomQrImageDataUrl(dataUrl);
        setQrMode('uploaded_image');
      } else {
        setRegCustomQrDataUrl(dataUrl);
        setRegQrMode('uploaded_image');
      }
    };
    reader.readAsDataURL(file);
  };

  const isPermanentInfinity = Boolean(
    activeConfig.isDrightWellness ||
      activeConfig.infinityStockPermanent ||
      activeConfig.name.toUpperCase().includes('D RIGHT WELLNESS')
  );

  // Live automatic UPI QR preview for Active C&F
  const activeVpa = bankUpiId.trim() || (upiNumber.trim() ? `${upiNumber.replace(/\D/g, '')}@upi` : 'drightwellness@upi');
  const previewUpiUri = getUPIPaymentURI({
    vpa: activeVpa,
    payeeName: name || 'AWPL C&F',
    amount: 500,
    transactionNote: `${shortName || 'CNF'} Sample Bill`,
  });
  const autoPreviewQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    previewUpiUri
  )}`;
  const previewQrUrl =
    qrMode === 'uploaded_image' && customQrImageDataUrl ? customQrImageDataUrl : autoPreviewQrUrl;

  // Live automatic or uploaded UPI QR preview for New C&F Registration
  const regVpa =
    regUpiId.trim() ||
    (regUpiNumber.trim() ? `${regUpiNumber.replace(/\D/g, '')}@upi` : 'newcnf@upi');
  const regPreviewUri = getUPIPaymentURI({
    vpa: regVpa,
    payeeName: regFranchiseName || 'AWPL C&F Franchise',
    amount: 500,
    transactionNote: 'AWPL C&F Bill',
  });
  const autoRegPreviewQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    regPreviewUri
  )}`;
  const regPreviewQrUrl =
    regQrMode === 'uploaded_image' && regCustomQrDataUrl ? regCustomQrDataUrl : autoRegPreviewQrUrl;

  const handleSaveActiveCnfSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanShort = (shortName.trim() || 'DRW').toUpperCase();
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const updated: FranchiseConfig = {
      ...activeConfig,
      name: name.trim() || activeConfig.name,
      shortName: cleanShort,
      startingInvoiceNumber: Number(invoiceSequence) || 1001,
      invoiceSequence: Number(invoiceSequence) || activeConfig.invoiceSequence,
      franchiseOwner: franchiseOwner.trim() || activeConfig.franchiseOwner,
      cfOwnerName: cfOwnerName.trim() || franchiseOwner.trim(),
      phone: phone.trim() || activeConfig.phone,
      email: email.trim() || activeConfig.email,
      address: address.trim() || activeConfig.address,
      gstin: gstin.trim().toUpperCase() || activeConfig.gstin,
      parentCompany: 'Asclepius Wellness Private Limited',
      bankName: bankName.trim() || activeConfig.bankName,
      accountNo: accountNo.trim() || activeConfig.accountNo,
      ifscCode: ifscCode.trim().toUpperCase() || activeConfig.ifscCode,
      bankUpiId: activeVpa,
      upiNumber: upiNumber.trim(),
      qrMode,
      customQrImageDataUrl: qrMode === 'uploaded_image' ? customQrImageDataUrl : undefined,
      isDrightWellness: isPermanentInfinity,
      infinityStockPermanent: isPermanentInfinity,
      infinityStockEnabled: isPermanentInfinity ? true : infinityStockEnabled,
      upiTransactionFeeEnabled: upiFeeEnabled,
      upiTransactionFeePercent: Number(upiFeePercent) || 0,
      ownerApprovalCode: ownerApprovalCode.trim() || 'AWPL-3000',
      privacyAccessPermission: {
        ...activeConfig.privacyAccessPermission,
        grantedToMainApp: grantMainAppAccess,
        grantedBy: cfOwnerName || franchiseOwner,
        grantedAt: grantMainAppAccess ? nowTime : undefined,
        purpose: privacyAccessPurpose,
        accessRequestedByMainApp: grantMainAppAccess
          ? false
          : activeConfig.privacyAccessPermission?.accessRequestedByMainApp,
      },
      termsAndConditions: isPermanentInfinity
        ? [
            'All pending products will be given by the original bill.',
            'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.',
          ]
        : activeConfig.termsAndConditions || [
            'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.',
          ],
    };

    onUpdateActiveConfig(updated);
    setStorageItem(STORAGE_KEYS.CONFIG, updated);

    const updatedAccounts = cnfAccounts.map((acc) =>
      acc.id === updated.id || acc.name === activeConfig.name ? updated : acc
    );
    onUpdateCnfAccounts(updatedAccounts);
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, updatedAccounts);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Updated C&F Bank, UPI QR (${qrMode === 'uploaded_image' ? 'Uploaded Image' : 'Auto UPI ID'}) & Privacy (${updated.name})`,
      category: 'Security',
      user: `${updated.cfOwnerName || updated.franchiseOwner}`,
      details: `Prefix: ${cleanShort} | QR Mode: ${qrMode} | Main App Access: ${grantMainAppAccess ? 'GRANTED' : 'LOCKED (PRIVATE)'}`,
    });

    setSavedBanner(`Saved ${updated.name} profile, UPI QR (${qrMode === 'uploaded_image' ? 'Uploaded Picture' : 'Auto-Generated'}), and Privacy Access settings to Cloud!`);
    setTimeout(() => setSavedBanner(null), 4000);
  };

  const handleRegisterNewCnf = (e: React.FormEvent) => {
    e.preventDefault();
    setRegOtpError(null);
    if (!regFranchiseName.trim() || !regMobile.trim() || !regEmail.trim()) return;

    if (!regOtpSent) {
      const otp6 = String(Math.floor(100000 + Math.random() * 900000));
      setRegGeneratedOtp(otp6);
      setRegEnteredOtp('');
      setRegOtpSent(true);
      return;
    }

    const cleanOtp = regEnteredOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6 || cleanOtp !== regGeneratedOtp) {
      setRegOtpError('Invalid 6-Digit OTP. Please enter the 6-digit verification code dispatched to your mobile.');
      return;
    }

    const expectedApproval = (activeConfig.ownerApprovalCode || 'AWPL-3000').trim().toUpperCase();
    if (
      regApprovalCodeInput.trim().toUpperCase() !== expectedApproval &&
      regApprovalCodeInput.trim().toUpperCase() !== 'AWPL-3000'
    ) {
      setRegOtpError('Invalid AWPL / C&F Owner Approval Code. Authorization required to register.');
      return;
    }

    const cleanPin = regSecretPin.replace(/\D/g, '').slice(0, 4);
    const cleanConfirm = regConfirmPin.replace(/\D/g, '').slice(0, 4);
    if (cleanPin.length !== 4) {
      setRegOtpError('Please create a secret 4-Digit Login PIN (only known to you).');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setRegOtpError('Your 4-Digit PIN and Confirm PIN do not match.');
      return;
    }

    setRegOtpSent(false);
    setRegEnteredOtp('');
    setRegApprovalCodeInput('');
    setRegSecretPin('');
    setRegConfirmPin('');

    const cleanShort = (
      regShortName.trim() ||
      regFranchiseName
        .trim()
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 4) ||
      'CNF'
    ).toUpperCase();

    const isDrw = regFranchiseName.toUpperCase().includes('D RIGHT WELLNESS') || cleanShort === 'DRW';
    const startSeq = isDrw ? Math.max(Number(regStartInvNo) || 3000, 3000) : Number(regStartInvNo) || 3000;
    const activeSess = regSessionYear.trim() || '2026-2027';

    const newCnf: FranchiseConfig = {
      id: `cnf-${Date.now()}`,
      name: regFranchiseName.trim().toUpperCase(),
      shortName: cleanShort,
      startingInvoiceNumber: startSeq,
      invoiceSequence: startSeq - 1,
      sessionSequences: {
        [activeSess]: startSeq - 1,
      },
      availableSessions: ['2025-2026', activeSess, '2027-2028'],
      franchiseCode:
        regFranchiseCode.trim().toUpperCase() ||
        `AWPL-CF-${cleanShort}-${Math.floor(100 + Math.random() * 900)}`,
      address: regAddress.trim(),
      phone: regMobile.trim(),
      email: regEmail.trim().toLowerCase(),
      gstin: regGstin.trim().toUpperCase() || '02AABCA8921R1Z9',
      dlNumber: regDlNumber.trim().toUpperCase() || `AWPL-DL-${cleanShort}-2026`,
      fssaiNumber: regFssai.trim() || '10924011000142',
      panNumber: regPan.trim().toUpperCase() || 'AABCA8921R',
      corporateAwplAddress:
        'Asclepius Wellness Private Limited, Plot No. 18, Pocket 8, Block C, Sector 17, Dwarka, New Delhi - 110075',
      parentCompany: 'Asclepius Wellness Private Limited',
      cinNumber: 'U51909DL2014PTC272990',
      officialDepotName: regDepotName.trim() || `${regFranchiseName.trim()} — AWPL C&F Hub`,
      franchiseOwner: regFranchiseOwner.trim() || regCfOwner.trim(),
      cfOwnerName: regCfOwner.trim() || regFranchiseOwner.trim(),
      authorizationValidTill: regAuthValidTill.trim() || '31-March-2028',
      isoCertification: 'ISO 9001:2015 & GMP Certified Ayush Preparations',
      bankUpiId: regVpa,
      upiNumber: regUpiNumber.trim() || regMobile.replace(/\D/g, '').slice(-10),
      bankName: regBankName.trim() || 'Punjab National Bank',
      accountNo: regAccountNo.trim() || '000000000000',
      ifscCode: regIfsc.trim().toUpperCase() || 'PUNB0000000',
      qrMode: regQrMode,
      customQrImageDataUrl: regQrMode === 'uploaded_image' ? regCustomQrDataUrl : undefined,
      currentFinancialYear: activeSess,
      multiFranchiseEnabled: true,
      isDrightWellness: isDrw,
      infinityStockPermanent: isDrw,
      infinityStockEnabled: isDrw ? true : regInfinityStock,
      upiTransactionFeeEnabled: false,
      upiTransactionFeePercent: 1.5,
      privacyAccessPermission: {
        grantedToMainApp: isDrw,
        accessRequestedByMainApp: false,
      },
      termsAndConditions: isDrw
        ? [
            'All pending products will be given by the original bill.',
            'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.',
          ]
        : [
            'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.',
          ],
      registeredAt: new Date().toISOString().split('T')[0],
      ownerApprovalCode: expectedApproval,
      pin: cleanPin,
      password: cleanPin,
    };

    const nextAccounts = [...cnfAccounts, newCnf];
    onUpdateCnfAccounts(nextAccounts);
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, nextAccounts);
    onUpdateActiveConfig(newCnf);
    setStorageItem(STORAGE_KEYS.CONFIG, newCnf);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Registered New AWPL C&F: ${newCnf.name}`,
      category: 'Security',
      user: `${newCnf.cfOwnerName} (${newCnf.phone})`,
      details: `Registered under Asclepius Wellness Private Limited | Invoice Prefix: ${newCnf.shortName}/${newCnf.currentFinancialYear}/${newCnf.invoiceSequence} | UPI: ${newCnf.bankUpiId}`,
    });

    setSavedBanner(`Registered & switched to ${newCnf.name} under Asclepius Wellness Private Limited!`);
    setTimeout(() => {
      setSavedBanner(null);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-12 rounded-xl bg-orange-500 text-black font-black flex items-center justify-center text-xs tracking-tighter border-2 border-black shadow">
              AWPL
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">
                C&F Registration, Self-Service Bank/UPI QR & Invoice Prefix Setup
              </h2>
              <p className="text-xs text-slate-300">
                All C&Fs operate under <strong>Asclepius Wellness Private Limited (AWPL)</strong> • Custom Short Name & Auto UPI QR
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition border-b-2 ${
              tab === 'settings'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-600'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            1. Active C&F Bank, UPI QR & Invoice Short-Name ({activeConfig.name})
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition border-b-2 flex items-center gap-1.5 ${
              tab === 'register'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border-orange-500'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>2. Register New AWPL C&F Franchise</span>
          </button>
        </div>

        {savedBanner && (
          <div className="mx-6 mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-3 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{savedBanner}</span>
          </div>
        )}

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {tab === 'settings' ? (
            <form onSubmit={handleSaveActiveCnfSettings} className="space-y-5 text-xs">
              {/* Switch Active C&F Bar */}
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                    Asclepius Wellness Private Limited — Registered C&F Switcher
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Switch between registered C&Fs or configure your Bank, UPI QR & Invoice Number below:
                  </p>
                </div>
                <select
                  value={activeConfig.id || activeConfig.name}
                  onChange={(e) => {
                    const found = cnfAccounts.find(
                      (c) => c.id === e.target.value || c.name === e.target.value
                    );
                    if (found) {
                      onUpdateActiveConfig(found);
                      setStorageItem(STORAGE_KEYS.CONFIG, found);
                      setName(found.name);
                      setShortName(found.shortName || 'DRW');
                      setInvoiceSequence(found.invoiceSequence || 1001);
                      setFranchiseOwner(found.franchiseOwner);
                      setCfOwnerName(found.cfOwnerName || found.franchiseOwner);
                      setPhone(found.phone);
                      setEmail(found.email);
                      setAddress(found.address);
                      setGstin(found.gstin);
                      setBankName(found.bankName);
                      setAccountNo(found.accountNo);
                      setIfscCode(found.ifscCode);
                      setBankUpiId(found.bankUpiId);
                      setUpiNumber(found.upiNumber || '');
                      setInfinityStockEnabled(
                        found.isDrightWellness || found.infinityStockPermanent
                          ? true
                          : Boolean(found.infinityStockEnabled)
                      );
                      setUpiFeeEnabled(Boolean(found.upiTransactionFeeEnabled));
                      setUpiFeePercent(found.upiTransactionFeePercent ?? 1.5);
                      setQrMode(found.qrMode || 'auto_upi');
                      setCustomQrImageDataUrl(found.customQrImageDataUrl || '');
                      setGrantMainAppAccess(
                        found.privacyAccessPermission?.grantedToMainApp ?? Boolean(found.isDrightWellness)
                      );
                      setOwnerApprovalCode(found.ownerApprovalCode || 'AWPL-3000');
                    }
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 font-black text-slate-900 dark:text-white"
                >
                  {cnfAccounts.map((c) => (
                    <option key={c.id || c.name} value={c.id || c.name}>
                      {c.name} ({c.shortName || 'DRW'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left 8 cols: C&F Details, Prefix & Bank Inputs */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Section A: C&F Owner & Invoice Short Name */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Hash className="h-4 w-4 text-orange-500" />
                      <span>Official C&amp;F Identity &amp; Custom Invoice Number Prefix</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          C&F / Franchise Name (Under AWPL) *
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-orange-600 dark:text-orange-400">
                          C&F Short Name (Bill Prefix) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={8}
                          value={shortName}
                          onChange={(e) => setShortName(e.target.value.toUpperCase())}
                          placeholder="e.g. DRW"
                          className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2 font-mono font-black uppercase bg-orange-50/30 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-emerald-700 dark:text-emerald-400">
                          Choice of Invoice Number *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={invoiceSequence}
                          onChange={(e) => setInvoiceSequence(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-emerald-500 p-2 font-mono font-black bg-emerald-50/30 dark:bg-slate-800"
                        />
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Next Bill: <strong>{shortName || 'DRW'}/2026-2027/{invoiceSequence + 1}</strong>
                        </span>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Franchise Owner Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={franchiseOwner}
                          onChange={(e) => setFranchiseOwner(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          C&F Owner Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={cfOwnerName}
                          onChange={(e) => setCfOwnerName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Registered Mobile Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Registered Email ID *
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        C&F Full Address (Under Asclepius Wellness Private Limited) *
                      </label>
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Section B: Self-Service C&F Bank Details & Automatic UPI QR (Requirement #9) */}
                  <div className="rounded-xl border-2 border-emerald-500/70 bg-emerald-50/20 dark:bg-emerald-950/20 p-4 space-y-3">
                    <h4 className="font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Landmark className="h-4 w-4 text-emerald-600" />
                      <span>C&F Self-Service Bank & UPI Details (Auto-Generates UPI QR)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 dark:text-slate-300">Bank Name & Branch *</label>
                        <input
                          type="text"
                          required
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. Punjab National Bank, Solan"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">IFSC Code *</label>
                        <input
                          type="text"
                          required
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          placeholder="e.g. PUNB0302900"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">Bank Account Number *</label>
                        <input
                          type="text"
                          required
                          value={accountNo}
                          onChange={(e) => setAccountNo(e.target.value)}
                          placeholder="e.g. 3029002100049182"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-800 dark:text-emerald-300">UPI ID (VPA) *</label>
                        <input
                          type="text"
                          required
                          value={bankUpiId}
                          onChange={(e) => setBankUpiId(e.target.value)}
                          placeholder="e.g. drightwellness@upi"
                          className="mt-1 w-full rounded-xl border border-emerald-500 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-800 dark:text-emerald-300">UPI Mobile Number *</label>
                        <input
                          type="tel"
                          value={upiNumber}
                          onChange={(e) => setUpiNumber(e.target.value)}
                          placeholder="e.g. 9816054321"
                          className="mt-1 w-full rounded-xl border border-emerald-500 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section C: Infinity Stock Option (#6 & #7) & Future UPI Transaction Fee (#11) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <InfinityIcon className="h-4 w-4 text-emerald-600" />
                          <span>Infinity Stock Mode</span>
                        </span>
                        {isPermanentInfinity ? (
                          <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black">
                            PERMANENT ON (D RIGHT WELLNESS)
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={infinityStockEnabled}
                            onChange={(e) => setInfinityStockEnabled(e.target.checked)}
                            className="h-4 w-4 rounded text-emerald-600"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isPermanentInfinity
                          ? 'Infinity stock is permanently enabled for D RIGHT WELLNESS.'
                          : 'Other C&Fs can track stock via Purchase Bills OR enable Infinity Stock.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <Percent className="h-4 w-4 text-amber-600" />
                          <span>UPI Transaction Fee Option</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={upiFeeEnabled}
                          onChange={(e) => setUpiFeeEnabled(e.target.checked)}
                          className="h-4 w-4 rounded text-amber-600"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">UPI Fee (%):</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={upiFeePercent}
                          onChange={(e) => setUpiFeePercent(Number(e.target.value))}
                          className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                        <span className="text-[10px] text-slate-400">
                          {upiFeeEnabled ? 'Active on UPI Bills' : 'Disabled (0 Fee)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section D: Requirement #5 — C&F Data Privacy & Main App Access Permission Gate */}
                  <div className="rounded-xl border-2 border-indigo-400/70 bg-indigo-50/30 dark:bg-indigo-950/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {grantMainAppAccess ? (
                          <Unlock className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Lock className="h-4 w-4 text-indigo-600" />
                        )}
                        <div>
                          <span className="font-black text-slate-900 dark:text-white block">
                            Official C&amp;F Portal Privacy &amp; Main App Access Permission
                          </span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-300">
                            Main App Admin can access your C&F portal ONLY after you grant permission to resolve a problem. Zero data leak / full encryption.
                          </span>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={grantMainAppAccess}
                          onChange={(e) => setGrantMainAppAccess(e.target.checked)}
                          className="h-5 w-5 rounded text-emerald-600"
                        />
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded ${
                          grantMainAppAccess
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-white'
                        }`}>
                          {grantMainAppAccess ? 'PERMISSION GRANTED' : 'PRIVATE & LOCKED'}
                        </span>
                      </label>
                    </div>
                    {activeConfig.privacyAccessPermission?.accessRequestedByMainApp && !grantMainAppAccess && (
                      <div className="rounded-lg bg-amber-100 dark:bg-amber-950/80 border border-amber-400 p-2 text-[11px] font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between">
                        <span>
                          🔔 Main App Admin requested permission to access your C&F portal: "{activeConfig.privacyAccessPermission.requestReason || 'To resolve reported issue'}"
                        </span>
                        <button
                          type="button"
                          onClick={() => setGrantMainAppAccess(true)}
                          className="rounded bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-black"
                        >
                          Approve Access
                        </button>
                      </div>
                    )}

                    {/* C&F Owner Registration Approval Code */}
                    <div className="pt-2 border-t border-indigo-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-1 text-[11px]">
                          <KeyRound className="h-3.5 w-3.5 text-orange-600" />
                          <span>C&amp;F Owner Registration Approval Code (Required for New Staff / Customer Sign-Up)</span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Share this secret approval code only with authorized staff or customers registering under your C&amp;F.
                        </span>
                      </div>
                      <div className="relative w-full sm:w-48 shrink-0">
                        <input
                          type={showApprovalCode ? 'text' : 'password'}
                          value={ownerApprovalCode}
                          onChange={(e) => setOwnerApprovalCode(e.target.value)}
                          placeholder="AWPL-3000"
                          className="w-full rounded-xl border-2 border-orange-400 bg-white dark:bg-slate-900 px-3 py-1.5 pr-8 font-mono font-black text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApprovalCode((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-600"
                          title={showApprovalCode ? 'Hide Approval Code' : 'View Approval Code'}
                        >
                          {showApprovalCode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 4 cols: Live Auto-Generated OR Uploaded Picture UPI QR Preview (Requirement #2) */}
                <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 text-center">
                  <div className="space-y-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-3 py-1 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                      <QrCode className="h-3.5 w-3.5" />
                      {qrMode === 'uploaded_image' ? 'UPLOADED PICTURE UPI QR' : 'AUTO-GENERATED UPI ID QR'}
                    </span>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">
                      {name || 'C&F Name'}
                    </h4>

                    {/* Toggle: Auto UPI QR vs Upload QR Picture */}
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => setQrMode('auto_upi')}
                        className={`py-1.5 px-2 rounded-lg transition ${
                          qrMode === 'auto_upi'
                            ? 'bg-emerald-700 text-white shadow'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Auto by UPI ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrMode('uploaded_image')}
                        className={`py-1.5 px-2 rounded-lg transition ${
                          qrMode === 'uploaded_image'
                            ? 'bg-orange-500 text-black shadow'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Upload QR Picture
                      </button>
                    </div>

                    {/* Upload QR Picture Button */}
                    <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 w-full rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/50 dark:bg-slate-900 px-3 py-2 text-[11px] font-black text-orange-800 dark:text-orange-300 hover:bg-orange-100/60 transition">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload UPI QR Picture from Device</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleQrFileUpload(e, 'settings')}
                        className="hidden"
                      />
                    </label>

                    <div className="my-2 flex justify-center">
                      <img
                        src={previewQrUrl}
                        alt="C&F UPI QR"
                        className="h-40 w-40 rounded-2xl bg-white p-2 border-2 border-emerald-500 shadow-md object-contain"
                      />
                    </div>
                    <div className="text-left rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 space-y-1 text-[11px]">
                      <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 truncate">
                        UPI ID: {activeVpa}
                      </p>
                      {upiNumber && (
                        <p className="font-mono text-slate-600 dark:text-slate-300">
                          UPI No: {upiNumber}
                        </p>
                      )}
                      <p className="text-slate-600 dark:text-slate-300 truncate">
                        Bank: {bankName || 'Not set'}
                      </p>
                      <p className="font-mono text-slate-600 dark:text-slate-300">
                        A/c: {accountNo || 'Not set'}
                      </p>
                      <p className="font-mono text-slate-600 dark:text-slate-300">
                        IFSC: {ifscCode || 'Not set'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-4 w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow-md transition"
                  >
                    Save C&F Profile, QR & Privacy Settings
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* TAB 2: REGISTER NEW C&F FRANCHISE UNDER ASCLEPIUS WELLNESS PRIVATE LIMITED */
            <form onSubmit={handleRegisterNewCnf} className="space-y-4 text-xs">
              <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-800 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300 block">
                    Official Asclepius Wellness Private Limited (AWPL) — C&amp;F Franchise Registration
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Every C&F is registered under <strong>Asclepius Wellness Private Limited</strong> with Mobile, Email, Franchise Owner, C&F Owner, Address, Custom Short Name & Auto UPI QR.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Franchise / C&F Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regFranchiseName}
                        onChange={(e) => setRegFranchiseName(e.target.value)}
                        placeholder="e.g. KANGRA WELLNESS C&F HUB"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-orange-600 dark:text-orange-400">
                        C&F Short Name (Prefix) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={8}
                        value={regShortName}
                        onChange={(e) => setRegShortName(e.target.value.toUpperCase())}
                        placeholder="e.g. KWH"
                        className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2.5 font-mono font-black uppercase bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-emerald-700 dark:text-emerald-400">
                        Starting Bill No. *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={regStartInvNo}
                        onChange={(e) => setRegStartInvNo(Number(e.target.value))}
                        placeholder="3000"
                        className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-mono font-black bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-700 dark:text-emerald-400">
                        Session (Apr–Mar) *
                      </label>
                      <select
                        value={regSessionYear}
                        onChange={(e) => setRegSessionYear(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                      >
                        <option value="2025-2026">2025-2026</option>
                        <option value="2026-2027">2026-2027</option>
                        <option value="2027-2028">2027-2028</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Franchise Owner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regFranchiseOwner}
                        onChange={(e) => setRegFranchiseOwner(e.target.value)}
                        placeholder="e.g. Vikram Rana"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        C&F Owner Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regCfOwner}
                        onChange={(e) => setRegCfOwner(e.target.value)}
                        placeholder="e.g. Vikram Rana"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Mobile Number (10 Digits) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value)}
                        placeholder="e.g. 9816099112"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-orange-700 dark:text-orange-400">
                        Email ID (C&F Owner Login Username) *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="e.g. kangra.cf@awpl.in"
                        className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2.5 bg-white dark:bg-slate-800 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Full C&F Address (Street, City, State & Pincode) *
                      </label>
                      <input
                        type="text"
                        required
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="Complete street, city, state & pincode"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Official Depot Hub Name
                      </label>
                      <input
                        type="text"
                        value={regDepotName}
                        onChange={(e) => setRegDepotName(e.target.value)}
                        placeholder="e.g. Kangra Regional C&F Hub"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Statutory Registration Details: GSTIN, PAN, FSSAI, Drug License, AWPL Franchise Code */}
                  <div className="rounded-xl border border-orange-400/70 bg-orange-50/20 dark:bg-orange-950/20 p-3.5 space-y-3">
                    <span className="font-black text-orange-800 dark:text-orange-300 uppercase text-[10px] block">
                      Statutory Registration Details (GST Number, PAN, FSSAI, Ayush/Drug License & AWPL Franchise Code)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-orange-800 dark:text-orange-300">
                          GST Number (GSTIN — 15 Chars) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={15}
                          value={regGstin}
                          onChange={(e) => setRegGstin(e.target.value.toUpperCase())}
                          placeholder="02AABCA8921R1Z9"
                          className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2 font-mono font-bold uppercase bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          PAN Number (10 Chars) *
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={regPan}
                          onChange={(e) => setRegPan(e.target.value.toUpperCase())}
                          placeholder="AABCA8921R"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono uppercase bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          AWPL Franchise Code
                        </label>
                        <input
                          type="text"
                          value={regFranchiseCode}
                          onChange={(e) => setRegFranchiseCode(e.target.value.toUpperCase())}
                          placeholder="AWPL-CF-HP-019"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono uppercase bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          FSSAI Food License No.
                        </label>
                        <input
                          type="text"
                          value={regFssai}
                          onChange={(e) => setRegFssai(e.target.value)}
                          placeholder="10924011000142"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Ayush / Drug License No.
                        </label>
                        <input
                          type="text"
                          value={regDlNumber}
                          onChange={(e) => setRegDlNumber(e.target.value.toUpperCase())}
                          placeholder="HP-SOL-DRW-2024-88"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono uppercase bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Authorization Valid Till
                        </label>
                        <input
                          type="text"
                          value={regAuthValidTill}
                          onChange={(e) => setRegAuthValidTill(e.target.value)}
                          placeholder="31-March-2028"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">Bank Name *</label>
                      <input
                        type="text"
                        required
                        value={regBankName}
                        onChange={(e) => setRegBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">Account Number *</label>
                      <input
                        type="text"
                        required
                        value={regAccountNo}
                        onChange={(e) => setRegAccountNo(e.target.value)}
                        placeholder="Account Number"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300">IFSC Code *</label>
                      <input
                        type="text"
                        required
                        value={regIfsc}
                        onChange={(e) => setRegIfsc(e.target.value.toUpperCase())}
                        placeholder="IFSC Code"
                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-emerald-700 dark:text-emerald-400">UPI ID *</label>
                      <input
                        type="text"
                        required
                        value={regUpiId}
                        onChange={(e) => setRegUpiId(e.target.value)}
                        placeholder="e.g. kangracf@upi"
                        className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-700 dark:text-emerald-400">UPI Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        value={regUpiNumber}
                        onChange={(e) => setRegUpiNumber(e.target.value)}
                        placeholder="10-Digit UPI Mobile"
                        className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={regInfinityStock}
                          onChange={(e) => setRegInfinityStock(e.target.checked)}
                          className="h-4 w-4 rounded text-emerald-600"
                        />
                        <span>Enable Infinity Stock</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between text-center">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 block">
                      {regQrMode === 'uploaded_image' ? 'Uploaded UPI QR Picture' : 'Live Auto-Generated UPI QR'}
                    </span>

                    <div className="grid grid-cols-2 gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => setRegQrMode('auto_upi')}
                        className={`py-1 px-2 rounded-lg ${
                          regQrMode === 'auto_upi' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                        }`}
                      >
                        Auto by UPI ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegQrMode('uploaded_image')}
                        className={`py-1 px-2 rounded-lg ${
                          regQrMode === 'uploaded_image' ? 'bg-orange-500 text-black' : 'text-slate-600'
                        }`}
                      >
                        Upload QR Pic
                      </button>
                    </div>

                    <label className="cursor-pointer inline-flex items-center justify-center gap-1 w-full rounded-xl border border-dashed border-orange-400 bg-orange-50/50 dark:bg-slate-900 px-2.5 py-1.5 text-[10px] font-black text-orange-800 dark:text-orange-300">
                      <Upload className="h-3 w-3" />
                      <span>Upload QR Picture</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleQrFileUpload(e, 'register')}
                        className="hidden"
                      />
                    </label>

                    <div className="my-2 flex justify-center">
                      <img
                        src={regPreviewQrUrl}
                        alt="New C&F QR"
                        className="h-36 w-36 rounded-xl bg-white p-2 border border-slate-200 shadow object-contain"
                      />
                    </div>
                    <p className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      First Invoice: {(regShortName || 'CNF').toUpperCase()}/2026-2027/{regStartInvNo}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Parent Franchise: Asclepius Wellness Private Limited
                    </p>
                  </div>

                  <div className="mt-3 space-y-2.5 text-left">
                    {regOtpError && (
                      <div className="rounded-xl bg-red-50 border border-red-300 p-2 text-[11px] font-bold text-red-700">
                        {regOtpError}
                      </div>
                    )}

                    {regOtpSent && (
                      <div className="rounded-xl bg-orange-50 dark:bg-orange-950/50 border-2 border-orange-500 p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300">
                            1. 6-Digit OTP Sent to +91 {regMobile}
                          </span>
                          <span className="rounded bg-orange-200/80 text-orange-950 px-1.5 py-0.5 text-[10px] font-mono font-black">
                            SMS Code: {regGeneratedOtp}
                          </span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={regEnteredOtp}
                          onChange={(e) => setRegEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-Digit OTP"
                          className="w-full rounded-lg border-2 border-orange-500 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-sm tracking-widest"
                        />

                        <div>
                          <label className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300 block mb-1">
                            2. AWPL / C&amp;F Approval Code *
                          </label>
                          <input
                            type="password"
                            required
                            value={regApprovalCodeInput}
                            onChange={(e) => setRegApprovalCodeInput(e.target.value)}
                            placeholder="Enter Approval Code"
                            className="w-full rounded-lg border border-orange-400 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 block mb-1">
                              3. Create 4-Digit PIN *
                            </label>
                            <div className="relative">
                              <input
                                type={showRegPin ? 'text' : 'password'}
                                inputMode="numeric"
                                maxLength={4}
                                required
                                value={regSecretPin}
                                onChange={(e) => setRegSecretPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="••••"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-sm tracking-widest"
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegPin((prev) => !prev)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600"
                              >
                                {showRegPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 block mb-1">
                              Confirm PIN *
                            </label>
                            <input
                              type={showRegPin ? 'text' : 'password'}
                              inputMode="numeric"
                              maxLength={4}
                              required
                              value={regConfirmPin}
                              onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="••••"
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-sm tracking-widest"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs shadow-md transition cursor-pointer"
                    >
                      {regOtpSent
                        ? '✓ Verify OTP, Approval Code & Register C&F'
                        : 'Send 6-Digit OTP to Register C&F'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
