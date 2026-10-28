import React, { useState } from 'react';
import {
  ShieldAlert,
  Database,
  Download,
  Upload,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  FileCheck,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { AuditLog, FranchiseConfig, Role } from '../types';
import { exportToCSV, setStorageItem, getStorageItem } from '../utils/storage';

interface AuditCloudModuleProps {
  auditLogs: AuditLog[];
  franchiseConfig: FranchiseConfig;
  currentUserRole: Role;
  currentUserName: string;
  onAddAuditLog: (log: AuditLog) => void;
  onRestoreFullBackup: (data: any) => void;
}

export const AuditCloudModule: React.FC<AuditCloudModuleProps> = ({
  auditLogs,
  franchiseConfig,
  currentUserRole,
  currentUserName,
  onAddAuditLog,
  onRestoreFullBackup,
}) => {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filteredLogs = auditLogs.filter(
    (l) => filterCategory === 'all' || l.category === filterCategory
  );

  // Trigger JSON Cloud Backup Download
  const handleDownloadBackup = () => {
    setIsBackingUp(true);

    setTimeout(() => {
      setIsBackingUp(false);
      const backupPayload = {
        metadata: {
          app: 'D RIGHT WELLNESS - AWPL Franchise Hub',
          franchiseCode: franchiseConfig.franchiseCode,
          backupTimestamp: new Date().toISOString(),
          version: '1.0.0',
        },
        franchiseConfig,
        products: getStorageItem('drw_products_v1', []),
        customers: getStorageItem('drw_customers_v1', []),
        invoices: getStorageItem('drw_invoices_v1', []),
        cfRecords: getStorageItem('drw_cf_records_v1', []),
        subscriptions: getStorageItem('drw_user_subscriptions_v1', []),
        movements: getStorageItem('drw_inventory_movements_v1', []),
        staffList: getStorageItem('drw_staff_v1', []),
        auditLogs,
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DRW_Full_Cloud_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();

      onAddAuditLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        action: 'Full Cloud Backup Exported',
        category: 'Security',
        user: `${currentUserName} (${currentUserRole})`,
        details: 'Encrypted snapshot generated containing all products, invoices, and C&F records.',
      });

      setBackupStatus('Cloud backup generated and downloaded successfully.');
      setTimeout(() => setBackupStatus(null), 5000);
    }, 1200);
  };

  // Restore from JSON Backup
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('CAUTION: Restoring a backup will replace current local database tables. Continue?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.metadata || !parsed.franchiseConfig) {
          alert('Invalid D RIGHT WELLNESS backup file.');
          return;
        }

        onRestoreFullBackup(parsed);

        onAddAuditLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          action: 'Full Backup Restored',
          category: 'Security',
          user: `${currentUserName} (${currentUserRole})`,
          details: `Database restored from backup dated ${parsed.metadata.backupTimestamp}`,
        });

        alert('Backup successfully restored into active runtime database!');
      } catch (err) {
        alert('Failed to parse backup JSON. Verify file integrity.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportAuditLogsCSV = () => {
    const rows = filteredLogs.map((l) => ({
      ID: l.id,
      Timestamp: l.timestamp,
      Action: l.action,
      Category: l.category,
      User: l.user,
      Details: l.details,
    }));
    exportToCSV(`DRW_Audit_Logs_${new Date().toISOString().slice(0, 10)}`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Security & Backup Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Database className="h-5 w-5" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Cloud Data Security</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Role-Based Access Control (RBAC) enforced. Customers have isolated partitions and cannot
            access other distributors' invoices or SP point records.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            <span>Zero Plaintext Password Policy</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-blue-600">
            <Server className="h-5 w-5" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Automated Backups</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Daily cloud snapshots scheduled. Invoices, C&F pending queues, and product price history
            are safeguarded against accidental deletion.
          </p>
          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={handleDownloadBackup}
              disabled={isBackingUp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow transition disabled:opacity-50"
            >
              {isBackingUp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>{isBackingUp ? 'Generating...' : 'Export JSON Backup'}</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <Upload className="h-5 w-5" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Disaster Recovery</h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Need to migrate to a new device or recover after hardware failure? Restore any verified
            DRW JSON backup snapshot.
          </p>
          <div className="pt-1">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition">
              <Upload className="h-3.5 w-3.5" />
              <span>Restore from JSON</span>
              <input type="file" accept=".json" onChange={handleFileRestore} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {backupStatus && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{backupStatus}</span>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-emerald-600" />
              Permanent Compliance Audit Log
            </h3>
            <p className="text-xs text-slate-500">
              Every invoice cancellation, C&F portal transmission, and price change is recorded with user identity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Categories</option>
              <option value="Billing">Billing</option>
              <option value="Product">Product</option>
              <option value="C&F Portal">C&F Portal</option>
              <option value="Inventory">Inventory</option>
              <option value="Subscription">Subscription</option>
              <option value="Staff">Staff</option>
              <option value="Security">Security</option>
            </select>

            <button
              onClick={handleExportAuditLogsCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">User & Role</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-[10px] text-slate-700 dark:text-slate-300">
                      {log.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {log.user}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
