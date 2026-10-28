import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Smartphone,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  Wifi
} from 'lucide-react';
import { ConnectedDeviceSession, FranchiseConfig } from '../types';
import { saveToCloudBackup } from '../utils/storage';

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseConfig: FranchiseConfig;
  operatorName: string;
  onPullCloudState: () => void;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({
  isOpen,
  onClose,
  franchiseConfig,
  operatorName,
  onPullCloudState,
}) => {
  const [devices, setDevices] = useState<ConnectedDeviceSession[]>([]);
  const [pcCount, setPcCount] = useState(0);
  const [mobileCount, setMobileCount] = useState(0);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [simDeviceName, setSimDeviceName] = useState('');
  const [simDeviceType, setSimDeviceType] = useState<'pc' | 'mobile'>('pc');

  const currentDeviceId = (() => {
    if (typeof window === 'undefined') return 'dev-pc-main';
    let id = localStorage.getItem('drw_this_device_id');
    if (!id) {
      const isMob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
      id = `dev-${isMob ? 'mob' : 'pc'}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('drw_this_device_id', id);
    }
    return id;
  })();

  const fetchDevices = async () => {
    try {
      const res = await fetch(
        `/api/cloud/devices?cnfId=${encodeURIComponent(franchiseConfig.id || 'cnf-dright-solan')}`
      );
      const data = await res.json();
      if (data.ok) {
        setDevices(data.devices || []);
        setPcCount(data.pcCount || 0);
        setMobileCount(data.mobileCount || 0);
      }
    } catch {
      // Fallback local list
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen, franchiseConfig.id]);

  if (!isOpen) return null;

  const handleAddSimulatedDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLimitError(null);
    const name =
      simDeviceName.trim() ||
      (simDeviceType === 'pc'
        ? `Billing Counter PC #${pcCount + 1}`
        : `Franchise Owner Android Mobile`);

    try {
      const res = await fetch('/api/cloud/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `dev-${simDeviceType}-${Date.now()}`,
          cnfId: franchiseConfig.id || 'cnf-dright-solan',
          deviceType: simDeviceType,
          deviceName: name,
          platformInfo: simDeviceType === 'pc' ? 'Windows 11 / Desktop POS' : 'Android 14 Mobile App',
          operatorName,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.limitReached) {
        setLimitError(
          data.error ||
            `Device limit reached! Only 5 PCs and 1 Mobile can be used at the same time.`
        );
      } else {
        setDevices(data.devices || []);
        setPcCount(data.pcCount || 0);
        setMobileCount(data.mobileCount || 0);
        setSimDeviceName('');
        setSyncToast(`Connected ${name} (${simDeviceType.toUpperCase()}) with real-time cloud sync!`);
        setTimeout(() => setSyncToast(null), 3500);
      }
    } catch (err: any) {
      setLimitError(err?.message || 'Unable to register device.');
    }
  };

  const handleDisconnectDevice = async (id: string) => {
    try {
      const res = await fetch(
        `/api/cloud/devices/${encodeURIComponent(id)}?cnfId=${encodeURIComponent(
          franchiseConfig.id || 'cnf-dright-solan'
        )}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.ok) {
        setDevices(data.devices || []);
        setLimitError(null);
        fetchDevices();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500 text-black flex items-center justify-center font-black">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                Official Multi-Device Cloud Sync • Max 5 PC Terminals + 1 Mobile App
              </span>
              <h2 className="text-base sm:text-lg font-black mt-0.5">
                Connected PC & Mobile Devices — {franchiseConfig.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {/* Device Quota Gauges: Max 5 PCs + Max 1 Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="h-8 w-8 text-emerald-700 dark:text-emerald-400" />
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                    PC App Sessions (Max 5 PCs)
                  </span>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {pcCount} / 5 PCs Active
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Simultaneous POS billing & stock sync
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                  pcCount >= 5 ? 'bg-red-600 text-white' : 'bg-emerald-700 text-white'
                }`}
              >
                {pcCount >= 5 ? '5/5 Full' : `${5 - pcCount} Slot Free`}
              </span>
            </div>

            <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-8 w-8 text-indigo-700 dark:text-indigo-400" />
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-300">
                    Mobile App Session (Max 1 Mobile)
                  </span>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {mobileCount} / 1 Mobile Active
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Android / Mobile Live Sync
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                  mobileCount >= 1 ? 'bg-amber-500 text-black' : 'bg-indigo-600 text-white'
                }`}
              >
                {mobileCount >= 1 ? '1/1 Active' : '1 Slot Free'}
              </span>
            </div>
          </div>

          {limitError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/70 border-2 border-red-500 p-3.5 text-red-900 dark:text-red-200 font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{limitError}</span>
            </div>
          )}

          {syncToast && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-3 text-emerald-900 dark:text-emerald-200 font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{syncToast}</span>
            </div>
          )}

          {/* Active Connected Devices Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Simultaneously Connected Devices ({devices.length} / 6 Total Allowed)
              </h4>
              <button
                type="button"
                onClick={() => {
                  saveToCloudBackup();
                  onPullCloudState();
                  fetchDevices();
                  setSyncToast('Synced all bills, stock, ledgers & complaints across all connected PCs and Mobile!');
                  setTimeout(() => setSyncToast(null), 3000);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 font-black text-[11px] shadow"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync All Devices Now</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {devices.map((d) => {
                const isThis = d.id === currentDeviceId;
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-3">
                      {d.deviceType === 'mobile' ? (
                        <Smartphone className="h-5 w-5 text-indigo-600" />
                      ) : (
                        <Monitor className="h-5 w-5 text-emerald-600" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white">
                            {d.deviceName}
                          </span>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                            {d.deviceType.toUpperCase()}
                          </span>
                          {isThis && (
                            <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black">
                              THIS DEVICE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Operator: {d.operatorName} • Last Synced: {d.lastActiveAt}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDisconnectDevice(d.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Register / Test Multi-Device Limit (5 PCs + 1 Mobile) */}
          <form
            onSubmit={handleAddSimulatedDevice}
            className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 space-y-3"
          >
            <h4 className="font-black text-slate-800 dark:text-slate-200">
              Connect Additional PC or Mobile Device (Enforces 5 PC + 1 Mobile Limit)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={simDeviceType}
                onChange={(e) => setSimDeviceType(e.target.value as 'pc' | 'mobile')}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 font-bold"
              >
                <option value="pc">PC App Terminal ({pcCount}/5 Used)</option>
                <option value="mobile">Mobile App ({mobileCount}/1 Used)</option>
              </select>
              <input
                type="text"
                value={simDeviceName}
                onChange={(e) => setSimDeviceName(e.target.value)}
                placeholder="e.g. Counter PC #2 or Owner Android Phone"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 font-semibold"
              />
              <button
                type="submit"
                className="rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black py-2 px-3 shadow flex items-center justify-center gap-1.5"
              >
                <Cloud className="h-4 w-4" />
                <span>Connect & Sync Device</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
