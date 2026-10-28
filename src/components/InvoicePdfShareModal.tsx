import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Share2,
  Mail,
  Printer,
  CheckCircle2,
  X,
  MessageCircle,
  Sparkles,
  FileDown,
  Send
} from 'lucide-react';
import { Customer, FranchiseConfig, Invoice } from '../types';
import { formatINR, getInvoiceSessionYear } from '../utils/storage';
import {
  PdfInvoiceFormat,
  downloadInvoicePdf,
  shareInvoicePdfOnWhatsApp,
  emailInvoicePdf,
  getSanitizedInvoiceFilename,
  buildInvoiceWhatsAppText
} from '../utils/invoicePdfGenerator';

interface InvoicePdfShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  franchiseConfig: FranchiseConfig;
  customers?: Customer[];
  onOpenPrintModal?: (invoice: Invoice) => void;
  onActionLogged?: (actionTitle: string, details: string) => void;
}

export const InvoicePdfShareModal: React.FC<InvoicePdfShareModalProps> = ({
  isOpen,
  onClose,
  invoice,
  franchiseConfig,
  customers = [],
  onOpenPrintModal,
  onActionLogged,
}) => {
  const [pdfFormat, setPdfFormat] = useState<PdfInvoiceFormat>('a4');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isSharingWa, setIsSharingWa] = useState(false);

  useEffect(() => {
    if (invoice) {
      setWhatsappPhone(invoice.customerMobile || '');
      const cleanMob = (invoice.customerMobile || '').replace(/\D/g, '').slice(-10);
      const matchedCust = customers.find(
        (c) => c.mobile.replace(/\D/g, '').slice(-10) === cleanMob
      );
      setRecipientEmail(matchedCust?.email || '');
      setStatusFeedback(null);
    }
  }, [invoice, customers]);

  if (!isOpen || !invoice) return null;

  const pdfFilename = getSanitizedInvoiceFilename(invoice, pdfFormat);
  const sessionYear = getInvoiceSessionYear(invoice);

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 5000);
  };

  const handleDownloadPdf = () => {
    const savedName = downloadInvoicePdf(invoice, franchiseConfig, pdfFormat);
    showToast(`Downloaded PDF Invoice: ${savedName}`);
    onActionLogged?.(
      `Invoice PDF Downloaded (${invoice.invoiceNumber})`,
      `Exported ${pdfFormat.toUpperCase()} PDF file (${savedName}) for ${invoice.customerName}.`
    );
  };

  const handleShareWhatsAppNativeOrChat = async (forceDirectChat: boolean) => {
    setIsSharingWa(true);
    try {
      const targetInvoice: Invoice = {
        ...invoice,
        customerMobile: whatsappPhone.trim() || invoice.customerMobile,
      };
      const result = await shareInvoicePdfOnWhatsApp(
        targetInvoice,
        franchiseConfig,
        pdfFormat,
        forceDirectChat
      );
      if (result.method === 'native_file_share') {
        showToast(`Shared PDF file (${result.filename}) via system WhatsApp share sheet!`);
      } else {
        showToast(
          `Downloaded ${result.filename} & opened WhatsApp chat (+91 ${targetInvoice.customerMobile}) — attach the downloaded PDF in 1 click!`
        );
      }
      onActionLogged?.(
        `Invoice PDF Shared on WhatsApp (${invoice.invoiceNumber})`,
        `Shared ${result.filename} to WhatsApp (+91 ${targetInvoice.customerMobile}).`
      );
    } finally {
      setIsSharingWa(false);
    }
  };

  const handleEmailPdf = (e: React.FormEvent) => {
    e.preventDefault();
    const { filename } = emailInvoicePdf(invoice, franchiseConfig, recipientEmail, pdfFormat);
    showToast(
      `Downloaded ${filename} & opened Email draft${
        recipientEmail ? ` to ${recipientEmail}` : ''
      }. Attach the downloaded PDF file to send!`
    );
    onActionLogged?.(
      `Invoice PDF Emailed (${invoice.invoiceNumber})`,
      `Prepared email with PDF (${filename}) for ${recipientEmail || invoice.customerName}.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl border-2 border-orange-500">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30">
              <FileDown className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-white text-orange-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  PDF Export, Email & WhatsApp Hub
                </span>
                <span className="rounded-md bg-orange-900/40 px-2 py-0.5 text-[10px] font-mono font-bold text-orange-100">
                  Session {sessionYear}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                Invoice #{invoice.invoiceNumber} • {formatINR(invoice.grandTotal)}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/90 hover:bg-white/20 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 text-xs">
          {/* Status Toast */}
          {statusFeedback && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 border-2 border-emerald-500 p-3 text-emerald-950 font-bold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{statusFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                className="text-[11px] underline shrink-0"
              >
                OK
              </button>
            </div>
          )}

          {/* Invoice Quick Summary Card */}
          <div className="rounded-2xl bg-orange-50/70 border border-orange-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-900">
                {invoice.customerName}{' '}
                <span className="font-mono text-xs font-bold text-orange-600">
                  (+91 {invoice.customerMobile})
                </span>
              </p>
              <p className="text-[11px] text-slate-600">
                Date: <strong>{invoice.date}</strong> • Items:{' '}
                <strong>{invoice.items.length}</strong> • Eligible SP:{' '}
                <strong className="text-emerald-700">{invoice.totalSp} SP</strong>
                {invoice.customerAwplId ? (
                  <>
                    {' '}
                    • AWPL ID: <strong className="font-mono">{invoice.customerAwplId}</strong>
                  </>
                ) : null}
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Ready PDF File: <strong className="text-slate-800">{pdfFilename}</strong>
              </p>
            </div>

            {/* Choose PDF Document Format */}
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Select PDF Layout Format:
              </span>
              <div className="inline-flex rounded-xl bg-white p-1 border border-orange-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPdfFormat('a4')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    pdfFormat === 'a4'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A4 Tax Invoice PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPdfFormat('thermal')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    pdfFormat === 'thermal'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  80mm Thermal PDF
                </button>
              </div>
            </div>
          </div>

          {/* 1. Primary Action: Download PDF or Print Receipt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-3.5 text-sm font-black shadow-md shadow-orange-500/20 transition cursor-pointer"
            >
              <Download className="h-5 w-5" />
              <span>Download PDF Document</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenPrintModal) {
                  onClose();
                  onOpenPrintModal(invoice);
                } else {
                  window.print();
                }
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-3.5 text-sm font-black shadow-md transition cursor-pointer"
            >
              <Printer className="h-5 w-5 text-orange-400" />
              <span>Open Print Receipt Preview</span>
            </button>
          </div>

          {/* 2. Share PDF on WhatsApp Section */}
          <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    Share PDF Invoice on WhatsApp
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Attach the PDF file directly on mobile/supported browsers or open customer WhatsApp chat with auto-downloaded PDF
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-emerald-900 block mb-1">
                  Customer WhatsApp Mobile Number (10-Digit)
                </label>
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="10-digit WhatsApp mobile number..."
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:pt-4">
                <button
                  type="button"
                  disabled={isSharingWa}
                  onClick={() => handleShareWhatsAppNativeOrChat(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-black shadow transition cursor-pointer"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share PDF File on WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={isSharingWa}
                  onClick={() => handleShareWhatsAppNativeOrChat(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-500 px-3.5 py-2.5 text-xs font-black transition cursor-pointer"
                  title="Downloads the PDF and opens direct WhatsApp chat to this number"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <span>Download PDF + Open WA Chat</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Email PDF Receipt Section */}
          <form
            onSubmit={handleEmailPdf}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-orange-500 text-white flex items-center justify-center">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Email PDF Receipt to Customer
                </h4>
                <p className="text-[11px] text-slate-500">
                  Automatically downloads <strong>{pdfFilename}</strong> and opens a pre-filled email receipt
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter customer or C&F email address (e.g. customer@gmail.com)..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-orange-600 text-white px-4 py-2 text-xs font-black shadow transition cursor-pointer shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Download PDF & Open Email</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Official GST Invoice • {franchiseConfig.name} ({franchiseConfig.gstin})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-1.5 font-black text-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
