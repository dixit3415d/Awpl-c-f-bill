import React, { useState } from 'react';
import { MessageSquarePlus, Star, X, CheckCircle2, Send } from 'lucide-react';
import { AppFeedback, AppPortalMode } from '../types';
import { setStorageItem, saveToCloudBackup, STORAGE_KEYS } from '../utils/storage';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalMode: AppPortalMode;
  defaultName: string;
  defaultMobile: string;
  cnfName: string;
  feedbacks: AppFeedback[];
  onUpdateFeedbacks: (list: AppFeedback[]) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  portalMode,
  defaultName,
  defaultMobile,
  cnfName,
  feedbacks,
  onUpdateFeedbacks,
}) => {
  const [submitterName, setSubmitterName] = useState(defaultName);
  const [submitterMobile, setSubmitterMobile] = useState(defaultMobile);
  const [rating, setRating] = useState<number>(5);
  const [category, setCategory] = useState<AppFeedback['category']>('Billing & Barcode');
  const [message, setMessage] = useState('');
  const [submittedToast, setSubmittedToast] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newEntry: AppFeedback = {
      id: `fb-${Date.now()}`,
      submittedByPortal: portalMode === 'customer_app' ? 'customer_app' : 'cnf_app',
      submitterName: submitterName.trim() || defaultName || 'App User',
      submitterMobile: submitterMobile.trim() || '9800000000',
      cnfName,
      rating,
      category,
      message: message.trim(),
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'New',
    };

    const updated = [newEntry, ...feedbacks];
    onUpdateFeedbacks(updated);
    setStorageItem(STORAGE_KEYS.FEEDBACKS, updated);
    saveToCloudBackup();

    setMessage('');
    setSubmittedToast(true);
    setTimeout(() => setSubmittedToast(false), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-11 rounded-lg bg-orange-500 text-black font-black flex items-center justify-center text-xs border border-black">
              AWPL
            </div>
            <div>
              <h3 className="font-black text-base">
                C&F Bill — App Feedback ({portalMode === 'customer_app' ? 'Customer App' : 'C&F App'})
              </h3>
              <p className="text-[11px] text-slate-300">
                Share your feedback, rating, or feature request directly with the Main App Admin
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {submittedToast && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-3 font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Thank you! Your feedback has been synced to the Main App Admin Cloud.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Your Name / C&F Name *</label>
                <input
                  type="text"
                  required
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={submitterMobile}
                  onChange={(e) => setSubmitterMobile(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Topic / Module</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AppFeedback['category'])}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="Billing & Barcode">Billing & Barcode</option>
                  <option value="C&F Online Sync">C&F Online Sync</option>
                  <option value="Customer App Ordering">Customer App Ordering</option>
                  <option value="UPI & Bank QR">UPI & Bank QR</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="General Feedback">General Feedback</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">App Rating</label>
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1.5 rounded-lg border transition ${
                        star <= rating
                          ? 'bg-amber-400 text-slate-950 border-amber-500'
                          : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Star className="h-4 w-4 fill-current" />
                    </button>
                  ))}
                  <span className="ml-2 font-black text-amber-600">{rating}/5</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Your Feedback or Suggestion for C&F Bill App *
              </label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your feedback or feature request..."
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 font-black shadow transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit Feedback to Main App</span>
              </button>
            </div>
          </form>

          {/* Recent Feedback List */}
          <div className="space-y-2.5">
            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <MessageSquarePlus className="h-4 w-4 text-emerald-600" />
              <span>Recent C&F & Customer Feedback ({feedbacks.length})</span>
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{fb.submitterName}</span>
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {fb.submittedByPortal === 'customer_app' ? 'Customer App' : 'C&F App'}
                      </span>
                      <span className="text-amber-500 font-black">{'★'.repeat(fb.rating)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{fb.createdAt}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{fb.message}</p>
                  {fb.adminReply && (
                    <div className="mt-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-2 text-[11px] text-emerald-900 dark:text-emerald-200">
                      <strong>Main Admin Reply:</strong> {fb.adminReply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
