# Fully Editable Bill Format Studio & Live Inline Bill Designer

Deliver a complete, user-customizable **Bill Format Studio** that lets C&F Owners and Billing Staff control every aspect of how their bill looks and what information appears on it—combining **live inline click-to-edit directly on the bill preview**, a **visual template & column/section builder**, **custom user-defined fields**, and **dual persistence** (save as the permanent C&F default template or apply per-bill overrides before printing/downloading PDF).

## User Review & Critical Decisions

> [!IMPORTANT]
> All requirements confirmed during clarification are incorporated below. Review the plan and click **Proceed** to build.

- **Confirmed Decision 1 — Full Section, Column & Custom Field Control**: Users can show, hide, rename, or edit every part of the bill:
  - **Header & Company Details**: Company logo, C&F name override, invoice title badge (`GST TAX INVOICE`, `RETAIL BILL`, etc.), header/sub-header text, address, phone/email, GSTIN, PAN, FSSAI, Drug/Ayush License (DL), and Franchise Code.
  - **Customer & AWPL Block**: Customer Name/Mobile, AWPL DS ID, Green ID / Repurchase Side (`S.A.O` / `S.G.O`) / Greening Category badge, Payment Mode & Status, Staff Name, and Total SP badge.
  - **Line-Item Table Columns & Labels**: Individual toggles and editable column headings for `S.No (#)`, `Product Name`, `SKU Code`, `AWPL Online Status`, `Target AWPL ID per Item`, `Pending Product Tag`, `Batch No.`, `Expiry Date`, `MRP`, `Unit Rate (DP)`, `Discount %`, `Qty`, `SP (Unit & Line Total)`, `GST %`, and `Line Total`.
  - **Totals, Payment, QR Codes & Footer**: Subtotal, Discount, GST Breakdown, UPI Fee, Grand Total, Total SP Highlight Box, Amount Paid / Balance Due, Bank Details & UPI Scan-to-Pay QR, Customer App Download QR, C&F Online Clearance Strip, Editable Terms & Conditions, Custom Footer Message, Authorized Signatory Name, Customer Signature Line, and Official C&F Seal.
  - **User-Defined Custom Fields & Notes**: Users can add unlimited custom key-value fields (e.g., `Vehicle / Courier No.`, `Doctor / Advisor Name`, `E-Way Bill No.`, `Special Offer Note`) in the Header, Customer block, or Footer.
- **Confirmed Decision 2 — Triple Editing Experience (Options 1, 2 & 3)**:
  1. **Live Click-to-Edit Inline Mode on Bill Preview**: Toggle **"Live Inline Edit on Bill"** to click any heading, label, company detail, customer note, column header, or footer text directly on the bill canvas and edit it in place—plus one-click eye icons on each bill block to hide/show sections on the fly.
  2. **Visual Bill Format Customizer Panel**: Organized tabs for **Layout & Presets** (Full Tax Invoice, Compact Counter Bill, SP & Product Summary Only, Thermal POS Receipt, Custom), **Header & Licenses**, **Table Columns & Labels**, **Totals, QR & Footer**, and **Custom Bill Fields**.
  3. **Quick Layout Presets & Font/Density Controls**: Adjust bill accent theme (Emerald AWPL, Classic Black & White Print, Saffron Corporate, Royal Indigo), font scale (`Compact`, `Standard`, `Large`), and table border style.
- **Confirmed Decision 3 — Dual Save Scope (Permanent C&F Default + Per-Bill Overrides)**:
  - **Apply to This Bill Only**: Keeps customizations active for the current invoice print, PDF download, and WhatsApp share without altering the franchise's global template (and optionally saves the override onto that specific invoice record).
  - **Save as Default C&F Template**: Saves the customized bill format permanently to the C&F Franchise profile (`BillPrintConfig`) and cloud backup so all future bills automatically use it.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the bill print & preview modal into an interactive **Bill Format Studio** where users decide exactly what appears on their bill and how it is formatted across A4, A5, Letter, Thermal 80mm, Thermal 58mm, and generated PDFs.
- **Target Audience / Persona**: AWPL C&F Franchise Owners and POS Billing Staff who need tailored invoices for different billing scenarios (full statutory GST bills, simplified counter receipts, distributor SP summaries, or custom transport/courier bills).
- **Key Value**: Eliminates rigid invoice templates—users can click any text on the bill to edit it immediately, hide unwanted columns or license numbers with a single click, add custom fields, and print or export matching PDFs.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Quick Preset Selection**: From the top toolbar of the Bill Print Studio, the user can pick a 1-click preset (`Full GST & AWPL Tax Invoice`, `Standard Counter Bill`, `Minimal Retail Receipt`, `Distributor SP Focus`) or open the full customizer.
  2. **Live Inline Editing directly on the Bill**: When **Live Edit on Bill** is active, hovering over any heading, label, company field, table column header, or footer text highlights it with a subtle dashed edit ring. Clicking edits the text inline in real time, while floating section action pills allow hiding/restoring any block.
  3. **Granular Section & Column Builder**: In the visual editor panel, 4 structured tabs let users toggle individual fields (e.g., hide `MRP` or `Batch`, show `Expiry Date` or `Discount %`, toggle `FSSAI` / `DL` / `PAN` individually, or add custom fields like `Courier Tracking No.`).
  4. **Save & Output**: Users choose **"Apply to This Bill Only"** or **"Save as Permanent C&F Default"**, then click **Print Bill**, **Download PDF**, or **Share PDF on WhatsApp**—all of which honor the exact customized format.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft enterprise document studio with crisp paper simulation, tabular numeric alignment (`tabular-nums`), and clear visual separation between the dark studio control bar and the paper canvas.
  - *Color Palette & Mood*: Studio chrome in deep slate/emerald (`#0F172A` / `#064E3B`), paper canvas in pure print-accurate white (`#FFFFFF`) with selectable bill theme accents (`Emerald`, `Monochrome Black & White`, `Saffron`, `Indigo`).
  - *Typography & Hierarchy*: Clean sans-serif structural headings paired with monospace tabular numerals (`font-mono tabular-nums`) for all quantities, rates, SP calculations, GST percentages, and totals.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified Configuration Driving Both HTML Print & jsPDF Export**
  - *Chosen Approach*: Both the live HTML printable canvas (`A4/A5/Letter` and `Thermal 80mm/58mm`) and the `jsPDF` generator read from the same active `BillPrintConfig` (including per-bill overrides, custom column labels, hidden columns, and custom fields).
  - *Why*: Guarantees that downloading or sharing a PDF on WhatsApp produces the exact same columns, labels, and custom fields that the user sees in the print preview.
  - *Alternatives Considered*: Keeping PDF generation static—rejected because users expect their custom bill format to apply to PDF downloads as well as physical prints.
- **Decision 2: Non-Destructive Per-Bill Override vs. Franchise Default**
  - *Chosen Approach*: Store an optional `customBillConfigOverride` on individual `Invoice` records when the user saves changes for "This Bill Only", while "Save as C&F Default" updates `franchiseConfig.billPrintConfig`.
  - *Why*: Lets staff customize a specific customer's bill (e.g., adding a transport note or hiding MRP for a specific order) without messing up the store's standard template, while still allowing permanent template updates whenever desired.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Bill Format Studio (Modal)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Studio Toolbar: Paper Size │ Orientation │ Preset │ Live Inline Edit │  │
│  └──────────────────┬───────────────────────────────────────┬───────────┘  │
│                     ▼                                       ▼              │
│  ┌─────────────────────────────────────┐ ┌──────────────────────────────┐  │
│  │   4-Tab Visual Template Builder     │ │   Live Interactive Canvas    │  │
│  │  • Tab 1: Paper, Theme & Presets    │ │  • Click-to-edit headings,   │  │
│  │  • Tab 2: Header, Licenses & Cust   │ │    column titles & notes     │  │
│  │  • Tab 3: Item Table Columns        │ │  • Hover section hide/show   │  │
│  │  • Tab 4: Totals, QR, Sign & Custom │ │  • A4/A5/Letter & Thermal    │  │
│  └──────────────────┬──────────────────┘ └──────────────┬───────────────┘  │
│                     └─────────────────┬─────────────────┘                  │
│                                       ▼                                    │
│        ┌────────────────────────────────────────────────────────────┐      │
│        │                 Dual Persistence & Export                  │      │
│        │  • Save to This Bill Only (Invoice.customBillConfig)       │      │
│        │  • Save as Default C&F Template (Franchise.billPrintConfig)│      │
│        │  • Synced Output → Browser Print + jsPDF + WhatsApp Text   │      │
│        └────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State Extensions**:
  - Extend `BillPrintConfig` with:
    - **Granular Header & License Toggles**: `showPhoneAndEmail`, `showOwnerNames`, `showGstin`, `showPanNumber`, `showFssaiAndDl`, `showFranchiseCode`, `showSessionYear`.
    - **Customer & AWPL Block Toggles**: `showCustomerSection`, `showCustomerAwplId`, `showGreenIdBadge`, `showPaymentAndStaffBlock`.
    - **Granular Table Column Toggles**: `showSerialNoColumn`, `showSkuInItem`, `showOnlineStatusInItem`, `showItemAwplId`, `showPendingTagInItem`, `showBatchColumn`, `showExpiryColumn`, `showMrpColumn`, `showDiscountColumn`, `showRateColumn`, `showQtyColumn`, `showSpPoints`, `showGstBreakdown`, `showLineTotalColumn`.
    - **Editable Column & Section Labels (`columnLabels`)**: Custom text overrides for table headers (`#`, `Product`, `Batch`, `Expiry`, `MRP`, `Rate`, `Disc %`, `Qty`, `SP`, `GST %`, `Total`) and section titles (`billedToTitle`, `paymentDetailsTitle`, `termsTitle`, `signatoryLabel`, `customerSignLabel`).
    - **Totals & Footer Toggles**: `showSubtotalAndDiscount`, `showAmountInWords`, `showBalanceDue`, `showBankAndQr`, `showCustomerAppQr`, `showTermsAndConditions`, `showSignatureAndSeal`, `showOfficialSealStamp`.
    - **Visual Styling & Custom Fields**: `themeColor` (`emerald` | `monochrome` | `saffron` | `indigo`), `fontSizeScale` (`compact` | `normal` | `large`), and `customFields: { id: string; label: string; value: string; position: 'header' | 'customer' | 'footer'; visible: boolean }[]`.
  - Extend `Invoice` with optional `customBillConfig?: Partial<BillPrintConfig>` for per-bill overrides.
- **Interactive Component & State Mapping**:
  - Clicking any inline-editable text element when `isInlineEditMode` is active renders an inline input or content-editable field that immediately updates `billConfig`.
  - Toggling any checkbox in the 4-Tab Visual Builder or clicking a quick preset (`Full Tax Invoice`, `Compact Counter`, `SP Summary`, `Thermal Receipt`) immediately updates the live preview and PDF generator.
  - Clicking **"Save for This Bill Only"** persists the config onto the current invoice; clicking **"Save as Default C&F Template"** persists it to `FranchiseConfig` and cloud storage.
