import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Invoice } from '../types';

interface OfflineBannerProps {
  isOnline: boolean;
  offlineQueueCount: number;
  onSyncOfflineQueue: () => void;
  isSyncing: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  offlineQueueCount,
  onSyncOfflineQueue,
  isSyncing,
}) => {
  if (isOnline && offlineQueueCount === 0) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold shadow-md flex items-center justify-between z-40 transition animate-fade-in">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4 animate-bounce" />
            <span>
              Offline POS Mode Active — Invoices are safely stored locally. You can continue billing.
            </span>
          </>
        ) : (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-800 animate-ping" />
            <span>Connection restored! {offlineQueueCount} offline transaction(s) pending sync.</span>
          </>
        )}
      </div>

      {isOnline && offlineQueueCount > 0 && (
        <button
          onClick={onSyncOfflineQueue}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded-lg bg-slate-950 text-white px-3 py-1 text-xs hover:bg-slate-900 shadow transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Invoices Now'}</span>
        </button>
      )}
    </div>
  );
};
