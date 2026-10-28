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
 * Builds a complete, formatted WhatsApp message for an invoice
 */
export const buildInvoiceWhatsAppText = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig
): string => {
  const billConfig: BillPrintConfig = {
    ...DEFAULT_BILL_PRINT_CONFIG,
    ...(franchiseConfig.billPrintConfig || {}),
  };

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

  const lines = [
    `🌿 *${franchiseConfig.name}*`,
    `*${
      billConfig.customHeaderMatter ||
      `Authorized Franchise of ${franchiseConfig.parentCompany || 'Asclepius Wellness Pvt. Ltd.'}`
    }*`,
    `---------------------------------`,
    `📄 *OFFICIAL PDF TAX INVOICE (${pdfFileName})*`,
    `🧾 *Invoice No:* ${invoice.invoiceNumber}${
      invoice.regeneratedCount ? ` (v${invoice.regeneratedCount})` : ''
    }`,
    `🗓️ *Financial Session:* ${sessionYear} (Apr–Mar)`,
    `📅 *Date:* ${invoice.date}`,
    `👤 *Customer:* ${invoice.customerName} (+91 ${invoice.customerMobile})`,
    invoice.customerAwplId ? `🆔 *AWPL DS ID:* ${invoice.customerAwplId}` : '',
    invoice.customerAwplId
      ? primaryIsGreen
        ? `✅ *AWPL ID Status:* GREEN ID • Side: *${primaryRepurchaseSide || 'S.A.O'}*`
        : `🌱 *AWPL ID Status:* NOT GREEN • Greening: *${primaryGreeningCategory || '27 SP'}*`
      : '',
    `---------------------------------`,
    `*BILLED ITEMS (${invoice.items.length}):*`,
    ...invoice.items.map((it, idx) => {
      const targetId = it.targetAwplId || invoice.customerAwplId || 'Retail';
      const cfText = it.cfSynced
        ? ` [Online Done: ${it.cfBillNumber || invoice.cfBillNumber || 'Yes'}]`
        : ` [Online Pending]`;
      return `${idx + 1}. *${it.product.name}* x${it.quantity} = Rs. ${it.lineTotal.toLocaleString(
        'en-IN'
      )} (${it.spEarned} SP) • ID: ${targetId}${cfText}`;
    }),
    `---------------------------------`,
    `💰 *Grand Total:* Rs. ${invoice.grandTotal.toLocaleString('en-IN')}`,
    `✨ *Total AWPL SP Earned:* ${invoice.totalSp} SP`,
    `💳 *Payment Mode:* ${invoice.paymentMethod} (${invoice.paymentStatus.toUpperCase()})`,
    invoice.balanceDue > 0
      ? `⚠️ *Balance Due:* Rs. ${invoice.balanceDue.toLocaleString('en-IN')} (UPI: ${
          franchiseConfig.bankUpiId
        })`
      : `✅ *Payment Status:* Paid in Full`,
    `---------------------------------`,
    `📍 *C&F Address:* ${franchiseConfig.address}`,
    `📞 *Contact:* ${franchiseConfig.phone} | GSTIN: ${franchiseConfig.gstin}`,
    billConfig.customFooterMatter || `Thank you for choosing ${franchiseConfig.name}!`,
  ].filter(Boolean);

  return lines.join('\n');
};

/**
 * Generates a professionally formatted jsPDF document for a single finalized invoice
 */
export const generateInvoicePdfDoc = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4'
): jsPDF => {
  const billConfig: BillPrintConfig = {
    ...DEFAULT_BILL_PRINT_CONFIG,
    ...(franchiseConfig.billPrintConfig || {}),
    termsAndConditions:
      franchiseConfig.billPrintConfig?.termsAndConditions &&
      franchiseConfig.billPrintConfig.termsAndConditions.length > 0
        ? franchiseConfig.billPrintConfig.termsAndConditions
        : DEFAULT_BILL_PRINT_CONFIG.termsAndConditions,
  };

  const sessionYear = getInvoiceSessionYear(invoice);

  if (format === 'thermal') {
    // Compact 80mm POS Thermal Receipt PDF
    const estimatedHeight = Math.max(210, 145 + invoice.items.length * 14);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, estimatedHeight],
    });

    let y = 7;
    // Orange top accent bar
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, 80, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(billConfig.invoiceTitle || 'GST TAX INVOICE', 40, y, { align: 'center' });
    y += 4.5;

    doc.setFontSize(10.5);
    doc.setTextColor(234, 88, 12);
    const titleLines = doc.splitTextToSize(franchiseConfig.name.toUpperCase(), 72);
    doc.text(titleLines, 40, y, { align: 'center' });
    y += titleLines.length * 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const addrLines = doc.splitTextToSize(franchiseConfig.address, 72);
    doc.text(addrLines, 40, y, { align: 'center' });
    y += addrLines.length * 3.2;

    doc.text(`Ph: ${franchiseConfig.phone} | GSTIN: ${franchiseConfig.gstin}`, 40, y, {
      align: 'center',
    });
    y += 3.5;
    doc.text(`Session (Apr-Mar): ${sessionYear}`, 40, y, { align: 'center' });
    y += 3;

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
    doc.text(`Customer: ${invoice.customerName}`, 4, y);
    y += 3.5;
    doc.text(`Mobile: +91 ${invoice.customerMobile}`, 4, y);
    y += 3.5;
    if (invoice.customerAwplId) {
      doc.setFont('helvetica', 'bold');
      doc.text(`AWPL ID: ${invoice.customerAwplId}`, 4, y);
      y += 3.5;
    }

    doc.line(4, y, 76, y);
    y += 3.5;

    // Items header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ITEM / QTY x RATE', 4, y);
    doc.text('TOTAL', 76, y, { align: 'right' });
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
      const itemLines = doc.splitTextToSize(`${idx + 1}. ${it.product.name}`, 56);
      doc.text(itemLines, 4, y);
      y += itemLines.length * 3.2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(
        `   ${it.quantity} x Rs.${it.unitPrice} (SP: ${unitSp}x${it.quantity}=${it.spEarned} SP)`,
        4,
        y
      );
      doc.setFont('helvetica', 'bold');
      doc.text(`Rs.${it.lineTotal.toLocaleString('en-IN')}`, 76, y, { align: 'right' });
      y += 3.8;
    });

    doc.line(4, y, 76, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text('Subtotal:', 4, y);
    doc.text(formatPdfINR(invoice.subtotal), 76, y, { align: 'right' });
    y += 3.5;

    doc.text('Included GST:', 4, y);
    doc.text(formatPdfINR(invoice.taxTotal), 76, y, { align: 'right' });
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(234, 88, 12);
    doc.text('GRAND TOTAL:', 4, y);
    doc.text(formatPdfINR(invoice.grandTotal), 76, y, { align: 'right' });
    y += 4.2;

    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text(`ELIGIBLE AWPL SP: ${invoice.totalSp} SP`, 4, y);
    y += 3.8;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Payment: ${invoice.paymentMethod} (${invoice.paymentStatus.toUpperCase()})`,
      4,
      y
    );
    y += 4;

    doc.line(4, y, 76, y);
    y += 4;
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`UPI ID: ${franchiseConfig.bankUpiId}`, 40, y, { align: 'center' });
    y += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.text(
      billConfig.customFooterMatter || `Thank you for visiting ${franchiseConfig.name}!`,
      40,
      y,
      { align: 'center' }
    );

    return doc;
  }

  // ================= STANDARD A4 GST TAX INVOICE PDF =================
  const doc = new jsPDF({
    orientation: billConfig.orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 12;

  // Top Vibrant Orange & Slate Header Banner
  doc.setFillColor(249, 115, 22); // #f97316 Orange
  doc.rect(0, 0, pageWidth, 4.5, 'F');

  // Header Box Background
  doc.setFillColor(255, 247, 237); // orange-50
  doc.setDrawColor(251, 146, 60); // orange-400
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 34, 2.5, 2.5, 'FD');

  // Left: Franchise Name & Address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(franchiseConfig.name.toUpperCase(), margin + 4, y + 5);

  doc.setFontSize(8.5);
  doc.setTextColor(234, 88, 12); // orange-600
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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(franchiseConfig.address, margin + 4, y + 15);
  doc.text(
    `C&F Owner: ${franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner} | Phone: ${
      franchiseConfig.phone
    } | Email: ${franchiseConfig.email}`,
    margin + 4,
    y + 19.5
  );
  doc.text(
    `GSTIN: ${franchiseConfig.gstin} | C&F Code: ${franchiseConfig.franchiseCode} | FSSAI: ${franchiseConfig.fssaiNumber} | DL: ${franchiseConfig.dlNumber}`,
    margin + 4,
    y + 24
  );

  if (billConfig.customSubHeaderMatter) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(billConfig.customSubHeaderMatter, margin + 4, y + 28.5);
  }

  // Right: Tax Invoice Badge & Invoice Meta
  const rightBoxWidth = 68;
  const rightBoxX = pageWidth - margin - rightBoxWidth - 3;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightBoxX, y + 1, rightBoxWidth, 28, 2, 2, 'FD');

  doc.setFillColor(249, 115, 22);
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
  doc.text(`Session (Apr-Mar): ${sessionYear}`, rightBoxX + 3, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text(
    `Status: ${invoice.paymentStatus.toUpperCase()} (${invoice.paymentMethod})`,
    rightBoxX + 3,
    y + 26
  );

  y += 37;

  // Customer & Billing Allocation Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'FD');

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
  doc.setTextColor(234, 88, 12);
  doc.text('BILLED TO CUSTOMER & AWPL ID ALLOCATION:', margin + 3.5, y + 5);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${invoice.customerName} (+91 ${invoice.customerMobile})`, margin + 3.5, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const awplInfoLine = invoice.customerAwplId
    ? `AWPL Direct Seller ID: ${invoice.customerAwplId}  |  ID Status: ${
        primaryIsGreen
          ? `GREEN ID (Repurchase Side: ${primaryRepurchaseSide || 'S.A.O'})`
          : `NOT GREEN (Greening Category: ${primaryGreeningCategory || '27 SP'})`
      }`
    : 'Retail Walk-in Customer (No AWPL DS ID Attached)';
  doc.text(awplInfoLine, margin + 3.5, y + 15.5);

  const syncedItemsCount = invoice.items.filter((i) => i.cfSynced).length;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.text(
    `AWPL C&F Online Clearance: ${syncedItemsCount}/${invoice.items.length} Items Synced  |  Online Bill #: ${
      invoice.cfBillNumber || 'Pending'
    }  |  Billed By: ${invoice.staffName}`,
    margin + 3.5,
    y + 19.8
  );

  y += 26;

  // Line Items Table using jspdf-autotable
  const tableHead = [
    [
      '#',
      'Product Description & AWPL Online Status',
      'SKU / Batch',
      'MRP',
      'Unit Rate',
      'Qty',
      'SP (Unit/Total)',
      'GST %',
      'Line Total',
    ],
  ];

  const tableBody = invoice.items.map((item, idx) => {
    const targetId = item.targetAwplId || invoice.customerAwplId || 'Retail';
    const unitSp =
      item.product.sp !== undefined
        ? item.product.sp
        : Math.round((item.spEarned || 0) / Math.max(1, item.quantity));
    const syncBadge = item.cfSynced
      ? `Online Done (${item.cfBillNumber || invoice.cfBillNumber || 'Synced'})`
      : 'Online Pending';
    const pendingTag = item.isPendingProduct
      ? item.pendingProductStatus === 'given'
        ? `\n[PENDING PRODUCT GIVEN: ${item.pendingGivenAt || 'Handed Over'}]`
        : `\n[PENDING PRODUCT: TO BE GIVEN ON ORIGINAL BILL]`
      : '';

    return [
      String(idx + 1),
      `${item.product.name}\nSP: ${unitSp} SP/unit (Line SP: ${item.spEarned} SP) | ID: ${targetId} | ${syncBadge}${pendingTag}`,
      `${item.product.sku}\nBatch: ${item.product.batchNumber}`,
      formatPdfINR(item.product.mrp),
      `${formatPdfINR(item.unitPrice)} (${item.selectedPriceType.toUpperCase()})`,
      String(item.quantity),
      `${item.spEarned} SP\n(${unitSp}x${item.quantity})`,
      `${item.product.gstRate}%`,
      formatPdfINR(item.lineTotal),
    ];
  });

  const totalUnits = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  const tableFoot = [
    [
      '',
      'TOTAL BILL QTY, SP & AMOUNT',
      '',
      '',
      '',
      String(totalUnits),
      `${invoice.totalSp} SP`,
      '',
      formatPdfINR(invoice.grandTotal),
    ],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: {
      fillColor: [249, 115, 22], // Vibrant Orange #f97316
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'left',
    },
    footStyles: {
      fillColor: [236, 253, 245],
      textColor: [6, 95, 70],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [255, 251, 235],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25 },
      3: { cellWidth: 19, halign: 'right' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 12, halign: 'right' },
      8: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Check if we need a page break for summary & footer
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 62 > pageHeight) {
    doc.addPage();
    y = 15;
  }

  // Left Column: Bank & UPI Details + Terms & Conditions
  const leftColWidth = (pageWidth - margin * 2) * 0.56;
  const rightColWidth = (pageWidth - margin * 2) * 0.41;
  const rightColX = pageWidth - margin - rightColWidth;

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

  // Right Column: Totals Summary Box
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(249, 115, 22);
  doc.roundedRect(rightColX, y, rightColWidth, 34, 2, 2, 'FD');

  let sumY = y + 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('Subtotal:', rightColX + 3.5, sumY);
  doc.text(formatPdfINR(invoice.subtotal), rightColX + rightColWidth - 3.5, sumY, {
    align: 'right',
  });

  sumY += 4.5;
  doc.text('GST Included (CGST+SGST):', rightColX + 3.5, sumY);
  doc.text(`(${formatPdfINR(invoice.taxTotal)})`, rightColX + rightColWidth - 3.5, sumY, {
    align: 'right',
  });

  if (invoice.discountTotal > 0) {
    sumY += 4.5;
    doc.text('Discount:', rightColX + 3.5, sumY);
    doc.text(`-${formatPdfINR(invoice.discountTotal)}`, rightColX + rightColWidth - 3.5, sumY, {
      align: 'right',
    });
  }

  sumY += 5.5;
  doc.setDrawColor(251, 146, 60);
  doc.line(rightColX + 3, sumY - 3, rightColX + rightColWidth - 3, sumY - 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(234, 88, 12);
  doc.text('GRAND TOTAL:', rightColX + 3.5, sumY + 1);
  doc.text(formatPdfINR(invoice.grandTotal), rightColX + rightColWidth - 3.5, sumY + 1, {
    align: 'right',
  });

  sumY += 6;
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text('Total AWPL SP Earned:', rightColX + 3.5, sumY);
  doc.text(`${invoice.totalSp} SP`, rightColX + rightColWidth - 3.5, sumY, {
    align: 'right',
  });

  sumY += 5;
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  const paidText =
    invoice.balanceDue > 0
      ? `Paid: ${formatPdfINR(invoice.amountPaid)} | Due: ${formatPdfINR(invoice.balanceDue)}`
      : `Paid in Full: ${formatPdfINR(invoice.amountPaid)} (${invoice.paymentMethod})`;
  doc.text(paidText, rightColX + 3.5, sumY);

  // Terms & Conditions below Bank Box
  let termsY = y + 25;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TERMS & CONDITIONS:', margin, termsY);
  termsY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  billConfig.termsAndConditions.slice(0, 4).forEach((term, idx) => {
    const wrapped = doc.splitTextToSize(`${idx + 1}. ${term}`, leftColWidth);
    doc.text(wrapped, margin, termsY);
    termsY += wrapped.length * 3.2;
  });

  const signY = Math.max(termsY + 8, y + 44);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, signY, margin + 45, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Customer Signature', margin + 22.5, signY + 4, { align: 'center' });

  doc.line(pageWidth - margin - 55, signY, pageWidth - margin, signY);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `For ${franchiseConfig.name}`,
    pageWidth - margin - 27.5,
    signY - 2,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Authorized Signatory (${franchiseConfig.cfOwnerName || franchiseConfig.franchiseOwner})`,
    pageWidth - margin - 27.5,
    signY + 4,
    { align: 'center' }
  );

  // Footer message
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(234, 88, 12);
  doc.text(
    billConfig.customFooterMatter || `Thank you for choosing ${franchiseConfig.name}!`,
    pageWidth / 2,
    signY + 10,
    { align: 'center' }
  );

  return doc;
};

/**
 * Downloads the generated PDF directly to the user's device
 */
export const downloadInvoicePdf = (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4'
): string => {
  const doc = generateInvoicePdfDoc(invoice, franchiseConfig, format);
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
  format: PdfInvoiceFormat = 'a4'
): { blob: Blob; file: File; filename: string; blobUrl: string } => {
  const doc = generateInvoicePdfDoc(invoice, franchiseConfig, format);
  const filename = getSanitizedInvoiceFilename(invoice, format);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  return { blob, file, filename, blobUrl };
};

/**
 * Shares the Invoice PDF on WhatsApp:
 * 1. If the browser/device supports native file sharing (`navigator.canShare({ files: [file] })`),
 *    it opens the native Share Sheet with the actual PDF file attached + WhatsApp summary text.
 * 2. Otherwise (or when `mode === 'whatsapp_chat'`), it automatically downloads the PDF file
 *    and opens the customer's WhatsApp chat (`wa.me`) with the formatted invoice summary so the
 *    C&F owner can drop/attach the downloaded PDF directly into WhatsApp.
 */
export const shareInvoicePdfOnWhatsApp = async (
  invoice: Invoice,
  franchiseConfig: FranchiseConfig,
  format: PdfInvoiceFormat = 'a4',
  forceDirectWhatsAppChat: boolean = false
): Promise<{ method: 'native_file_share' | 'whatsapp_chat_with_download'; filename: string }> => {
  const { file, filename } = getInvoicePdfFile(invoice, franchiseConfig, format);
  const whatsappText = buildInvoiceWhatsAppText(invoice, franchiseConfig);

  // Try native Web Share API with PDF file attachment first (works great on Android/iOS & supported desktops)
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
      // If user cancelled the share sheet, don't force redirect unless requested
      if (err?.name === 'AbortError') {
        return { method: 'native_file_share', filename };
      }
    }
  }

  // Fallback / Direct WhatsApp Chat: Download the PDF file AND open WhatsApp chat to customer's number
  downloadInvoicePdf(invoice, franchiseConfig, format);

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
  format: PdfInvoiceFormat = 'a4'
): { filename: string; mailtoUrl: string } => {
  const filename = downloadInvoicePdf(invoice, franchiseConfig, format);
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
