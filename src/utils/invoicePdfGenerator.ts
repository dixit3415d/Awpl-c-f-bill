import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BillPrintConfig, FranchiseConfig, Invoice } from '../types';
import { DEFAULT_BILL_PRINT_CONFIG } from '../data/initialData';
import { getInvoiceSessionYear } from './storage';

export type PdfInvoiceFormat = 'a4' | 'thermal';

/**
 * Currency formatter specifically safe for standard PDF fonts (uses Rs. to avoid unicode glyph boxes)
 */
const formatPdfINR = (amount: number): string => {
  const num = Number(amount || 0);
  return `Rs. ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const getSanitizedInvoiceFilename = (
  invoice: Invoice,
  format: PdfInvoiceFormat = 'a4'
): string => {
  const safeInvNo = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const suffix = format === 'thermal' ? '_Thermal_Receipt' : '_Tax_Invoice';
  return `Invoice_${safeInvNo}${suffix}.pdf`;
};

/**
 * Resolves the effective BillPrintConfig for an invoice, combining defaults,
 * franchise-level template, per-bill saved override, and optional live studio override.
 */
export const resolveEffectiveBillConfig = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  liveOverride?: Partial<BillPrintConfig>
): BillPrintConfig => {
  const base = franchiseConfig.billPrintConfig || {};
  const perBill = invoice.customBillConfig || {};
  const live = liveOverride || {};

  const merged: BillPrintConfig = {
    ...DEFAULT_BILL_PRINT_CONFIG,
    ...base,
    ...perBill,
    ...live,
    columnLabels: {
      ...(DEFAULT_BILL_PRINT_CONFIG.columnLabels || {}),
      ...(base.columnLabels || {}),
      ...(perBill.columnLabels || {}),
      ...(live.columnLabels || {}),
    },
    customFields:
      live.customFields ??
      perBill.customFields ??
      base.customFields ??
      DEFAULT_BILL_PRINT_CONFIG.customFields ??
      [],
    termsAndConditions:
      (live.termsAndConditions && live.termsAndConditions.length > 0
        ? live.termsAndConditions
        : perBill.termsAndConditions && perBill.termsAndConditions.length > 0
        ? perBill.termsAndConditions
        : base.termsAndConditions && base.termsAndConditions.length > 0
        ? base.termsAndConditions
        : DEFAULT_BILL_PRINT_CONFIG.termsAndConditions) || [],
  };

  merged.showSpPoints = merged.showSpPoints ?? merged.showSpColumn ?? true;
  merged.showGstBreakdown = merged.showGstBreakdown ?? merged.showGstColumn ?? true;
  merged.showBankAndQr = merged.showBankAndQr ?? merged.showUpiQr ?? true;
  merged.showSignatureAndSeal = merged.showSignatureAndSeal ?? merged.showSignaturesAndStamp ?? true;
  return merged;
};

/**
 * Builds a complete, formatted WhatsApp message for an invoice honoring custom BillPrintConfig
 */
export const buildInvoiceWhatsAppText = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  overrideConfig?: Partial<BillPrintConfig>
): string => {
  const billConfig = resolveEffectiveBillConfig(invoice, franchiseConfig, overrideConfig);

  const primaryIsGreen =
    invoice.isIdGreen !== undefined
      ? invoice.isIdGreen
      : invoice.items[0]?.isIdGreen !== undefined
      ? invoice.items[0]?.isIdGreen
      : Boolean(invoice.repurchaseSide || invoice.items[0]?.repurchaseSide);
  const primaryRepurchaseSide = invoice.repurchaseSide || invoice.items[0]?.repurchaseSide;
  const primaryGreeningCategory = invoice.greeningCategory || invoice.items[0]?.greeningCategory;

  const sessionYear = getInvoiceSessionYear(invoice);
  const pdfFileName = getSanitizedInvoiceFilename(invoice, 'a4');
  const displayCompanyName = billConfig.customCompanyNameOverride?.trim() || franchiseConfig.name;
  const displayAddress = billConfig.customAddressOverride?.trim() || franchiseConfig.address;
  const displayPhone = billConfig.customPhoneOverride?.trim() || franchiseConfig.phone;

  const visibleCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && (f.label.trim() || f.value.trim())
  );

  const lines = [
    `🌿 *${displayCompanyName}*`,
    `*${
      billConfig.customHeaderMatter ||
      `Authorized Franchise of ${franchiseConfig.parentCompany || 'Asclepius Wellness Pvt. Ltd.'}`
    }*`,
    `---------------------------------`,
    `📄 *${billConfig.invoiceTitle || 'OFFICIAL PDF TAX INVOICE'} (${pdfFileName})*`,
    `🧾 *Invoice No:* ${invoice.invoiceNumber}${
      invoice.regeneratedCount ? ` (v${invoice.regeneratedCount})` : ''
    }`,
    billConfig.showSessionYear !== false ? `🗓️ *Financial Session:* ${sessionYear} (Apr–Mar)` : '',
    `📅 *Date:* ${invoice.date}`,
    billConfig.showCustomerSection !== false
      ? `👤 *Customer:* ${invoice.customerName} (+91 ${invoice.customerMobile})`
      : '',
    billConfig.showCustomerAwplId !== false && invoice.customerAwplId
      ? `🆔 *AWPL DS ID:* ${invoice.customerAwplId}`
      : '',
    billConfig.showGreenIdBadge !== false && invoice.customerAwplId
      ? primaryIsGreen
        ? `✅ *AWPL ID Status:* GREEN ID • Side: *${primaryRepurchaseSide || 'S.A.O'}*`
        : `🌱 *AWPL ID Status:* NOT GREEN • Greening: *${primaryGreeningCategory || '27 SP'}*`
      : '',
    billConfig.customCustomerNote?.trim() ? `📝 *Note:* ${billConfig.customCustomerNote.trim()}` : '',
    ...visibleCustomFields.map((cf) => `🔹 *${cf.label}:* ${cf.value}`),
    `---------------------------------`,
    `*BILLED ITEMS (${invoice.items.length}):*`,
    ...invoice.items.map((it, idx) => {
      const targetId = it.targetAwplId || invoice.customerAwplId || 'Retail';
      const cfText =
        billConfig.showOnlineStatusInItem !== false
          ? it.cfSynced
            ? ` [Online Done: ${it.cfBillNumber || invoice.cfBillNumber || 'Yes'}]`
            : ` [Online Pending]`
          : '';
      const spText =
        billConfig.showSpPoints !== false ? ` (${it.spEarned} SP)` : '';
      const idText =
        billConfig.showItemAwplId !== false ? ` • ID: ${targetId}` : '';
      return `${idx + 1}. *${it.product.name}* x${it.quantity} = Rs. ${it.lineTotal.toLocaleString(
        'en-IN'
      )}${spText}${idText}${cfText}`;
    }),
    `---------------------------------`,
    `💰 *Grand Total:* Rs. ${invoice.grandTotal.toLocaleString('en-IN')}`,
    billConfig.showSpPoints !== false ? `✨ *Total AWPL SP Earned:* ${invoice.totalSp} SP` : '',
    billConfig.showPaymentAndStaffBlock !== false
      ? `💳 *Payment Mode:* ${invoice.paymentMethod} (${invoice.paymentStatus.toUpperCase()})`
      : '',
    billConfig.showBalanceDue !== false && invoice.balanceDue > 0
      ? `⚠️ *Balance Due:* Rs. ${invoice.balanceDue.toLocaleString('en-IN')} (UPI: ${
          franchiseConfig.bankUpiId
        })`
      : `✅ *Payment Status:* Paid in Full`,
    `---------------------------------`,
    billConfig.showAddress !== false ? `📍 *C&F Address:* ${displayAddress}` : '',
    billConfig.showPhoneAndEmail !== false
      ? `📞 *Contact:* ${displayPhone}${
          billConfig.showGstin !== false ? ` | GSTIN: ${franchiseConfig.gstin}` : ''
        }`
      : '',
    billConfig.customFooterMatter || `Thank you for choosing ${displayCompanyName}!`,
  ].filter(Boolean);

  return lines.join('\n');
};

/**
 * Generates a professionally formatted jsPDF document for a single finalized invoice
 * that mirrors the user's exact customized BillPrintConfig
 */
export const generateInvoicePdfDoc = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4',
  overrideConfig?: Partial<BillPrintConfig>
): jsPDF => {
  const billConfig = resolveEffectiveBillConfig(invoice, franchiseConfig, overrideConfig);
  const labels = billConfig.columnLabels || DEFAULT_BILL_PRINT_CONFIG.columnLabels || {};

  const displayCompanyName = billConfig.customCompanyNameOverride?.trim() || franchiseConfig.name;
  const displayAddress = billConfig.customAddressOverride?.trim() || franchiseConfig.address;
  const displayPhone = billConfig.customPhoneOverride?.trim() || franchiseConfig.phone;

  const headerCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && f.position === 'header' && (f.label.trim() || f.value.trim())
  );
  const customerCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && f.position === 'customer' && (f.label.trim() || f.value.trim())
  );
  const footerCustomFields = (billConfig.customFields || []).filter(
    (f) => f.visible && f.position === 'footer' && (f.label.trim() || f.value.trim())
  );

  // Theme colors for PDF
  const themeColors: Record<
    string,
    { primary: [number, number, number]; lightBg: [number, number, number]; border: [number, number, number] }
  > = {
    emerald: { primary: [6, 95, 70], lightBg: [236, 253, 245], border: [16, 185, 129] },
    monochrome: { primary: [15, 23, 42], lightBg: [248, 250, 252], border: [100, 116, 139] },
    saffron: { primary: [234, 88, 12], lightBg: [255, 247, 237], border: [251, 146, 60] },
    indigo: { primary: [55, 48, 163], lightBg: [238, 242, 255], border: [99, 102, 241] },
  };
  const activeTheme = themeColors[billConfig.themeColor || 'emerald'] || themeColors.emerald;

  const sessionYear = getInvoiceSessionYear(invoice);

  if (format === 'thermal') {
    const estimatedHeight = Math.max(210, 155 + invoice.items.length * 14);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, estimatedHeight],
    });

    let y = 7;
    doc.setFillColor(...activeTheme.primary);
    doc.rect(0, 0, 80, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(billConfig.invoiceTitle || 'GST TAX INVOICE', 40, y, { align: 'center' });
    y += 4.5;

    doc.setFontSize(10.5);
    doc.setTextColor(...activeTheme.primary);
    const titleLines = doc.splitTextToSize(displayCompanyName.toUpperCase(), 72);
    doc.text(titleLines, 40, y, { align: 'center' });
    y += titleLines.length * 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    if (billConfig.showAddress !== false) {
      const addrLines = doc.splitTextToSize(displayAddress, 72);
      doc.text(addrLines, 40, y, { align: 'center' });
      y += addrLines.length * 3.2;
    }

    const contactParts: string[] = [];
    if (billConfig.showPhoneAndEmail !== false) contactParts.push(`Ph: ${displayPhone}`);
    if (billConfig.showGstin !== false && billConfig.showGstinAndLicenses !== false) {
      contactParts.push(`GSTIN: ${franchiseConfig.gstin}`);
    }
    if (contactParts.length > 0) {
      doc.text(contactParts.join(' | '), 40, y, { align: 'center' });
      y += 3.5;
    }
    if (billConfig.showSessionYear !== false) {
      doc.text(`Session (Apr-Mar): ${sessionYear}`, 40, y, { align: 'center' });
      y += 3;
    }

    headerCustomFields.forEach((cf) => {
      doc.text(`${cf.label}: ${cf.value}`, 40, y, { align: 'center' });
      y += 3.2;
    });

    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(4, y, 76, y);
    y += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`INV: ${invoice.invoiceNumber}`, 4, y);
    y += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${invoice.date}`, 4, y);
    y += 3.5;
    if (billConfig.showCustomerSection !== false) {
      doc.text(`Customer: ${invoice.customerName}`, 4, y);
      y += 3.5;
      doc.text(`Mobile: +91 ${invoice.customerMobile}`, 4, y);
      y += 3.5;
      if (billConfig.showCustomerAwplId !== false && invoice.customerAwplId) {
        doc.setFont('helvetica', 'bold');
        doc.text(`AWPL ID: ${invoice.customerAwplId}`, 4, y);
        y += 3.5;
      }
      if (billConfig.customCustomerNote?.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.text(`Note: ${billConfig.customCustomerNote.trim()}`, 4, y);
        y += 3.5;
      }
      customerCustomFields.forEach((cf) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${cf.label}: ${cf.value}`, 4, y);
        y += 3.2;
      });
    }

    doc.line(4, y, 76, y);
    y += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(`${labels.product || 'ITEM'} / QTY x ${labels.rate || 'RATE'}`, 4, y);
    doc.text(labels.lineTotal || 'TOTAL', 76, y, { align: 'right' });
    y += 2.5;
    doc.line(4, y, 76, y);
    y += 3.5;

    invoice.items.forEach((it, idx) => {
      const unitSp =
        it.product.sp !== undefined
          ? it.product.sp
          : Math.round((it.spEarned || 0) / Math.max(1, it.quantity));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      const prefix = billConfig.showSerialNoColumn !== false ? `${idx + 1}. ` : '';
      const itemLines = doc.splitTextToSize(`${prefix}${it.product.name}`, 56);
      doc.text(itemLines, 4, y);
      y += itemLines.length * 3.2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      const spSegment =
        billConfig.showSpPoints !== false
          ? ` (SP: ${unitSp}x${it.quantity}=${it.spEarned} SP)`
          : '';
      doc.text(`   ${it.quantity} x Rs.${it.unitPrice}${spSegment}`, 4, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rs.${it.lineTotal.toLocaleString('en-IN')}`, 76, y, { align: 'right' });
      y += 3.8;
    });

    doc.line(4, y, 76, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    if (billConfig.showSubtotalAndDiscount !== false) {
      doc.text('Subtotal:', 4, y);
      doc.text(formatPdfINR(invoice.subtotal), 76, y, { align: 'right' });
      y += 3.5;
    }

    if (billConfig.showGstBreakdown !== false) {
      doc.text('Included GST:', 4, y);
      doc.text(formatPdfINR(invoice.taxTotal), 76, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...activeTheme.primary);
    doc.text('GRAND TOTAL:', 4, y);
    doc.text(formatPdfINR(invoice.grandTotal), 76, y, { align: 'right' });
    y += 4.2;

    if (billConfig.showSpPoints !== false) {
      doc.setFontSize(7.5);
      doc.setTextColor(6, 95, 70);
      doc.text(`TOTAL AWPL SP: ${invoice.totalSp} SP`, 4, y);
      y += 3.8;
    }

    if (billConfig.showPaymentAndStaffBlock !== false) {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Payment: ${invoice.paymentMethod} (${invoice.paymentStatus.toUpperCase()})`,
        4,
        y
      );
      y += 4;
    }

    footerCustomFields.forEach((cf) => {
      doc.setFont('helvetica', 'normal');
      doc.text(`${cf.label}: ${cf.value}`, 4, y);
      y += 3.4;
    });

    doc.line(4, y, 76, y);
    y += 4;
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    if (billConfig.showBankAndQr !== false) {
      doc.text(`UPI ID: ${franchiseConfig.bankUpiId}`, 40, y, { align: 'center' });
      y += 3.5;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(
      billConfig.customFooterMatter || `Thank you for visiting ${displayCompanyName}!`,
      40,
      y,
      { align: 'center' }
    );

    return doc;
  }

  // ================= STANDARD A4 / A5 / LETTER GST TAX INVOICE PDF =================
  const pdfFormat =
    billConfig.paperSize === 'A5'
      ? 'a5'
      : billConfig.paperSize === 'Letter'
      ? 'letter'
      : 'a4';

  const doc = new jsPDF({
    orientation: billConfig.orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: pdfFormat,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 12;

  // Top Header Accent Bar
  doc.setFillColor(...activeTheme.primary);
  doc.rect(0, 0, pageWidth, 4.5, 'F');

  // Header Box Background
  const headerBoxHeight = 34 + Math.min(headerCustomFields.length * 4, 12);
  doc.setFillColor(...activeTheme.lightBg);
  doc.setDrawColor(...activeTheme.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y - 2, pageWidth - margin * 2, headerBoxHeight, 2.5, 2.5, 'FD');

  // Left: Franchise Name & Address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  doc.text(displayCompanyName.toUpperCase(), margin + 4, y + 5);

  doc.setFontSize(8.5);
  doc.setTextColor(...activeTheme.primary);
  doc.text(
    (
      billConfig.customHeaderMatter ||
      `Authorized Franchise Under ${
        franchiseConfig.parentCompany || 'Asclepius Wellness Private Limited (AWPL)'
      }`
    ).toUpperCase(),
    margin + 4,
    y + 10
  );

  let headerLeftY = y + 14.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  if (billConfig.showAddress !== false) {
    doc.text(displayAddress, margin + 4, headerLeftY);
    headerLeftY += 4.2;
  }

  const ownerAndPhoneParts: string[] = [];
  if (billConfig.showOwnerNames !== false) {
    ownerAndPhoneParts.push(
      `C&F Owner: ${franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner}`
    );
  }
  if (billConfig.showPhoneAndEmail !== false) {
    ownerAndPhoneParts.push(`Phone: ${displayPhone}`);
    ownerAndPhoneParts.push(`Email: ${franchiseConfig.email}`);
  }
  if (ownerAndPhoneParts.length > 0) {
    doc.text(ownerAndPhoneParts.join(' | '), margin + 4, headerLeftY);
    headerLeftY += 4.2;
  }

  if (billConfig.showGstinAndLicenses !== false) {
    const licenseParts: string[] = [];
    if (billConfig.showGstin !== false) licenseParts.push(`GSTIN: ${franchiseConfig.gstin}`);
    if (billConfig.showPanNumber && franchiseConfig.panNumber) {
      licenseParts.push(`PAN: ${franchiseConfig.panNumber}`);
    }
    if (billConfig.showFranchiseCode !== false) {
      licenseParts.push(`C&F Code: ${franchiseConfig.franchiseCode}`);
    }
    if (billConfig.showFssaiAndDl !== false) {
      if (franchiseConfig.fssaiNumber) licenseParts.push(`FSSAI: ${franchiseConfig.fssaiNumber}`);
      if (franchiseConfig.dlNumber) licenseParts.push(`DL: ${franchiseConfig.dlNumber}`);
    }
    if (licenseParts.length > 0) {
      doc.text(licenseParts.join(' | '), margin + 4, headerLeftY);
      headerLeftY += 4.2;
    }
  }

  if (billConfig.customSubHeaderMatter) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...activeTheme.primary);
    doc.text(billConfig.customSubHeaderMatter, margin + 4, headerLeftY);
    headerLeftY += 4;
  }

  if (headerCustomFields.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(
      headerCustomFields.map((cf) => `${cf.label}: ${cf.value}`).join('   |   '),
      margin + 4,
      headerLeftY
    );
  }

  // Right: Tax Invoice Badge & Invoice Meta
  const rightBoxWidth = 68;
  const rightBoxX = pageWidth - margin - rightBoxWidth - 3;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightBoxX, y + 1, rightBoxWidth, 28, 2, 2, 'FD');

  doc.setFillColor(...activeTheme.primary);
  doc.roundedRect(rightBoxX + 3, y + 3, rightBoxWidth - 6, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    billConfig.invoiceTitle || 'GST TAX INVOICE',
    rightBoxX + rightBoxWidth / 2,
    y + 6.8,
    { align: 'center' }
  );

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(`No: ${invoice.invoiceNumber}`, rightBoxX + 3, y + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${invoice.date}`, rightBoxX + 3, y + 18);
  if (billConfig.showSessionYear !== false) {
    doc.text(`Session (Apr-Mar): ${sessionYear}`, rightBoxX + 3, y + 22);
  }
  if (billConfig.showSpPoints !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...activeTheme.primary);
    doc.text(
      `Total SP: ${invoice.totalSp} SP | ${invoice.paymentStatus.toUpperCase()}`,
      rightBoxX + 3,
      y + 26
    );
  }

  y += headerBoxHeight + 3;

  // Customer & Billing Allocation Box
  if (billConfig.showCustomerSection !== false || billConfig.showPaymentAndStaffBlock !== false) {
    const custBoxHeight =
      22 +
      (billConfig.customCustomerNote?.trim() ? 4 : 0) +
      (customerCustomFields.length > 0 ? 4 : 0);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, pageWidth - margin * 2, custBoxHeight, 2, 2, 'FD');

    const primaryIsGreen =
      invoice.isIdGreen !== undefined
        ? invoice.isIdGreen
        : invoice.items[0]?.isIdGreen !== undefined
        ? invoice.items[0]?.isIdGreen
        : Boolean(invoice.repurchaseSide || invoice.items[0]?.repurchaseSide);
    const primaryRepurchaseSide = invoice.repurchaseSide || invoice.items[0]?.repurchaseSide;
    const primaryGreeningCategory = invoice.greeningCategory || invoice.items[0]?.greeningCategory;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...activeTheme.primary);
    doc.text(
      (labels.billedToTitle || 'BILLED TO CUSTOMER & AWPL ID ALLOCATION:').toUpperCase(),
      margin + 3.5,
      y + 5
    );

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${invoice.customerName} (+91 ${invoice.customerMobile})`, margin + 3.5, y + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const awplInfoLine =
      billConfig.showCustomerAwplId !== false && invoice.customerAwplId
        ? `AWPL Direct Seller ID: ${invoice.customerAwplId}${
            billConfig.showGreenIdBadge !== false
              ? `  |  ID Status: ${
                  primaryIsGreen
                    ? `GREEN ID (Repurchase Side: ${primaryRepurchaseSide || 'S.A.O'})`
                    : `NOT GREEN (Greening Category: ${primaryGreeningCategory || '27 SP'})`
                }`
              : ''
          }`
        : 'Customer Bill';
    doc.text(awplInfoLine, margin + 3.5, y + 15.5);

    const syncedItemsCount = invoice.items.filter((i) => i.cfSynced).length;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text(
      `Payment: ${invoice.paymentMethod} (${invoice.paymentStatus.toUpperCase()})  |  Billed By: ${
        invoice.staffName
      }${
        billConfig.showCfClearanceBlock !== false
          ? `  |  C&F Online: ${syncedItemsCount}/${invoice.items.length} Synced`
          : ''
      }`,
      margin + 3.5,
      y + 19.8
    );

    let extraCustY = y + 23.8;
    if (billConfig.customCustomerNote?.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`Note: ${billConfig.customCustomerNote.trim()}`, margin + 3.5, extraCustY);
      extraCustY += 4;
    }
    if (customerCustomFields.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(
        customerCustomFields.map((cf) => `${cf.label}: ${cf.value}`).join('   |   '),
        margin + 3.5,
        extraCustY
      );
    }

    y += custBoxHeight + 4;
  }

  // Dynamic Line Items Table Columns based on BillPrintConfig
  interface ColDef {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    renderCell: (item: Invoice['items'][0], idx: number) => string;
    renderFoot: (totalUnits: number) => string;
  }

  const activeColumns: ColDef[] = [];

  if (billConfig.showSerialNoColumn !== false) {
    activeColumns.push({
      key: 'serialNo',
      header: labels.serialNo || '#',
      align: 'center',
      renderCell: (_, idx) => String(idx + 1),
      renderFoot: () => '',
    });
  }

  activeColumns.push({
    key: 'product',
    header: labels.product || 'Product & AWPL Online Status',
    align: 'left',
    renderCell: (item) => {
      const targetId = item.targetAwplId || invoice.customerAwplId || 'Retail';
      const unitSp =
        item.product.sp !== undefined
          ? item.product.sp
          : Math.round((item.spEarned || 0) / Math.max(1, item.quantity));
      const metaParts: string[] = [];
      if (billConfig.showSkuInItem !== false) metaParts.push(`SKU: ${item.product.sku}`);
      if (billConfig.showSpPoints !== false) {
        metaParts.push(`SP: ${unitSp}/unit (Line: ${item.spEarned} SP)`);
      }
      if (billConfig.showItemAwplId !== false && targetId) {
        metaParts.push(`ID: ${targetId}`);
      }
      if (billConfig.showOnlineStatusInItem !== false) {
        metaParts.push(
          item.cfSynced
            ? `Online Done (${item.cfBillNumber || invoice.cfBillNumber || 'Synced'})`
            : 'Online Pending'
        );
      }
      const pendingTag =
        billConfig.showPendingTagInItem !== false && item.isPendingProduct
          ? item.pendingProductStatus === 'given'
            ? `\n[PENDING PRODUCT GIVEN: ${item.pendingGivenAt || 'Handed Over'}]`
            : `\n[PENDING PRODUCT: TO BE GIVEN ON ORIGINAL BILL]`
          : '';
      return `${item.product.name}${metaParts.length > 0 ? `\n${metaParts.join(' | ')}` : ''}${pendingTag}`;
    },
    renderFoot: () => 'TOTAL BILL SUMMARY',
  });

  if (billConfig.showBatchColumn !== false) {
    activeColumns.push({
      key: 'batch',
      header: labels.batch || 'Batch',
      align: 'center',
      renderCell: (item) => item.product.batchNumber || '-',
      renderFoot: () => '',
    });
  }

  if (billConfig.showExpiryColumn) {
    activeColumns.push({
      key: 'expiry',
      header: labels.expiry || 'Expiry',
      align: 'center',
      renderCell: (item) => item.product.expiryDate || '-',
      renderFoot: () => '',
    });
  }

  if (billConfig.showMrpColumn !== false) {
    activeColumns.push({
      key: 'mrp',
      header: labels.mrp || 'MRP',
      align: 'right',
      renderCell: (item) => formatPdfINR(item.product.mrp),
      renderFoot: () => '',
    });
  }

  if (billConfig.showDiscountColumn) {
    activeColumns.push({
      key: 'discount',
      header: labels.discount || 'Disc %',
      align: 'right',
      renderCell: (item) => `${item.discountPercent || 0}%`,
      renderFoot: () => '',
    });
  }

  if (billConfig.showRateColumn !== false) {
    activeColumns.push({
      key: 'rate',
      header: labels.rate || 'Rate',
      align: 'right',
      renderCell: (item) => formatPdfINR(item.unitPrice),
      renderFoot: () => '',
    });
  }

  if (billConfig.showQtyColumn !== false) {
    activeColumns.push({
      key: 'qty',
      header: labels.qty || 'Qty',
      align: 'center',
      bold: true,
      renderCell: (item) => String(item.quantity),
      renderFoot: (totalUnits) => String(totalUnits),
    });
  }

  if (billConfig.showSpPoints !== false) {
    activeColumns.push({
      key: 'sp',
      header: labels.sp || 'SP (Unit/Total)',
      align: 'right',
      bold: true,
      renderCell: (item) => {
        const unitSp =
          item.product.sp !== undefined
            ? item.product.sp
            : Math.round((item.spEarned || 0) / Math.max(1, item.quantity));
        return `${item.spEarned} SP\n(${unitSp}x${item.quantity})`;
      },
      renderFoot: () => `${invoice.totalSp} SP`,
    });
  }

  if (billConfig.showGstBreakdown !== false) {
    activeColumns.push({
      key: 'gst',
      header: labels.gst || 'GST %',
      align: 'right',
      renderCell: (item) => `${item.product.gstRate}%`,
      renderFoot: () => '',
    });
  }

  if (billConfig.showLineTotalColumn !== false) {
    activeColumns.push({
      key: 'lineTotal',
      header: labels.lineTotal || 'Total',
      align: 'right',
      bold: true,
      renderCell: (item) => formatPdfINR(item.lineTotal),
      renderFoot: () => formatPdfINR(invoice.grandTotal),
    });
  }

  const totalUnits = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  const tableHead = [activeColumns.map((c) => c.header)];
  const tableBody = invoice.items.map((item, idx) =>
    activeColumns.map((c) => c.renderCell(item, idx))
  );
  const tableFoot = [activeColumns.map((c) => c.renderFoot(totalUnits))];

  const colStyles: Record<number, any> = {};
  activeColumns.forEach((col, index) => {
    colStyles[index] = {
      halign: col.align || 'left',
      ...(col.bold ? { fontStyle: 'bold' } : {}),
      ...(col.key === 'serialNo' ? { cellWidth: 8 } : {}),
    };
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: {
      fillColor: activeTheme.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'left',
    },
    footStyles: {
      fillColor: activeTheme.lightBg,
      textColor: activeTheme.primary,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: colStyles,
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 62 > pageHeight) {
    doc.addPage();
    y = 15;
  }

  const leftColWidth = (pageWidth - margin * 2) * 0.56;
  const rightColWidth = (pageWidth - margin * 2) * 0.41;
  const rightColX = pageWidth - margin - rightColWidth;

  if (billConfig.showBankAndQr !== false) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, leftColWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('FRANCHISE BANK & UPI PAYMENT DETAILS:', margin + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`UPI ID: ${franchiseConfig.bankUpiId}`, margin + 3, y + 10);
    doc.text(`Bank: ${franchiseConfig.bankName}`, margin + 3, y + 14.5);
    doc.text(
      `A/C No: ${franchiseConfig.accountNo}  |  IFSC: ${franchiseConfig.ifscCode}`,
      margin + 3,
      y + 19
    );
  }

  // Right Column: Totals Summary Box
  doc.setFillColor(...activeTheme.lightBg);
  doc.setDrawColor(...activeTheme.border);
  doc.roundedRect(rightColX, y, rightColWidth, 34, 2, 2, 'FD');

  let sumY = y + 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  if (billConfig.showSubtotalAndDiscount !== false) {
    doc.text('Subtotal:', rightColX + 3.5, sumY);
    doc.text(formatPdfINR(invoice.subtotal), rightColX + rightColWidth - 3.5, sumY, {
      align: 'right',
    });
    sumY += 4.5;
  }

  if (billConfig.showGstBreakdown !== false) {
    doc.text('GST Included (CGST+SGST):', rightColX + 3.5, sumY);
    doc.text(`(${formatPdfINR(invoice.taxTotal)})`, rightColX + rightColWidth - 3.5, sumY, {
      align: 'right',
    });
    sumY += 4.5;
  }

  if (billConfig.showSubtotalAndDiscount !== false && invoice.discountTotal > 0) {
    doc.text('Discount:', rightColX + 3.5, sumY);
    doc.text(`-${formatPdfINR(invoice.discountTotal)}`, rightColX + rightColWidth - 3.5, sumY, {
      align: 'right',
    });
    sumY += 4.5;
  }

  sumY += 1.5;
  doc.setDrawColor(...activeTheme.border);
  doc.line(rightColX + 3, sumY - 3, rightColX + rightColWidth - 3, sumY - 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...activeTheme.primary);
  doc.text('GRAND TOTAL:', rightColX + 3.5, sumY + 1);
  doc.text(formatPdfINR(invoice.grandTotal), rightColX + rightColWidth - 3.5, sumY + 1, {
    align: 'right',
  });

  if (billConfig.showSpPoints !== false) {
    sumY += 6;
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text('Total AWPL SP Earned:', rightColX + 3.5, sumY);
    doc.text(`${invoice.totalSp} SP`, rightColX + rightColWidth - 3.5, sumY, {
      align: 'right',
    });
  }

  if (billConfig.showBalanceDue !== false) {
    sumY += 5;
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    const paidText =
      invoice.balanceDue > 0
        ? `Paid: ${formatPdfINR(invoice.amountPaid)} | Due: ${formatPdfINR(invoice.balanceDue)}`
        : `Paid in Full: ${formatPdfINR(invoice.amountPaid)} (${invoice.paymentMethod})`;
    doc.text(paidText, rightColX + 3.5, sumY);
  }

  // Terms & Conditions + Footer Custom Fields below Bank Box
  let termsY = billConfig.showBankAndQr !== false ? y + 25 : y + 3;
  if (billConfig.showTermsAndConditions !== false && billConfig.termsAndConditions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${labels.termsTitle || 'TERMS & CONDITIONS'}:`, margin, termsY);
    termsY += 3.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    billConfig.termsAndConditions.slice(0, 5).forEach((term, idx) => {
      const wrapped = doc.splitTextToSize(`${idx + 1}. ${term}`, leftColWidth);
      doc.text(wrapped, margin, termsY);
      termsY += wrapped.length * 3.2;
    });
  }

  if (footerCustomFields.length > 0) {
    termsY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    footerCustomFields.forEach((cf) => {
      doc.text(`${cf.label}: ${cf.value}`, margin, termsY);
      termsY += 3.5;
    });
  }

  const signY = Math.max(termsY + 8, y + 44);
  if (billConfig.showSignatureAndSeal !== false) {
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, signY, margin + 45, signY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(labels.customerSignLabel || 'Customer Signature', margin + 22.5, signY + 4, {
      align: 'center',
    });

    doc.line(pageWidth - margin - 55, signY, pageWidth - margin, signY);
    doc.setTextColor(15, 23, 42);
    doc.text(`For ${displayCompanyName}`, pageWidth - margin - 27.5, signY - 2, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${labels.signatoryLabel || 'Authorized Signatory'} (${
        franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner
      })`,
      pageWidth - margin - 27.5,
      signY + 4,
      { align: 'center' }
    );
  }

  if (billConfig.customFooterMatter) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...activeTheme.primary);
    doc.text(billConfig.customFooterMatter, pageWidth / 2, signY + 10, { align: 'center' });
  }

  return doc;
};

/**
 * Downloads the generated PDF directly to the user's device
 */
export const downloadInvoicePdf = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4',
  overrideConfig?: Partial<BillPrintConfig>
): string => {
  const doc = generateInvoicePdfDoc(invoice, franchiseConfig, format, overrideConfig);
  const filename = getSanitizedInvoiceFilename(invoice, format);
  doc.save(filename);
  return filename;
};

/**
 * Creates a Blob and File object for Web Share API or previewing
 */
export const getInvoicePdfFile = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4',
  overrideConfig?: Partial<BillPrintConfig>
): { blob: Blob; file: File; filename: string; blobUrl: string } => {
  const doc = generateInvoicePdfDoc(invoice, franchiseConfig, format, overrideConfig);
  const filename = getSanitizedInvoiceFilename(invoice, format);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  return { blob, file, filename, blobUrl };
};

/**
 * Shares the Invoice PDF on WhatsApp
 */
export const shareInvoicePdfOnWhatsApp = async (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4',
  forceDirectWhatsAppChat: boolean = false,
  overrideConfig?: Partial<BillPrintConfig>
): Promise<{ method: 'native_file_share' | 'whatsapp_chat_with_download'; filename: string }> => {
  const { file, filename } = getInvoicePdfFile(invoice, franchiseConfig, format, overrideConfig);
  const whatsappText = buildInvoiceWhatsAppText(invoice, franchiseConfig, overrideConfig);

  if (
    !forceDirectWhatsAppChat &&
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      const shareData: ShareData = {
        title: `GST Tax Invoice #${invoice.invoiceNumber} - ${franchiseConfig.name}`,
        text: whatsappText,
        files: [file],
      };
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return { method: 'native_file_share', filename };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { method: 'native_file_share', filename };
      }
    }
  }

  downloadInvoicePdf(invoice, franchiseConfig, format, overrideConfig);

  const cleanPhone = (invoice.customerMobile || '').replace(/\D/g, '').slice(-10);
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waTextWithPdfNote = `${whatsappText}\n\n📎 *Official PDF Invoice (${filename}) has been generated & attached.*`;
  const waUrl = fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(waTextWithPdfNote)}`
    : `https://wa.me/?text=${encodeURIComponent(waTextWithPdfNote)}`;

  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { method: 'whatsapp_chat_with_download', filename };
};

/**
 * Downloads the PDF invoice and opens the user's email client with pre-filled subject & invoice summary
 */
export const emailInvoicePdf = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  recipientEmail: string = '',
  format: PdfInvoiceFormat = 'a4',
  overrideConfig?: Partial<BillPrintConfig>
): { filename: string; mailtoUrl: string } => {
  const filename = downloadInvoicePdf(invoice, franchiseConfig, format, overrideConfig);
  const sessionYear = getInvoiceSessionYear(invoice);

  const subject = `GST Tax Invoice #${invoice.invoiceNumber} (${sessionYear}) - ${franchiseConfig.name}`;
  const bodyLines = [
    `Dear ${invoice.customerName},`,
    ``,
    `Thank you for your purchase at ${franchiseConfig.name} (${
      franchiseConfig.parentCompany || 'Asclepius Wellness Pvt. Ltd.'
    }).`,
    `Please find your finalized PDF Tax Invoice (${filename}) downloaded and ready to attach to this email.`,
    ``,
    `--- INVOICE SUMMARY ---`,
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Financial Session: ${sessionYear} (April to March)`,
    `Invoice Date: ${invoice.date}`,
    `Customer Name: ${invoice.customerName} (+91 ${invoice.customerMobile})`,
    invoice.customerAwplId ? `AWPL Direct Seller ID: ${invoice.customerAwplId}` : '',
    `Total Items: ${invoice.items.length}`,
    `Grand Total: ${formatPdfINR(invoice.grandTotal)}`,
    `Total AWPL SP Earned: ${invoice.totalSp} SP`,
    `Payment Mode: ${invoice.paymentMethod} (${invoice.paymentStatus.toUpperCase()})`,
    invoice.balanceDue > 0
      ? `Balance Due: ${formatPdfINR(invoice.balanceDue)} (Pay via UPI: ${franchiseConfig.bankUpiId})`
      : `Payment Status: Paid in Full`,
    ``,
    `Warm Regards,`,
    `${franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner}`,
    `${franchiseConfig.name}`,
    `${franchiseConfig.address}`,
    `Phone: ${franchiseConfig.phone} | GSTIN: ${franchiseConfig.gstin}`,
  ].filter((line) => line !== undefined);

  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

  const link = document.createElement('a');
  link.href = mailtoUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { filename, mailtoUrl };
};

/**
 * Exports a Batch PDF Register of all currently filtered invoices in InvoiceList
 */
export const exportFilteredInvoicesRegisterPdf = (
  invoices: Invoice[],
  franchiseConfig: FranchiseConfig,
  activeSessionLabel: string = 'All Sessions'
): string => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${franchiseConfig.name.toUpperCase()} — GST INVOICE REGISTER`, margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `GSTIN: ${franchiseConfig.gstin} | C&F Code: ${franchiseConfig.franchiseCode} | Session Filter: ${activeSessionLabel} | Generated: ${new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')}`,
    margin,
    18.5
  );

  const activeInvoices = invoices.filter((i) => i.paymentStatus !== 'cancelled');
  const totalRev = activeInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalSp = activeInvoices.reduce((s, i) => s + i.totalSp, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(234, 88, 12);
  doc.text(
    `Total Bills: ${invoices.length} (${activeInvoices.length} Active)  |  Total Revenue: ${formatPdfINR(
      totalRev
    )}  |  Total SP: ${totalSp} SP`,
    margin,
    24
  );

  const head = [
    [
      '#',
      'Invoice Number',
      'Session',
      'Date',
      'Customer & Mobile',
      'AWPL ID',
      'Items',
      'SP',
      'Payment Mode',
      'C&F Portal Status',
      'Grand Total',
    ],
  ];

  const body = invoices.map((inv, idx) => [
    String(idx + 1),
    inv.invoiceNumber,
    getInvoiceSessionYear(inv),
    inv.date,
    `${inv.customerName}\n+91 ${inv.customerMobile}`,
    inv.customerAwplId || 'Retail',
    String(inv.items.length),
    `${inv.totalSp} SP`,
    `${inv.paymentMethod} (${inv.paymentStatus.toUpperCase()})`,
    inv.cfSyncStatus === 'synced'
      ? `Synced (${inv.cfBillNumber || 'Done'})`
      : inv.cfSyncStatus === 'partially_synced'
      ? 'Partial'
      : 'Pending',
    formatPdfINR(inv.grandTotal),
  ]);

  autoTable(doc, {
    startY: 28,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [255, 251, 235],
    },
  });

  const filename = `DRW_Invoice_Register_${activeSessionLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
};
