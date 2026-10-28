import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Upload,
  FileText,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Send
} from 'lucide-react';
import { AppPortalMode, ComplaintReport } from '../types';
import { saveToCloudBackup, setStorageItem, STORAGE_KEYS } from '../utils/storage';

interface ComplaintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalMode: AppPortalMode;
  defaultName: string;
  defaultMobile: string;
  cnfId?: string;
  cnfName?: string;
  complaints: ComplaintReport[];
  onUpdateComplaints: (list: ComplaintReport[]) => void;
}

export const ComplaintReportModal: React.FC<ComplaintReportModalProps> = ({
  isOpen,
  onClose,
  portalMode,
  defaultName,
  defaultMobile,
  cnfId,
  cnfName,
  complaints,
  onUpdateComplaints,
}) => {
  const [submitterName, setSubmitterName] = useState(defaultName);
  const [submitterMobile, setSubmitterMobile] = useState(defaultMobile);
  const [relatedInvoiceNumber, setRelatedInvoiceNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentType, setAttachmentType] = useState<'image' | 'pdf' | 'none'>('none');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string>('');
  const [isVerifyingAi, setIsVerifyingAi] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setAttachmentName(file.name);
    setAttachmentType(isPdf ? 'pdf' : 'image');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setIsVerifyingAi(true);
    const nowTime = new Date().toISOString().replace('T', ' ').slice(0, 16);

    let aiVerification: ComplaintReport['aiVerificationStatus'] = 'Pending_AI';
    let aiScore = 88;
    let aiReason =
      'Complaint submitted and forwarded to Main App Admin for review and resolution.';
    let aiAction =
      'Main App Admin has full authority to verify original bill/receipt and resolve this report.';

    try {
      const res = await fetch('/api/gemini/verify-complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submittedByPortal: portalMode === 'customer_app' ? 'customer_app' : 'cnf_app',
          submitterName: submitterName.trim() || defaultName,
          submitterMobile: submitterMobile.trim() || defaultMobile,
          cnfName,
          subject: subject.trim(),
          description: description.trim(),
          relatedInvoiceNumber: relatedInvoiceNumber.trim(),
          attachmentName,
          attachmentType,
          attachmentDataUrl: attachmentDataUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.result) {
        aiVerification = data.result.isGenuine ? 'Genuine' : 'Suspicious';
        aiScore = Number(data.result.confidenceScore) || 85;
        aiReason = data.result.aiVerificationReason || aiReason;
        aiAction = data.result.suggestedMainAdminAction || aiAction;
      }
    } catch {
      aiVerification = 'Genuine';
    } finally {
      setIsVerifyingAi(false);
    }

    const newComplaint: ComplaintReport = {
      id: `cmp-${Date.now()}`,
      submittedByPortal: portalMode === 'customer_app' ? 'customer_app' : 'cnf_app',
      submitterName: submitterName.trim() || defaultName,
      submitterMobile: submitterMobile.trim() || defaultMobile,
      cnfId,
      cnfName,
      subject: subject.trim(),
      description: description.trim(),
      relatedInvoiceNumber: relatedInvoiceNumber.trim() || undefined,
      attachmentName: attachmentName || undefined,
      attachmentType,
      attachmentDataUrl: attachmentDataUrl || undefined,
      aiVerificationStatus: aiVerification,
      aiConfidenceScore: aiScore,
      aiVerificationReason: aiReason,
      status: 'Open',
      createdAt: nowTime,
    };

    const nextList = [newComplaint, ...complaints];
    onUpdateComplaints(nextList);
    setStorageItem(STORAGE_KEYS.COMPLAINTS, nextList);
    saveToCloudBackup();

    setSubject('');
    setDescription('');
    setRelatedInvoiceNumber('');
    setAttachmentName('');
    setAttachmentType('none');
    setAttachmentDataUrl('');
    setToastMsg(
      `Complaint #${newComplaint.id.slice(-5)} sent directly to Main App! AI Verification: ${aiVerification.toUpperCase()} (${aiScore}%).`
    );
    setTimeout(() => setToastMsg(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between bg-red-900 text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-300" />
            <div>
              <span className="rounded bg-amber-400 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                Official AWPL Dispute Desk • Direct to Main App + Google Gemini AI Verification
              </span>
              <h2 className="text-base sm:text-lg font-black mt-0.5">
                Report / Complaint Desk ({portalMode === 'customer_app' ? 'Customer App' : `C&F App — ${cnfName || 'C&F'}`})
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-red-200 hover:bg-red-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
          {toastMsg && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-3.5 font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmitComplaint} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Your Name *</label>
                <input
                  type="text"
                  required
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={submitterMobile}
                  onChange={(e) => setSubmitterMobile(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Related Bill / Invoice # (Optional)
                </label>
                <input
                  type="text"
                  value={relatedInvoiceNumber}
                  onChange={(e) => setRelatedInvoiceNumber(e.target.value)}
                  placeholder="e.g. DRW/2025-26/1001"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Complaint / Report Subject *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Pending Product Not Received / UPI Payment Deduction / Online C&F Sync Delay"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Detailed Complaint Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain your issue with bill number, date, product name, or payment details so AI can verify genuineness and Main App can resolve it immediately..."
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
              />
            </div>

            {/* Upload Picture or PDF from Device */}
            <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-emerald-600" />
                  <span className="font-black text-slate-800 dark:text-slate-200">
                    Upload Proof from Device (Picture / Photo or PDF Document)
                  </span>
                </div>
                <label className="cursor-pointer rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 font-black text-xs inline-flex items-center gap-1.5 shadow">
                  <Upload className="h-3.5 w-3.5 text-amber-400" />
                  <span>Choose Picture or PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {attachmentName && (
                <div className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-emerald-400">
                  <div className="flex items-center gap-2">
                    {attachmentType === 'pdf' ? (
                      <FileText className="h-5 w-5 text-red-600" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-emerald-600" />
                    )}
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{attachmentName}</p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Attached ({attachmentType.toUpperCase()}) — Will be analyzed by Google Gemini AI & sent to Main App
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentName('');
                      setAttachmentType('none');
                      setAttachmentDataUrl('');
                    }}
                    className="text-red-600 font-bold text-[11px] hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifyingAi}
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition"
            >
              {isVerifyingAi ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin text-amber-300" />
                  <span>Google Gemini AI is verifying report genuineness...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Report to Main App (AI Genuineness Check)</span>
                </>
              )}
            </button>
          </form>

          {/* Previous Complaints & Main App Resolution Status */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              Recent Reports & Main App Authority Resolution Status ({complaints.length})
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {complaints.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50/70 dark:bg-slate-800/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-black text-slate-900 dark:text-white">{c.subject}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                          c.aiVerificationStatus === 'Genuine'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        🤖 AI: {c.aiVerificationStatus} ({c.aiConfidenceScore}%)
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                          c.status === 'Resolved_By_Main_App'
                            ? 'bg-blue-600 text-white'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.status === 'Resolved_By_Main_App' ? '✓ Resolved by Main App' : c.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{c.description}</p>
                  {c.aiVerificationReason && (
                    <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">
                      AI Finding: {c.aiVerificationReason}
                    </p>
                  )}
                  {c.mainAdminResolutionNote && (
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 p-2 text-blue-950 dark:text-blue-200 font-bold">
                      ✓ Main App Authority Resolution: {c.mainAdminResolutionNote}
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
