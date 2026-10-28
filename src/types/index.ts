export type Role = 
  | 'super_admin' 
  | 'franchise_admin' 
  | 'billing_staff' 
  | 'inventory_staff' 
  | 'support_staff' 
  | 'customer';

export type AppPortalMode = 'cnf_app' | 'customer_app' | 'main_app';

export type ProductCategory = 
  | 'Ayurvedic Wellness'
  | 'Oral Care'
  | 'Hair & Personal Care'
  | 'Nutrition & Food'
  | 'Vedic Agri & Veterinary'
  | 'Home Care';

export interface AWPLProduct {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  mrp: number; // Maximum Retail Price in INR
  dp: number;  // Distributor Price in INR
  sp: number;  // Sales Point (e.g. 10, 15, 27, 52)
  stock: number;
  lowStockThreshold: number;
  batchNumber: string;
  expiryDate: string;
  description: string;
  gstRate: number; // 5, 12, 18
  status: 'active' | 'out_of_stock' | 'discontinued';
  barcode: string;
  imageUrl?: string;
  lastUpdated: string;
  source: 'Official AWPL Sync' | 'Manual Entry' | 'CSV Import';
  stopCustomerAppSale?: boolean; // If true, C&F has stopped billing for this item in the Customer App
  priceHistory?: {
    date: string;
    oldMrp: number;
    newMrp: number;
    oldDp: number;
    newDp: number;
    oldSp: number;
    newSp: number;
    reason: string;
  }[];
}

export type AWPLRepurchaseSide = 'S.A.O' | 'S.G.O';

export type AWPLGreeningCategory = '27 SP' | '52 SP' | '100 SP' | 'Only Point Update';

export interface LinkedCFDepot {
  id: string;
  name: string;
  shortName?: string;
  code: string;
  city: string;
  state: string;
  address: string;
  upiId: string;
  upiNumber?: string;
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
  contactPhone: string;
  email?: string;
  franchiseOwner?: string;
  cfOwnerName?: string;
  parentCompany?: string;
  isDrightWellness?: boolean;
  infinityStockPermanent?: boolean;
  infinityStockEnabled?: boolean;
}

export interface CartItem {
  product: AWPLProduct;
  quantity: number;
  selectedPriceType: 'mrp' | 'dp';
  unitPrice: number;
  discountPercent: number;
  taxAmount: number;
  lineTotal: number;
  spEarned: number;
  // AWPL C&F Portal Item Tracking
  cfSynced?: boolean;
  cfBillNumber?: string; // Online C&F Bill No e.g. AWPL-CF-SOL-2026-8842
  cfIdNumber?: string;   // C&F ID No e.g. CF-ID-90412
  cfSyncedAt?: string;
  cfRemarks?: string;
  // AWPL ID Allocation (1 ID per item or same ID for all items), Green ID Side (S.A.O / S.G.O) & Greening Category
  targetAwplId?: string;
  targetAwplHolderName?: string;
  isIdGreen?: boolean;
  repurchaseSide?: AWPLRepurchaseSide;
  greeningCategory?: AWPLGreeningCategory;
  // Pending Product by D RIGHT WELLNESS / C&F (Requirement #14 & #15)
  isPendingProduct?: boolean;
  pendingProductStatus?: 'pending' | 'given';
  pendingGivenAt?: string;
  pendingArrivalNotifiedAt?: string;
  pendingNotes?: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  awplId?: string; // e.g., AWPL782910
  isAwplVerified: boolean;
  isAppRegistered?: boolean; // Whether mobile number is registered in our Customer App
  isIdGreen?: boolean;
  preferredSide?: AWPLRepurchaseSide;
  greeningCategory?: AWPLGreeningCategory;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  totalSpEarned: number;
  outstandingBalance: number;
  createdAt: string;
  subscriptionId?: string;
  password?: string;
  pin?: string;
  preferredCfId?: string;
}

export type PaymentMethod = 'UPI' | 'Cash' | 'Split (Cash + UPI)' | 'Card' | 'Credit' | 'Bank Transfer';
export type PaymentStatus = 'paid' | 'partially_paid' | 'pending' | 'refunded' | 'cancelled';
export type CFSyncStatus = 'synced' | 'partially_synced' | 'pending';

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. DRW/2026-2027/3000 or custom C&F short name prefix
  sessionYear?: string;  // April to March Financial Session e.g. "2025-2026", "2026-2027"
  cnfId?: string;
  cnfName?: string;
  cnfShortName?: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  customerAwplId?: string;
  isIdGreen?: boolean;
  repurchaseSide?: AWPLRepurchaseSide;
  greeningCategory?: AWPLGreeningCategory;
  date: string;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  upiTransactionFeePercent?: number;
  upiTransactionFeeAmount?: number;
  upiFeePercent?: number;
  upiFeeAmount?: number;
  grandTotal: number;
  totalSp: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  balanceDue: number;
  splitDetails?: {
    cashAmount: number;
    upiAmount: number;
  };
  paymentReceivedConfirmed?: boolean;
  staffName: string;
  staffId: string;
  notes?: string;
  isOfflineCreated?: boolean;
  isSynced?: boolean;
  cloudSavedAt?: string;
  qrCodeData?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  // Official AWPL C&F Portal Clearance details
  cfBillNumber?: string; // Online C&F Bill No e.g. AWPL-CF-SOL-2026-8842
  cfIdNumber?: string;   // C&F ID No / Distributor C&F Ref No e.g. CF-ID-90412
  cfSyncStatus?: CFSyncStatus;
  cfSyncedAt?: string;
  cfNotes?: string;
  // Linked C&F Depot, Multi-ID Mode & Automatic 7-Day Pending Online + 5-Day Credit Reminders
  selectedCfDepotId?: string;
  selectedCfDepotName?: string;
  awplAllocationMode?: 'same_id' | 'multiple_ids';
  reminder7DaySentAt?: string;
  creditReminder5DaySentAt?: string;
  autoWhatsappQueuedAt?: string;
  autoInAppNotifiedAt?: string;
  isRegisteredAppCustomer?: boolean;
  upiRefNo?: string;
  // Pending Product Workflow (Requirement #14 & #15)
  hasPendingProducts?: boolean;
  pendingProductsStatus?: 'pending' | 'given';
  pendingProductReminderSentAt?: string;
  pendingProductReminderChannel?: 'in_app' | 'whatsapp';
  pendingProductGivenAt?: string;
  // Requirement #3: Update / Regenerate Invoice tracking
  regeneratedCount?: number;
  lastRegeneratedAt?: string;
  // Per-Bill Custom Format Override (when user chooses "Save for This Bill Only")
  customBillConfig?: Partial<BillPrintConfig>;
}

export interface PurchaseBillItem {
  productId: string;
  productName: string;
  sku: string;
  quantityPurchased: number;
  unitPurchaseDp: number;
  spPerUnit: number;
  batchNumber: string;
  lineTotal: number;
}

export interface PurchaseBill {
  id: string;
  cnfId: string;
  cnfName: string;
  purchaseBillNumber: string;
  date: string;
  supplierName: string; // Asclepius Wellness Private Limited
  items: PurchaseBillItem[];
  totalQuantity: number;
  totalSp: number;
  totalAmount: number;
  paymentMode: 'Bank Transfer / NEFT / RTGS' | 'UPI' | 'Cheque' | 'Cash';
  referenceNo?: string;
  addedBy: string;
  notes?: string;
}

export interface BankDeposit {
  id: string;
  date: string;
  amount: number;
  bankName: string;
  accountNo: string;
  referenceNo: string;
  depositedBy: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  date: string;
  supplierName: string;
  itemsSummary: string;
  amount: number;
  paymentMode: 'Bank Transfer / UPI' | 'Bank Transfer / NEFT / RTGS' | 'RTGS / NEFT' | 'UPI' | 'Cheque';
  referenceNo?: string;
  status: 'Paid & Deducted from Bank' | 'Pending';
  createdBy: string;
  notes?: string;
}

export interface InAppNotification {
  id: string;
  type?: 'pending_7day_online' | 'credit_5day_due' | '7_day_online_pending' | '5_day_credit_payment' | 'pending_product_arrived';
  invoiceId: string;
  invoiceNumber: string;
  customerMobile: string;
  customerName: string;
  awplId?: string;
  daysPending: number;
  pendingItemsCount: number;
  pendingItemsList?: string;
  totalAmount: number;
  balanceDue?: number;
  totalSp: number;
  message: string;
  whatsappUrl: string;
  upiPaymentUri?: string;
  createdAt: string;
  isRead?: boolean;
  channel: 'both_whatsapp_and_in_app' | 'whatsapp_only' | 'in_app_only';
}

export interface CFBillRecord {
  id: string;
  referenceNo: string; // e.g., CF-SOL-2026-8891
  awplCustomerId: string;
  customerName: string;
  customerMobile: string;
  itemsSummary: string;
  totalSp: number;
  pendingAmount: number;
  cfBranch: string; // "Solan C&F Depot"
  status: 'Pending Verification' | 'Under Processing' | 'Approved by C&F' | 'Dispatched' | 'Issue Reported' | 'Resolved';
  createdDate: string;
  lastUpdated: string;
  customerRemarks?: string;
  adminResolution?: string;
  otpVerified: boolean;
  submissionId?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  billingPeriod: '14 Days Free' | 'Monthly' | 'Quarterly' | 'Yearly';
  targetAudience?: 'cf_franchise' | 'customer';
  unlimitedBilling?: boolean;
  features: string[];
  maxInvoicesPerMonth: number;
  isPopular?: boolean;
  isActive: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  planId: string;
  planName: string;
  startDate: string;
  expiryDate: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending_payment';
  paymentRef?: string;
  amountPaid: number;
  cloudDeductionAmount?: number;
  netCreditedToMainAdmin?: number;
  autoRenew: boolean;
  settledToAccount?: string;
  settledStatus?: 'Credited to Owner A/c' | 'Pending';
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'Stock In (C&F)' | 'Purchase Bill Stock In' | 'Sale (POS)' | 'Sale (Online)' | 'Return' | 'Damage / Expiry Write-Off' | 'Adjustment';
  quantityChange: number; // positive or negative
  batchNumber: string;
  date: string;
  referenceId: string; // Invoice ID or Inward PO#
  performedBy: string;
  notes?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  employeeCode: string; // e.g. DRW-STF-01
  role: Role;
  mobile: string;
  email?: string;
  assignedDepot: string;
  shift: 'Full Day (9 AM - 8 PM)' | 'Morning Shift (9 AM - 2 PM)' | 'Evening Shift (2 PM - 8 PM)';
  pinCode: string; // 4-digit counter PIN
  status: 'active' | 'inactive';
  joinedDate: string;
  permissions: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'Billing' | 'Product' | 'C&F Portal' | 'Subscription' | 'Inventory' | 'Security' | 'Staff';
  user: string;
  details: string;
}

export interface AppFeedback {
  id: string;
  submittedByPortal: 'cnf_app' | 'customer_app';
  submitterName: string;
  submitterMobile: string;
  cnfName?: string;
  rating: number; // 1 to 5
  category: 'Billing & Barcode' | 'C&F Online Sync' | 'Customer App Ordering' | 'UPI & Bank QR' | 'Feature Request' | 'General Feedback';
  message: string;
  createdAt: string;
  status: 'New' | 'Reviewed' | 'Implemented';
  adminReply?: string;
}

export interface MainAdminConfig {
  appName: string; // "C&F Bill"
  mainAdminName: string;
  mainBankAccountNumber: string; // Manually entered in Main App
  mainBankIfsc: string;
  mainBankName: string;
  mainUpiId: string;
  mainUpiNumber: string;
  cloudProviderName: string;
  cloudMonthlyFixedCostPerCnf: number;      // e.g. ₹49/mo cloud cost per C&F
  cloudMonthlyFixedCostPerCustomer: number; // e.g. ₹9/mo cloud cost per Customer
  cloudCostDeductionPercent: number;        // e.g. 5% cloud infrastructure deduction
  defaultUpiTransactionFeeEnabled: boolean;
  defaultUpiTransactionFeePercent: number;
  globalAnnouncementBanner?: string;
  dynamicFeatureRules: string[];
  lastGeminiUpdateAt?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminSecurityPin?: string;
  adminMasterKey?: string;
  masterApprovalCode?: string;
}

export type BillPaperSize = 'A4' | 'A5' | 'Letter' | 'Thermal_80mm' | 'Thermal_58mm' | '80mm' | '58mm';
export type BillPaperOrientation = 'portrait' | 'landscape';
export type BillThemeColor = 'emerald' | 'monochrome' | 'saffron' | 'indigo';
export type BillFontScale = 'compact' | 'normal' | 'large';

export interface CustomBillField {
  id: string;
  label: string;
  value: string;
  position: 'header' | 'customer' | 'footer';
  visible: boolean;
}

export interface BillColumnLabels {
  serialNo?: string;
  product?: string;
  batch?: string;
  expiry?: string;
  mrp?: string;
  rate?: string;
  discount?: string;
  qty?: string;
  sp?: string;
  gst?: string;
  lineTotal?: string;
  billedToTitle?: string;
  paymentDetailsTitle?: string;
  termsTitle?: string;
  signatoryLabel?: string;
  customerSignLabel?: string;
}

export interface BillPrintConfig {
  paperSize: BillPaperSize;
  orientation: BillPaperOrientation;
  themeColor?: BillThemeColor;
  fontSizeScale?: BillFontScale;
  invoiceTitle: string;
  customCompanyNameOverride?: string;
  customHeaderMatter: string;
  customSubHeaderMatter: string;
  customAddressOverride?: string;
  customPhoneOverride?: string;
  customCustomerNote?: string;
  customFooterMatter: string;
  termsAndConditions: string[];
  // Header & Statutory License Toggles
  showCompanyLogo: boolean;
  showShortNameBadge?: boolean;
  showAddress?: boolean;
  showOwnerNames?: boolean;
  showPhoneAndEmail?: boolean;
  showGstinAndLicenses?: boolean;
  showGstin?: boolean;
  showPanNumber?: boolean;
  showFranchiseCode?: boolean;
  showFssaiAndDl?: boolean;
  showSessionYear?: boolean;
  // Customer & AWPL Block Toggles
  showCustomerSection?: boolean;
  showCustomerAwplId?: boolean;
  showGreenIdBadge?: boolean;
  showPaymentAndStaffBlock?: boolean;
  // Item Table Column Toggles
  showSerialNoColumn?: boolean;
  showSkuInItem?: boolean;
  showOnlineStatusInItem?: boolean;
  showItemAwplId?: boolean;
  showPendingTagInItem?: boolean;
  showBatchColumn?: boolean;
  showExpiryColumn?: boolean;
  showMrpColumn?: boolean;
  showDiscountColumn?: boolean;
  showRateColumn?: boolean;
  showQtyColumn?: boolean;
  showSpColumn: boolean;
  showSpPoints?: boolean;
  showGstColumn: boolean;
  showGstBreakdown?: boolean;
  showLineTotalColumn?: boolean;
  // Totals, Payment, QR & Footer Toggles
  showCfClearanceBlock: boolean;
  showSubtotalAndDiscount?: boolean;
  showBalanceDue?: boolean;
  showUpiQr: boolean;
  showBankAndQr?: boolean;
  showCustomerAppQr: boolean;
  showTermsAndConditions?: boolean;
  showSignaturesAndStamp: boolean;
  showSignatureAndSeal?: boolean;
  showOfficialSealStamp?: boolean;
  // Custom Column Headings & User-Defined Fields
  columnLabels?: BillColumnLabels;
  customFields?: CustomBillField[];
  // PC Printer
  selectedPrinterName?: string;
  detectedPrinters?: string[];
  autoPrinterDetect?: boolean;
  autoPrintOnSave?: boolean;
}

export interface PrivacyAccessPermission {
  grantedToMainApp: boolean;
  grantedBy?: string;
  grantedAt?: string;
  purpose?: string;
  accessRequestedByMainApp?: boolean;
  requestedAt?: string;
  requestReason?: string;
}

export interface ComplaintReport {
  id: string;
  submittedByPortal: 'cnf_app' | 'customer_app';
  reporterName: string;
  reporterMobile: string;
  cnfId?: string;
  cnfName: string;
  category:
    | 'Billing & Invoice Dispute'
    | 'Pending Product Not Received'
    | 'Product Quality / Batch Issue'
    | 'UPI / Payment Deduction Issue'
    | 'C&F Portal Online Sync Delay'
    | 'Other Official Complaint';
  subject: string;
  description: string;
  attachmentName?: string;
  attachmentMimeType?: string; // e.g. image/jpeg, image/png, application/pdf
  attachmentDataUrl?: string;  // base64 data URL from device upload
  createdAt: string;
  status: 'Pending AI Check' | 'Genuine — Action Required' | 'Flagged / Unverified' | 'Resolved by Main App';
  aiVerification?: {
    isGenuine: boolean;
    confidenceScore: number; // 0 - 100
    verdictLabel: 'Genuine & Verified' | 'Needs Manual Review' | 'Suspicious / Incomplete';
    aiAnalysis: string;
    recommendedAction: string;
    verifiedAt: string;
  };
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface ConnectedDeviceSession {
  deviceId: string;
  deviceName: string;
  deviceType: 'pc' | 'mobile';
  platform: string;
  portalMode: AppPortalMode;
  cnfId: string;
  cnfName: string;
  lastActiveAt: string;
  isCurrentDevice?: boolean;
}

export interface FranchiseConfig {
  id?: string;
  name: string;
  shortName?: string; // e.g. "DRW" or custom C&F short name
  startingInvoiceNumber?: number; // e.g. 1001
  franchiseCode: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  dlNumber: string;
  fssaiNumber: string;
  panNumber: string;
  corporateAwplAddress: string;
  parentCompany?: string; // "Asclepius Wellness Private Limited"
  cinNumber: string;
  officialDepotName: string;
  franchiseOwner: string;
  cfOwnerName?: string;
  cnfOwnerName?: string;
  logoUrl?: string;
  authorizationValidTill: string;
  isoCertification: string;
  bankUpiId: string;
  upiNumber?: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  // Requirement #2: QR of UPI payment via Uploaded Picture OR Auto-Generated from UPI ID
  qrMode?: 'auto_upi' | 'uploaded_image';
  customQrImageDataUrl?: string;
  currentFinancialYear: string; // e.g. "2026-2027" (April to March session)
  financialYear?: string;
  invoiceSequence: number;
  sessionSequences?: Record<string, number>; // Per-session (April-March) invoice sequence tracker
  availableSessions?: string[]; // Preserved April-March sessions e.g. ["2025-2026", "2026-2027", "2027-2028"]
  multiFranchiseEnabled: boolean;
  isDrightWellness?: boolean;
  infinityStockPermanent?: boolean; // Permanent true for D RIGHT WELLNESS
  infinityStockEnabled?: boolean;   // Toggleable for other C&Fs
  upiTransactionFeeEnabled?: boolean;
  upiTransactionFeePercent?: number;
  termsAndConditions?: string[];
  // Requirement #7, #8, #9: Editable Bill Print Configuration & Auto PC Printer
  billPrintConfig?: BillPrintConfig;
  // Requirement #5: Privacy Permission Gate for Main App Access
  privacyAccessPermission?: PrivacyAccessPermission;
  // Per-C&F Product Catalog with C&F-specific DP, SP, MRP & Stop-Sale settings
  customProducts?: AWPLProduct[];
  registeredAt?: string;
  password?: string;
  pin?: string;
  ownerApprovalCode?: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  portal: AppPortalMode;
  role: Role;
  userId: string;
  userName: string;
  identifier?: string; // Email ID for C&F Owner & Admin; Mobile Number for Customer & Staff
  userMobile?: string;
  userEmail?: string;
  cnfId?: string;
  cnfName?: string;
  cnfShortName?: string;
  customerId?: string;
  loggedInAt: string;
}

export interface PaymentGatewaySession {
  sessionId: string;
  purpose: 'cnf_subscription' | 'customer_subscription' | 'customer_order' | 'pos_invoice';
  portal: AppPortalMode;
  amount: number;
  currency: 'INR';
  payerName: string;
  payerMobile?: string;
  userId?: string;
  planId?: string;
  planName?: string;
  payeeName: string;
  payeeUpiId: string;
  payeeAccountNo?: string;
  payeeIfsc?: string;
  status: 'listening' | 'detected' | 'verified';
  utrNumber?: string;
  createdAt: string;
  verifiedAt?: string;
  autoDetected?: boolean;
}



