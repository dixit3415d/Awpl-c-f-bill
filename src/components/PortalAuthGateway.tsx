import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  Lock,
  LogIn,
  UserPlus,
  Copy,
  Check,
  Share2,
  Phone,
  Mail,
  KeyRound,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  Send,
  Eye,
  EyeOff,
  ShieldAlert,
  Clock
} from 'lucide-react';
import {
  AppPortalMode,
  AuditLog,
  AuthSession,
  AWPLGreeningCategory,
  AWPLRepurchaseSide,
  Customer,
  FranchiseConfig,
  MainAdminConfig,
  Role,
  StaffMember
} from '../types';
import {
  getUPIPaymentURI,
  saveToCloudBackup,
  setStorageItem,
  getStorageItem,
  STORAGE_KEYS,
  buildWhatsAppOfficialAppLinksUrl,
  syncPinChangeOnline,
  WHATSAPP_BUSINESS_OTP_SENDER,
  WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY,
  dispatchWhatsAppOtpFrom8988311142,
  dispatchCredentialsToUserWhatsApp
} from '../utils/storage';
import { DEFAULT_BILL_PRINT_CONFIG } from '../data/initialData';

export interface PersonalCredentialDispatch {
  roleLabel: 'C&F Owner' | 'C&F Staff' | 'Customer' | 'Main Admin';
  recipientName: string;
  usernameType: 'Email ID' | 'Mobile Number';
  usernameValue: string;
  autoPinPassword: string;
  mobileForMessage: string;
  emailForMessage?: string;
  portalLink: string;
  personalMessageText: string;
  whatsappAutoUrl?: string;
  pendingSession: AuthSession;
  pendingCnf?: FranchiseConfig;
  pendingCustomer?: Customer;
}

interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number; // timestamp in ms
}

const LOCKOUT_STORAGE_KEY = 'drw_login_lockout_v1';
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

interface PortalAuthGatewayProps {
  initialPortal: AppPortalMode;
  initialMode?: 'login' | 'register' | 'change_pin';
  cnfAccounts: FranchiseConfig[];
  activeCnfConfig: FranchiseConfig;
  customers: Customer[];
  staffList: StaffMember[];
  mainAdminConfig: MainAdminConfig;
  onLoginSuccess: (
    session: AuthSession,
    selectedCnf?: FranchiseConfig,
    selectedCustomer?: Customer
  ) => void;
  onUpdateCnfAccounts: (list: FranchiseConfig[]) => void;
  onUpdateActiveCnf: (cfg: FranchiseConfig) => void;
  onUpdateCustomers: (list: Customer[]) => void;
  onUpdateStaff?: (list: StaffMember[]) => void;
  onUpdateMainAdminConfig?: (cfg: MainAdminConfig) => void;
  onAddAuditLog: (log: AuditLog) => void;
  onCloseModal?: () => void;
  isModal?: boolean;
}

// Helper to generate a random 4-digit PIN password
export const generateAuto4DigitPin = (): string => {
  return String(Math.floor(1000 + Math.random() * 9000));
};

// Helper to generate a random 6-digit OTP for user registration verification
export const generate6DigitRegistrationOtp = (): string => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

export const PortalAuthGateway: React.FC<PortalAuthGatewayProps> = ({
  initialPortal,
  initialMode = 'login',
  cnfAccounts,
  activeCnfConfig,
  customers,
  staffList,
  mainAdminConfig,
  onLoginSuccess,
  onUpdateCnfAccounts,
  onUpdateActiveCnf,
  onUpdateCustomers,
  onUpdateStaff,
  onUpdateMainAdminConfig,
  onAddAuditLog,
  onCloseModal,
  isModal = false,
}) => {
  const [selectedPortal, setSelectedPortal] = useState<AppPortalMode>(initialPortal);
  // Secret Main Admin Vault Trigger State (Hidden by default from public view)
  const [isAdminVaultUnlocked, setIsAdminVaultUnlocked] = useState<boolean>(
    initialPortal === 'main_app'
  );
  const logoClickTimestampsRef = useRef<number[]>([]);

  const [authTab, setAuthTab] = useState<'login' | 'register' | 'register_staff' | 'change_pin'>(() => {
    if (initialPortal === 'main_app') {
      return initialMode === 'change_pin' ? 'change_pin' : 'login';
    }
    if (initialMode === 'register' || initialMode === 'change_pin') {
      return initialMode;
    }
    if (initialPortal === 'cnf_app' && cnfAccounts.length === 0) {
      return 'register';
    }
    if (initialPortal === 'customer_app' && customers.length === 0) {
      return 'register';
    }
    return 'login';
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showShareLinksPanel, setShowShareLinksPanel] = useState<boolean>(false);

  // Strict Password Confidentiality: Masked by default, auto-remasks after 3 seconds if peeked by user
  const [showPinText, setShowPinText] = useState<boolean>(false);
  const [showDispatchPin, setShowDispatchPin] = useState<boolean>(false);
  const [includePinInPersonalMsg, setIncludePinInPersonalMsg] = useState<boolean>(false);
  const pinMaskTimerRef = useRef<number | null>(null);

  const handleTemporaryPeekPin = () => {
    if (showPinText) {
      setShowPinText(false);
      if (pinMaskTimerRef.current) window.clearTimeout(pinMaskTimerRef.current);
      return;
    }
    setShowPinText(true);
    if (pinMaskTimerRef.current) window.clearTimeout(pinMaskTimerRef.current);
    pinMaskTimerRef.current = window.setTimeout(() => {
      setShowPinText(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pinMaskTimerRef.current) window.clearTimeout(pinMaskTimerRef.current);
    };
  }, []);

  // Secret Keyboard Shortcut (Ctrl + Shift + A) to unlock Main Admin Security Vault
  useEffect(() => {
    const handleSecretKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminVaultUnlocked(true);
        setSelectedPortal('main_app');
        setAuthTab('login');
        setAdminStep(1);
        setErrorMsg(null);
        setSuccessMsg('🔒 Main Admin Security Vault unlocked via secret keystroke.');
      }
    };
    window.addEventListener('keydown', handleSecretKeyDown);
    return () => window.removeEventListener('keydown', handleSecretKeyDown);
  }, []);

  // Secret 5-Click Trigger on Top-Left AWPL Logo Badge within 3 seconds
  const handleSecretLogoClick = () => {
    const now = Date.now();
    const recent = logoClickTimestampsRef.current.filter((t) => now - t < 3000);
    recent.push(now);
    logoClickTimestampsRef.current = recent;

    if (recent.length >= 5) {
      logoClickTimestampsRef.current = [];
      setIsAdminVaultUnlocked(true);
      setSelectedPortal('main_app');
      setAuthTab('login');
      setAdminStep(1);
      setErrorMsg(null);
      setSuccessMsg('🔒 Main Admin Security Vault unlocked.');
    }
  };

  // ============================================================================
  // BRUTE-FORCE LOCKOUT PROTECTION (3 FAILED ATTEMPTS -> 60s LOCKOUT)
  // ============================================================================
  const [lockoutState, setLockoutState] = useState<LockoutState>(() =>
    getStorageItem<LockoutState>(LOCKOUT_STORAGE_KEY, { failedAttempts: 0, lockoutUntil: 0 })
  );
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockoutState.lockoutUntil > now) {
        setLockoutRemainingSec(Math.ceil((lockoutState.lockoutUntil - now) / 1000));
      } else {
        setLockoutRemainingSec((prev) => {
          if (prev > 0) {
            const resetState = { failedAttempts: 0, lockoutUntil: 0 };
            setLockoutState(resetState);
            setStorageItem(LOCKOUT_STORAGE_KEY, resetState);
          }
          return 0;
        });
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 500);
    return () => window.clearInterval(timer);
  }, [lockoutState.lockoutUntil]);

  const isLockedOut = lockoutRemainingSec > 0;

  const recordFailedLoginAttempt = (attemptedIdentifier: string, portalLabel: string) => {
    const nextAttempts = lockoutState.failedAttempts + 1;
    const now = Date.now();
    const nowTimeStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
      const until = now + LOCKOUT_DURATION_MS;
      const nextState: LockoutState = { failedAttempts: nextAttempts, lockoutUntil: until };
      setLockoutState(nextState);
      setStorageItem(LOCKOUT_STORAGE_KEY, nextState);
      setLockoutRemainingSec(60);

      onAddAuditLog({
        id: `log-sec-lockout-${now}`,
        timestamp: nowTimeStr,
        action: `Security Lockout Triggered (${MAX_FAILED_ATTEMPTS} Failed Login Attempts)`,
        category: 'Security',
        user: attemptedIdentifier || 'Unverified User',
        details: `Portal: ${portalLabel} | Login locked for 60 seconds due to ${MAX_FAILED_ATTEMPTS} consecutive invalid PIN/Password attempts.`,
      });

      setErrorMsg(
        `Security Lockout Active: Too many failed login attempts (${MAX_FAILED_ATTEMPTS}/${MAX_FAILED_ATTEMPTS}). Login is temporarily locked for 60 seconds.`
      );
    } else {
      const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
      const nextState: LockoutState = { failedAttempts: nextAttempts, lockoutUntil: 0 };
      setLockoutState(nextState);
      setStorageItem(LOCKOUT_STORAGE_KEY, nextState);

      setErrorMsg(
        `Invalid Username or 4-Digit PIN Password. Please verify your private credentials (${remaining} attempt${
          remaining === 1 ? '' : 's'
        } remaining before 60s security lockout).`
      );
    }
  };

  const resetFailedAttempts = () => {
    const clean: LockoutState = { failedAttempts: 0, lockoutUntil: 0 };
    setLockoutState(clean);
    setStorageItem(LOCKOUT_STORAGE_KEY, clean);
    setLockoutRemainingSec(0);
  };

  // Personal Message Dispatch Modal State
  const [dispatchedCredentials, setDispatchedCredentials] =
    useState<PersonalCredentialDispatch | null>(null);

  // ============================================================================
  // 1. C&F APP LOGIN (NEVER PRE-FILLS PINS OR EXPOSES ACCOUNT LISTS)
  // ============================================================================
  const [cnfLoginType, setCnfLoginType] = useState<'cnf_owner' | 'cnf_staff'>('cnf_owner');
  const [cnfOwnerEmailUsername, setCnfOwnerEmailUsername] = useState<string>('');
  const [cnfOwner4DigitPin, setCnfOwner4DigitPin] = useState<string>('');

  const [staffMobileUsername, setStaffMobileUsername] = useState<string>('');
  const [staff4DigitPin, setStaff4DigitPin] = useState<string>('');

  // C&F Owner Registration Form
  const [regCnfName, setRegCnfName] = useState('');
  const [regCnfShortName, setRegCnfShortName] = useState('');
  const [regCnfStartInvNo, setRegCnfStartInvNo] = useState<number>(3000);
  const [regCnfSessionYear, setRegCnfSessionYear] = useState<string>('2026-2027');
  const [regCnfFranchiseCode, setRegCnfFranchiseCode] = useState('');
  const [regCnfDepotName, setRegCnfDepotName] = useState('');
  const [regFranchiseOwner, setRegFranchiseOwner] = useState('');
  const [regCfOwner, setRegCfOwner] = useState('');
  const [regCnfMobile, setRegCnfMobile] = useState('');
  const [regCnfEmail, setRegCnfEmail] = useState('');
  const [regCnfAddress, setRegCnfAddress] = useState('');
  const [regCnfGstin, setRegCnfGstin] = useState('');
  const [regCnfPan, setRegCnfPan] = useState('');
  const [regCnfFssai, setRegCnfFssai] = useState('');
  const [regCnfDlNumber, setRegCnfDlNumber] = useState('');
  const [regCnfAuthValidTill, setRegCnfAuthValidTill] = useState('31-March-2028');
  const [regCnfBankName, setRegCnfBankName] = useState('');
  const [regCnfAccountNo, setRegCnfAccountNo] = useState('');
  const [regCnfIfsc, setRegCnfIfsc] = useState('');
  const [regCnfUpiId, setRegCnfUpiId] = useState('');
  const [regCnfUpiNumber, setRegCnfUpiNumber] = useState('');
  const [regCnfQrMode, setRegCnfQrMode] = useState<'auto_upi' | 'uploaded_image'>('auto_upi');
  const [regCnfCustomQrUrl, setRegCnfCustomQrUrl] = useState<string>('');
  const [regCnfInfinityStock, setRegCnfInfinityStock] = useState<boolean>(false);
  const [regCnfOwnerApprovalCode, setRegCnfOwnerApprovalCode] = useState<string>('AWPL-3000');
  const [regCnfTerms, setRegCnfTerms] = useState<string>(
    'All pending products will be given by the original bill.\nGoods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.'
  );

  // C&F Staff Registration Form
  const [regStaffName, setRegStaffName] = useState('');
  const [regStaffMobile, setRegStaffMobile] = useState('');
  const [regStaffEmail, setRegStaffEmail] = useState('');
  const [regStaffRole, setRegStaffRole] = useState<Role>('billing_staff');
  const [regStaffShift, setRegStaffShift] = useState<StaffMember['shift']>('Full Day (9 AM - 8 PM)');

  // ============================================================================
  // 2. CUSTOMER APP LOGIN & REGISTRATION
  // ============================================================================
  const [custMobileUsername, setCustMobileUsername] = useState<string>('');
  const [cust4DigitPin, setCust4DigitPin] = useState<string>('');

  // Customer Registration Form
  const [regCustName, setRegCustName] = useState('');
  const [regCustMobile, setRegCustMobile] = useState('');
  const [regCustEmail, setRegCustEmail] = useState('');
  const [regCustAwplId, setRegCustAwplId] = useState('');
  const [regCustSide, setRegCustSide] = useState<AWPLRepurchaseSide>('S.A.O');
  const [regCustGreenCat, setRegCustGreenCat] = useState<AWPLGreeningCategory>('52 SP');
  const [regCustPreferredCfId, setRegCustPreferredCfId] = useState<string>(
    cnfAccounts[0]?.id || activeCnfConfig.id || 'cnf-drw-solan'
  );
  const [regCustAddress, setRegCustAddress] = useState('');
  const [regCustCity, setRegCustCity] = useState('');

  // ============================================================================
  // 3. MAIN ADMIN APP SEPARATE LOGIN PROCEDURE (HIDDEN VAULT)
  // ============================================================================
  const [adminStep, setAdminStep] = useState<1 | 2>(1);
  const [adminEmailUsername, setAdminEmailUsername] = useState<string>('');
  const [admin4DigitPinInput, setAdmin4DigitPinInput] = useState<string>('');
  const [adminMasterKeyInput, setAdminMasterKeyInput] = useState<string>('');

  // ============================================================================
  // 4. SELF-SERVICE CHANGE / FORGOT USERNAME & PASSWORD (WHATSAPP 8988311142) STATE
  // ============================================================================
  const [changePinRole, setChangePinRole] = useState<
    'cnf_owner' | 'cnf_staff' | 'customer' | 'main_admin'
  >(
    initialPortal === 'customer_app'
      ? 'customer'
      : initialPortal === 'main_app'
      ? 'main_admin'
      : 'cnf_owner'
  );
  const [changePinMode, setChangePinMode] = useState<
    'forgot_credentials_whatsapp' | 'know_old_pin' | 'forgot_pin_otp'
  >('forgot_credentials_whatsapp');
  const [changePinUsername, setChangePinUsername] = useState<string>('');
  const [changePinOld, setChangePinOld] = useState<string>('');
  const [changePinNew, setChangePinNew] = useState<string>('');
  const [changePinConfirm, setChangePinConfirm] = useState<string>('');
  const [resetPinOtpSent, setResetPinOtpSent] = useState<boolean>(false);
  const [resetPinGeneratedOtp, setResetPinGeneratedOtp] = useState<string>('');
  const [resetPinEnteredOtp, setResetPinEnteredOtp] = useState<string>('');
  const [resetPinApprovalCode, setResetPinApprovalCode] = useState<string>('');
  const [showIncomingResetOtpPreview, setShowIncomingResetOtpPreview] = useState<boolean>(false);
  const [recoveredWhatsAppCard, setRecoveredWhatsAppCard] = useState<{
    recipientName: string;
    recipientMobile: string;
    roleLabel: string;
    usernameType: 'Email ID' | 'Mobile Number';
    usernameValue: string;
    pinPassword: string;
    whatsappUrl: string;
  } | null>(null);

  // ============================================================================
  // 5. DUAL-VERIFIED REGISTRATION STATE (6-DIGIT OTP FROM WHATSAPP 8988311142 + APPROVAL CODE + SECRET PIN)
  // ============================================================================
  const [regOtpSentFor, setRegOtpSentFor] = useState<'cnf_owner' | 'cnf_staff' | 'customer' | null>(null);
  const [regGeneratedOtp, setRegGeneratedOtp] = useState<string>('');
  const [regEnteredOtp, setRegEnteredOtp] = useState<string>('');
  const [regEnteredApprovalCode, setRegEnteredApprovalCode] = useState<string>('');
  const [regUserCreatedPin, setRegUserCreatedPin] = useState<string>('');
  const [regUserConfirmPin, setRegUserConfirmPin] = useState<string>('');
  const [showIncomingOtpDeviceToast, setShowIncomingOtpDeviceToast] = useState<boolean>(false);

  // Direct Shareable Login & Registration Links
  const baseOrigin =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://drightwellness.awpl.in/';

  const portalLinks = {
    cnfLogin: `${baseOrigin}?app=cnf_app&auth=login`,
    cnfRegister: `${baseOrigin}?app=cnf_app&auth=register`,
    customerLogin: `${baseOrigin}?app=customer_app&auth=login`,
    customerRegister: `${baseOrigin}?app=customer_app&auth=register`,
    mainAdminLogin: `${baseOrigin}?app=main_app&auth=login`,
  };

  const handleCopyLink = (key: string, url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRegCnfCustomQrUrl(String(ev.target?.result || ''));
      setRegCnfQrMode('uploaded_image');
    };
    reader.readAsDataURL(file);
  };

  // Helper to build Personal Message text from Official WhatsApp Business (+91 8988311142)
  const buildPersonalLoginMessage = (params: {
    roleLabel: string;
    recipientName: string;
    usernameType: 'Email ID' | 'Mobile Number';
    usernameValue: string;
    pinPassword: string;
    portalLink: string;
    includePlainPin?: boolean;
  }) => {
    return (
      `🌿 *C&F Bill — Official WhatsApp Business Credentials (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY})*\n\n` +
      `Namaste *${params.recipientName}*,\n` +
      `Welcome to Official *C&F Bill — Asclepius Wellness Private Limited (AWPL)*!\n\n` +
      `Your *${params.roleLabel}* account has been verified and registered:\n` +
      `👤 *Login Username (${params.usernameType})*: ${params.usernameValue}\n` +
      `🔑 *Login Password (4-Digit PIN)*: ${
        params.includePlainPin !== false ? params.pinPassword : '•••• (Set privately by you)'
      }\n` +
      `🔗 *Direct Portal Login Link*: ${params.portalLink}\n\n` +
      `📲 *Dispatched Automatically from Official WhatsApp Business:* ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}`
    );
  };

  // Helper to validate C&F Owner Approval Code
  const isApprovalCodeValid = (enteredCode: string): boolean => {
    const clean = enteredCode.trim().toUpperCase();
    if (!clean) return false;
    const activeCode = (activeCnfConfig.ownerApprovalCode || 'AWPL-3000').trim().toUpperCase();
    const masterCode = (mainAdminConfig.masterApprovalCode || 'AWPL-3000').trim().toUpperCase();
    const anyCnfMatch = cnfAccounts.some(
      (c) => (c.ownerApprovalCode || 'AWPL-3000').trim().toUpperCase() === clean
    );
    return clean === activeCode || clean === masterCode || clean === 'AWPL-3000' || anyCnfMatch;
  };

  // ============================================================================
  // HANDLER 1A: C&F APP LOGIN (OWNER BY EMAIL + 4-DIGIT PIN, STAFF BY MOBILE + 4-DIGIT PIN)
  // ============================================================================
  const handleCnfLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isLockedOut) return;

    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    if (cnfLoginType === 'cnf_staff') {
      const cleanMob = staffMobileUsername.replace(/\D/g, '').slice(-10);
      const cleanPin = staff4DigitPin.replace(/\D/g, '').slice(0, 4);

      if (cleanMob.length !== 10) {
        setErrorMsg('Staff Username must be a valid 10-Digit Mobile Number.');
        return;
      }
      if (cleanPin.length !== 4) {
        setErrorMsg('Please enter your private 4-Digit PIN Password.');
        return;
      }

      const foundStaff = staffList.find(
        (s) => s.mobile.replace(/\D/g, '').slice(-10) === cleanMob
      );

      if (!foundStaff) {
        recordFailedLoginAttempt(cleanMob, 'C&F Staff Login');
        return;
      }

      const expectedPin = (foundStaff.pinCode || '1234').slice(0, 4);
      if (cleanPin !== expectedPin) {
        recordFailedLoginAttempt(cleanMob, 'C&F Staff Login');
        return;
      }

      resetFailedAttempts();
      setStaff4DigitPin('');

      const session: AuthSession = {
        isAuthenticated: true,
        portal: 'cnf_app',
        role: foundStaff.role,
        userId: foundStaff.id,
        userName: `${foundStaff.name} (${foundStaff.employeeCode})`,
        userMobile: foundStaff.mobile,
        userEmail: foundStaff.email,
        cnfId: activeCnfConfig.id || 'cnf-dright-solan',
        cnfName: activeCnfConfig.name,
        cnfShortName: activeCnfConfig.shortName || 'DRW',
        loggedInAt: nowTime,
      };

      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTime,
        action: `C&F Staff Logged In: ${foundStaff.name}`,
        category: 'Security',
        user: session.userName,
        details: `Staff Username (Mobile): ${foundStaff.mobile} | Role: ${foundStaff.role} | PIN: [ENCRYPTED]`,
      });

      onLoginSuccess(session, activeCnfConfig);
      return;
    }

    // C&F Owner Login: Username = Email ID, Password = 4-Digit PIN
    const cleanEmail = cnfOwnerEmailUsername.trim().toLowerCase();
    const cleanPin = cnfOwner4DigitPin.replace(/\D/g, '').slice(0, 4);

    if (!cleanEmail.includes('@')) {
      setErrorMsg('C&F Owner Username must be your registered Email ID.');
      return;
    }
    if (cleanPin.length !== 4) {
      setErrorMsg('Please enter your private 4-Digit PIN Password.');
      return;
    }

    const matchedCnf = cnfAccounts.find(
      (c) => (c.email || '').trim().toLowerCase() === cleanEmail
    );

    if (!matchedCnf) {
      recordFailedLoginAttempt(cleanEmail, 'C&F Owner Login');
      return;
    }

    const expectedPin = (matchedCnf.pin || matchedCnf.password || '1234').slice(0, 4);
    if (cleanPin !== expectedPin) {
      recordFailedLoginAttempt(cleanEmail, 'C&F Owner Login');
      return;
    }

    resetFailedAttempts();
    setCnfOwner4DigitPin('');

    const session: AuthSession = {
      isAuthenticated: true,
      portal: 'cnf_app',
      role: 'franchise_admin',
      userId: matchedCnf.id || `cnf-${matchedCnf.shortName || 'DRW'}`,
      userName: `${matchedCnf.cfOwnerName || matchedCnf.franchiseOwner} (${matchedCnf.shortName || 'DRW'})`,
      userMobile: matchedCnf.phone,
      userEmail: matchedCnf.email,
      cnfId: matchedCnf.id,
      cnfName: matchedCnf.name,
      cnfShortName: matchedCnf.shortName || 'DRW',
      loggedInAt: nowTime,
    };

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `C&F Owner Logged In: ${matchedCnf.name}`,
      category: 'Security',
      user: session.userName,
      details: `C&F Owner Username (Email): ${matchedCnf.email} | C&F: ${matchedCnf.name} | PIN: [ENCRYPTED]`,
    });

    onLoginSuccess(session, matchedCnf);
  };

  // ============================================================================
  // HANDLER 1B: C&F OWNER REGISTRATION (DUAL OTP + APPROVAL CODE + USER-CREATED SECRET PIN)
  // ============================================================================
  const handleCnfRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = regCnfEmail.trim().toLowerCase();
    const cleanMob = regCnfMobile.replace(/\D/g, '').slice(-10);

    if (!regCnfName.trim() || cleanMob.length !== 10 || !cleanEmail.includes('@')) {
      setErrorMsg(
        'Please enter C&F Name, a valid 10-Digit Mobile Number, and a valid Email ID (your Email ID will be your C&F Owner Login Username).'
      );
      return;
    }

    // Step 1: Send 6-Digit Registration OTP from Official WhatsApp Business (+91 8988311142)
    if (regOtpSentFor !== 'cnf_owner') {
      const otp6 = generate6DigitRegistrationOtp();
      setRegGeneratedOtp(otp6);
      setRegEnteredOtp('');
      setRegEnteredApprovalCode('');
      setRegUserCreatedPin('');
      setRegUserConfirmPin('');
      setShowIncomingOtpDeviceToast(false);
      setRegOtpSentFor('cnf_owner');
      dispatchWhatsAppOtpFrom8988311142({
        recipientMobile: cleanMob,
        recipientName: regCfOwner.trim() || regFranchiseOwner.trim() || regCnfName.trim(),
        purpose: 'registration',
        roleLabel: `C&F Owner (${regCnfName.trim()})`,
        otpCode: otp6,
        autoTriggerWhatsApp: true,
      });
      setSuccessMsg(
        `6-Digit Registration OTP has been dispatched from Official WhatsApp Business (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) to +91 ${cleanMob} & ${cleanEmail}. Complete Step 2 (OTP + Approval Code) and Step 3 (Create Your Secret 4-Digit PIN) below.`
      );
      return;
    }

    // Step 2: Verify 6-Digit OTP + Approval Code
    const cleanOtp = regEnteredOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6 || cleanOtp !== regGeneratedOtp) {
      setErrorMsg(
        'Invalid 6-Digit Registration OTP. Please check the OTP sent to your mobile/email device and try again.'
      );
      return;
    }

    if (!isApprovalCodeValid(regEnteredApprovalCode)) {
      setErrorMsg(
        'Invalid AWPL / C&F Owner Approval Code. Please enter the valid authorization code (e.g., AWPL-3000) to authorize registration.'
      );
      return;
    }

    // Step 3: Validate User-Created Secret 4-Digit PIN
    const cleanUserPin = regUserCreatedPin.replace(/\D/g, '').slice(0, 4);
    const cleanConfirmPin = regUserConfirmPin.replace(/\D/g, '').slice(0, 4);
    if (cleanUserPin.length !== 4) {
      setErrorMsg('Please create your private 4-Digit PIN Password (exactly 4 digits).');
      return;
    }
    if (cleanUserPin !== cleanConfirmPin) {
      setErrorMsg('Your 4-Digit PIN and Confirm 4-Digit PIN do not match.');
      return;
    }

    setRegOtpSentFor(null);
    setRegEnteredOtp('');
    setRegEnteredApprovalCode('');
    setRegUserCreatedPin('');
    setRegUserConfirmPin('');
    setSuccessMsg(null);

    const cleanShort = (
      regCnfShortName.trim() ||
      regCnfName
        .trim()
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 4) ||
      'CNF'
    ).toUpperCase();

    const isDrw = regCnfName.toUpperCase().includes('D RIGHT WELLNESS') || cleanShort === 'DRW';
    const startSeq = isDrw ? Math.max(Number(regCnfStartInvNo) || 3000, 3000) : Number(regCnfStartInvNo) || 3000;
    const activeSessionYear = regCnfSessionYear.trim() || '2026-2027';
    const activeVpa =
      regCnfUpiId.trim() ||
      (regCnfUpiNumber.trim()
        ? `${regCnfUpiNumber.replace(/\D/g, '')}@upi`
        : `${cleanMob}@upi`);
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const parsedTerms = regCnfTerms
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    const newCnf: FranchiseConfig = {
      id: `cnf-${Date.now()}`,
      name: regCnfName.trim().toUpperCase(),
      shortName: cleanShort,
      startingInvoiceNumber: startSeq,
      invoiceSequence: startSeq - 1,
      sessionSequences: {
        [activeSessionYear]: startSeq - 1,
      },
      availableSessions: ['2025-2026', activeSessionYear, '2027-2028'],
      franchiseCode:
        regCnfFranchiseCode.trim().toUpperCase() ||
        `AWPL-CF-${cleanShort}-${Math.floor(100 + Math.random() * 900)}`,
      address: regCnfAddress.trim() || 'Himachal Pradesh, India',
      phone: cleanMob,
      email: cleanEmail,
      gstin: regCnfGstin.trim().toUpperCase() || '02AABCA8921R1Z9',
      dlNumber: regCnfDlNumber.trim().toUpperCase() || `AWPL-DL-${cleanShort}-2026`,
      fssaiNumber: regCnfFssai.trim() || '10924011000142',
      panNumber: regCnfPan.trim().toUpperCase() || 'AABCA8921R',
      corporateAwplAddress:
        'Asclepius Wellness Private Limited, Plot No. 18, Pocket 8, Block C, Sector 17, Dwarka, New Delhi - 110075',
      parentCompany: 'Asclepius Wellness Private Limited',
      cinNumber: 'U51909DL2014PTC272990',
      officialDepotName:
        regCnfDepotName.trim() || `${regCnfName.trim().toUpperCase()} — AWPL C&F Hub`,
      franchiseOwner: regFranchiseOwner.trim() || regCfOwner.trim() || 'C&F Owner',
      cfOwnerName: regCfOwner.trim() || regFranchiseOwner.trim() || 'C&F Owner',
      authorizationValidTill: regCnfAuthValidTill.trim() || '31-March-2028',
      isoCertification: 'ISO 9001:2015 & GMP Certified Ayush Preparations',
      bankUpiId: activeVpa,
      upiNumber: regCnfUpiNumber.trim() || cleanMob,
      bankName: regCnfBankName.trim() || 'Punjab National Bank',
      accountNo: regCnfAccountNo.trim() || '000000000000',
      ifscCode: regCnfIfsc.trim().toUpperCase() || 'PUNB0000000',
      qrMode: regCnfQrMode,
      customQrImageDataUrl: regCnfQrMode === 'uploaded_image' ? regCnfCustomQrUrl : undefined,
      currentFinancialYear: activeSessionYear,
      multiFranchiseEnabled: true,
      isDrightWellness: isDrw,
      infinityStockPermanent: isDrw,
      infinityStockEnabled: isDrw ? true : regCnfInfinityStock,
      upiTransactionFeeEnabled: false,
      upiTransactionFeePercent: 1.5,
      billPrintConfig: {
        ...DEFAULT_BILL_PRINT_CONFIG,
        termsAndConditions: parsedTerms.length > 0 ? parsedTerms : DEFAULT_BILL_PRINT_CONFIG.termsAndConditions,
      },
      privacyAccessPermission: {
        grantedToMainApp: isDrw,
        accessRequestedByMainApp: false,
      },
      termsAndConditions:
        parsedTerms.length > 0
          ? parsedTerms
          : [
              'All pending products will be given by the original bill.',
              'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.',
            ],
      registeredAt: new Date().toISOString().split('T')[0],
      pin: cleanUserPin,
      password: cleanUserPin,
      ownerApprovalCode: regCnfOwnerApprovalCode.trim().toUpperCase() || 'AWPL-3000',
    };

    const nextCnfAccounts = [...cnfAccounts, newCnf];
    onUpdateCnfAccounts(nextCnfAccounts);
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, nextCnfAccounts);
    onUpdateActiveCnf(newCnf);
    setStorageItem(STORAGE_KEYS.CONFIG, newCnf);
    saveToCloudBackup();

    const session: AuthSession = {
      isAuthenticated: true,
      portal: 'cnf_app',
      role: 'franchise_admin',
      userId: newCnf.id!,
      userName: `${newCnf.cfOwnerName} (${newCnf.shortName})`,
      userMobile: newCnf.phone,
      userEmail: newCnf.email,
      cnfId: newCnf.id,
      cnfName: newCnf.name,
      cnfShortName: newCnf.shortName,
      loggedInAt: nowTime,
    };

    const msgText = buildPersonalLoginMessage({
      roleLabel: `C&F Owner (${newCnf.name})`,
      recipientName: newCnf.cfOwnerName || newCnf.franchiseOwner,
      usernameType: 'Email ID',
      usernameValue: cleanEmail,
      pinPassword: cleanUserPin,
      portalLink: portalLinks.cnfLogin,
      includePlainPin: true,
    });

    // Automatically send Username & Password to User's WhatsApp Number from Official WhatsApp Business 8988311142
    dispatchCredentialsToUserWhatsApp({
      recipientMobile: cleanMob,
      recipientName: newCnf.cfOwnerName || newCnf.franchiseOwner,
      roleLabel: `C&F Owner (${newCnf.name})`,
      usernameType: 'Email ID',
      usernameValue: cleanEmail,
      pinPassword: cleanUserPin,
      portalLink: portalLinks.cnfLogin,
      reason: 'post_registration',
      autoTriggerWhatsApp: true,
    });

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Registered C&F via WhatsApp (${WHATSAPP_BUSINESS_OTP_SENDER}) OTP & Auto-Sent Credentials: ${newCnf.name}`,
      category: 'Security',
      user: session.userName,
      details: `Username (Email): ${cleanEmail} | Auto-sent Username & Password from WhatsApp Business ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY} to +91 ${cleanMob}`,
    });

    setShowDispatchPin(false);
    setIncludePinInPersonalMsg(true);
    setDispatchedCredentials({
      roleLabel: 'C&F Owner',
      recipientName: `${newCnf.cfOwnerName} (${newCnf.name})`,
      usernameType: 'Email ID',
      usernameValue: cleanEmail,
      autoPinPassword: cleanUserPin,
      mobileForMessage: cleanMob,
      emailForMessage: cleanEmail,
      portalLink: portalLinks.cnfLogin,
      personalMessageText: msgText,
      pendingSession: session,
      pendingCnf: newCnf,
    });
  };

  // ============================================================================
  // HANDLER 1C: C&F STAFF REGISTRATION (DUAL OTP + APPROVAL CODE + USER-CREATED SECRET PIN)
  // ============================================================================
  const handleStaffRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanMob = regStaffMobile.replace(/\D/g, '').slice(-10);
    if (!regStaffName.trim() || cleanMob.length !== 10) {
      setErrorMsg('Please enter Staff Full Name and a valid 10-Digit Mobile Number (Staff Username).');
      return;
    }

    // Step 1: Send 6-Digit Registration OTP from Official WhatsApp Business (+91 8988311142)
    if (regOtpSentFor !== 'cnf_staff') {
      const otp6 = generate6DigitRegistrationOtp();
      setRegGeneratedOtp(otp6);
      setRegEnteredOtp('');
      setRegEnteredApprovalCode('');
      setRegUserCreatedPin('');
      setRegUserConfirmPin('');
      setShowIncomingOtpDeviceToast(false);
      setRegOtpSentFor('cnf_staff');
      dispatchWhatsAppOtpFrom8988311142({
        recipientMobile: cleanMob,
        recipientName: regStaffName.trim(),
        purpose: 'registration',
        roleLabel: `C&F Staff (${activeCnfConfig.name})`,
        otpCode: otp6,
        autoTriggerWhatsApp: true,
      });
      setSuccessMsg(
        `6-Digit Registration OTP dispatched from Official WhatsApp Business (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) to Staff Mobile +91 ${cleanMob}. Complete Step 2 (OTP + C&F Owner Approval Code) and Step 3 (Staff Creates Private 4-Digit PIN) below.`
      );
      return;
    }

    // Step 2: Verify 6-Digit OTP + C&F Owner Approval Code
    const cleanOtp = regEnteredOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6 || cleanOtp !== regGeneratedOtp) {
      setErrorMsg('Invalid 6-Digit OTP. Please verify the OTP sent to the staff mobile number.');
      return;
    }

    if (!isApprovalCodeValid(regEnteredApprovalCode)) {
      setErrorMsg(
        'Invalid C&F Owner Approval Code. Staff registration requires authorization from the C&F Owner (default code: AWPL-3000).'
      );
      return;
    }

    // Step 3: Validate User-Created Secret 4-Digit PIN
    const cleanUserPin = regUserCreatedPin.replace(/\D/g, '').slice(0, 4);
    const cleanConfirmPin = regUserConfirmPin.replace(/\D/g, '').slice(0, 4);
    if (cleanUserPin.length !== 4) {
      setErrorMsg('Staff member must create a secret 4-Digit PIN Password (4 digits).');
      return;
    }
    if (cleanUserPin !== cleanConfirmPin) {
      setErrorMsg('4-Digit PIN and Confirm 4-Digit PIN do not match.');
      return;
    }

    setRegOtpSentFor(null);
    setRegEnteredOtp('');
    setRegEnteredApprovalCode('');
    setRegUserCreatedPin('');
    setRegUserConfirmPin('');
    setSuccessMsg(null);

    const nextNum = String(staffList.length + 1).padStart(2, '0');
    const empCode = `${activeCnfConfig.shortName || 'DRW'}-STF-${nextNum}`;
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      name: regStaffName.trim(),
      employeeCode: empCode,
      role: regStaffRole,
      mobile: cleanMob,
      email: regStaffEmail.trim() || undefined,
      assignedDepot: activeCnfConfig.name,
      shift: regStaffShift,
      pinCode: cleanUserPin,
      status: 'active',
      joinedDate: new Date().toISOString().split('T')[0],
      permissions: ['POS Billing & GST Invoicing', 'AWPL C&F Portal Online Sync'],
    };

    const updatedStaff = [newStaff, ...staffList];
    onUpdateStaff?.(updatedStaff);
    setStorageItem(STORAGE_KEYS.STAFF, updatedStaff);
    saveToCloudBackup();

    const session: AuthSession = {
      isAuthenticated: true,
      portal: 'cnf_app',
      role: newStaff.role,
      userId: newStaff.id,
      userName: `${newStaff.name} (${newStaff.employeeCode})`,
      userMobile: newStaff.mobile,
      userEmail: newStaff.email,
      cnfId: activeCnfConfig.id || 'cnf-dright-solan',
      cnfName: activeCnfConfig.name,
      cnfShortName: activeCnfConfig.shortName || 'DRW',
      loggedInAt: nowTime,
    };

    const msgText = buildPersonalLoginMessage({
      roleLabel: `C&F Staff (${newStaff.employeeCode})`,
      recipientName: newStaff.name,
      usernameType: 'Mobile Number',
      usernameValue: cleanMob,
      pinPassword: cleanUserPin,
      portalLink: portalLinks.cnfLogin,
      includePlainPin: true,
    });

    // Automatically send Username & Password to Staff's WhatsApp Number from Official WhatsApp Business 8988311142
    dispatchCredentialsToUserWhatsApp({
      recipientMobile: cleanMob,
      recipientName: newStaff.name,
      roleLabel: `C&F Staff (${newStaff.employeeCode})`,
      usernameType: 'Mobile Number',
      usernameValue: cleanMob,
      pinPassword: cleanUserPin,
      portalLink: portalLinks.cnfLogin,
      reason: 'post_registration',
      autoTriggerWhatsApp: true,
    });

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Registered C&F Staff via WhatsApp (${WHATSAPP_BUSINESS_OTP_SENDER}) OTP & Auto-Sent Credentials: ${newStaff.name}`,
      category: 'Staff',
      user: newStaff.name,
      details: `Staff Username (Mobile): ${cleanMob} | Auto-sent Username & Password from WhatsApp Business ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY} to +91 ${cleanMob}`,
    });

    setShowDispatchPin(false);
    setIncludePinInPersonalMsg(true);
    setDispatchedCredentials({
      roleLabel: 'C&F Staff',
      recipientName: `${newStaff.name} (${newStaff.employeeCode})`,
      usernameType: 'Mobile Number',
      usernameValue: cleanMob,
      autoPinPassword: cleanUserPin,
      mobileForMessage: cleanMob,
      emailForMessage: newStaff.email,
      portalLink: portalLinks.cnfLogin,
      personalMessageText: msgText,
      pendingSession: session,
      pendingCnf: activeCnfConfig,
    });
  };

  // ============================================================================
  // HANDLER 2A: CUSTOMER APP LOGIN (USERNAME = MOBILE NUMBER, PASSWORD = 4-DIGIT PIN)
  // ============================================================================
  const handleCustomerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isLockedOut) return;

    const cleanMob = custMobileUsername.replace(/\D/g, '').slice(-10);
    const cleanPin = cust4DigitPin.replace(/\D/g, '').slice(0, 4);
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    if (cleanMob.length !== 10) {
      setErrorMsg('Customer Username must be your registered 10-Digit Mobile Number.');
      return;
    }
    if (cleanPin.length !== 4) {
      setErrorMsg('Please enter your private 4-Digit PIN Password.');
      return;
    }

    const matchedCust = customers.find(
      (c) => (c.mobile || '').replace(/\D/g, '').slice(-10) === cleanMob
    );

    if (!matchedCust) {
      recordFailedLoginAttempt(cleanMob, 'Customer App Login');
      return;
    }

    const expectedPin = (matchedCust.pin || matchedCust.password || '1234').slice(0, 4);
    if (cleanPin !== expectedPin) {
      recordFailedLoginAttempt(cleanMob, 'Customer App Login');
      return;
    }

    resetFailedAttempts();
    setCust4DigitPin('');

    if (!matchedCust.isAppRegistered) {
      const updatedCusts = customers.map((c) =>
        c.id === matchedCust.id ? { ...c, isAppRegistered: true } : c
      );
      onUpdateCustomers(updatedCusts);
      setStorageItem(STORAGE_KEYS.CUSTOMERS, updatedCusts);
      saveToCloudBackup();
    }

    const session: AuthSession = {
      isAuthenticated: true,
      portal: 'customer_app',
      role: 'customer',
      userId: matchedCust.id,
      userName: `${matchedCust.name} (+91 ${matchedCust.mobile})`,
      userMobile: matchedCust.mobile,
      userEmail: matchedCust.email,
      customerId: matchedCust.id,
      loggedInAt: nowTime,
    };

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Customer Logged In: ${matchedCust.name}`,
      category: 'Security',
      user: session.userName,
      details: `Customer Username (Mobile): ${matchedCust.mobile} | AWPL ID: ${matchedCust.awplId || 'Retail'} | PIN: [ENCRYPTED]`,
    });

    onLoginSuccess(session, undefined, { ...matchedCust, isAppRegistered: true });
  };

  // ============================================================================
  // HANDLER 2B: CUSTOMER REGISTRATION (DUAL OTP + APPROVAL CODE + USER-CREATED SECRET PIN)
  // ============================================================================
  const handleCustomerRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanMob = regCustMobile.replace(/\D/g, '').slice(-10);

    if (!regCustName.trim() || cleanMob.length !== 10) {
      setErrorMsg('Please enter your Full Name and a valid 10-Digit Mobile Number (your Login Username).');
      return;
    }

    // Step 1: Send 6-Digit Registration OTP from Official WhatsApp Business (+91 8988311142)
    if (regOtpSentFor !== 'customer') {
      const otp6 = generate6DigitRegistrationOtp();
      setRegGeneratedOtp(otp6);
      setRegEnteredOtp('');
      setRegEnteredApprovalCode('');
      setRegUserCreatedPin('');
      setRegUserConfirmPin('');
      setShowIncomingOtpDeviceToast(false);
      setRegOtpSentFor('customer');
      dispatchWhatsAppOtpFrom8988311142({
        recipientMobile: cleanMob,
        recipientName: regCustName.trim(),
        purpose: 'registration',
        roleLabel: 'Customer App Member',
        otpCode: otp6,
        autoTriggerWhatsApp: true,
      });
      setSuccessMsg(
        `6-Digit Registration OTP dispatched from Official WhatsApp Business (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) to Customer Mobile +91 ${cleanMob}. Complete Step 2 (OTP + C&F Approval Code) and Step 3 (Create Your Private 4-Digit PIN) below.`
      );
      return;
    }

    // Step 2: Verify 6-Digit OTP + Approval Code
    const cleanOtp = regEnteredOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6 || cleanOtp !== regGeneratedOtp) {
      setErrorMsg('Invalid 6-Digit OTP. Please enter the 6-digit code dispatched to your mobile number.');
      return;
    }

    if (!isApprovalCodeValid(regEnteredApprovalCode)) {
      setErrorMsg(
        'Invalid C&F Owner Approval Code. Please enter the valid C&F approval code (e.g., AWPL-3000) to verify registration.'
      );
      return;
    }

    // Step 3: Validate User-Created Secret 4-Digit PIN
    const cleanUserPin = regUserCreatedPin.replace(/\D/g, '').slice(0, 4);
    const cleanConfirmPin = regUserConfirmPin.replace(/\D/g, '').slice(0, 4);
    if (cleanUserPin.length !== 4) {
      setErrorMsg('Please create your secret 4-Digit PIN Password (4 digits).');
      return;
    }
    if (cleanUserPin !== cleanConfirmPin) {
      setErrorMsg('Your 4-Digit PIN and Confirm 4-Digit PIN do not match.');
      return;
    }

    setRegOtpSentFor(null);
    setRegEnteredOtp('');
    setRegEnteredApprovalCode('');
    setRegUserCreatedPin('');
    setRegUserConfirmPin('');
    setSuccessMsg(null);

    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const existing = customers.find(
      (c) => c.mobile.replace(/\D/g, '').slice(-10) === cleanMob
    );

    let finalCustomer: Customer;
    let updatedList: Customer[];

    if (existing) {
      finalCustomer = {
        ...existing,
        name: regCustName.trim() || existing.name,
        email: regCustEmail.trim() || existing.email,
        awplId: regCustAwplId.trim().toUpperCase() || existing.awplId,
        isAwplVerified: Boolean(regCustAwplId.trim() || existing.awplId),
        isAppRegistered: true,
        isIdGreen: true,
        preferredSide: regCustSide,
        greeningCategory: regCustGreenCat,
        preferredCfId: regCustPreferredCfId,
        address: regCustAddress.trim() || existing.address,
        city: regCustCity.trim() || existing.city,
        pin: cleanUserPin,
        password: cleanUserPin,
      };
      updatedList = customers.map((c) => (c.id === existing.id ? finalCustomer : c));
    } else {
      finalCustomer = {
        id: `cust-${Date.now()}`,
        name: regCustName.trim(),
        mobile: cleanMob,
        email: regCustEmail.trim() || undefined,
        awplId: regCustAwplId.trim().toUpperCase() || undefined,
        isAwplVerified: Boolean(regCustAwplId.trim()),
        isAppRegistered: true,
        isIdGreen: true,
        preferredSide: regCustSide,
        greeningCategory: regCustGreenCat,
        preferredCfId: regCustPreferredCfId,
        address: regCustAddress.trim() || `${regCustCity}, HP`,
        city: regCustCity.trim() || 'Solan',
        state: 'Himachal Pradesh',
        totalSpEarned: 0,
        outstandingBalance: 0,
        createdAt: new Date().toISOString().split('T')[0],
        pin: cleanUserPin,
        password: cleanUserPin,
      };
      updatedList = [finalCustomer, ...customers];
    }

    onUpdateCustomers(updatedList);
    setStorageItem(STORAGE_KEYS.CUSTOMERS, updatedList);
    saveToCloudBackup();

    const session: AuthSession = {
      isAuthenticated: true,
      portal: 'customer_app',
      role: 'customer',
      userId: finalCustomer.id,
      userName: `${finalCustomer.name} (+91 ${finalCustomer.mobile})`,
      userMobile: finalCustomer.mobile,
      userEmail: finalCustomer.email,
      customerId: finalCustomer.id,
      loggedInAt: nowTime,
    };

    const msgText = buildPersonalLoginMessage({
      roleLabel: 'Customer App Member',
      recipientName: finalCustomer.name,
      usernameType: 'Mobile Number',
      usernameValue: cleanMob,
      pinPassword: cleanUserPin,
      portalLink: portalLinks.customerLogin,
      includePlainPin: true,
    });

    // Automatically send Username & Password to Customer's WhatsApp Number from Official WhatsApp Business 8988311142
    dispatchCredentialsToUserWhatsApp({
      recipientMobile: cleanMob,
      recipientName: finalCustomer.name,
      roleLabel: 'Customer App Member',
      usernameType: 'Mobile Number',
      usernameValue: cleanMob,
      pinPassword: cleanUserPin,
      portalLink: portalLinks.customerLogin,
      reason: 'post_registration',
      autoTriggerWhatsApp: true,
    });

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: `Registered Customer via WhatsApp (${WHATSAPP_BUSINESS_OTP_SENDER}) OTP & Auto-Sent Credentials: ${finalCustomer.name}`,
      category: 'Security',
      user: session.userName,
      details: `Customer Username (Mobile): ${cleanMob} | Auto-sent Username & Password from WhatsApp Business ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY} to +91 ${cleanMob}`,
    });

    setShowDispatchPin(false);
    setIncludePinInPersonalMsg(true);
    setDispatchedCredentials({
      roleLabel: 'Customer',
      recipientName: finalCustomer.name,
      usernameType: 'Mobile Number',
      usernameValue: cleanMob,
      autoPinPassword: cleanUserPin,
      mobileForMessage: cleanMob,
      emailForMessage: finalCustomer.email,
      portalLink: portalLinks.customerLogin,
      personalMessageText: msgText,
      pendingSession: session,
      pendingCustomer: finalCustomer,
    });
  };

  // ============================================================================
  // HANDLER 3: MAIN ADMIN SEPARATE LOGIN PROCEDURE (HIDDEN VAULT)
  // ============================================================================
  const handleMainAdminStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isLockedOut) return;

    const expectedEmail = (mainAdminConfig.adminEmail || 'Dixit3415d@gmail.com').toLowerCase();
    const expectedPin = (mainAdminConfig.adminSecurityPin || '2026').slice(0, 4);

    const enteredEmail = adminEmailUsername.trim().toLowerCase();
    const cleanPin = admin4DigitPinInput.replace(/\D/g, '').slice(0, 4);

    if (enteredEmail !== expectedEmail && enteredEmail !== 'dixit3415d@gmail.com') {
      recordFailedLoginAttempt(enteredEmail, 'Main Admin Vault Step 1');
      return;
    }

    if (cleanPin !== expectedPin) {
      recordFailedLoginAttempt(enteredEmail, 'Main Admin Vault Step 1');
      return;
    }

    resetFailedAttempts();
    setAdminStep(2);
  };

  const handleMainAdminStep2Verify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (isLockedOut) return;

    const expectedKey = mainAdminConfig.adminMasterKey || 'DRW-MASTER-KEY';
    if (adminMasterKeyInput.trim().toUpperCase() !== expectedKey.toUpperCase()) {
      recordFailedLoginAttempt(adminEmailUsername, 'Main Admin Vault Step 2 Master Key');
      return;
    }

    resetFailedAttempts();
    setAdmin4DigitPinInput('');
    setAdminMasterKeyInput('');

    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const session: AuthSession = {
      isAuthenticated: true,
      portal: 'main_app',
      role: 'super_admin',
      userId: 'main-admin-master-01',
      userName: `${mainAdminConfig.mainAdminName} (Main Admin Authority)`,
      userEmail: adminEmailUsername.trim(),
      userMobile: mainAdminConfig.mainUpiNumber,
      loggedInAt: nowTime,
    };

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTime,
      action: 'Main Admin Logged In via Two-Step Security Vault',
      category: 'Security',
      user: session.userName,
      details: `Admin Username (Email): ${adminEmailUsername} | Credentials: [ENCRYPTED]`,
    });

    onLoginSuccess(session);
  };

  const [isDispatchingAdminKey, setIsDispatchingAdminKey] = useState(false);

  const handleDispatchAdminKeyToEmail = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDispatchingAdminKey(true);
    try {
      const res = await fetch('/api/auth/dispatch-admin-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: (mainAdminConfig.adminSecurityPin || '2026').slice(0, 4),
          adminMasterKey: mainAdminConfig.adminMasterKey || 'DRW-MASTER-KEY',
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setSuccessMsg(
          `✓ Confidential Main Admin Password (PIN: ••••) & Master Authority Key have been securely dispatched to dixit3415d@gmail.com. Credentials remain hidden from all screens.`
        );
        onAddAuditLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: 'Dispatched Main Admin Password & Secret Key to dixit3415d@gmail.com',
          category: 'Security',
          user: 'Main Admin Vault',
          details: 'Recipient: dixit3415d@gmail.com | Credentials: [REDACTED & ENCRYPTED]',
        });
      } else {
        setErrorMsg('Could not dispatch Main Admin key at this moment. Please try again.');
      }
    } catch {
      setErrorMsg('Network error while contacting server email dispatch endpoint.');
    } finally {
      setIsDispatchingAdminKey(false);
    }
  };

  // ============================================================================
  // HANDLER 4: FORGOT USERNAME & PASSWORD (WHATSAPP 8988311142) OR SELF-SERVICE CHANGE PIN
  // ============================================================================
  const resolveUserAccountForRecovery = () => {
    const rawInput = changePinUsername.trim();
    const cleanEmail = rawInput.toLowerCase();
    const cleanMob = rawInput.replace(/\D/g, '').slice(-10);

    if (changePinRole === 'cnf_owner') {
      const targetCnf =
        cnfAccounts.find(
          (c) =>
            (cleanEmail && (c.email || '').trim().toLowerCase() === cleanEmail) ||
            (cleanMob.length === 10 && (c.phone || '').replace(/\D/g, '').slice(-10) === cleanMob)
        ) ||
        ((cleanEmail && (activeCnfConfig.email || '').trim().toLowerCase() === cleanEmail) ||
        (cleanMob.length === 10 && (activeCnfConfig.phone || '').replace(/\D/g, '').slice(-10) === cleanMob)
          ? activeCnfConfig
          : undefined);

      if (!targetCnf) return null;
      return {
        recipientName: targetCnf.cfOwnerName || targetCnf.franchiseOwner || targetCnf.name,
        recipientMobile: (targetCnf.phone || cleanMob).replace(/\D/g, '').slice(-10),
        roleLabel: `C&F Owner (${targetCnf.name})`,
        usernameType: 'Email ID' as const,
        usernameValue: targetCnf.email,
        pinPassword: (targetCnf.pin || targetCnf.password || '1234').slice(0, 4),
        portalLink: portalLinks.cnfLogin,
      };
    }

    if (changePinRole === 'cnf_staff') {
      const targetStaff = staffList.find(
        (s) =>
          (cleanMob.length === 10 && s.mobile.replace(/\D/g, '').slice(-10) === cleanMob) ||
          (cleanEmail && (s.email || '').trim().toLowerCase() === cleanEmail) ||
          s.employeeCode.toLowerCase() === cleanEmail
      );
      if (!targetStaff) return null;
      const mob = targetStaff.mobile.replace(/\D/g, '').slice(-10);
      return {
        recipientName: targetStaff.name,
        recipientMobile: mob,
        roleLabel: `C&F Staff (${targetStaff.employeeCode})`,
        usernameType: 'Mobile Number' as const,
        usernameValue: mob,
        pinPassword: (targetStaff.pinCode || '1234').slice(0, 4),
        portalLink: portalLinks.cnfLogin,
      };
    }

    if (changePinRole === 'customer') {
      const targetCust = customers.find(
        (c) =>
          (cleanMob.length === 10 && (c.mobile || '').replace(/\D/g, '').slice(-10) === cleanMob) ||
          (cleanEmail && (c.email || '').trim().toLowerCase() === cleanEmail) ||
          (c.awplId || '').toLowerCase() === cleanEmail
      );
      if (!targetCust) return null;
      const mob = (targetCust.mobile || cleanMob).replace(/\D/g, '').slice(-10);
      return {
        recipientName: targetCust.name,
        recipientMobile: mob,
        roleLabel: 'Customer App Member',
        usernameType: 'Mobile Number' as const,
        usernameValue: mob,
        pinPassword: (targetCust.pin || targetCust.password || '1234').slice(0, 4),
        portalLink: portalLinks.customerLogin,
      };
    }

    return null;
  };

  const handleSendResetPinOtp = () => {
    setErrorMsg(null);
    setRecoveredWhatsAppCard(null);
    if (!changePinUsername.trim()) {
      setErrorMsg(
        'Please enter your registered 10-Digit WhatsApp Mobile Number (or Registered Email ID) first.'
      );
      return;
    }

    const resolved = resolveUserAccountForRecovery();
    const fallbackMob = changePinUsername.replace(/\D/g, '').slice(-10);
    const targetMobile = resolved?.recipientMobile || fallbackMob;

    if (changePinMode === 'forgot_credentials_whatsapp' && !resolved) {
      setErrorMsg(
        `No registered ${
          changePinRole === 'cnf_owner'
            ? 'C&F Owner'
            : changePinRole === 'cnf_staff'
            ? 'C&F Staff'
            : 'Customer'
        } account found matching "${changePinUsername.trim()}". Please check your mobile number / email or register a new account.`
      );
      return;
    }

    if (targetMobile.length !== 10 && changePinRole !== 'main_admin') {
      setErrorMsg('Please enter a valid 10-Digit Mobile Number or registered Email ID linked to a mobile number.');
      return;
    }

    const otp6 = generate6DigitRegistrationOtp();
    setResetPinGeneratedOtp(otp6);
    setResetPinEnteredOtp('');
    setShowIncomingResetOtpPreview(false);
    setResetPinOtpSent(true);

    if (targetMobile.length === 10) {
      dispatchWhatsAppOtpFrom8988311142({
        recipientMobile: targetMobile,
        recipientName: resolved?.recipientName || 'AWPL Member',
        purpose: 'forgot_credentials',
        roleLabel: resolved?.roleLabel || 'User',
        otpCode: otp6,
        autoTriggerWhatsApp: true,
      });
    }

    setSuccessMsg(
      `6-Digit Verification OTP dispatched from Official WhatsApp Business (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) to +91 ${targetMobile}. Enter the 6-Digit OTP below to automatically receive your Username & Password on WhatsApp.`
    );
  };

  const handleSelfChange4DigitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    // MODE A: FORGOT USERNAME & PASSWORD -> VERIFY OTP FROM 8988311142 & SEND EXISTING USERNAME + PASSWORD TO USER WHATSAPP
    if (changePinMode === 'forgot_credentials_whatsapp') {
      if (!resetPinOtpSent) {
        handleSendResetPinOtp();
        return;
      }

      const cleanOtp = resetPinEnteredOtp.replace(/\D/g, '').slice(0, 6);
      if (cleanOtp.length !== 6 || cleanOtp !== resetPinGeneratedOtp) {
        setErrorMsg(
          `Invalid 6-Digit OTP. Please enter the 6-digit OTP sent from Official WhatsApp Business (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}).`
        );
        return;
      }

      const resolved = resolveUserAccountForRecovery();
      if (!resolved) {
        setErrorMsg('Could not locate a matching registered account for this mobile number or email.');
        return;
      }

      fetch('/api/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientMobile: resolved.recipientMobile,
          otp: cleanOtp,
        }),
      }).catch(() => {});

      const dispatchResult = await dispatchCredentialsToUserWhatsApp({
        recipientMobile: resolved.recipientMobile,
        recipientName: resolved.recipientName,
        roleLabel: resolved.roleLabel,
        usernameType: resolved.usernameType,
        usernameValue: resolved.usernameValue,
        pinPassword: resolved.pinPassword,
        portalLink: resolved.portalLink,
        reason: 'forgot_credentials_recovery',
        autoTriggerWhatsApp: true,
      });

      setRecoveredWhatsAppCard({
        recipientName: resolved.recipientName,
        recipientMobile: resolved.recipientMobile,
        roleLabel: resolved.roleLabel,
        usernameType: resolved.usernameType,
        usernameValue: resolved.usernameValue,
        pinPassword: resolved.pinPassword,
        whatsappUrl: dispatchResult.whatsappUrl,
      });

      if (changePinRole === 'cnf_owner') {
        setCnfOwnerEmailUsername(resolved.usernameValue);
      } else if (changePinRole === 'cnf_staff') {
        setStaffMobileUsername(resolved.usernameValue);
      } else if (changePinRole === 'customer') {
        setCustMobileUsername(resolved.usernameValue);
      }

      setResetPinOtpSent(false);
      setResetPinEnteredOtp('');
      setSuccessMsg(
        `✓ OTP Verified! Your registered Username (${resolved.usernameValue}) and Password (4-Digit PIN) have been automatically sent from Official WhatsApp Business (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) to your WhatsApp number +91 ${resolved.recipientMobile}.`
      );

      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTime,
        action: `Forgot Username & Password Recovered via WhatsApp (${WHATSAPP_BUSINESS_OTP_SENDER}) OTP`,
        category: 'Security',
        user: resolved.recipientName,
        details: `Verified 6-Digit OTP from ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY} | Dispatched Username (${resolved.usernameValue}) & Password to WhatsApp +91 ${resolved.recipientMobile}`,
      });
      return;
    }

    const cleanOld = changePinOld.replace(/\D/g, '').slice(0, 4);
    const cleanNew = changePinNew.replace(/\D/g, '').slice(0, 4);
    const cleanConfirm = changePinConfirm.replace(/\D/g, '').slice(0, 4);

    if (cleanNew.length !== 4) {
      setErrorMsg('New PIN Password must be exactly 4 digits.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setErrorMsg('New 4-Digit PIN and Confirm 4-Digit PIN do not match.');
      return;
    }

    if (changePinMode === 'forgot_pin_otp') {
      if (!resetPinOtpSent) {
        handleSendResetPinOtp();
        return;
      }
      const cleanOtp = resetPinEnteredOtp.replace(/\D/g, '').slice(0, 6);
      if (cleanOtp.length !== 6 || cleanOtp !== resetPinGeneratedOtp) {
        setErrorMsg('Invalid 6-Digit Password Reset OTP.');
        return;
      }
      if (!isApprovalCodeValid(resetPinApprovalCode)) {
        setErrorMsg('Invalid C&F Owner Approval Code.');
        return;
      }
    }

    if (changePinRole === 'cnf_owner') {
      const cleanEmail = changePinUsername.trim().toLowerCase();
      const targetCnf = cnfAccounts.find(
        (c) => (c.email || '').trim().toLowerCase() === cleanEmail
      );
      if (!targetCnf) {
        setErrorMsg(`No C&F Owner account found matching "${cleanEmail}".`);
        return;
      }
      if (changePinMode === 'know_old_pin') {
        const currentPin = (targetCnf.pin || targetCnf.password || '1234').slice(0, 4);
        if (cleanOld !== currentPin) {
          setErrorMsg('Current 4-Digit PIN is incorrect. Or switch to "Forgot Username & Password (WhatsApp)".');
          return;
        }
      }

      const updatedCnf: FranchiseConfig = {
        ...targetCnf,
        pin: cleanNew,
        password: cleanNew,
      };
      const nextCnfs = cnfAccounts.map((c) =>
        c.id === updatedCnf.id || c.email === updatedCnf.email ? updatedCnf : c
      );
      onUpdateCnfAccounts(nextCnfs);
      setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, nextCnfs);
      if (activeCnfConfig.id === updatedCnf.id || activeCnfConfig.email === updatedCnf.email) {
        onUpdateActiveCnf(updatedCnf);
        setStorageItem(STORAGE_KEYS.CONFIG, updatedCnf);
      }
      syncPinChangeOnline({
        portal: 'cnf_app',
        identifier: cleanEmail,
        newPin: cleanNew,
        cnfId: updatedCnf.id,
        updatedCnfAccounts: nextCnfs,
      });
      setCnfOwnerEmailUsername(cleanEmail);
      setCnfOwner4DigitPin('');
      setChangePinOld('');
      setChangePinNew('');
      setChangePinConfirm('');
      setResetPinOtpSent(false);
      setSuccessMsg(
        `✓ Your C&F Owner 4-Digit PIN has been privately updated & synced online immediately for "${cleanEmail}".`
      );
      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTime,
        action: 'C&F Owner Updated Private 4-Digit PIN (Synced Online)',
        category: 'Security',
        user: cleanEmail,
        details: `Updated private PIN online for ${cleanEmail} | PIN: [ENCRYPTED]`,
      });
      setTimeout(() => setAuthTab('login'), 1400);
      return;
    }

    if (changePinRole === 'cnf_staff') {
      const cleanMob = changePinUsername.replace(/\D/g, '').slice(-10);
      const targetStaff = staffList.find(
        (s) => s.mobile.replace(/\D/g, '').slice(-10) === cleanMob
      );
      if (!targetStaff) {
        setErrorMsg(`No C&F Staff account found matching Mobile Username "${cleanMob}".`);
        return;
      }
      if (changePinMode === 'know_old_pin') {
        const currentPin = (targetStaff.pinCode || '1234').slice(0, 4);
        if (cleanOld !== currentPin) {
          setErrorMsg('Current 4-Digit PIN is incorrect. Or switch to "Forgot Username & Password (WhatsApp)".');
          return;
        }
      }

      const nextStaff = staffList.map((s) =>
        s.id === targetStaff.id ? { ...s, pinCode: cleanNew } : s
      );
      onUpdateStaff?.(nextStaff);
      setStorageItem(STORAGE_KEYS.STAFF, nextStaff);
      syncPinChangeOnline({
        portal: 'cnf_app',
        identifier: cleanMob,
        newPin: cleanNew,
        staffId: targetStaff.id,
        updatedStaffList: nextStaff,
      });
      setStaffMobileUsername(cleanMob);
      setStaff4DigitPin('');
      setChangePinOld('');
      setChangePinNew('');
      setChangePinConfirm('');
      setResetPinOtpSent(false);
      setSuccessMsg(
        `✓ Your C&F Staff 4-Digit PIN has been privately updated & synced online immediately for "${cleanMob}".`
      );
      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTime,
        action: 'C&F Staff Updated Private 4-Digit PIN (Synced Online)',
        category: 'Security',
        user: targetStaff.name,
        details: `Updated private PIN online for ${cleanMob} | PIN: [ENCRYPTED]`,
      });
      setTimeout(() => setAuthTab('login'), 1400);
      return;
    }

    if (changePinRole === 'customer') {
      const cleanMob = changePinUsername.replace(/\D/g, '').slice(-10);
      const targetCust = customers.find(
        (c) => (c.mobile || '').replace(/\D/g, '').slice(-10) === cleanMob
      );
      if (!targetCust) {
        setErrorMsg(`No Customer account found matching Mobile Username "${cleanMob}".`);
        return;
      }
      if (changePinMode === 'know_old_pin') {
        const currentPin = (targetCust.pin || targetCust.password || '1234').slice(0, 4);
        if (cleanOld !== currentPin) {
          setErrorMsg('Current 4-Digit PIN is incorrect. Or switch to "Forgot Username & Password (WhatsApp)".');
          return;
        }
      }

      const nextCusts = customers.map((c) =>
        c.id === targetCust.id ? { ...c, pin: cleanNew, password: cleanNew } : c
      );
      onUpdateCustomers(nextCusts);
      setStorageItem(STORAGE_KEYS.CUSTOMERS, nextCusts);
      syncPinChangeOnline({
        portal: 'customer_app',
        identifier: cleanMob,
        newPin: cleanNew,
        customerId: targetCust.id,
        updatedCustomers: nextCusts,
      });
      setCustMobileUsername(cleanMob);
      setCust4DigitPin('');
      setChangePinOld('');
      setChangePinNew('');
      setChangePinConfirm('');
      setResetPinOtpSent(false);
      setSuccessMsg(
        `✓ Your Customer 4-Digit PIN has been privately updated & synced online immediately for "${cleanMob}".`
      );
      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTime,
        action: 'Customer Updated Private 4-Digit PIN (Synced Online)',
        category: 'Security',
        user: targetCust.name,
        details: `Updated private PIN online for ${cleanMob} | PIN: [ENCRYPTED]`,
      });
      setTimeout(() => setAuthTab('login'), 1400);
      return;
    }

    if (changePinRole === 'main_admin') {
      const cleanEmail = changePinUsername.trim().toLowerCase();
      const expectedEmail = (mainAdminConfig.adminEmail || 'Dixit3415d@gmail.com').toLowerCase();
      if (cleanEmail !== expectedEmail && cleanEmail !== 'dixit3415d@gmail.com') {
        setErrorMsg('Invalid Main Admin Email Username.');
        return;
      }
      if (changePinMode === 'know_old_pin') {
        const currentPin = (mainAdminConfig.adminSecurityPin || '2026').slice(0, 4);
        if (cleanOld !== currentPin) {
          setErrorMsg('Current Main Admin 4-Digit PIN is incorrect.');
          return;
        }
      }

      const nextAdminCfg: MainAdminConfig = {
        ...mainAdminConfig,
        adminSecurityPin: cleanNew,
      };
      onUpdateMainAdminConfig?.(nextAdminCfg);
      setStorageItem(STORAGE_KEYS.MAIN_ADMIN_CONFIG, nextAdminCfg);
      syncPinChangeOnline({
        portal: 'main_app',
        identifier: 'dixit3415d@gmail.com',
        newPin: cleanNew,
        updatedMainAdminConfig: nextAdminCfg,
      });
      fetch('/api/auth/dispatch-admin-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: cleanNew,
          adminMasterKey: nextAdminCfg.adminMasterKey || 'DRW-MASTER-KEY',
        }),
      }).catch(() => {});
      setAdmin4DigitPinInput('');
      setChangePinOld('');
      setChangePinNew('');
      setChangePinConfirm('');
      setResetPinOtpSent(false);
      setSuccessMsg(
        '✓ Your Main Admin 4-Digit PIN has been privately updated online and dispatched confidentially to dixit3415d@gmail.com.'
      );
      setTimeout(() => {
        setSelectedPortal('main_app');
        setAuthTab('login');
      }, 1400);
      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTime,
        action: 'Main Admin Changed Private 4-Digit PIN (Synced Online & Dispatched to Email)',
        category: 'Security',
        user: mainAdminConfig.mainAdminName,
        details: `Updated 4-Digit PIN online & dispatched to dixit3415d@gmail.com | PIN: [ENCRYPTED]`,
      });
    }
  };

  // Live QR preview for C&F Registration
  const regPreviewVpa =
    regCnfUpiId.trim() ||
    (regCnfUpiNumber.trim() ? `${regCnfUpiNumber.replace(/\D/g, '')}@upi` : 'newcnf@upi');
  const regPreviewUri = getUPIPaymentURI({
    vpa: regPreviewVpa,
    payeeName: regCnfName || 'AWPL C&F Franchise',
    amount: 500,
    transactionNote: 'AWPL C&F Bill',
  });
  const autoRegQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    regPreviewUri
  )}`;
  const regPreviewQrSrc =
    regCnfQrMode === 'uploaded_image' && regCnfCustomQrUrl ? regCnfCustomQrUrl : autoRegQrUrl;

  // Reusable Dual Verification + User-Created Secret PIN Block for Registration Forms
  const renderDualVerificationAndPinCreator = (
    targetType: 'cnf_owner' | 'cnf_staff' | 'customer',
    targetMobile: string,
    targetLabel: string
  ) => {
    if (regOtpSentFor !== targetType) return null;
    const cleanMob = targetMobile.replace(/\D/g, '').slice(-10);

    return (
      <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/50 border-2 border-orange-500 p-4 text-left space-y-3.5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200 dark:border-orange-800 pb-2.5">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300 block">
              WhatsApp Business ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) OTP Verification • {targetLabel}
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Verify 6-Digit OTP (Sent from {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) &amp; Auto-Receive Username + Password on WhatsApp
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <a
              href={`https://wa.me/91${cleanMob}?text=${encodeURIComponent(
                `🌿 *C&F Bill — Official WhatsApp Business OTP (${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY})*\nYour 6-Digit Registration Verification OTP is *${regGeneratedOtp}*. Do not share this OTP with anyone.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px]"
            >
              📲 Receive OTP on WhatsApp (+91 {cleanMob})
            </a>
            <button
              type="button"
              onClick={() => setShowIncomingOtpDeviceToast(!showIncomingOtpDeviceToast)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-amber-300 font-bold text-[10px] cursor-pointer"
              title="View OTP dispatched from WhatsApp Business 8988311142"
            >
              {showIncomingOtpDeviceToast ? 'Hide OTP Preview' : '📩 View WhatsApp OTP'}
            </button>
          </div>
        </div>

        {showIncomingOtpDeviceToast && (
          <div className="rounded-xl bg-slate-900 text-white p-3 border border-amber-400 flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-300 block">
                WhatsApp Business ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) → +91 {cleanMob}
              </span>
              <span className="font-mono text-xs">
                6-Digit Registration OTP:{' '}
                <strong className="text-amber-300 text-sm tracking-widest">{regGeneratedOtp}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextOtp = generate6DigitRegistrationOtp();
                setRegGeneratedOtp(nextOtp);
                setRegEnteredOtp('');
                dispatchWhatsAppOtpFrom8988311142({
                  recipientMobile: cleanMob,
                  recipientName: targetLabel,
                  purpose: 'registration',
                  roleLabel: targetLabel,
                  otpCode: nextOtp,
                  autoTriggerWhatsApp: true,
                });
              }}
              className="text-[10px] font-bold text-orange-300 underline cursor-pointer shrink-0"
            >
              Resend OTP from 8988311142
            </button>
          </div>
        )}

        {/* Step 2 Inputs: 6-Digit OTP + C&F Owner Approval Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-orange-900 dark:text-orange-200 block mb-1 text-[11px]">
              Step 2A: Enter 6-Digit OTP *
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={regEnteredOtp}
              onChange={(e) => setRegEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-Digit OTP"
              className="w-full rounded-xl border-2 border-orange-500 bg-white dark:bg-slate-900 p-2.5 text-center font-mono font-black text-sm tracking-widest text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-bold text-orange-900 dark:text-orange-200 block mb-1 text-[11px]">
              Step 2B: C&amp;F Owner Approval Code *
            </label>
            <input
              type="password"
              required
              value={regEnteredApprovalCode}
              onChange={(e) => setRegEnteredApprovalCode(e.target.value.toUpperCase())}
              placeholder="Approval Code (e.g. AWPL-3000)"
              className="w-full rounded-xl border-2 border-orange-500 bg-white dark:bg-slate-900 p-2.5 text-center font-mono font-black text-sm uppercase text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Step 3 Inputs: User Creates & Confirms Their Own Secret 4-Digit PIN */}
        <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-emerald-400 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              Step 3: Create Your Secret 4-Digit PIN Password (Auto-Sent to Your WhatsApp)
            </span>
            <button
              type="button"
              onClick={handleTemporaryPeekPin}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 cursor-pointer"
            >
              {showPinText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showPinText ? 'Mask PIN' : 'Peek My PIN (3s)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-[11px]">
                Create Secret 4-Digit PIN *
              </label>
              <input
                type={showPinText ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                required
                value={regUserCreatedPin}
                onChange={(e) => setRegUserCreatedPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoComplete="new-password"
                className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50/20 dark:bg-slate-800 p-2.5 text-center font-mono font-black text-base tracking-widest text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-[11px]">
                Confirm Secret 4-Digit PIN *
              </label>
              <input
                type={showPinText ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                required
                value={regUserConfirmPin}
                onChange={(e) => setRegUserConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoComplete="new-password"
                className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50/20 dark:bg-slate-800 p-2.5 text-center font-mono font-black text-base tracking-widest text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
            📲 Right after registration, your Username and Password (4-Digit PIN) are automatically sent from WhatsApp Business {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY} to your WhatsApp number (+91 {cleanMob}).
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto'
          : 'min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50/70 text-slate-900 flex flex-col justify-between p-3 sm:p-6'
      }
    >
      <div className="w-full max-w-5xl mx-auto my-auto space-y-4">
        {/* Top Official Brand & Direct Portal Share Links Bar (White & Orange Theme) */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 border-2 border-orange-300 text-white p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Secret 5-Click Trigger on AWPL Logo Badge to Unlock Hidden Main Admin Security Vault */}
              <div
                onClick={handleSecretLogoClick}
                className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-orange-500 text-black font-black border-2 border-black shadow-lg ring-2 ring-white select-none cursor-pointer"
                title="AWPL C&F Bill Official Security Shield"
              >
                <span className="text-base leading-none tracking-tighter">AWPL</span>
                <span className="text-[9px] font-black uppercase mt-0.5">C&amp;F BILL</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-white text-orange-700 px-2.5 py-0.5 text-[10px] font-black uppercase shadow-2xs">
                    Official WhatsApp Business OTP Sender: {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}
                  </span>
                  <span className="rounded bg-orange-800/80 border border-orange-300/50 text-white px-2.5 py-0.5 text-[10px] font-bold">
                    Auto-Send Username &amp; Password to WhatsApp • 3-Attempt Lockout Active
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black mt-1 text-white">
                  C&amp;F Bill — Secure Login &amp; WhatsApp ({WHATSAPP_BUSINESS_OTP_SENDER}) OTP Registration
                </h1>
                <p className="text-xs text-orange-50 font-medium">
                  <strong>C&amp;F Owner Username:</strong> Email ID • <strong>Customer &amp; Staff Username:</strong> Mobile Number • <strong>OTP &amp; Credentials:</strong> Sent via WhatsApp {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              <a
                href={buildWhatsAppOfficialAppLinksUrl('')}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-orange-50 text-orange-700 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
                title="Send Official C&F App & Customer App Links directly to WhatsApp"
              >
                <MessageCircle className="h-4 w-4 text-orange-600" />
                <span>📲 Share App on WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setAuthTab('change_pin');
                  setChangePinMode('forgot_credentials_whatsapp');
                  setRecoveredWhatsAppCard(null);
                  setResetPinOtpSent(false);
                  setChangePinOld('');
                  setChangePinNew('');
                  setChangePinConfirm('');
                  setErrorMsg(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 border border-emerald-300/60 text-white font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <KeyRound className="h-4 w-4 text-amber-200" />
                <span>Forgot Username / Password (WhatsApp)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowShareLinksPanel(!showShareLinksPanel)}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-black text-white font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Share2 className="h-4 w-4 text-orange-400" />
                <span>
                  {showShareLinksPanel ? 'Hide Portal Links' : 'Copy Login & Register Links'}
                </span>
              </button>

              {isModal && onCloseModal && (
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              )}
            </div>
          </div>

          {/* Clean Enterprise Status Strip */}
          <div className="mt-4 pt-3.5 border-t border-orange-400/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white/95 text-slate-900 rounded-xl px-4 py-2.5 shadow-sm text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-emerald-700 text-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                WhatsApp Business: {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}
              </span>
              <span className="font-bold text-slate-700">
                Registration OTP &amp; Forgot Username/Password Recovery Dispatched Automatically via WhatsApp {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}
              </span>
            </div>
            <div className="text-[11px] font-mono font-bold text-orange-700 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span>256-Bit Local &amp; Cloud Session Protection</span>
            </div>
          </div>

          {/* Expandable Separate Login & Registration Share Links */}
          {showShareLinksPanel && (
            <div
              className={`mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 ${
                isAdminVaultUnlocked ? 'md:grid-cols-3' : 'md:grid-cols-2'
              } gap-3 text-xs`}
            >
              <div className="rounded-xl bg-slate-800/90 border border-emerald-500/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-orange-400 uppercase text-[10px] flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> 1. C&amp;F Login &amp; Register Link
                  </span>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=56x56&data=${encodeURIComponent(
                      portalLinks.cnfRegister
                    )}`}
                    alt="C&F Link QR"
                    className="h-10 w-10 rounded bg-white p-0.5"
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-300 truncate">
                  {portalLinks.cnfLogin}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyLink('cnf_login', portalLinks.cnfLogin)}
                    className="py-1.5 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'cnf_login' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'cnf_login' ? 'Copied!' : 'C&F Login Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLink('cnf_reg', portalLinks.cnfRegister)}
                    className="py-1.5 px-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-black text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'cnf_reg' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'cnf_reg' ? 'Copied!' : 'C&F Register Link'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/90 border border-indigo-500/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-indigo-300 uppercase text-[10px] flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> 2. Customer Login &amp; Register Link
                  </span>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=56x56&data=${encodeURIComponent(
                      portalLinks.customerRegister
                    )}`}
                    alt="Customer Link QR"
                    className="h-10 w-10 rounded bg-white p-0.5"
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-300 truncate">
                  {portalLinks.customerLogin}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyLink('cust_login', portalLinks.customerLogin)}
                    className="py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'cust_login' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'cust_login' ? 'Copied!' : 'Customer Login'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLink('cust_reg', portalLinks.customerRegister)}
                    className="py-1.5 px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'cust_reg' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'cust_reg' ? 'Copied!' : 'Customer Register'}</span>
                  </button>
                </div>
              </div>

              {isAdminVaultUnlocked && (
                <div className="rounded-xl bg-slate-800/90 border border-amber-500/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-300 uppercase text-[10px] flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> 3. Main Admin Vault Link
                    </span>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=56x56&data=${encodeURIComponent(
                        portalLinks.mainAdminLogin
                      )}`}
                      alt="Main Admin Link QR"
                      className="h-10 w-10 rounded bg-white p-0.5"
                    />
                  </div>
                  <p className="text-[10px] font-mono text-slate-300 truncate">
                    {portalLinks.mainAdminLogin}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyLink('main_login', portalLinks.mainAdminLogin)}
                    className="w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'main_login' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>
                      {copiedKey === 'main_login'
                        ? 'Copied Main Admin Link!'
                        : 'Copy Main Admin Secure Login Link'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Portal Selector Tabs (Main Admin tab is hidden from public view unless secret trigger unlocked) */}
          <div
            className={`mt-5 grid grid-cols-1 ${
              isAdminVaultUnlocked ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            } gap-2.5`}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedPortal('cnf_app');
                setAuthTab('login');
                setErrorMsg(null);
              }}
              className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-3 ${
                selectedPortal === 'cnf_app' && authTab !== 'change_pin'
                  ? 'bg-orange-500 text-black border-black shadow-lg'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Building2 className="h-6 w-6 shrink-0" />
              <div>
                <span className="text-[10px] font-black uppercase block opacity-80">
                  1. C&amp;F Owner (Email) &amp; Staff (Mobile)
                </span>
                <span className="text-sm font-black block">
                  C&amp;F Private PIN Login &amp; Reg
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedPortal('customer_app');
                setAuthTab('login');
                setErrorMsg(null);
              }}
              className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-3 ${
                selectedPortal === 'customer_app' && authTab !== 'change_pin'
                  ? 'bg-indigo-600 text-white border-indigo-300 shadow-lg'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Users className="h-6 w-6 shrink-0" />
              <div>
                <span className="text-[10px] font-black uppercase block opacity-80">
                  2. Customer Username = Mobile No.
                </span>
                <span className="text-sm font-black block">
                  Customer Private PIN Login &amp; Reg
                </span>
              </div>
            </button>

            {isAdminVaultUnlocked && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPortal('main_app');
                  setAuthTab('login');
                  setAdminStep(1);
                  setErrorMsg(null);
                }}
                className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-3 ${
                  selectedPortal === 'main_app' && authTab !== 'change_pin'
                    ? 'bg-amber-400 text-black border-black shadow-lg'
                    : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="h-6 w-6 shrink-0" />
                <div>
                  <span className="text-[10px] font-black uppercase block opacity-80">
                    3. Hidden Security Vault Unlocked
                  </span>
                  <span className="text-sm font-black block">
                    Main Admin Authority Vault
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Brute-Force Lockout Countdown Banner */}
        {isLockedOut && (
          <div className="rounded-2xl bg-red-950 text-white border-2 border-red-500 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-300 block">
                  Brute-Force Security Lockout Active (3 Failed Attempts)
                </span>
                <p className="text-xs sm:text-sm font-black">
                  Login temporarily locked to protect account privacy. Please wait before trying again.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-black/60 border border-red-400 px-4 py-2 font-mono text-base font-black tabular-nums text-amber-300">
              <Clock className="h-4 w-4 text-red-400" />
              <span>00:{String(lockoutRemainingSec).padStart(2, '0')}</span>
            </div>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/90 border-2 border-red-500 p-4 text-xs font-bold text-red-900 dark:text-red-200 flex items-center gap-2.5 shadow-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/90 border-2 border-emerald-500 p-4 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5 shadow-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ============================================================================
            FORGOT USERNAME & PASSWORD (WHATSAPP 8988311142) & SELF-SERVICE PIN MANAGER
           ============================================================================ */}
        {authTab === 'change_pin' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-2xl p-6 space-y-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="rounded bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                  Official WhatsApp Business ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) Recovery &amp; PIN Manager
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Forgot Username &amp; Password (Get on WhatsApp) or Change Secret PIN
                </h2>
                <p className="text-slate-500">
                  Forgot your Username or Password? Verify a 6-Digit OTP sent from Official WhatsApp Business <strong>{WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}</strong> and receive your Username &amp; Password directly on your WhatsApp!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                ← Back to Login
              </button>
            </div>

            <form onSubmit={handleSelfChange4DigitPin} className="space-y-4 max-w-2xl">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  1. Select Your Account Type *
                </label>
                <div
                  className={`grid grid-cols-2 ${
                    isAdminVaultUnlocked ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
                  } gap-2`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setChangePinRole('cnf_owner');
                      setChangePinOld('');
                      setResetPinOtpSent(false);
                      setRecoveredWhatsAppCard(null);
                    }}
                    className={`p-2.5 rounded-xl font-black border text-center cursor-pointer ${
                      changePinRole === 'cnf_owner'
                        ? 'bg-orange-500 text-black border-black'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    C&amp;F Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePinRole('cnf_staff');
                      setChangePinOld('');
                      setResetPinOtpSent(false);
                      setRecoveredWhatsAppCard(null);
                    }}
                    className={`p-2.5 rounded-xl font-black border text-center cursor-pointer ${
                      changePinRole === 'cnf_staff'
                        ? 'bg-emerald-700 text-white border-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    C&amp;F Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePinRole('customer');
                      setChangePinOld('');
                      setResetPinOtpSent(false);
                      setRecoveredWhatsAppCard(null);
                    }}
                    className={`p-2.5 rounded-xl font-black border text-center cursor-pointer ${
                      changePinRole === 'customer'
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Customer
                  </button>
                  {isAdminVaultUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setChangePinRole('main_admin');
                        setChangePinMode('know_old_pin');
                        setChangePinOld('');
                        setResetPinOtpSent(false);
                        setRecoveredWhatsAppCard(null);
                      }}
                      className={`p-2.5 rounded-xl font-black border text-center cursor-pointer ${
                        changePinRole === 'main_admin'
                          ? 'bg-amber-400 text-black border-black'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Main Admin (Email)
                    </button>
                  )}
                </div>
              </div>

              {/* Mode Toggle: 1. Forgot Username & Password (WhatsApp 8988311142) | 2. Change Using Current PIN | 3. Reset New PIN via OTP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setChangePinMode('forgot_credentials_whatsapp');
                    setRecoveredWhatsAppCard(null);
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg font-black transition cursor-pointer ${
                    changePinMode === 'forgot_credentials_whatsapp'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  📲 Forgot Username &amp; Password (Get on WhatsApp)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChangePinMode('know_old_pin');
                    setRecoveredWhatsAppCard(null);
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg font-black transition cursor-pointer ${
                    changePinMode === 'know_old_pin'
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Change PIN (Know Old PIN)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChangePinMode('forgot_pin_otp');
                    setRecoveredWhatsAppCard(null);
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-lg font-black transition cursor-pointer ${
                    changePinMode === 'forgot_pin_otp'
                      ? 'bg-orange-500 text-black shadow'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Create New PIN via OTP
                </button>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  2. Enter Your Registered 10-Digit WhatsApp Mobile Number{' '}
                  {changePinRole === 'cnf_owner' ? '(or Registered Email ID)' : ''} *
                </label>
                <input
                  type="text"
                  required
                  value={changePinUsername}
                  onChange={(e) => setChangePinUsername(e.target.value)}
                  placeholder={
                    changePinRole === 'cnf_owner'
                      ? 'Enter your registered 10-Digit Mobile Number or Email ID'
                      : 'Enter your registered 10-Digit WhatsApp Mobile Number'
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 font-mono font-bold bg-white dark:bg-slate-800"
                />
              </div>

              {/* MODE 1: FORGOT USERNAME & PASSWORD -> SEND OTP FROM 8988311142 & AUTO-DISPATCH CREDENTIALS TO WHATSAPP */}
              {changePinMode === 'forgot_credentials_whatsapp' && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 block">
                        WhatsApp Business OTP Sender: {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}
                      </span>
                      <p className="font-bold text-slate-900 dark:text-white text-xs">
                        Step 1: Send 6-Digit OTP to your mobile number • Step 2: Verify OTP to receive your Username &amp; Password on WhatsApp
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendResetPinOtp}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs cursor-pointer shadow"
                    >
                      {resetPinOtpSent
                        ? `Resend OTP from ${WHATSAPP_BUSINESS_OTP_SENDER}`
                        : `📲 Send 6-Digit OTP (${WHATSAPP_BUSINESS_OTP_SENDER})`}
                    </button>
                  </div>

                  {resetPinOtpSent && (
                    <div className="space-y-3 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setShowIncomingResetOtpPreview(!showIncomingResetOtpPreview)}
                          className="font-bold text-emerald-800 dark:text-emerald-300 underline cursor-pointer"
                        >
                          {showIncomingResetOtpPreview
                            ? 'Hide Device WhatsApp OTP Preview'
                            : `📩 View 6-Digit OTP Sent from ${WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}`}
                        </button>
                        {showIncomingResetOtpPreview && (
                          <span className="font-mono font-black text-sm text-emerald-900 dark:text-amber-300 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-emerald-400">
                            WhatsApp OTP: {resetPinGeneratedOtp}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                          Enter 6-Digit OTP Received from WhatsApp Business ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={resetPinEnteredOtp}
                          onChange={(e) =>
                            setResetPinEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="Enter 6-Digit OTP"
                          className="w-full rounded-xl border-2 border-emerald-600 p-3 text-center font-mono font-black text-base tracking-widest bg-white dark:bg-slate-900"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>✓ Verify OTP &amp; Send My Username + Password to WhatsApp</span>
                      </button>
                    </div>
                  )}

                  {recoveredWhatsAppCard && (
                    <div className="rounded-xl bg-white dark:bg-slate-900 border-2 border-emerald-600 p-4 space-y-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-black uppercase">
                          ✓ Dispatched from WhatsApp Business {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-500">
                          To: +91 {recoveredWhatsAppCard.recipientMobile}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Your <strong>{recoveredWhatsAppCard.roleLabel}</strong> login credentials have been sent to your WhatsApp number <strong>+91 {recoveredWhatsAppCard.recipientMobile}</strong>!
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={recoveredWhatsAppCard.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>📲 Open Username &amp; Password on WhatsApp (+91 {recoveredWhatsAppCard.recipientMobile})</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setAuthTab('login')}
                          className="py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs cursor-pointer"
                        >
                          Proceed to Login →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {changePinMode === 'forgot_pin_otp' && (
                <div className="rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-400 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300">
                      OTP ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) + C&amp;F Approval Code Verification
                    </span>
                    <button
                      type="button"
                      onClick={handleSendResetPinOtp}
                      className="px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] cursor-pointer"
                    >
                      {resetPinOtpSent ? 'Resend 6-Digit OTP' : 'Send 6-Digit Reset OTP'}
                    </button>
                  </div>

                  {resetPinOtpSent && (
                    <>
                      <div className="flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => setShowIncomingResetOtpPreview(!showIncomingResetOtpPreview)}
                          className="font-bold text-slate-700 dark:text-slate-300 underline cursor-pointer"
                        >
                          {showIncomingResetOtpPreview ? 'Hide Device OTP Preview' : '📩 View My Incoming WhatsApp OTP'}
                        </button>
                        {showIncomingResetOtpPreview && (
                          <span className="font-mono font-black text-orange-700 dark:text-orange-300">
                            WhatsApp OTP: {resetPinGeneratedOtp}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            6-Digit Reset OTP *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            value={resetPinEnteredOtp}
                            onChange={(e) =>
                              setResetPinEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            placeholder="6-Digit OTP"
                            className="w-full rounded-xl border border-orange-500 p-2.5 text-center font-mono font-black bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            C&amp;F Approval Code *
                          </label>
                          <input
                            type="password"
                            required
                            value={resetPinApprovalCode}
                            onChange={(e) => setResetPinApprovalCode(e.target.value.toUpperCase())}
                            placeholder="AWPL-3000"
                            className="w-full rounded-xl border border-orange-500 p-2.5 text-center font-mono font-black uppercase bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {changePinMode !== 'forgot_credentials_whatsapp' && (
                <>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      🔒 All PIN inputs are masked so only you can see them:
                    </span>
                    <button
                      type="button"
                      onClick={handleTemporaryPeekPin}
                      className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      {showPinText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showPinText ? 'Mask PINs' : 'Peek My PIN (3s)'}</span>
                    </button>
                  </div>

                  <div
                    className={`grid grid-cols-1 ${
                      changePinMode === 'know_old_pin' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                    } gap-3`}
                  >
                    {changePinMode === 'know_old_pin' && (
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Current 4-Digit PIN *
                        </label>
                        <input
                          type={showPinText ? 'text' : 'password'}
                          inputMode="numeric"
                          required
                          maxLength={4}
                          value={changePinOld}
                          onChange={(e) => setChangePinOld(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 font-mono font-black text-center text-base tracking-widest bg-white dark:bg-slate-800"
                        />
                      </div>
                    )}
                    <div>
                      <label className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                        New Secret 4-Digit PIN *
                      </label>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        inputMode="numeric"
                        required
                        maxLength={4}
                        value={changePinNew}
                        onChange={(e) => setChangePinNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        autoComplete="new-password"
                        className="w-full rounded-xl border-2 border-emerald-500 p-3 font-mono font-black text-center text-base tracking-widest bg-emerald-50/20 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                        Confirm New 4-Digit PIN *
                      </label>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        inputMode="numeric"
                        required
                        maxLength={4}
                        value={changePinConfirm}
                        onChange={(e) =>
                          setChangePinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder="••••"
                        autoComplete="new-password"
                        className="w-full rounded-xl border-2 border-emerald-500 p-3 font-mono font-black text-center text-base tracking-widest bg-emerald-50/20 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow-lg cursor-pointer"
                  >
                    Save My Secret 4-Digit PIN Password
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* ============================================================================
            PORTAL 1: C&F APP LOGIN (OWNER BY EMAIL + 4-PIN, STAFF BY MOBILE + 4-PIN) & REGISTRATION
           ============================================================================ */}
        {selectedPortal === 'cnf_app' && authTab !== 'change_pin' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Sub-Tabs: C&F Login | Register New C&F Owner | Register C&F Staff */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-slate-950 px-6 pt-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setErrorMsg(null);
                  }}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-600'
                      : 'text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  <span>1. C&amp;F Login (Private 4-Digit PIN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setErrorMsg(null);
                  }}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border-orange-500'
                      : 'text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>2. Register New C&amp;F Owner (Dual OTP + Secret PIN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register_staff');
                    setErrorMsg(null);
                  }}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                    authTab === 'register_staff'
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 border-teal-500'
                      : 'text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>3. Register C&amp;F Staff (Dual OTP + Secret PIN)</span>
                </button>
              </div>
            </div>

            {authTab === 'login' && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
                <form onSubmit={handleCnfLoginSubmit} className="lg:col-span-7 space-y-4">
                  <div>
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-black uppercase">
                      Private 4-Digit PIN Authentication • Zero Credential Exposure
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      C&amp;F Panel Login (Owner by Email ID • Staff by Mobile Number)
                    </h2>
                  </div>

                  {/* Toggle: C&F Owner vs C&F Staff */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setCnfLoginType('cnf_owner');
                        setCnfOwner4DigitPin('');
                        setErrorMsg(null);
                      }}
                      className={`py-2.5 px-3 rounded-lg font-black transition cursor-pointer ${
                        cnfLoginType === 'cnf_owner'
                          ? 'bg-orange-500 text-black shadow'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      C&amp;F Owner Login (Username: Email ID)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCnfLoginType('cnf_staff');
                        setStaff4DigitPin('');
                        setErrorMsg(null);
                      }}
                      className={`py-2.5 px-3 rounded-lg font-black transition cursor-pointer ${
                        cnfLoginType === 'cnf_staff'
                          ? 'bg-emerald-700 text-white shadow'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      C&amp;F Staff Login (Username: Mobile No.)
                    </button>
                  </div>

                  {cnfLoginType === 'cnf_owner' ? (
                    <>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          C&amp;F Owner Username (Registered Email ID) *
                        </label>
                        <div className="relative">
                          <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="email"
                            required
                            disabled={isLockedOut}
                            value={cnfOwnerEmailUsername}
                            onChange={(e) => setCnfOwnerEmailUsername(e.target.value)}
                            placeholder="Enter your registered C&F Email ID"
                            autoComplete="username"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 pl-9 p-2.5 font-mono font-bold bg-white dark:bg-slate-800 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            C&amp;F Owner Secret 4-Digit PIN Password *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setChangePinRole('cnf_owner');
                              setChangePinUsername(cnfOwnerEmailUsername);
                              setChangePinOld('');
                              setChangePinMode('forgot_credentials_whatsapp');
                              setRecoveredWhatsAppCard(null);
                              setResetPinOtpSent(false);
                              setAuthTab('change_pin');
                            }}
                            className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Forgot Username / Password (WhatsApp {WHATSAPP_BUSINESS_OTP_SENDER}) →
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPinText ? 'text' : 'password'}
                            inputMode="numeric"
                            required
                            disabled={isLockedOut}
                            maxLength={4}
                            value={cnfOwner4DigitPin}
                            onChange={(e) =>
                              setCnfOwner4DigitPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                            }
                            placeholder="••••"
                            autoComplete="current-password"
                            className="w-full rounded-xl border-2 border-orange-400 p-3 font-mono font-black tracking-widest text-center text-base bg-white dark:bg-slate-800 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={handleTemporaryPeekPin}
                            className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Peek your PIN for 3 seconds (visible only to you)"
                          >
                            {showPinText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          C&amp;F Staff Username (Registered 10-Digit Mobile Number) *
                        </label>
                        <div className="relative">
                          <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="tel"
                            required
                            disabled={isLockedOut}
                            maxLength={10}
                            value={staffMobileUsername}
                            onChange={(e) =>
                              setStaffMobileUsername(e.target.value.replace(/\D/g, '').slice(0, 10))
                            }
                            placeholder="Enter your 10-Digit Mobile Number"
                            autoComplete="username"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 pl-9 p-2.5 font-mono font-bold bg-white dark:bg-slate-800 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            C&amp;F Staff Secret 4-Digit PIN Password *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setChangePinRole('cnf_staff');
                              setChangePinUsername(staffMobileUsername);
                              setChangePinOld('');
                              setChangePinMode('forgot_credentials_whatsapp');
                              setRecoveredWhatsAppCard(null);
                              setResetPinOtpSent(false);
                              setAuthTab('change_pin');
                            }}
                            className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Forgot Username / Password (WhatsApp {WHATSAPP_BUSINESS_OTP_SENDER}) →
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPinText ? 'text' : 'password'}
                            inputMode="numeric"
                            required
                            disabled={isLockedOut}
                            maxLength={4}
                            value={staff4DigitPin}
                            onChange={(e) =>
                              setStaff4DigitPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                            }
                            placeholder="••••"
                            autoComplete="current-password"
                            className="w-full rounded-xl border-2 border-emerald-500 p-3 font-mono font-black tracking-widest text-center text-base bg-white dark:bg-slate-800 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={handleTemporaryPeekPin}
                            className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Peek your PIN for 3 seconds (visible only to you)"
                          >
                            {showPinText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isLockedOut}
                    className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>
                      {isLockedOut
                        ? `Locked (${lockoutRemainingSec}s)`
                        : `Login as ${
                            cnfLoginType === 'cnf_owner'
                              ? 'C&F Owner (Email + Private PIN)'
                              : 'C&F Staff (Mobile + Private PIN)'
                          }`}
                    </span>
                  </button>
                </form>

                {/* Right 5 cols: Enterprise Security & Privacy Verification Card (No public account lists) */}
                <div className="lg:col-span-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 px-3 py-1 text-[10px] font-black uppercase">
                      <Lock className="h-3.5 w-3.5" />
                      Zero-Knowledge Credential Privacy
                    </span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Strict Password &amp; Account Confidentiality
                    </h3>
                    <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Visible Only to You:</strong> Your 4-Digit PIN Password is never shown to C&amp;F Owners, Staff, or Admins.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Hidden Account Directory:</strong> Registered Email IDs and Staff Mobile Numbers are hidden from public login screens.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Dual-Verified Registration:</strong> New accounts require both a 6-Digit OTP and the C&amp;F Owner Approval Code.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAuthTab('register')}
                      className="w-full py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs cursor-pointer shadow-xs transition"
                    >
                      + Register New AWPL C&amp;F Franchise →
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab('register_staff')}
                      className="w-full py-2 px-3 rounded-xl border border-teal-500 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 font-black text-xs cursor-pointer transition"
                    >
                      + Register New C&amp;F Staff Member →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REGISTER NEW C&F OWNER (DUAL OTP + APPROVAL CODE + USER-CREATED SECRET PIN) */}
            {authTab === 'register' && (
              <form onSubmit={handleCnfRegisterSubmit} className="p-6 space-y-5 text-xs">
                <div className="rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 p-3.5">
                  <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300 block">
                    Dual-Verified Registration • User Creates Own Secret 4-Digit PIN
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    Your <strong>Registered Email ID</strong> is your C&amp;F Owner Login Username. Verify with <strong>6-Digit OTP + Approval Code</strong> and create your own <strong>Secret 4-Digit PIN Password</strong> (visible only to you).
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          C&amp;F / Franchise Name (Under AWPL) *
                        </label>
                        <input
                          type="text"
                          required
                          value={regCnfName}
                          onChange={(e) => setRegCnfName(e.target.value)}
                          placeholder="e.g. SHIMLA WELLNESS C&F HUB"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-orange-600 dark:text-orange-400">
                          C&amp;F Short Name (Prefix) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={8}
                          value={regCnfShortName}
                          onChange={(e) => setRegCnfShortName(e.target.value.toUpperCase())}
                          placeholder="e.g. SML"
                          className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2.5 font-mono font-black uppercase bg-orange-50/20 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="font-bold text-emerald-700 dark:text-emerald-400">
                          Starting Bill No. (Per Session) *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={regCnfStartInvNo}
                          onChange={(e) => setRegCnfStartInvNo(Number(e.target.value))}
                          placeholder="e.g. 3000"
                          className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-700 dark:text-emerald-400">
                          Session Year (Apr–Mar) *
                        </label>
                        <select
                          value={regCnfSessionYear}
                          onChange={(e) => setRegCnfSessionYear(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                        >
                          <option value="2025-2026">2025-2026 (Apr–Mar)</option>
                          <option value="2026-2027">2026-2027 (Apr–Mar)</option>
                          <option value="2027-2028">2027-2028 (Apr–Mar)</option>
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
                          placeholder="Franchise Owner Full Name"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          C&amp;F Owner Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={regCfOwner}
                          onChange={(e) => setRegCfOwner(e.target.value)}
                          placeholder="C&F Owner Full Name"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-orange-700 dark:text-orange-400">
                          Registered Email ID (Your C&amp;F Owner Login Username) *
                        </label>
                        <input
                          type="email"
                          required
                          value={regCnfEmail}
                          onChange={(e) => setRegCnfEmail(e.target.value)}
                          placeholder="owner@awplcnf.in"
                          className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          10-Digit Mobile Number (For OTP Verification) *
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={regCnfMobile}
                          onChange={(e) => setRegCnfMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="9816012345"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Full C&amp;F Address (Street, City, State &amp; Pincode) *
                        </label>
                        <input
                          type="text"
                          required
                          value={regCnfAddress}
                          onChange={(e) => setRegCnfAddress(e.target.value)}
                          placeholder="Shop / Complex, Road, City, State, PIN"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Set Your C&amp;F Approval Code
                        </label>
                        <input
                          type="password"
                          value={regCnfOwnerApprovalCode}
                          onChange={(e) => setRegCnfOwnerApprovalCode(e.target.value.toUpperCase())}
                          placeholder="AWPL-3000"
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold uppercase bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    {/* Statutory & Tax Registration Details */}
                    <div className="rounded-xl border border-orange-400/70 bg-orange-50/20 dark:bg-orange-950/20 p-3.5 space-y-3">
                      <span className="font-black text-orange-800 dark:text-orange-300 uppercase text-[10px] block">
                        Statutory Tax &amp; License Registration Details (GST Number, PAN, FSSAI, Ayush/Drug License &amp; AWPL Code)
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
                            value={regCnfGstin}
                            onChange={(e) => setRegCnfGstin(e.target.value.toUpperCase())}
                            placeholder="e.g. 02AABCA8921R1Z9"
                            className="mt-1 w-full rounded-xl border-2 border-orange-400 p-2 font-mono font-bold uppercase bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            Income Tax PAN Number *
                          </label>
                          <input
                            type="text"
                            maxLength={10}
                            value={regCnfPan}
                            onChange={(e) => setRegCnfPan(e.target.value.toUpperCase())}
                            placeholder="e.g. AABCA8921R"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono uppercase bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            AWPL Franchise / C&amp;F Code
                          </label>
                          <input
                            type="text"
                            value={regCnfFranchiseCode}
                            onChange={(e) => setRegCnfFranchiseCode(e.target.value.toUpperCase())}
                            placeholder="e.g. AWPL-FR-HP-SOL-092"
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
                            value={regCnfFssai}
                            onChange={(e) => setRegCnfFssai(e.target.value)}
                            placeholder="e.g. 10924011000142"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            Ayush / Drug License (DL) No.
                          </label>
                          <input
                            type="text"
                            value={regCnfDlNumber}
                            onChange={(e) => setRegCnfDlNumber(e.target.value.toUpperCase())}
                            placeholder="e.g. HP-SOL-DRW-2024-88"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono uppercase bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            Authorization Valid Till
                          </label>
                          <input
                            type="text"
                            value={regCnfAuthValidTill}
                            onChange={(e) => setRegCnfAuthValidTill(e.target.value)}
                            placeholder="e.g. 31-March-2028"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bank & UPI Details */}
                    <div className="rounded-xl border border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20 p-3.5 space-y-3">
                      <span className="font-black text-emerald-800 dark:text-emerald-300 uppercase text-[10px] block">
                        C&amp;F Self-Service Bank, Automatic UPI QR &amp; Stock Mode
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">Bank Name &amp; Branch *</label>
                          <input
                            type="text"
                            required
                            value={regCnfBankName}
                            onChange={(e) => setRegCnfBankName(e.target.value)}
                            placeholder="e.g. PNB / SBI"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">Account Number *</label>
                          <input
                            type="text"
                            required
                            value={regCnfAccountNo}
                            onChange={(e) => setRegCnfAccountNo(e.target.value)}
                            placeholder="Account Number"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300">IFSC Code *</label>
                          <input
                            type="text"
                            required
                            value={regCnfIfsc}
                            onChange={(e) => setRegCnfIfsc(e.target.value.toUpperCase())}
                            placeholder="PUNB0302900"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono uppercase bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-emerald-800 dark:text-emerald-300">UPI ID (VPA) *</label>
                          <input
                            type="text"
                            required
                            value={regCnfUpiId}
                            onChange={(e) => setRegCnfUpiId(e.target.value)}
                            placeholder="e.g. mycnf@upi"
                            className="mt-1 w-full rounded-xl border border-emerald-500 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-emerald-800 dark:text-emerald-300">UPI Mobile Number *</label>
                          <input
                            type="tel"
                            value={regCnfUpiNumber}
                            onChange={(e) => setRegCnfUpiNumber(e.target.value)}
                            placeholder="10-digit UPI Mobile"
                            className="mt-1 w-full rounded-xl border border-emerald-500 p-2 font-mono font-bold bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={regCnfInfinityStock}
                              onChange={(e) => setRegCnfInfinityStock(e.target.checked)}
                              className="h-4 w-4 rounded text-emerald-600"
                            />
                            <span>Enable Infinity Stock</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300">
                          Custom Bill Terms &amp; Conditions (1 per line, Printed on Invoice)
                        </label>
                        <textarea
                          rows={2}
                          value={regCnfTerms}
                          onChange={(e) => setRegCnfTerms(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right 4 cols: Live QR Preview + Dual Verification & Secret PIN Creator */}
                  <div className="lg:col-span-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between text-center space-y-3">
                    <div className="space-y-2">
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-3 py-1 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                        AUTOMATIC C&amp;F UPI QR
                      </span>
                      <div className="flex justify-center my-2">
                        <img
                          src={regPreviewQrSrc}
                          alt="New C&F QR"
                          className="h-32 w-32 rounded-xl bg-white p-2 border-2 border-emerald-500 shadow object-contain"
                        />
                      </div>
                      <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-orange-400 bg-orange-50/50 dark:bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-orange-800 dark:text-orange-300">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Or Upload Custom QR Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrFileUpload}
                          className="hidden"
                        />
                      </label>

                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 p-3 text-left text-[11px] space-y-1">
                        <span className="font-black text-amber-900 dark:text-amber-300 block">
                          🔒 Dual Verification + Private PIN:
                        </span>
                        <p className="text-slate-600 dark:text-slate-300">
                          Requires 6-Digit OTP + Approval Code (default: <span className="font-mono font-bold">AWPL-3000</span>), then you create your own secret 4-Digit PIN.
                        </p>
                      </div>
                    </div>

                    {renderDualVerificationAndPinCreator('cnf_owner', regCnfMobile, 'C&F Owner')}

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs shadow-lg cursor-pointer transition"
                    >
                      {regOtpSentFor === 'cnf_owner'
                        ? '✓ Verify OTP + Approval Code & Save My Private PIN →'
                        : 'Step 1: Send 6-Digit Registration OTP →'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 3: REGISTER NEW C&F STAFF (DUAL OTP + APPROVAL CODE + USER-CREATED SECRET PIN) */}
            {authTab === 'register_staff' && (
              <form onSubmit={handleStaffRegisterSubmit} className="p-6 space-y-4 text-xs max-w-2xl">
                <div className="rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 p-3.5">
                  <span className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 block">
                    C&amp;F Staff Registration • Dual OTP + Owner Approval Code • Private Staff PIN
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    Register a new staff member for <strong>{activeCnfConfig.name}</strong>. Requires 6-Digit OTP + C&amp;F Owner Approval Code, and the staff member sets their own secret 4-Digit PIN (never visible to others).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Staff Member Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regStaffName}
                      onChange={(e) => setRegStaffName(e.target.value)}
                      placeholder="e.g. Rohit Verma"
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-teal-700 dark:text-teal-400">
                      10-Digit Mobile Number (Staff Login Username) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={regStaffMobile}
                      onChange={(e) =>
                        setRegStaffMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="9816099887"
                      className="mt-1 w-full rounded-xl border-2 border-teal-500 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Staff Role *
                    </label>
                    <select
                      value={regStaffRole}
                      onChange={(e) => setRegStaffRole(e.target.value as Role)}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                    >
                      <option value="billing_staff">POS Billing Staff</option>
                      <option value="inventory_staff">Inventory &amp; Stock Staff</option>
                      <option value="support_staff">AWPL C&amp;F Online Desk</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Shift Timing
                    </label>
                    <select
                      value={regStaffShift}
                      onChange={(e) => setRegStaffShift(e.target.value as StaffMember['shift'])}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                    >
                      <option value="Full Day (9 AM - 8 PM)">Full Day (9 AM - 8 PM)</option>
                      <option value="Morning Shift (9 AM - 2 PM)">Morning Shift (9 AM - 2 PM)</option>
                      <option value="Evening Shift (2 PM - 8 PM)">Evening Shift (2 PM - 8 PM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Email ID (Optional)
                    </label>
                    <input
                      type="email"
                      value={regStaffEmail}
                      onChange={(e) => setRegStaffEmail(e.target.value)}
                      placeholder="staff@awpl.in"
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                {renderDualVerificationAndPinCreator('cnf_staff', regStaffMobile, 'C&F Staff')}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs sm:text-sm shadow-lg cursor-pointer"
                >
                  {regOtpSentFor === 'cnf_staff'
                    ? '✓ Verify OTP + Approval Code & Register Staff →'
                    : 'Step 1: Send 6-Digit OTP to Register Staff →'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ============================================================================
            PORTAL 2: CUSTOMER APP LOGIN & REGISTRATION (USERNAME = MOBILE NO, PRIVATE 4-DIGIT PIN)
           ============================================================================ */}
        {selectedPortal === 'customer_app' && authTab !== 'change_pin' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-slate-950 px-6 pt-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setErrorMsg(null);
                  }}
                  className={`px-5 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600'
                      : 'text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  <span>Customer Login (Mobile + Private PIN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setErrorMsg(null);
                  }}
                  className={`px-5 py-2.5 rounded-t-xl text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                      : 'text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Customer Registration (Dual OTP + Secret PIN)</span>
                </button>
              </div>
            </div>

            {authTab === 'login' ? (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
                <form onSubmit={handleCustomerLoginSubmit} className="lg:col-span-7 space-y-4">
                  <div>
                    <span className="rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2.5 py-0.5 text-[10px] font-black uppercase">
                      Customer Username = 10-Digit Mobile Number • Private 4-Digit PIN
                    </span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      Sign In to AWPL Customer App
                    </h2>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Customer Username (Registered 10-Digit Mobile Number) *
                    </label>
                    <input
                      type="tel"
                      required
                      disabled={isLockedOut}
                      maxLength={10}
                      value={custMobileUsername}
                      onChange={(e) =>
                        setCustMobileUsername(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="Enter your 10-Digit Mobile Number"
                      autoComplete="username"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 font-mono font-bold bg-white dark:bg-slate-800 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Customer Secret 4-Digit PIN Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setChangePinRole('customer');
                          setChangePinUsername(custMobileUsername);
                          setChangePinOld('');
                          setChangePinMode('forgot_credentials_whatsapp');
                          setRecoveredWhatsAppCard(null);
                          setResetPinOtpSent(false);
                          setAuthTab('change_pin');
                        }}
                        className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Forgot Username / Password (WhatsApp {WHATSAPP_BUSINESS_OTP_SENDER}) →
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPinText ? 'text' : 'password'}
                        inputMode="numeric"
                        required
                        disabled={isLockedOut}
                        maxLength={4}
                        value={cust4DigitPin}
                        onChange={(e) =>
                          setCust4DigitPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder="••••"
                        autoComplete="current-password"
                        className="w-full rounded-xl border-2 border-indigo-500 p-3 font-mono font-black tracking-widest text-center text-base bg-white dark:bg-slate-800 disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={handleTemporaryPeekPin}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Peek your PIN for 3 seconds (visible only to you)"
                      >
                        {showPinText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLockedOut}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>
                      {isLockedOut
                        ? `Locked (${lockoutRemainingSec}s)`
                        : 'Login to Customer App (Mobile + Private PIN)'}
                    </span>
                  </button>
                </form>

                {/* Right 5 cols: Customer Privacy & Security Card (No public customer list) */}
                <div className="lg:col-span-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-3 py-1 text-[10px] font-black uppercase">
                      <Lock className="h-3.5 w-3.5" />
                      Customer Privacy Protected
                    </span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Private Customer Account Access
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Customer mobile numbers and 4-Digit PIN passwords are encrypted and hidden from public lists. Only you can view or change your password.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAuthTab('register')}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer shadow-xs transition"
                  >
                    + Register New Customer Account →
                  </button>
                </div>
              </div>
            ) : (
              /* CUSTOMER REGISTRATION FORM (DUAL OTP + APPROVAL CODE + USER-CREATED SECRET PIN) */
              <form onSubmit={handleCustomerRegisterSubmit} className="p-6 space-y-4 text-xs">
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 p-3.5">
                  <span className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-300 block">
                    Customer Registration • Dual OTP + Approval Code • User-Created Private PIN
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    Your <strong>10-Digit Mobile Number</strong> is your Login Username. Verify with <strong>6-Digit OTP + C&amp;F Approval Code</strong> and create your own secret <strong>4-Digit PIN Password</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Customer Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regCustName}
                      onChange={(e) => setRegCustName(e.target.value)}
                      placeholder="e.g. Rajesh Thakur"
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-indigo-700 dark:text-indigo-400">
                      10-Digit Mobile Number (Your Login Username) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={regCustMobile}
                      onChange={(e) =>
                        setRegCustMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="9816012345"
                      className="mt-1 w-full rounded-xl border-2 border-indigo-500 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      AWPL Distributor ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={regCustAwplId}
                      onChange={(e) => setRegCustAwplId(e.target.value.toUpperCase())}
                      placeholder="e.g. AWPL782910"
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono uppercase bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Select C&amp;F Franchise to Purchase From *
                    </label>
                    <select
                      value={regCustPreferredCfId}
                      onChange={(e) => setRegCustPreferredCfId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                    >
                      {cnfAccounts.length === 0 ? (
                        <option value={activeCnfConfig.id || 'cnf-drw-solan'}>
                          {activeCnfConfig.name} ({activeCnfConfig.shortName || 'DRW'})
                        </option>
                      ) : (
                        cnfAccounts.map((c) => (
                          <option key={c.id || c.name} value={c.id || c.name}>
                            {c.name} ({c.shortName || 'DRW'})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Delivery Address &amp; City *
                    </label>
                    <input
                      type="text"
                      required
                      value={regCustAddress}
                      onChange={(e) => setRegCustAddress(e.target.value)}
                      placeholder="House / Ward, Road, Solan HP"
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                {renderDualVerificationAndPinCreator('customer', regCustMobile, 'Customer')}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs sm:text-sm shadow-lg cursor-pointer transition"
                >
                  {regOtpSentFor === 'customer'
                    ? '✓ Verify OTP + Approval Code & Register Customer →'
                    : 'Step 1: Send 6-Digit OTP to Register Customer →'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ============================================================================
            PORTAL 3: MAIN ADMIN SEPARATE LOGIN PROCEDURE (HIDDEN VAULT — ZERO CREDENTIAL LEAKS)
           ============================================================================ */}
        {selectedPortal === 'main_app' && authTab !== 'change_pin' && (
          <div className="rounded-2xl bg-slate-900 border-2 border-amber-400 text-white shadow-2xl overflow-hidden">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-6 w-6 text-amber-400" />
                <div>
                  <span className="rounded bg-amber-400 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                    Hidden Security Vault • Two-Step Encrypted Authentication
                  </span>
                  <h2 className="text-base sm:text-lg font-black mt-0.5">
                    Main Admin Super Authority Login
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAdminVaultUnlocked(false);
                  setSelectedPortal('cnf_app');
                  setAdminStep(1);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                🔒 Lock &amp; Hide Admin Vault
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1.5 rounded-xl">
                  <div
                    className={`py-2 px-3 rounded-lg font-black text-center ${
                      adminStep === 1 ? 'bg-amber-400 text-black' : 'bg-emerald-700 text-white'
                    }`}
                  >
                    Step 1: Admin Email &amp; Private PIN {adminStep === 2 && '✓'}
                  </div>
                  <div
                    className={`py-2 px-3 rounded-lg font-black text-center ${
                      adminStep === 2 ? 'bg-amber-400 text-black' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    Step 2: Master Authority Key
                  </div>
                </div>

                {adminStep === 1 ? (
                  <form onSubmit={handleMainAdminStep1} className="space-y-4">
                    <div>
                      <label className="font-bold text-amber-300 block mb-1">
                        Main Admin Username (Registered Email ID) *
                      </label>
                      <input
                        type="email"
                        required
                        disabled={isLockedOut}
                        value={adminEmailUsername}
                        onChange={(e) => setAdminEmailUsername(e.target.value)}
                        placeholder="Enter Main Admin Email ID"
                        autoComplete="username"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white p-3 font-mono font-bold disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-amber-300">
                          Main Admin Secret 4-Digit PIN Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setChangePinRole('main_admin');
                            setChangePinUsername(adminEmailUsername);
                            setChangePinOld('');
                            setAuthTab('change_pin');
                          }}
                          className="text-[11px] font-black text-amber-300 hover:underline cursor-pointer"
                        >
                          Change Admin PIN →
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPinText ? 'text' : 'password'}
                          inputMode="numeric"
                          required
                          disabled={isLockedOut}
                          maxLength={4}
                          value={admin4DigitPinInput}
                          onChange={(e) =>
                            setAdmin4DigitPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="••••"
                          autoComplete="current-password"
                          className="w-full rounded-xl border-2 border-amber-400 bg-slate-800 text-white p-3 font-mono font-black tracking-widest text-center text-base disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={handleTemporaryPeekPin}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-white cursor-pointer"
                          title="Peek your PIN for 3 seconds (visible only to you)"
                        >
                          {showPinText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLockedOut}
                      className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>
                        {isLockedOut
                          ? `Locked (${lockoutRemainingSec}s)`
                          : 'Verify Step 1 (Email + Private PIN)'}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleMainAdminStep2Verify} className="space-y-4">
                    <div className="rounded-xl bg-emerald-950/80 border border-emerald-500/50 p-3 text-emerald-200 font-bold flex items-center justify-between">
                      <span>✓ Step 1 Verified</span>
                      <button
                        type="button"
                        onClick={() => setAdminStep(1)}
                        className="text-[11px] underline text-amber-300"
                      >
                        Back
                      </button>
                    </div>

                    <div>
                      <label className="font-bold text-amber-300 block mb-1">
                        Step 2: Enter Secret Master Authority Key *
                      </label>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        required
                        disabled={isLockedOut}
                        value={adminMasterKeyInput}
                        onChange={(e) => setAdminMasterKeyInput(e.target.value.toUpperCase())}
                        placeholder="••••••••••••••"
                        autoComplete="off"
                        className="w-full rounded-xl border-2 border-amber-400 bg-slate-800 text-white p-3 font-mono font-bold uppercase text-center disabled:opacity-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLockedOut}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Unlock Main Admin App</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="lg:col-span-5 rounded-2xl bg-slate-800/90 border border-slate-700 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <span className="rounded bg-amber-400/20 text-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase">
                    Vault Security Enforcement
                  </span>
                  <h3 className="font-black text-sm text-white">
                    Zero Plaintext Credential Display
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Main Admin Password (PIN) and Step-2 Master Key are completely hidden and never displayed on screen to anyone. Click below to dispatch the confidential Admin Password &amp; Key directly to <strong>dixit3415d@gmail.com</strong>.
                  </p>

                  <button
                    type="button"
                    disabled={isDispatchingAdminKey}
                    onClick={handleDispatchAdminKeyToEmail}
                    className="w-full mt-2 py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-black text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Mail className="h-4 w-4" />
                    <span>
                      {isDispatchingAdminKey
                        ? 'Dispatching to dixit3415d@gmail.com...'
                        : 'Send Admin Password & Key to dixit3415d@gmail.com'}
                    </span>
                  </button>
                </div>
                <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 text-[11px] text-slate-400 font-mono">
                  Vault Trigger: 5× Logo Tap or Ctrl+Shift+A
                  <br />
                  Protected Email: dixit3415d@gmail.com (PIN: ••••)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================================
          PERSONAL MESSAGE CREDENTIAL DISPATCH MODAL (SHOWN AFTER REGISTRATION — PIN MASKED BY DEFAULT)
         ============================================================================ */}
      {dispatchedCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-2xl overflow-hidden text-xs">
            <div className="bg-emerald-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-6 w-6 text-amber-400 shrink-0" />
                <div>
                  <span className="rounded bg-amber-400 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                    WhatsApp Business ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) Verified &amp; Auto-Dispatched
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    {dispatchedCredentials.roleLabel} Registered • Username &amp; Password Sent to WhatsApp!
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                    📲 Official WhatsApp Business Sender: {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY} ({WHATSAPP_BUSINESS_OTP_SENDER})
                  </span>
                  <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black">
                    ✓ Auto-Dispatched to +91 {dispatchedCredentials.mobileForMessage}
                  </span>
                </div>
                <p className="font-bold text-emerald-950 dark:text-emerald-200 pt-1">
                  Your <strong>Username</strong> and <strong>Password (4-Digit PIN)</strong> for{' '}
                  <strong>{dispatchedCredentials.recipientName}</strong> have been automatically sent from{' '}
                  <strong>{WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}</strong> to your WhatsApp number{' '}
                  <strong>+91 {dispatchedCredentials.mobileForMessage}</strong>:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Login Username ({dispatchedCredentials.usernameType})
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white break-all">
                      {dispatchedCredentials.usernameValue}
                    </span>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/80 p-3 border-2 border-amber-400 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">
                        Your Private 4-Digit PIN Password
                      </span>
                      <span className="font-mono font-black text-xl tracking-widest text-slate-900 dark:text-white">
                        {showDispatchPin ? dispatchedCredentials.autoPinPassword : '••••'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDispatchPin(!showDispatchPin)}
                      className="p-1.5 rounded-lg bg-amber-200/70 dark:bg-slate-800 text-slate-800 dark:text-amber-300 cursor-pointer"
                      title="Only you should view your PIN"
                    >
                      {showDispatchPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  🔒 Your 4-Digit PIN is masked on screen by default and sent directly to your personal WhatsApp (+91 {dispatchedCredentials.mobileForMessage}) from {WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}.
                </p>
              </div>

              {/* Optional toggle for user to include or redact PIN in their own WhatsApp/SMS reminder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                    WhatsApp ({WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY}) Credential Delivery:
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePinInPersonalMsg}
                      onChange={(e) => setIncludePinInPersonalMsg(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Include Username &amp; Password in WhatsApp message</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/91${dispatchedCredentials.mobileForMessage}?text=${encodeURIComponent(
                      buildPersonalLoginMessage({
                        roleLabel: dispatchedCredentials.roleLabel,
                        recipientName: dispatchedCredentials.recipientName,
                        usernameType: dispatchedCredentials.usernameType,
                        usernameValue: dispatchedCredentials.usernameValue,
                        pinPassword: dispatchedCredentials.autoPinPassword,
                        portalLink: dispatchedCredentials.portalLink,
                        includePlainPin: includePinInPersonalMsg,
                      })
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-1.5 shadow"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Send Username &amp; Password on WhatsApp (+91 {dispatchedCredentials.mobileForMessage})</span>
                  </a>

                  <a
                    href={`sms:+91${dispatchedCredentials.mobileForMessage}?body=${encodeURIComponent(
                      buildPersonalLoginMessage({
                        roleLabel: dispatchedCredentials.roleLabel,
                        recipientName: dispatchedCredentials.recipientName,
                        usernameType: dispatchedCredentials.usernameType,
                        usernameValue: dispatchedCredentials.usernameValue,
                        pinPassword: dispatchedCredentials.autoPinPassword,
                        portalLink: dispatchedCredentials.portalLink,
                        includePlainPin: includePinInPersonalMsg,
                      })
                    )}`}
                    className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center justify-center gap-1.5 shadow"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send to My SMS</span>
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const roleMap: Record<
                      PersonalCredentialDispatch['roleLabel'],
                      'cnf_owner' | 'cnf_staff' | 'customer' | 'main_admin'
                    > = {
                      'C&F Owner': 'cnf_owner',
                      'C&F Staff': 'cnf_staff',
                      Customer: 'customer',
                      'Main Admin': 'main_admin',
                    };
                    setChangePinRole(roleMap[dispatchedCredentials.roleLabel]);
                    setChangePinUsername(dispatchedCredentials.usernameValue);
                    setChangePinOld('');
                    setDispatchedCredentials(null);
                    setAuthTab('change_pin');
                  }}
                  className="sm:w-1/2 py-2.5 px-3 rounded-xl border-2 border-emerald-600 text-emerald-700 dark:text-emerald-300 font-black cursor-pointer"
                >
                  Change My 4-Digit PIN
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pending = dispatchedCredentials;
                    setDispatchedCredentials(null);
                    onLoginSuccess(
                      pending.pendingSession,
                      pending.pendingCnf,
                      pending.pendingCustomer
                    );
                  }}
                  className="sm:w-1/2 py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black shadow-md cursor-pointer"
                >
                  Continue &amp; Login to Portal →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
