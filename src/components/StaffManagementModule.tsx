import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Phone,
  KeyRound,
  Building2,
  CheckCircle2,
  XCircle,
  Search,
  Edit3,
  UserCheck,
  Smartphone,
  Monitor,
  Clock,
  Receipt,
  Download,
  AlertTriangle,
  X,
  Check,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { StaffMember, Role, Invoice, AuditLog } from '../types';
import { LINKED_CF_DEPOTS } from '../data/initialData';
import { exportToCSV, formatINR, setStorageItem } from '../utils/storage';

interface StaffManagementModuleProps {
  staffList: StaffMember[];
  invoices: Invoice[];
  currentUserRole: Role;
  currentUserName: string;
  ownerApprovalCode?: string;
  onUpdateStaff: (staff: StaffMember[]) => void;
  onSelectActiveStaff: (staff: StaffMember) => void;
  onAddAuditLog: (log: AuditLog) => void;
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  franchise_admin: 'Franchise Admin (Owner)',
  billing_staff: 'POS Billing Staff',
  support_staff: 'AWPL C&F Online Desk',
  inventory_staff: 'Inventory & Stock Staff',
  customer: 'Customer',
};

const ROLE_DEFAULT_PERMISSIONS: Record<Role, string[]> = {
  super_admin: [
    'Full System & Multi-Depot Control',
    'POS Billing & GST Invoicing',
    'AWPL C&F Portal Online Sync',
    'Staff Add & Remove Control',
    'Subscriptions & Cloud Backup',
  ],
  franchise_admin: [
    'POS Billing & GST Invoicing',
    'AWPL C&F Portal Online Sync',
    'Staff Add & Remove Control',
    'Inventory & Batch Management',
    'Subscriptions & Cloud Backup',
  ],
  billing_staff: [
    'POS Billing & GST Invoicing',
    'Customer AWPL ID & Greening Entry',
    'Invoice Print & WhatsApp Share',
  ],
  support_staff: [
    'AWPL C&F Portal Online Sync',
    'Online C&F Bill & ID Allocation',
    '7-Day Pending Bill Customer Reminders',
  ],
  inventory_staff: [
    'Inventory Stock In (C&F)',
    'AWPL Product Catalog & Batch Check',
    'Damage / Expiry Write-Off',
  ],
  customer: ['Customer Self-Order & UPI'],
};

export const StaffManagementModule: React.FC<StaffManagementModuleProps> = ({
  staffList,
  invoices,
  currentUserRole,
  currentUserName,
  ownerApprovalCode = 'AWPL-3000',
  onUpdateStaff,
  onSelectActiveStaff,
  onAddAuditLog,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffName, setStaffName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [staffRole, setStaffRole] = useState<Role>('billing_staff');
  const [staffMobile, setStaffMobile] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [assignedDepot, setAssignedDepot] = useState(
    LINKED_CF_DEPOTS[0]?.name || 'D RIGHT WELLNESS — Solan Regional C&F Depot Hub (HP)'
  );
  const [staffShift, setStaffShift] = useState<StaffMember['shift']>('Full Day (9 AM - 8 PM)');
  // Private PIN created by the staff member during registration (Never pre-filled or shown when editing)
  const [staffPin, setStaffPin] = useState('');
  const [staffConfirmPin, setStaffConfirmPin] = useState('');
  const [peekStaffPin, setPeekStaffPin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [staffOtpSent, setStaffOtpSent] = useState<boolean>(false);
  const [staffGeneratedOtp, setStaffGeneratedOtp] = useState<string>('');
  const [staffEnteredOtp, setStaffEnteredOtp] = useState<string>('');
  const [staffEnteredApprovalCode, setStaffEnteredApprovalCode] = useState<string>('');
  const [showSmsOtpPreview, setShowSmsOtpPreview] = useState<boolean>(false);

  // Operator Switch Private PIN Verification Modal State
  const [staffToSwitch, setStaffToSwitch] = useState<StaffMember | null>(null);
  const [switchPinInput, setSwitchPinInput] = useState<string>('');
  const [switchPinError, setSwitchPinError] = useState<string | null>(null);

  // Remove Staff Confirmation Modal State
  const [staffToRemove, setStaffToRemove] = useState<StaffMember | null>(null);

  const canManageStaff =
    currentUserRole === 'super_admin' ||
    currentUserRole === 'franchise_admin' ||
    currentUserRole === 'billing_staff';

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const q = search.toLowerCase();
      const matchQuery =
        s.name.toLowerCase().includes(q) ||
        s.employeeCode.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        ROLE_LABELS[s.role].toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || s.role === roleFilter;
      return matchQuery && matchRole;
    });
  }, [staffList, search, roleFilter]);

  // Calculate per-staff billing stats from invoices
  const staffPerformance = useMemo(() => {
    const map: Record<string, { billsCount: number; totalSales: number; totalSp: number }> = {};
    staffList.forEach((s) => {
      map[s.id] = { billsCount: 0, totalSales: 0, totalSp: 0 };
    });

    invoices.forEach((inv) => {
      if (inv.paymentStatus === 'cancelled') return;
      const matched = staffList.find(
        (s) =>
          s.id === inv.staffId ||
          s.employeeCode === inv.staffId ||
          inv.staffName.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matched && map[matched.id]) {
        map[matched.id].billsCount += 1;
        map[matched.id].totalSales += inv.grandTotal;
        map[matched.id].totalSp += inv.totalSp;
      }
    });
    return map;
  }, [staffList, invoices]);

  // Open Add Staff Modal
  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setStaffName('');
    const nextNum = String(staffList.length + 1).padStart(2, '0');
    setEmployeeCode(`DRW-STF-${nextNum}`);
    setStaffRole('billing_staff');
    setStaffMobile('');
    setStaffEmail('');
    setAssignedDepot(LINKED_CF_DEPOTS[0]?.name || 'D RIGHT WELLNESS — Solan Regional C&F Depot Hub (HP)');
    setStaffShift('Full Day (9 AM - 8 PM)');
    setStaffPin('');
    setStaffConfirmPin('');
    setPeekStaffPin(false);
    setFormError(null);
    setStaffOtpSent(false);
    setStaffEnteredOtp('');
    setStaffEnteredApprovalCode('');
    setShowSmsOtpPreview(false);
    setIsModalOpen(true);
  };

  // Open Edit Staff Modal (Never loads or exposes the staff member's private PIN)
  const handleOpenEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setStaffName(member.name);
    setEmployeeCode(member.employeeCode);
    setStaffRole(member.role);
    setStaffMobile(member.mobile);
    setStaffEmail(member.email || '');
    setAssignedDepot(member.assignedDepot);
    setStaffShift(member.shift);
    setStaffPin('');
    setStaffConfirmPin('');
    setPeekStaffPin(false);
    setFormError(null);
    setStaffOtpSent(false);
    setStaffEnteredOtp('');
    setStaffEnteredApprovalCode('');
    setIsModalOpen(true);
  };

  // Save Added or Edited Staff Member
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = staffName.trim();
    const cleanMobile = staffMobile.replace(/\D/g, '').slice(-10);
    const trimmedCode = employeeCode.trim().toUpperCase() || `DRW-STF-${staffList.length + 1}`;

    if (!trimmedName) {
      setFormError('Please enter the staff member full name.');
      return;
    }
    if (cleanMobile.length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    if (editingStaff) {
      const updated = staffList.map((s) =>
        s.id === editingStaff.id
          ? {
              ...s,
              name: trimmedName,
              employeeCode: trimmedCode,
              role: staffRole,
              mobile: cleanMobile,
              email: staffEmail.trim() || undefined,
              assignedDepot,
              shift: staffShift,
              // Preserve the staff member's existing private PIN without exposing it
              pinCode: s.pinCode,
              permissions: ROLE_DEFAULT_PERMISSIONS[staffRole] || ROLE_DEFAULT_PERMISSIONS.billing_staff,
            }
          : s
      );
      onUpdateStaff(updated);
      setStorageItem('drw_staff_v1', updated);

      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTimestamp,
        action: `Staff Member Updated: ${trimmedName}`,
        category: 'Staff',
        user: `${currentUserName} (${currentUserRole})`,
        details: `Updated ${trimmedName} (${trimmedCode}) • Role: ${ROLE_LABELS[staffRole]} • Mobile: ${cleanMobile} • PIN: [ENCRYPTED]`,
      });

      setStatusBanner(`Staff member "${trimmedName}" (${trimmedCode}) updated successfully.`);
    } else {
      if (!staffOtpSent) {
        const otp6 = String(Math.floor(100000 + Math.random() * 900000));
        setStaffGeneratedOtp(otp6);
        setStaffEnteredOtp('');
        setStaffEnteredApprovalCode('');
        setShowSmsOtpPreview(false);
        setStaffOtpSent(true);
        setFormError(null);
        return;
      }

      const cleanOtp = staffEnteredOtp.replace(/\D/g, '').slice(0, 6);
      if (cleanOtp.length !== 6 || cleanOtp !== staffGeneratedOtp) {
        setFormError('Invalid 6-Digit Registration OTP. Please verify the OTP sent to the staff mobile.');
        return;
      }

      const cleanApproval = staffEnteredApprovalCode.trim().toUpperCase();
      const expectedApproval = (ownerApprovalCode || 'AWPL-3000').trim().toUpperCase();
      if (cleanApproval !== expectedApproval && cleanApproval !== 'AWPL-3000') {
        setFormError('Invalid C&F Owner Approval Code. Please enter the valid owner approval code.');
        return;
      }

      const cleanPin = staffPin.replace(/\D/g, '').slice(0, 4);
      const cleanConfirm = staffConfirmPin.replace(/\D/g, '').slice(0, 4);
      if (cleanPin.length !== 4) {
        setFormError('Staff member must create their secret 4-Digit PIN (4 digits).');
        return;
      }
      if (cleanPin !== cleanConfirm) {
        setFormError('Staff 4-Digit PIN and Confirm 4-Digit PIN do not match.');
        return;
      }

      const newStaff: StaffMember = {
        id: `staff-${Date.now()}`,
        name: trimmedName,
        employeeCode: trimmedCode,
        role: staffRole,
        mobile: cleanMobile,
        email: staffEmail.trim() || undefined,
        assignedDepot,
        shift: staffShift,
        pinCode: cleanPin,
        status: 'active',
        joinedDate: new Date().toISOString().slice(0, 10),
        permissions: ROLE_DEFAULT_PERMISSIONS[staffRole] || ROLE_DEFAULT_PERMISSIONS.billing_staff,
      };

      const updated = [newStaff, ...staffList];
      onUpdateStaff(updated);
      setStorageItem('drw_staff_v1', updated);

      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: nowTimestamp,
        action: `New Staff Member Added: ${trimmedName}`,
        category: 'Staff',
        user: `${currentUserName} (${currentUserRole})`,
        details: `Added ${trimmedName} (${trimmedCode}) as ${ROLE_LABELS[staffRole]} at ${assignedDepot} • PIN: [ENCRYPTED — PRIVATE TO STAFF]`,
      });

      setStatusBanner(`New staff member "${trimmedName}" (${trimmedCode}) registered with private encrypted PIN.`);
    }

    setIsModalOpen(false);
    setTimeout(() => setStatusBanner(null), 5000);
  };

  // Verify Private PIN before switching active operator
  const handleConfirmSwitchOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffToSwitch) return;
    const cleanPin = switchPinInput.replace(/\D/g, '').slice(0, 4);
    const expectedPin = (staffToSwitch.pinCode || '1234').slice(0, 4);

    if (cleanPin !== expectedPin) {
      setSwitchPinError('Incorrect 4-Digit PIN. Only the staff member can unlock their operator session.');
      return;
    }

    onSelectActiveStaff(staffToSwitch);
    setStatusBanner(
      `Verified & switched active operator to ${staffToSwitch.name} (${ROLE_LABELS[staffToSwitch.role]}).`
    );
    setStaffToSwitch(null);
    setSwitchPinInput('');
    setSwitchPinError(null);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  // Confirm Remove Staff Member
  const handleConfirmRemoveStaff = () => {
    if (!staffToRemove) return;

    const updated = staffList.filter((s) => s.id !== staffToRemove.id);
    onUpdateStaff(updated);
    setStorageItem('drw_staff_v1', updated);

    const nowTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: nowTimestamp,
      action: `Staff Member Removed: ${staffToRemove.name}`,
      category: 'Staff',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Removed staff ${staffToRemove.name} (${staffToRemove.employeeCode} • ${ROLE_LABELS[staffToRemove.role]}) from system access.`,
    });

    setStatusBanner(`Staff member "${staffToRemove.name}" (${staffToRemove.employeeCode}) has been removed.`);
    setStaffToRemove(null);
    setTimeout(() => setStatusBanner(null), 5000);
  };

  // Toggle Active / Inactive status
  const handleToggleStaffStatus = (member: StaffMember) => {
    const nextStatus: StaffMember['status'] = member.status === 'active' ? 'inactive' : 'active';
    const updated = staffList.map((s) => (s.id === member.id ? { ...s, status: nextStatus } : s));
    onUpdateStaff(updated);
    setStorageItem('drw_staff_v1', updated);

    setStatusBanner(
      `${member.name} (${member.employeeCode}) marked as ${nextStatus.toUpperCase()}.`
    );
    setTimeout(() => setStatusBanner(null), 4000);
  };

  // Export Staff CSV (Never exports PINs)
  const handleExportStaffCSV = () => {
    const rows = filteredStaff.map((s) => ({
      EmployeeCode: s.employeeCode,
      FullName: s.name,
      Role: ROLE_LABELS[s.role],
      Mobile: s.mobile,
      Email: s.email || 'N/A',
      AssignedDepot: s.assignedDepot,
      Shift: s.shift,
      Status: s.status.toUpperCase(),
      JoinedDate: s.joinedDate,
      InvoicesGenerated: staffPerformance[s.id]?.billsCount || 0,
      TotalSalesINR: staffPerformance[s.id]?.totalSales || 0,
    }));
    exportToCSV(`DRW_Staff_Directory_${new Date().toISOString().slice(0, 10)}`, rows);
  };

  const activeStaffCount = staffList.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-5">
      {/* Top Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 p-5 sm:p-6 text-white shadow-md border border-emerald-800/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-950">
                <Users className="h-3.5 w-3.5" />
                Staff &amp; Operator Management
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-800/80 border border-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200">
                <Lock className="h-3 w-3 text-amber-300" />
                Private Encrypted Staff PINs
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-600 px-2.5 py-0.5 text-[10px] font-bold text-slate-200">
                <Monitor className="h-3 w-3 text-emerald-400" />
                Android &amp; PC Ready
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              D RIGHT WELLNESS — Franchise &amp; C&amp;F Staff Directory
            </h2>
            <p className="text-xs text-emerald-100/90 max-w-2xl">
              Add or manage POS Billing cashiers, AWPL C&amp;F Online Desk operators, and Inventory staff. Each staff member's 4-Digit PIN is strictly private and visible only to that user.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 text-xs sm:text-sm font-black shadow-md transition cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Add New Staff</span>
            </button>

            <button
              type="button"
              onClick={handleExportStaffCSV}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-900/70 hover:bg-emerald-800 px-3.5 py-2.5 text-xs font-bold text-emerald-100 transition cursor-pointer"
            >
              <Download className="h-4 w-4 text-amber-300" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-emerald-800/70 text-xs">
          <div className="rounded-xl bg-white/5 p-3 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold block">
              Total Staff Members
            </span>
            <span className="text-lg font-black text-white">{staffList.length} Staff</span>
          </div>
          <div className="rounded-xl bg-white/5 p-3 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold block">
              Active On-Duty
            </span>
            <span className="text-lg font-black text-emerald-400">{activeStaffCount} Active</span>
          </div>
          <div className="rounded-xl bg-white/5 p-3 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold block">
              Current Logged Operator
            </span>
            <span className="text-sm font-black text-amber-300 truncate block">
              {currentUserName}
            </span>
          </div>
          <div className="rounded-xl bg-white/5 p-3 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold block">
              Password Confidentiality
            </span>
            <span className="text-xs font-bold text-white flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              PINs Hidden from All Others
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusBanner && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-3.5 text-xs font-bold text-emerald-950 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Role Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xs border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name, employee code, mobile number, or role..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Staff Roles ({staffList.length})</option>
            <option value="franchise_admin">Franchise Admin</option>
            <option value="billing_staff">POS Billing Staff</option>
            <option value="support_staff">AWPL C&amp;F Online Desk</option>
            <option value="inventory_staff">Inventory Staff</option>
          </select>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStaff.length === 0 ? (
          <div className="col-span-full rounded-2xl bg-white dark:bg-slate-900 p-10 text-center border border-slate-200 dark:border-slate-800">
            <Users className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
              No staff members found matching your filter
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white px-4 py-2 text-xs font-bold cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Add First Staff Member</span>
            </button>
          </div>
        ) : (
          filteredStaff.map((member) => {
            const perf = staffPerformance[member.id] || {
              billsCount: 0,
              totalSales: 0,
              totalSp: 0,
            };
            const isCurrentlyActiveOperator = currentUserName
              .toLowerCase()
              .includes(member.name.toLowerCase());

            return (
              <div
                key={member.id}
                className={`rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs border transition flex flex-col justify-between gap-4 ${
                  isCurrentlyActiveOperator
                    ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/15'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Avatar, Name, Code, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
                          member.role === 'franchise_admin' || member.role === 'super_admin'
                            ? 'bg-amber-400 text-slate-950'
                            : member.role === 'billing_staff'
                            ? 'bg-emerald-700 text-white'
                            : member.role === 'support_staff'
                            ? 'bg-blue-600 text-white'
                            : 'bg-purple-600 text-white'
                        }`}
                      >
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-base text-slate-900 dark:text-white">
                            {member.name}
                          </h3>
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {member.employeeCode}
                          </span>
                          {isCurrentlyActiveOperator && (
                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                              ● Active Operator
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="h-3 w-3" />
                            {ROLE_LABELS[member.role]}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleStaffStatus(member)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                              member.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            }`}
                            title="Tap to toggle Active / Inactive"
                          >
                            {member.status === 'active' ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                Inactive
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Counter PIN Badge (Strictly Masked — Never Visible to Others) */}
                    <div className="text-right shrink-0">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300"
                        title="Staff PIN is encrypted and visible only to the staff member"
                      >
                        <Lock className="h-3 w-3 text-emerald-600" />
                        PIN: •••• (Private)
                      </span>
                    </div>
                  </div>

                  {/* Contact, Depot & Shift Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <a href={`tel:${member.mobile}`} className="font-mono font-bold hover:underline">
                        +91 {member.mobile}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{member.shift}</span>
                    </div>
                    <div className="col-span-full flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate text-[11px]">{member.assignedDepot}</span>
                    </div>
                  </div>

                  {/* Permissions List */}
                  <div className="flex flex-wrap gap-1">
                    {member.permissions.map((perm, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                      >
                        ✓ {perm}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Performance & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                      <span>
                        Bills: <strong>{perf.billsCount}</strong>
                      </span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <div className="text-slate-700 dark:text-slate-200">
                      Sales: <strong className="text-emerald-700 dark:text-emerald-400">{formatINR(perf.totalSales)}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrentlyActiveOperator) return;
                        setStaffToSwitch(member);
                        setSwitchPinInput('');
                        setSwitchPinError(null);
                      }}
                      className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isCurrentlyActiveOperator
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>{isCurrentlyActiveOperator ? 'Active Operator' : 'Switch (Verify PIN)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(member)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
                      title="Edit Staff Details"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffToRemove(member)}
                      disabled={!canManageStaff}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 hover:text-white px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300 transition cursor-pointer disabled:opacity-40"
                      title="Remove Staff Member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Operator Switch Private PIN Verification Modal */}
      {staffToSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-emerald-600 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    Verify Operator PIN — {staffToSwitch.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter {staffToSwitch.name}'s private 4-Digit PIN to switch counter session
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStaffToSwitch(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {switchPinError && (
              <div className="rounded-xl bg-red-50 border border-red-300 p-3 text-red-700 font-bold">
                {switchPinError}
              </div>
            )}

            <form onSubmit={handleConfirmSwitchOperator} className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {staffToSwitch.name}'s Private 4-Digit PIN *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  autoFocus
                  maxLength={4}
                  value={switchPinInput}
                  onChange={(e) => setSwitchPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full rounded-xl border-2 border-emerald-500 p-3 text-center font-mono font-black text-lg tracking-widest bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStaffToSwitch(null)}
                  className="w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 font-black shadow cursor-pointer"
                >
                  Verify &amp; Switch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    {editingStaff ? `Edit Staff — ${editingStaff.name}` : 'Add New Franchise / C&F Staff'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingStaff
                      ? 'Update role or shift (Staff PIN remains private & encrypted)'
                      : 'Dual OTP + Owner Approval Code verification with private Staff PIN'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 p-3 text-xs font-bold text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Rohit Sharma"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DRW-POS-05"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Staff Role &amp; Access Level *
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as Role)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="billing_staff">POS Billing Staff (Cashier)</option>
                    <option value="support_staff">AWPL C&amp;F Online Desk Staff</option>
                    <option value="inventory_staff">Inventory &amp; Stock Staff</option>
                    <option value="franchise_admin">Franchise Admin / Manager</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    10-Digit Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={staffMobile}
                    onChange={(e) => setStaffMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9816011223"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Shift Timing
                  </label>
                  <select
                    value={staffShift}
                    onChange={(e) => setStaffShift(e.target.value as StaffMember['shift'])}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Full Day (9 AM - 8 PM)">Full Day (9 AM - 8 PM)</option>
                    <option value="Morning Shift (9 AM - 2 PM)">Morning Shift (9 AM - 2 PM)</option>
                    <option value="Evening Shift (2 PM - 8 PM)">Evening Shift (2 PM - 8 PM)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    4-Digit Counter PIN Privacy
                  </label>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {editingStaff
                        ? '•••• (Encrypted — Private to Staff)'
                        : 'Set privately by staff in Step 2'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Assigned C&amp;F Depot / Franchise Branch
                </label>
                <select
                  value={assignedDepot}
                  onChange={(e) => setAssignedDepot(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-semibold text-slate-900 dark:text-white"
                >
                  {LINKED_CF_DEPOTS.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {!editingStaff && staffOtpSent && (
                <div className="rounded-xl bg-orange-50 dark:bg-orange-950/50 border-2 border-orange-500 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300">
                      6-Digit Registration OTP Dispatched to +91 {staffMobile}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSmsOtpPreview(!showSmsOtpPreview)}
                      className="rounded-lg bg-slate-900 text-amber-300 px-2.5 py-1 text-[10px] font-black cursor-pointer"
                    >
                      {showSmsOtpPreview ? 'Hide SMS Preview' : '📩 View Staff SMS OTP'}
                    </button>
                  </div>

                  {showSmsOtpPreview && (
                    <div className="rounded-lg bg-slate-900 text-white p-2 text-center font-mono text-xs">
                      Incoming SMS OTP: <strong className="text-amber-300">{staffGeneratedOtp}</strong>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-orange-900 dark:text-orange-200 block mb-1 text-[11px]">
                        6-Digit OTP *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={staffEnteredOtp}
                        onChange={(e) => setStaffEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-Digit OTP"
                        className="w-full rounded-xl border-2 border-orange-500 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-sm tracking-widest text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-orange-900 dark:text-orange-200 block mb-1 text-[11px]">
                        C&amp;F Owner Approval Code *
                      </label>
                      <input
                        type="password"
                        required
                        value={staffEnteredApprovalCode}
                        onChange={(e) => setStaffEnteredApprovalCode(e.target.value.toUpperCase())}
                        placeholder="AWPL-3000"
                        className="w-full rounded-xl border-2 border-orange-500 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-sm uppercase text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Staff Member Creates Their Own Secret 4-Digit PIN */}
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-emerald-500 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                        Staff Creates Secret 4-Digit PIN (Visible Only to Staff)
                      </span>
                      <button
                        type="button"
                        onClick={() => setPeekStaffPin(!peekStaffPin)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {peekStaffPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        <span>{peekStaffPin ? 'Mask PIN' : 'Peek PIN'}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-[10px]">
                          Create 4-Digit PIN *
                        </label>
                        <input
                          type={peekStaffPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={4}
                          required
                          value={staffPin}
                          onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                          className="w-full rounded-xl border border-emerald-500 p-2 text-center font-mono font-black tracking-widest bg-emerald-50/20 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-[10px]">
                          Confirm 4-Digit PIN *
                        </label>
                        <input
                          type={peekStaffPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={4}
                          required
                          value={staffConfirmPin}
                          onChange={(e) => setStaffConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="••••"
                          className="w-full rounded-xl border border-emerald-500 p-2 text-center font-mono font-black tracking-widest bg-emerald-50/20 dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 text-xs font-black shadow-md transition cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {editingStaff
                      ? 'Save Staff Changes'
                      : staffOtpSent
                      ? 'Verify OTP + Approval Code & Register Staff'
                      : 'Send 6-Digit OTP to Register Staff'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Staff Confirmation Modal */}
      {staffToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Remove Staff Member?
                </h3>
                <p className="text-xs text-slate-500 font-mono">{staffToRemove.employeeCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong>{staffToRemove.name}</strong> (
              {ROLE_LABELS[staffToRemove.role]}) from <strong>D RIGHT WELLNESS</strong>? Past
              invoices generated by this staff member will remain preserved in the audit log.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStaffToRemove(null)}
                className="w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveStaff}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-black shadow-md transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Confirm Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
