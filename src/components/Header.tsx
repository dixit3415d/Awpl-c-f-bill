import React from 'react';
import {
  Moon,
  Sun,
  User,
  Wifi,
  WifiOff,
  Maximize,
  Minimize,
  Keyboard,
  UserCog,
  Building2,
  Users,
  ShieldCheck,
  Landmark,
  MessageSquarePlus,
  ShieldAlert,
  Monitor,
  KeyRound,
  LogOut,
  Share2,
  UserPlus,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  Lock,
  Eye,
  EyeOff,
  X,
  Dumbbell
} from 'lucide-react';
import { AppPortalMode, AuthSession, FranchiseConfig, Role, StaffMember } from '../types';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { WhatsAppAndPlayStoreModal } from './WhatsAppAndPlayStoreModal';

interface HeaderProps {
  franchiseConfig: FranchiseConfig;
  cnfAccounts?: FranchiseConfig[];
  onSelectCnf?: (cnf: FranchiseConfig) => void;
  onOpenCnfSettings?: (mode: 'settings' | 'register') => void;
  onOpenFeedback?: () => void;
  onOpenComplaint?: () => void;
  onOpenDeviceSync?: () => void;
  activePortal: AppPortalMode;
  onPortalChange: (portal: AppPortalMode) => void;
  currentUserRole: Role;
  currentUserName: string;
  staffList: StaffMember[];
  onRoleChange: (role: Role) => void;
  onSelectStaff: (staff: StaffMember) => void;
  onOpenStaffManager: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isOnline: boolean;
  offlineQueueCount: number;
  onOpenCertificate: () => void;
  onOpenShortcuts?: () => void;
  authSession?: AuthSession | null;
  onOpenAuthModal?: (portal?: AppPortalMode, mode?: 'login' | 'register' | 'change_pin') => void;
  onLogout?: () => void;
  onResetToBrandNew?: () => void;
  onOpenGitFit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  franchiseConfig,
  cnfAccounts = [],
  onSelectCnf,
  onOpenCnfSettings,
  onOpenFeedback,
  onOpenComplaint,
  onOpenDeviceSync,
  activePortal,
  onPortalChange,
  currentUserRole,
  currentUserName,
  staffList,
  onRoleChange,
  onSelectStaff,
  onOpenStaffManager,
  isDarkMode,
  onToggleDarkMode,
  isOnline,
  offlineQueueCount,
  onOpenCertificate,
  onOpenShortcuts,
  authSession,
  onOpenAuthModal,
  onLogout,
  onResetToBrandNew,
  onOpenGitFit,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);
  const [isWhatsAppPlayStoreOpen, setIsWhatsAppPlayStoreOpen] = React.useState(false);
  const [whatsAppPlayStoreTab, setWhatsAppPlayStoreTab] = React.useState<'whatsapp' | 'playstore'>('whatsapp');
  const [isAdminVaultUnlocked, setIsAdminVaultUnlocked] = React.useState(
    activePortal === 'main_app' || authSession?.role === 'super_admin'
  );
  const [pendingStaffSwitch, setPendingStaffSwitch] = React.useState<StaffMember | null>(null);
  const [switchPinInput, setSwitchPinInput] = React.useState('');
  const [switchPinVisible, setSwitchPinVisible] = React.useState(false);
  const [switchPinError, setSwitchPinError] = React.useState<string | null>(null);

  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const logoClickTimestampsRef = React.useRef<number[]>([]);
  const switchPeekTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (activePortal === 'main_app' || authSession?.role === 'super_admin') {
      setIsAdminVaultUnlocked(true);
    }
  }, [activePortal, authSession?.role]);

  React.useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsLogoutConfirmOpen(false);
        setPendingStaffSwitch(null);
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'A' || event.key === 'a')) {
        event.preventDefault();
        setIsAdminVaultUnlocked(true);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  const handleLogoSecretClick = () => {
    const now = Date.now();
    const recent = logoClickTimestampsRef.current.filter((t) => now - t < 3000);
    recent.push(now);
    logoClickTimestampsRef.current = recent;
    if (recent.length >= 5) {
      logoClickTimestampsRef.current = [];
      setIsAdminVaultUnlocked(true);
    }
  };

  const handleToggleSwitchPinPeek = () => {
    if (switchPeekTimeoutRef.current) {
      window.clearTimeout(switchPeekTimeoutRef.current);
      switchPeekTimeoutRef.current = null;
    }
    if (switchPinVisible) {
      setSwitchPinVisible(false);
      return;
    }
    setSwitchPinVisible(true);
    switchPeekTimeoutRef.current = window.setTimeout(() => {
      setSwitchPinVisible(false);
    }, 3000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const activeStaffMembers = staffList.filter((s) => s.status === 'active');

  const handleOperatorDropdownChange = (val: string) => {
    if (val === '__manage_staff__') {
      onOpenStaffManager();
      return;
    }
    if (val.startsWith('staff:')) {
      const id = val.replace('staff:', '');
      const found = staffList.find((s) => s.id === id);
      if (found) {
        setPendingStaffSwitch(found);
        setSwitchPinInput('');
        setSwitchPinVisible(false);
        setSwitchPinError(null);
      }
      return;
    }
    onRoleChange(val as Role);
  };

  const handleVerifyStaffSwitchPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStaffSwitch) return;
    const cleanPin = switchPinInput.replace(/\D/g, '').slice(0, 4);
    if (cleanPin.length !== 4 || cleanPin !== pendingStaffSwitch.pinCode) {
      setSwitchPinError('Incorrect 4-Digit Operator PIN. Only the operator can unlock their session.');
      return;
    }
    onSelectStaff(pendingStaffSwitch);
    setPendingStaffSwitch(null);
    setSwitchPinInput('');
    setSwitchPinVisible(false);
    setSwitchPinError(null);
  };

  const matchedActiveStaff = activeStaffMembers.find((s) =>
    currentUserName.toLowerCase().includes(s.name.toLowerCase())
  );
  const currentSelectValue =
    currentUserRole === 'customer'
      ? 'customer'
      : matchedActiveStaff
      ? `staff:${matchedActiveStaff.id}`
      : currentUserRole;

  const displayedUsername =
    authSession?.identifier ||
    (activePortal === 'main_app'
      ? 'Dixit3415d@gmail.com'
      : activePortal === 'customer_app'
      ? 'Customer Session'
      : matchedActiveStaff
      ? matchedActiveStaff.mobile
      : franchiseConfig.email || 'drightwellness.solan@gmail.com');

  const portalLabel =
    activePortal === 'main_app'
      ? 'Main Admin Portal'
      : activePortal === 'customer_app'
      ? 'Customer App'
      : `C&F App (${franchiseConfig.shortName || 'DRW'})`;

  const showMainAdminTab =
    isAdminVaultUnlocked || activePortal === 'main_app' || authSession?.role === 'super_admin';

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b-2 border-orange-500 text-slate-900 dark:text-white shadow-sm print:hidden">
      {/* Top Switcher Bar in Vibrant Orange & White */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white px-3 sm:px-6 py-1.5 shadow-xs">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-100 hidden sm:inline">
              Switch Portal:
            </span>
            <button
              type="button"
              onClick={() => onPortalChange('cnf_app')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-[11px] transition cursor-pointer ${
                activePortal === 'cnf_app'
                  ? 'bg-white text-orange-700 shadow-sm ring-2 ring-black/10'
                  : 'bg-orange-700/70 text-white hover:bg-orange-700 border border-orange-400/50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>1. C&amp;F App (Billing &amp; Stock)</span>
            </button>

            <button
              type="button"
              onClick={() => onPortalChange('customer_app')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-[11px] transition cursor-pointer ${
                activePortal === 'customer_app'
                  ? 'bg-white text-orange-700 shadow-sm ring-2 ring-black/10'
                  : 'bg-orange-700/70 text-white hover:bg-orange-700 border border-orange-400/50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>2. Customer App (Shop &amp; SP)</span>
            </button>

            {showMainAdminTab && (
              <button
                type="button"
                onClick={() => onPortalChange('main_app')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-black text-[11px] transition cursor-pointer ${
                  activePortal === 'main_app'
                    ? 'bg-white text-orange-700 shadow-sm ring-2 ring-black/10'
                    : 'bg-slate-900/90 text-amber-300 hover:bg-slate-900 border border-amber-400/50'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>3. Main Admin Vault</span>
              </button>
            )}

            {onOpenGitFit && (
              <button
                type="button"
                onClick={onOpenGitFit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/60 px-2.5 py-1 text-[11px] font-black shadow-xs transition cursor-pointer"
                title="Open GitFit App (Workout & Macro Tracker, Supplement POS Billing & GitFit Mode)"
              >
                <Dumbbell className="h-3.5 w-3.5 text-orange-400" />
                <span>💪 GitFit App</span>
              </button>
            )}

            {/* Dual WhatsApp Share (Direct Contact Picker + Specific Number) & Google Play Store Hub */}
            <button
              type="button"
              onClick={() => {
                setWhatsAppPlayStoreTab('whatsapp');
                setIsWhatsAppPlayStoreOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 text-[11px] font-black shadow-xs transition cursor-pointer"
              title="Share App Link on WhatsApp (Direct Contact Picker without number OR by entering number) & Google Play Store Package"
            >
              <Share2 className="h-3 w-3 text-emerald-600" />
              <span>📲 Share on WhatsApp / Play Store</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Active C&F Switcher & Registration Trigger */}
            {activePortal === 'cnf_app' && cnfAccounts.length > 0 && onSelectCnf && (
              <select
                value={franchiseConfig.id || franchiseConfig.name}
                onChange={(e) => {
                  if (e.target.value === '__register_new_cnf__') {
                    onOpenCnfSettings?.('register');
                    return;
                  }
                  const found = cnfAccounts.find(
                    (c) => c.id === e.target.value || c.name === e.target.value
                  );
                  if (found) onSelectCnf(found);
                }}
                className="rounded-lg bg-white text-orange-800 border border-orange-300 px-2 py-1 text-[11px] font-black focus:outline-none cursor-pointer shadow-2xs"
                title="Switch Active AWPL C&F or Register New C&F"
              >
                {cnfAccounts.map((c) => (
                  <option key={c.id || c.name} value={c.id || c.name} className="bg-white text-slate-900">
                    C&amp;F: {c.name} ({c.shortName || 'DRW'})
                  </option>
                ))}
                <option value="__register_new_cnf__" className="bg-orange-100 text-orange-900 font-black">
                  + Register New AWPL C&amp;F...
                </option>
              </select>
            )}

            {/* User Profile Dropdown Menu */}
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-1 text-[11px] font-black transition cursor-pointer shadow-xs"
                title="Open User Profile Menu (Account Info, Change 4-Digit PIN, Register & Log Out)"
              >
                <User className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                <span className="truncate max-w-[145px] font-mono tabular-nums">{displayedUsername}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-orange-600 transition-transform ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-300 dark:border-slate-700 shadow-2xl z-50 overflow-hidden text-slate-900 dark:text-white">
                  <div className="bg-orange-50 dark:bg-slate-800/80 px-4 py-3 border-b border-orange-200 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400">
                        Active Session · {portalLabel}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        PIN: ••••
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5 truncate">
                      {currentUserName}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300 truncate mt-0.5">
                      Username: {displayedUsername}
                    </p>
                  </div>

                  <div className="p-2 space-y-1 text-xs">
                    {onOpenAuthModal && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            onOpenAuthModal(activePortal, 'login');
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <KeyRound className="h-4 w-4 text-orange-600 shrink-0" />
                          <span>Switch Account / Portal Login</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            onOpenAuthModal(activePortal, 'change_pin');
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                          <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Change / Reset Secret 4-Digit PIN</span>
                        </button>

                        {activePortal !== 'main_app' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              onOpenAuthModal(activePortal, 'register');
                            }}
                            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <UserPlus className="h-4 w-4 text-orange-600 shrink-0" />
                            <span>Register New User (OTP + Approval Code)</span>
                          </button>
                        )}
                      </>
                    )}

                    {onResetToBrandNew && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsResetConfirmOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        <RotateCcw className="h-4 w-4 text-orange-600 shrink-0" />
                        <span>Reset App to Brand New</span>
                      </button>
                    )}

                    {onLogout && (
                      <div className="pt-1 mt-1 border-t border-orange-100 dark:border-slate-800 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setIsAdminVaultUnlocked(false);
                            onLogout();
                          }}
                          className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-black bg-red-600 hover:bg-red-700 text-white shadow-xs transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <LogOut className="h-4 w-4 text-white shrink-0" />
                            <span>Log Out Now</span>
                          </span>
                          <span className="text-[10px] font-bold text-red-100">Instant Sign Out →</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Always-Visible Log Out Button in Top Bar */}
            {onLogout && (
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white border border-red-400 px-2.5 py-1 text-[11px] font-black shadow-xs transition cursor-pointer"
                title="Log Out of Current User Session"
              >
                <LogOut className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Log Out</span>
              </button>
            )}

            {onOpenDeviceSync && (
              <button
                type="button"
                onClick={onOpenDeviceSync}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-700/80 hover:bg-orange-800 border border-orange-300/60 px-2 py-1 text-[11px] font-bold text-white transition cursor-pointer"
                title="Simultaneous Multi-Device Sync (Max 5 PCs + 1 Mobile)"
              >
                <Monitor className="h-3 w-3 text-amber-200" />
                <span className="hidden lg:inline">5 PC + 1 Mob</span>
              </button>
            )}

            {onOpenComplaint && (
              <button
                type="button"
                onClick={onOpenComplaint}
                className="inline-flex items-center gap-1 rounded-lg bg-white/95 hover:bg-white text-red-700 px-2 py-1 text-[11px] font-black transition cursor-pointer"
                title="Report / Complaint with Picture or PDF Upload"
              >
                <ShieldAlert className="h-3 w-3 text-red-600" />
                <span className="hidden xl:inline">Complaint</span>
              </button>
            )}

            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-700/80 hover:bg-orange-800 border border-orange-300/60 px-2 py-1 text-[11px] font-bold text-white transition cursor-pointer"
              >
                <MessageSquarePlus className="h-3 w-3" />
                <span className="hidden xl:inline">Feedback</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main White & Orange Branding Row */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 gap-2 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* App Logo: Orange Background + Bold Black "AWPL" (5 rapid clicks unlocks Main Admin Vault) */}
          <button
            type="button"
            onClick={handleLogoSecretClick}
            className="flex h-11 w-14 sm:h-11 sm:w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-500 text-black font-black shadow-md border-2 border-black select-none cursor-pointer"
            title="Official App Logo"
          >
            <span className="text-xs sm:text-sm font-black tracking-tighter leading-none text-black">
              {franchiseConfig.shortName === 'GFIT' ? 'GITFIT' : 'AWPL'}
            </span>
            <span className="text-[8px] font-black uppercase tracking-tight leading-none mt-0.5 text-black">
              {franchiseConfig.shortName === 'GFIT' ? 'PRO APP' : 'C&F BILL'}
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white truncate">
                {franchiseConfig.shortName === 'GFIT' ? 'GitFit App — ' : 'C&F Bill — '}
                <span className="text-orange-600 dark:text-orange-400">
                  {activePortal === 'main_app'
                    ? 'Main Admin Portal'
                    : activePortal === 'customer_app'
                    ? 'Customer App'
                    : franchiseConfig.name}
                </span>
              </h1>
              <button
                type="button"
                onClick={onOpenCertificate}
                className="inline-flex items-center gap-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition shadow-xs cursor-pointer shrink-0"
                title="View Official Certificate & Share Live App Links"
              >
                <ShieldCheck className="h-3 w-3" />
                <span>
                  {franchiseConfig.shortName === 'GFIT' ? 'GITFIT PRO VERIFIED' : 'OFFICIAL AWPL VERIFIED'}
                </span>
                <span className="text-[9px] bg-white text-orange-700 px-1 rounded font-black">
                  {franchiseConfig.shortName || 'DRW'}
                </span>
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5 truncate font-medium">
              {activePortal === 'cnf_app'
                ? `${franchiseConfig.name} (Prefix: ${franchiseConfig.shortName || 'DRW'} • Session ${
                    franchiseConfig.currentFinancialYear || franchiseConfig.financialYear || '2026-2027'
                  } • Starts #${franchiseConfig.startingInvoiceNumber || 3000}) • ${
                    franchiseConfig.isDrightWellness || franchiseConfig.infinityStockPermanent
                      ? '∞ Permanent Infinity Stock'
                      : franchiseConfig.infinityStockEnabled
                      ? '∞ Infinity Stock ON'
                      : 'Purchase Bill Stock'
                  }`
                : activePortal === 'customer_app'
                ? 'Customer Self-Ordering, UPI Checkout & AWPL ID Allocation Portal'
                : 'Super Admin Portal • Cloud Data, Subscription Settlement & Google Gemini'}
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallPrompt />

          {/* Online/Offline status */}
          <div
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              isOnline
                ? 'bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-950/50 dark:border-orange-700 dark:text-orange-300'
                : 'bg-amber-100 border-amber-500 text-amber-800 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 text-orange-600" />
                <span>Cloud Synced</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-600" />
                <span>Offline ({offlineQueueCount})</span>
              </>
            )}
          </div>

          {/* C&F Self-Service Bank / UPI QR & Registration Button */}
          {activePortal === 'cnf_app' && onOpenCnfSettings && (
            <button
              type="button"
              onClick={() => onOpenCnfSettings('settings')}
              className="inline-flex items-center gap-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-[11px] font-black shadow-xs transition cursor-pointer"
              title="Configure C&F Bank, Auto UPI QR, GSTIN, Approval Code & Register New C&F"
            >
              <Landmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">C&amp;F Setup / QR</span>
            </button>
          )}

          {/* Quick Add / Remove Staff Button (C&F App) */}
          {activePortal === 'cnf_app' && (
            <button
              type="button"
              onClick={onOpenStaffManager}
              className="inline-flex items-center gap-1 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 px-2.5 py-1.5 text-[11px] font-black transition cursor-pointer"
              title="Add or Remove Staff Members"
            >
              <UserCog className="h-3.5 w-3.5 text-orange-600" />
              <span className="hidden sm:inline">Staff</span>
            </button>
          )}

          {/* Active Staff Switcher (C&F App) */}
          {activePortal === 'cnf_app' && (
            <div className="flex items-center gap-1 rounded-xl bg-orange-50 dark:bg-slate-800 border border-orange-300 dark:border-slate-700 px-2 py-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-orange-600 shrink-0" />
              <select
                value={currentSelectValue}
                onChange={(e) => handleOperatorDropdownChange(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[165px] truncate"
                title="Switch Active C&F Staff Member (Requires Private PIN)"
              >
                <optgroup label="Active C&F Staff (PIN Protected)" className="text-slate-900 bg-white">
                  {activeStaffMembers.map((member) => (
                    <option
                      key={member.id}
                      value={`staff:${member.id}`}
                      className="text-slate-900 bg-white"
                    >
                      {member.name} ({member.employeeCode})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="C&F Role Modes" className="text-slate-900 bg-white">
                  <option value="franchise_admin" className="text-slate-900 bg-white">
                    C&amp;F Owner / Admin Mode
                  </option>
                  <option value="billing_staff" className="text-slate-900 bg-white">
                    POS Billing Staff Mode
                  </option>
                  <option value="support_staff" className="text-slate-900 bg-white">
                    C&amp;F Support Desk Mode
                  </option>
                  <option value="inventory_staff" className="text-slate-900 bg-white">
                    Inventory Staff Mode
                  </option>
                  <option value="__manage_staff__" className="text-orange-700 font-bold bg-orange-50">
                    + Add / Remove Staff...
                  </option>
                </optgroup>
              </select>
            </div>
          )}

          {onOpenShortcuts && activePortal === 'cnf_app' && (
            <button
              onClick={onOpenShortcuts}
              className="hidden md:flex items-center gap-1 rounded-xl p-2 text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition"
              title="PC Keyboard Shortcuts & USB Barcode Gun (Press ?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="hidden md:flex items-center rounded-xl p-2 text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition"
            title={isFullscreen ? 'Exit Fullscreen (F11)' : 'PC Fullscreen Mode (F11)'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4 text-orange-600" /> : <Maximize className="h-4 w-4" />}
          </button>

          <button
            onClick={onToggleDarkMode}
            className="rounded-xl p-2 text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition cursor-pointer"
            title={isDarkMode ? 'Switch to White & Orange Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-orange-500" /> : <Moon className="h-4 w-4" />}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={() => setIsLogoutConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-[11px] font-black shadow-xs transition cursor-pointer"
              title="Log Out from Active User Account"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Private Operator PIN Verification Modal when switching staff from Header */}
      {pendingStaffSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-orange-500 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-orange-600" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                    Private Operator Authentication
                  </span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Verify PIN for {pendingStaffSwitch.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingStaffSwitch(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyStaffSwitchPin} className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Enter the private 4-digit PIN known only to <strong>{pendingStaffSwitch.name}</strong> (
                <span className="font-mono">{pendingStaffSwitch.employeeCode}</span>):
              </p>

              {switchPinError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 p-2.5 text-red-700 dark:text-red-200 font-bold">
                  {switchPinError}
                </div>
              )}

              <div className="relative">
                <input
                  type={switchPinVisible ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  required
                  value={switchPinInput}
                  onChange={(e) => setSwitchPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full rounded-xl border-2 border-orange-400 bg-orange-50/30 dark:bg-slate-800 p-3 text-center font-mono font-black text-lg tracking-[0.5em]"
                />
                <button
                  type="button"
                  onClick={handleToggleSwitchPinPeek}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-600"
                  title="Peek PIN for 3 seconds"
                >
                  {switchPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingStaffSwitch(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black shadow"
                >
                  Verify &amp; Switch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Out Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-orange-500 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-orange-100 dark:bg-orange-950/60 border border-orange-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                  Confirm Sign Out · {portalLabel}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  Are you sure you want to log out?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  You are currently signed in as <strong>{currentUserName}</strong> (
                  <span className="font-mono tabular-nums font-bold text-orange-700 dark:text-orange-400">
                    {displayedUsername}
                  </span>
                  ). You can sign back in anytime using your Username and private 4-Digit PIN.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  setIsAdminVaultUnlocked(false);
                  onLogout?.();
                }}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-black shadow-md transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Yes, Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset App to Brand New Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-orange-500 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-orange-100 dark:bg-orange-950/60 border border-orange-300 flex items-center justify-center shrink-0">
                <RotateCcw className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                  Factory Reset · Brand New App State
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  Reset App to Brand New?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  This will clear all existing invoices, customers, staff, C&amp;F registrations, ledger entries, and cloud history, and reset your invoice numbering back to{' '}
                  <strong className="text-orange-600">Bill #3000</strong> while keeping all 66 official AWPL catalog products intact.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  onResetToBrandNew?.();
                }}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-2.5 text-xs font-black shadow-md transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Yes, Make Brand New</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual WhatsApp Share & Google Play Store Package Modal */}
      <WhatsAppAndPlayStoreModal
        isOpen={isWhatsAppPlayStoreOpen}
        onClose={() => setIsWhatsAppPlayStoreOpen(false)}
        franchiseConfig={franchiseConfig}
        initialTab={whatsAppPlayStoreTab}
      />
    </header>
  );
};
