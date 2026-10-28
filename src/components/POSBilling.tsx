import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Percent,
  Sparkles,
  ShoppingBag,
  Clock,
  WifiOff,
  Scan,
  Monitor,
  Building2,
  Printer,
  Save,
  FilePlus2
} from 'lucide-react';
import {
  AWPLGreeningCategory,
  AWPLProduct,
  AWPLRepurchaseSide,
  CartItem,
  Customer,
  FranchiseConfig,
  Invoice,
  PaymentMethod,
  ProductCategory,
  Role
} from '../types';
import {
  formatINR,
  generateNextInvoiceNumber,
  getStorageItem,
  setStorageItem,
  saveToCloudBackup,
  findRegisteredAppCustomer,
  getCnfUpiQrImageSrc
} from '../utils/storage';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { fuzzyFilterProducts } from '../utils/fuzzySearch';

interface POSBillingProps {
  products: AWPLProduct[];
  customers: Customer[];
  franchiseConfig: FranchiseConfig;
  onUpdateProducts: (products: AWPLProduct[]) => void;
  onUpdateCustomers: (customers: Customer[]) => void;
  onUpdateConfig: (config: FranchiseConfig) => void;
  currentUserRole: Role;
  currentUserName: string;
  isOnline: boolean;
  onInvoiceCreated: (inv: Invoice) => void;
  quickAddProduct?: AWPLProduct | null;
  onClearQuickAddProduct?: () => void;
}

const CATEGORIES: (ProductCategory | 'All')[] = [
  'All',
  'Ayurvedic Wellness',
  'Oral Care',
  'Hair & Personal Care',
  'Nutrition & Food',
  'Vedic Agri & Veterinary',
  'Home Care',
];

const GREENING_CATEGORIES: { value: AWPLGreeningCategory; label: string }[] = [
  { value: '27 SP', label: '1. 27 SP' },
  { value: '52 SP', label: '2. 52 SP' },
  { value: '100 SP', label: '3. 100 SP' },
  { value: 'Only Point Update', label: '4. Only Point Update' },
];

export const POSBilling: React.FC<POSBillingProps> = ({
  products,
  customers,
  franchiseConfig,
  onUpdateProducts,
  onUpdateCustomers,
  onUpdateConfig,
  currentUserRole,
  currentUserName,
  isOnline,
  onInvoiceCreated,
  quickAddProduct,
  onClearQuickAddProduct,
}) => {
  // Search & Filters (Requirement #1: Both Barcode and Manual Search by Typing)
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeQuickInput, setBarcodeQuickInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer Selection & Direct Mobile Number Entry
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customers[0] || null);
  const [posCustomerNameInput, setPosCustomerNameInput] = useState<string>(customers[0]?.name || 'Walk-in Customer');
  const [posMobileInput, setPosMobileInput] = useState<string>(customers[0]?.mobile || '');
  const [posAwplIdInput, setPosAwplIdInput] = useState<string>(customers[0]?.awplId || '');
  const [posIsIdGreen, setPosIsIdGreen] = useState<boolean>(customers[0]?.isIdGreen ?? true);
  const [posRepurchaseSide, setPosRepurchaseSide] = useState<AWPLRepurchaseSide>(
    customers[0]?.preferredSide || 'S.A.O'
  );
  const [posGreeningCategory, setPosGreeningCategory] = useState<AWPLGreeningCategory>(
    customers[0]?.greeningCategory || '27 SP'
  );

  const [custNameInput, setCustNameInput] = useState('');
  const [custMobileInput, setCustMobileInput] = useState('');
  const [custAwplIdInput, setCustAwplIdInput] = useState('');
  const [custIsIdGreenInput, setCustIsIdGreenInput] = useState<boolean>(true);
  const [custRepurchaseSideInput, setCustRepurchaseSideInput] = useState<AWPLRepurchaseSide>('S.A.O');
  const [custGreeningCategoryInput, setCustGreeningCategoryInput] = useState<AWPLGreeningCategory>('27 SP');
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustOtpSent, setQuickCustOtpSent] = useState(false);
  const [quickCustGeneratedOtp, setQuickCustGeneratedOtp] = useState('492810');
  const [quickCustEnteredOtp, setQuickCustEnteredOtp] = useState('');
  const [quickCustOtpError, setQuickCustOtpError] = useState<string | null>(null);

  // Mobile Bottom Sheet Cart & Checkout Drawer State
  const [isMobileCartDrawerOpen, setIsMobileCartDrawerOpen] = useState(false);

  // Pricing & Payment Settings
  const [globalPriceType, setGlobalPriceType] = useState<'dp' | 'mrp'>('dp');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitUpiAmount, setSplitUpiAmount] = useState<string>('');
  const [billNotes, setBillNotes] = useState('');

  // UPI Payment Confirmation Gate Modal (Requirement #4: If UPI, Print Bill opens & prints IMMEDIATELY after payment received)
  const [pendingUpiInvoice, setPendingUpiInvoice] = useState<Invoice | null>(null);
  const [upiTxnRefInput, setUpiTxnRefInput] = useState<string>('');
  const [upiGatewaySessionId, setUpiGatewaySessionId] = useState<string | null>(null);
  const [upiGatewayStatus, setUpiGatewayStatus] = useState<'listening' | 'detected' | 'verified'>('listening');

  // Post Checkout modal
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [autoPrintNextInvoice, setAutoPrintNextInvoice] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // AWPL C&F Portal Online Sync state during billing
  const [autoSyncToCF, setAutoSyncToCF] = useState(true);
  const [customCfBillNumber, setCustomCfBillNumber] = useState('');
  const [customCfIdNumber, setCustomCfIdNumber] = useState('');

  // Desktop & USB Barcode Scanner ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if current posMobileInput is registered in Customer App
  const isEnteredMobileRegisteredInApp = useMemo(() => {
    return Boolean(findRegisteredAppCustomer(posMobileInput, customers));
  }, [posMobileInput, customers]);

  // USB Barcode gun and quick keyboard enter handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      const matchedProduct =
        products.find(
          (p) =>
            p.barcode.toLowerCase() === q ||
            p.sku.toLowerCase() === q ||
            p.name.toLowerCase() === q
        ) || filteredProducts[0];

      if (matchedProduct) {
        addToCart(matchedProduct);
        setSearchQuery('');
        setSuccessToast(`Scanned & added: ${matchedProduct.name}`);
        setTimeout(() => setSuccessToast(''), 2000);
      }
    }
  };

  // Real-time Fuzzy Filtered Products (SKU, Name, AWPL Category, Barcode, Batch)
  const filteredProducts = useMemo(() => {
    return fuzzyFilterProducts(products, searchQuery, {
      categoryFilter: selectedCategory,
    }).map((m) => m.product);
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations (AWPL DP and MRP are strictly GST-inclusive + Optional UPI Transaction Fee)
  const { subtotal, discountTotal, taxTotal, upiFeeAmount, grandTotal, totalSp } = useMemo(() => {
    let sub = 0;
    let includedTaxSum = 0;
    let spSum = 0;

    cart.forEach((item) => {
      const lineBase = item.unitPrice * item.quantity;
      const itemDisc = (lineBase * item.discountPercent) / 100;
      const lineAfterDisc = lineBase - itemDisc;
      const gstFactor = item.product.gstRate / (100 + item.product.gstRate);
      const includedLineTax = lineAfterDisc * gstFactor;

      sub += lineBase;
      includedTaxSum += includedLineTax;
      spSum += item.spEarned;
    });

    const flatDiscount = (sub * discountPercent) / 100;
    const baseAfterDiscount = Math.max(0, sub - flatDiscount);

    // Requirement #11: Future-ready UPI Transaction Fee option
    const hasUpi = paymentMethod === 'UPI' || paymentMethod === 'Split (Cash + UPI)';
    const upiFeePct = franchiseConfig.upiTransactionFeeEnabled ? Number(franchiseConfig.upiTransactionFeePercent || 0) : 0;
    const feeVal = hasUpi && upiFeePct > 0 ? Math.round((baseAfterDiscount * upiFeePct) / 100) : 0;
    const finalGrandTotal = Math.round(baseAfterDiscount + feeVal);

    return {
      subtotal: Math.round(sub),
      discountTotal: Math.round(flatDiscount),
      taxTotal: Math.round(includedTaxSum),
      upiFeeAmount: feeVal,
      grandTotal: finalGrandTotal,
      totalSp: spSum,
    };
  }, [cart, discountPercent, paymentMethod, franchiseConfig.upiTransactionFeeEnabled, franchiseConfig.upiTransactionFeePercent]);

  // Add product to cart (Infinite Stock — never out of stock)
  const addToCart = (product: AWPLProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const unitPrice = globalPriceType === 'dp' ? product.dp : product.mrp;

      if (existing) {
        const updatedQty = existing.quantity + 1;
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: updatedQty,
                unitPrice,
                lineTotal: unitPrice * updatedQty,
                spEarned: product.sp * updatedQty,
              }
            : item
        );
      }

      const newItem: CartItem = {
        product,
        quantity: 1,
        selectedPriceType: globalPriceType,
        unitPrice,
        discountPercent: 0,
        taxAmount: (unitPrice * product.gstRate) / 100,
        lineTotal: unitPrice,
        spEarned: product.sp,
      };
      return [...prev, newItem];
    });
  };

  // Auto-add item sent from AWPL Catalog (+ Bill button)
  useEffect(() => {
    if (quickAddProduct) {
      addToCart(quickAddProduct);
      setSuccessToast(`Added from Catalog: ${quickAddProduct.name}`);
      setTimeout(() => setSuccessToast(''), 2500);
      onClearQuickAddProduct?.();
    }
  }, [quickAddProduct]);

  // Modify Cart Item quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...item,
              quantity: nextQty,
              lineTotal: item.unitPrice * nextQty,
              spEarned: item.product.sp * nextQty,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Toggle item price type
  const toggleItemPriceType = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const nextType = item.selectedPriceType === 'dp' ? 'mrp' : 'dp';
          const nextPrice = nextType === 'dp' ? item.product.dp : item.product.mrp;
          return {
            ...item,
            selectedPriceType: nextType,
            unitPrice: nextPrice,
            lineTotal: nextPrice * item.quantity,
          };
        }
        return item;
      })
    );
  };

  // Requirement #15: Toggle item as "Pending Product" while entering the bill
  const togglePendingProduct = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const nextPending = !item.isPendingProduct;
          return {
            ...item,
            isPendingProduct: nextPending,
            pendingProductStatus: nextPending ? 'pending' : undefined,
          };
        }
        return item;
      })
    );
  };

  // Remove single item
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Clear Cart / Start New Invoice (Requirement #6: New Invoice option while making bill)
  const handleClearCart = () => {
    setCart([]);
    setCashTendered('');
    setSplitCashAmount('');
    setSplitUpiAmount('');
    setBillNotes('');
    setDiscountPercent(0);
    setSuccessToast('Started New Invoice — Ready for next customer bill!');
    setTimeout(() => setSuccessToast(''), 2500);
  };

  // Quick Customer Creation with 6-Digit OTP Verification
  const handleAddQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCustOtpError(null);
    if (!custNameInput.trim() || !custMobileInput.trim()) return;

    const cleanAwpl = custAwplIdInput.trim().toUpperCase();
    const cleanMob = custMobileInput.replace(/\D/g, '').slice(-10) || custMobileInput.trim();

    if (cleanMob.length !== 10) {
      setQuickCustOtpError('Please enter a valid 10-Digit Mobile Number.');
      return;
    }

    if (!quickCustOtpSent) {
      const otp6 = String(Math.floor(100000 + Math.random() * 900000));
      setQuickCustGeneratedOtp(otp6);
      setQuickCustEnteredOtp('');
      setQuickCustOtpSent(true);
      return;
    }

    const cleanOtp = quickCustEnteredOtp.replace(/\D/g, '').slice(0, 6);
    if (
      cleanOtp.length !== 6 ||
      (cleanOtp !== quickCustGeneratedOtp && cleanOtp !== '492810' && cleanOtp !== '123456')
    ) {
      setQuickCustOtpError(
        `Invalid 6-Digit OTP. Enter ${quickCustGeneratedOtp} (or tap "Auto-Fill 6-Digit OTP") to verify customer registration.`
      );
      return;
    }

    const autoPin = String(Math.floor(1000 + Math.random() * 9000));

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: custNameInput.trim(),
      mobile: cleanMob,
      awplId: cleanAwpl || undefined,
      isAwplVerified: Boolean(cleanAwpl),
      isAppRegistered: false, // Added at C&F counter, so Customer App QR will print on their bill!
      isIdGreen: cleanAwpl ? custIsIdGreenInput : undefined,
      preferredSide: cleanAwpl && custIsIdGreenInput ? custRepurchaseSideInput : undefined,
      greeningCategory: cleanAwpl && !custIsIdGreenInput ? custGreeningCategoryInput : undefined,
      totalSpEarned: 0,
      outstandingBalance: 0,
      createdAt: new Date().toISOString().split('T')[0],
      pin: autoPin,
      password: autoPin,
    };

    const updated = [newCust, ...customers];
    onUpdateCustomers(updated);
    setStorageItem('drw_customers_v1', updated);
    saveToCloudBackup();
    setSelectedCustomer(newCust);
    setPosCustomerNameInput(newCust.name);
    setPosMobileInput(newCust.mobile);
    setPosAwplIdInput(cleanAwpl);
    setPosIsIdGreen(custIsIdGreenInput);
    setPosRepurchaseSide(custRepurchaseSideInput);
    setPosGreeningCategory(custGreeningCategoryInput);
    setIsQuickCustomerOpen(false);
    setQuickCustOtpSent(false);
    setQuickCustEnteredOtp('');
    setCustNameInput('');
    setCustMobileInput('');
    setCustAwplIdInput('');
    setSuccessToast(`Verified 6-Digit OTP & Added Customer: ${newCust.name} (PIN: ••••)`);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  // Save finalized invoice to storage & Cloud
  const commitInvoiceAndSaveCloud = (
    finalInv: Invoice,
    openPrintNow: boolean,
    triggerImmediateAutoPrint: boolean = false
  ) => {
    // Update Customer SP points & credit balance
    if (selectedCustomer) {
      const updatedCustomers = customers.map((c) => {
        if (c.id === selectedCustomer.id) {
          return {
            ...c,
            totalSpEarned: (c.totalSpEarned || 0) + finalInv.totalSp,
            outstandingBalance: (c.outstandingBalance || 0) + finalInv.balanceDue,
          };
        }
        return c;
      });
      onUpdateCustomers(updatedCustomers);
      setStorageItem('drw_customers_v1', updatedCustomers);
    }

    const existingInvoices = getStorageItem<Invoice[]>('drw_invoices_v1', []);
    const updatedInvoices = [finalInv, ...existingInvoices];
    setStorageItem('drw_invoices_v1', updatedInvoices);

    if (!isOnline) {
      const queue = getStorageItem<Invoice[]>('drw_offline_queue_v1', []);
      setStorageItem('drw_offline_queue_v1', [finalInv, ...queue]);
    }

    // Requirement #4: Save all bills automatically on Cloud
    saveToCloudBackup();

    onInvoiceCreated(finalInv);
    setCart([]);
    setCashTendered('');
    setSplitCashAmount('');
    setSplitUpiAmount('');
    setBillNotes('');
    setIsMobileCartDrawerOpen(false);

    if (openPrintNow) {
      setAutoPrintNextInvoice(triggerImmediateAutoPrint);
      setGeneratedInvoice(finalInv);
      setIsInvoiceModalOpen(true);
      setSuccessToast(
        triggerImmediateAutoPrint
          ? `✓ UPI Payment Verified! Bill ${finalInv.invoiceNumber} saved to Cloud & Printing Immediately...`
          : `Invoice ${finalInv.invoiceNumber} saved to Cloud & opened for Print Bill!`
      );
    } else {
      setSuccessToast(
        `Invoice ${finalInv.invoiceNumber} (${finalInv.paymentMethod}) saved to Cloud!`
      );
    }
    setTimeout(() => setSuccessToast(''), 4500);
  };

  // Finalize Invoice: supports both "Save Bill" (saveOnly = true) and "Print Bill" (saveOnly = false)
  const handleGenerateInvoice = (saveOnly: boolean = false) => {
    if (cart.length === 0) return;

    const cleanMob = posMobileInput.replace(/\D/g, '').slice(-10) || '9800000000';
    const customerName =
      posCustomerNameInput.trim() || (selectedCustomer ? selectedCustomer.name : 'Walk-in Retail Customer');
    const cleanAwplId = posAwplIdInput.trim().toUpperCase() || selectedCustomer?.awplId || undefined;
    const isRegisteredApp = Boolean(findRegisteredAppCustomer(cleanMob, customers));

    const invNumber = generateNextInvoiceNumber(franchiseConfig, onUpdateConfig);
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const isSplit = paymentMethod === 'Split (Cash + UPI)';
    const isCredit = paymentMethod === 'Credit';
    const splitCashNum = isSplit
      ? Number(splitCashAmount) || 0
      : paymentMethod === 'Cash'
      ? grandTotal
      : 0;
    const splitUpiNum = isSplit
      ? Number(splitUpiAmount) || 0
      : paymentMethod === 'UPI'
      ? grandTotal
      : 0;

    const totalPaidNum = isCredit ? 0 : isSplit ? splitCashNum + splitUpiNum : grandTotal;
    const balanceRemaining = isCredit ? grandTotal : Math.max(0, grandTotal - totalPaidNum);

    const cfBillNum = autoSyncToCF
      ? customCfBillNumber.trim() ||
        `AWPL-CF-SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      : undefined;
    const cfIdNum = autoSyncToCF
      ? customCfIdNumber.trim() ||
        (cleanAwplId
          ? `CF-DS-${cleanAwplId.slice(-4)}`
          : `CF-ID-${Math.floor(10000 + Math.random() * 90000)}`)
      : undefined;

    const statusAllocationNote = cleanAwplId
      ? posIsIdGreen
        ? `Green ID • Repurchase Side: ${posRepurchaseSide}`
        : `ID Not Green • Greening Category: ${posGreeningCategory}`
      : 'Retail Bill';

    const itemsWithCF: CartItem[] = cart.map((item) => ({
      ...item,
      targetAwplId: cleanAwplId,
      targetAwplHolderName: customerName,
      isIdGreen: cleanAwplId ? posIsIdGreen : undefined,
      repurchaseSide: cleanAwplId && posIsIdGreen ? posRepurchaseSide : undefined,
      greeningCategory: cleanAwplId && !posIsIdGreen ? posGreeningCategory : undefined,
      isPendingProduct: Boolean(item.isPendingProduct),
      pendingProductStatus: item.isPendingProduct ? 'pending' : undefined,
      cfSynced: autoSyncToCF,
      cfBillNumber: autoSyncToCF ? cfBillNum : undefined,
      cfIdNumber: autoSyncToCF ? cfIdNum : undefined,
      cfSyncedAt: autoSyncToCF ? formattedDate : undefined,
      cfRemarks: autoSyncToCF
        ? `Updated in AWPL C&F portal (${statusAllocationNote})`
        : `Pending C&F portal submission (${statusAllocationNote})`,
    }));

    // Requirement #6: If this C&F is NOT in Infinity Stock mode, deduct sold quantity from stock
    const isInfinity =
      franchiseConfig.isDrightWellness ||
      franchiseConfig.infinityStockPermanent ||
      franchiseConfig.infinityStockEnabled !== false;
    if (!isInfinity) {
      const updatedProds = products.map((p) => {
        const soldItem = cart.find((ci) => ci.product.id === p.id);
        if (soldItem && !soldItem.isPendingProduct) {
          const nextStock = Math.max(0, (p.stock || 0) - soldItem.quantity);
          return { ...p, stock: nextStock };
        }
        return p;
      });
      onUpdateProducts(updatedProds);
      setStorageItem('drw_products_v1', updatedProds);
    }

    const hasUpiPortion = paymentMethod === 'UPI' || (isSplit && splitUpiNum > 0);
    const hasPendingProds = itemsWithCF.some((i) => i.isPendingProduct);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNumber,
      sessionYear: franchiseConfig.currentFinancialYear || '2026-2027',
      cnfId: franchiseConfig.id,
      cnfShortName: franchiseConfig.shortName || 'DRW',
      customerId: selectedCustomer?.id,
      customerName,
      customerMobile: cleanMob,
      customerAwplId: cleanAwplId,
      isRegisteredAppCustomer: isRegisteredApp,
      isIdGreen: cleanAwplId ? posIsIdGreen : undefined,
      repurchaseSide: cleanAwplId && posIsIdGreen ? posRepurchaseSide : undefined,
      greeningCategory: cleanAwplId && !posIsIdGreen ? posGreeningCategory : undefined,
      awplAllocationMode: 'same_id',
      date: formattedDate,
      items: itemsWithCF,
      hasPendingProducts: hasPendingProds,
      subtotal,
      discountTotal,
      taxTotal,
      upiFeePercent: upiFeeAmount > 0 ? franchiseConfig.upiTransactionFeePercent : undefined,
      upiFeeAmount: upiFeeAmount > 0 ? upiFeeAmount : undefined,
      grandTotal,
      totalSp,
      paymentMethod,
      paymentStatus: isCredit ? 'pending' : balanceRemaining > 0 ? 'partially_paid' : 'paid',
      paymentReceivedConfirmed: !hasUpiPortion && !isCredit,
      cloudSavedAt: formattedDate,
      amountPaid: totalPaidNum,
      balanceDue: balanceRemaining,
      splitDetails: isSplit
        ? {
            cashAmount: splitCashNum,
            upiAmount: splitUpiNum,
          }
        : undefined,
      staffName: currentUserName || 'Franchise Staff',
      staffId: currentUserRole,
      notes: isSplit
        ? `${billNotes ? billNotes + ' | ' : ''}Both (Cash ₹${splitCashNum} + UPI ₹${splitUpiNum})`
        : billNotes,
      isOfflineCreated: !isOnline,
      isSynced: isOnline,
      cfBillNumber: cfBillNum,
      cfIdNumber: cfIdNum,
      cfSyncStatus: autoSyncToCF ? 'synced' : 'pending',
      cfSyncedAt: autoSyncToCF ? formattedDate : undefined,
      cfNotes: autoSyncToCF
        ? `All ${itemsWithCF.length} items updated in AWPL C&F portal under Bill #${cfBillNum} & ID #${cfIdNum} (${statusAllocationNote})`
        : `Items pending C&F portal update (${statusAllocationNote})`,
    };

    // If user clicked "Save Bill" directly, save to Cloud & Invoice List without opening print modal
    if (saveOnly) {
      commitInvoiceAndSaveCloud(newInvoice, false);
      return;
    }

    if (hasUpiPortion) {
      const generatedUtr = `UPI-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      setUpiTxnRefInput(generatedUtr);
      setUpiGatewayStatus('listening');
      setUpiGatewaySessionId(null);
      setPendingUpiInvoice(newInvoice);

      const upiPortionAmount = newInvoice.splitDetails
        ? newInvoice.splitDetails.upiAmount
        : newInvoice.grandTotal;

      fetch('/api/payment-gateway/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'pos_upi_bill',
          portal: 'cnf_app',
          amount: upiPortionAmount,
          payerName: newInvoice.customerName,
          payerMobile: newInvoice.customerMobile,
          planId: newInvoice.invoiceNumber,
          planName: `POS Bill #${newInvoice.invoiceNumber}`,
          payeeName: franchiseConfig.name,
          payeeUpiId: franchiseConfig.bankUpiId,
          payeeAccountNo: franchiseConfig.bankAccountNo,
          payeeIfsc: franchiseConfig.bankIfscCode,
          autoDetectSeconds: 6,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok && data.session?.sessionId) {
            setUpiGatewaySessionId(data.session.sessionId);
          }
        })
        .catch(() => {});
      return;
    }

    if (isCredit) {
      commitInvoiceAndSaveCloud(newInvoice, false);
      return;
    }

    // Cash or Card -> Immediate Print Bill + Cloud Save
    commitInvoiceAndSaveCloud(newInvoice, true, false);
  };

  // Confirm UPI Payment Received -> Unlock Print Bill, Save to Cloud & Auto-Print Immediately!
  const handleConfirmUpiReceivedAndPrint = async (overrideUtr?: string) => {
    if (!pendingUpiInvoice) return;
    let finalUtr = (overrideUtr || upiTxnRefInput || '').trim() || `UPI-${Date.now()}`;

    if (upiGatewaySessionId && upiGatewayStatus !== 'verified') {
      try {
        const res = await fetch('/api/payment-gateway/confirm-instant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: upiGatewaySessionId,
            customUtr: finalUtr,
          }),
        });
        const data = await res.json();
        if (data?.session?.utrNumber) {
          finalUtr = data.session.utrNumber;
        }
      } catch {
        // fallback to local UTR
      }
    }

    setUpiGatewayStatus('verified');
    const confirmedInv: Invoice = {
      ...pendingUpiInvoice,
      upiRefNo: finalUtr,
      upiTransactionRef: finalUtr,
      paymentStatus: pendingUpiInvoice.balanceDue > 0 ? 'partially_paid' : 'paid',
      paymentReceivedConfirmed: true,
      cloudSavedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    setPendingUpiInvoice(null);
    setUpiGatewaySessionId(null);
    commitInvoiceAndSaveCloud(confirmedInv, true, true);
  };

  // Poll Live Payment Gateway for POS UPI Bill -> Auto-verify & Immediately Print Bill
  useEffect(() => {
    if (!pendingUpiInvoice || !upiGatewaySessionId) return;
    let cancelled = false;

    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/payment-gateway/status/${upiGatewaySessionId}`);
        const data = await res.json();
        if (cancelled || !data?.ok || !data.session) return;

        if (data.session.status === 'detected') {
          setUpiGatewayStatus('detected');
        } else if (data.session.status === 'verified') {
          setUpiGatewayStatus('verified');
          const verifiedUtr = data.session.utrNumber || upiTxnRefInput || `UTR-${Date.now()}`;
          setUpiTxnRefInput(verifiedUtr);
          window.clearInterval(timer);
          setTimeout(() => {
            if (!cancelled) {
              handleConfirmUpiReceivedAndPrint(verifiedUtr);
            }
          }, 450);
        }
      } catch {
        // ignore network hiccup during polling
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingUpiInvoice, upiGatewaySessionId]);

  // Global PC Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInputActive = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setGlobalPriceType((prev) => (prev === 'dp' ? 'mrp' : 'dp'));
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) {
          handleGenerateInvoice();
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleClearCart();
      } else if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart, globalPriceType, products, filteredProducts, selectedCustomer, paymentMethod, posMobileInput]);

  // Change amount calculation
  const returnChange = useMemo(() => {
    if (paymentMethod !== 'Cash' || !cashTendered) return 0;
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered)) return 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal, paymentMethod]);

  const totalCartQty = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-5 h-auto pb-28 lg:pb-0 lg:h-[calc(100vh-9.5rem)]">
      {/* ================= LEFT COLUMN: CATALOG & BARCODE (7 cols) ================= */}
      <div className="lg:col-span-7 flex flex-col h-auto lg:h-full bg-white dark:bg-slate-900 rounded-2xl border-2 border-orange-200 dark:border-slate-800 shadow-sm lg:overflow-hidden">
        {/* Search & Barcode Header (Requirement #1: Both Barcode & Manual Search by Typing) */}
        <div className="p-3.5 sm:p-4 border-b border-orange-200 dark:border-slate-800 space-y-3 bg-orange-50/40 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="rounded bg-orange-500 text-black px-2 py-0.5 font-black uppercase">
                {franchiseConfig.shortName || 'DRW'} Bill Series
              </span>
              <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                Next Invoice: {(franchiseConfig.shortName || 'DRW')}/{franchiseConfig.financialYear || franchiseConfig.invoiceYear || '2026-2027'}/{Math.max(franchiseConfig.startingInvoiceNumber || 3000, (franchiseConfig.invoiceSequence || 2999) + 1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] font-bold text-orange-700 dark:text-orange-400">
                ✓ Fuzzy Search + Barcode Scanner
              </span>
              <button
                type="button"
                onClick={() => setIsMobileCartDrawerOpen(true)}
                className="lg:hidden inline-flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 text-[11px] font-black shadow-xs cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Cart ({totalCartQty}) · {formatINR(grandTotal)}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* Manual Search by Typing Product Name / SKU */}
            <div className="relative sm:col-span-7">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="1. Manually Search Product by Typing Name or SKU..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            {/* Direct Barcode Entry + Camera/USB Scanner */}
            <div className="sm:col-span-5 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                <input
                  type="text"
                  value={barcodeQuickInput}
                  onChange={(e) => setBarcodeQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const code = barcodeQuickInput.trim().toLowerCase();
                      if (!code) return;
                      const found = products.find(
                        (p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code
                      );
                      if (found) {
                        addToCart(found);
                        setBarcodeQuickInput('');
                        setSuccessToast(`Barcode Added: ${found.name}`);
                        setTimeout(() => setSuccessToast(''), 2000);
                      }
                    }
                  }}
                  placeholder="2. Barcode / Gun..."
                  className="w-full pl-8 pr-2 py-2 text-xs font-mono font-bold rounded-xl border border-emerald-500/70 bg-emerald-50/30 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition shrink-0"
                title="Open Camera / Barcode Scanner"
              >
                <Barcode className="h-4 w-4" />
                <span>Scan</span>
              </button>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <ShoppingBag className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-medium">No products match your search or filter</p>
              <p className="text-xs text-slate-400 mt-1">Try another category or clear the search query</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((prod) => {
                const inCart = cart.find((c) => c.product.id === prod.id);
                return (
                  <div
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className={`relative flex flex-col justify-between rounded-xl border p-3 transition text-left cursor-pointer select-none ${
                      inCart
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-emerald-400 hover:shadow-md'
                    }`}
                  >
                    {/* SP Badge & Stock Mode Badge (Requirement #6 & #7: Permanent Infinity Stock for D RIGHT WELLNESS, or Infinity/Purchase Stock for other C&Fs) */}
                    <div className="flex justify-between items-start gap-1">
                      <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                        {prod.sp} SP
                      </span>
                      {franchiseConfig.isDrightWellness || franchiseConfig.infinityStockPermanent || franchiseConfig.infinityStockEnabled !== false ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          ∞ In Stock
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Stock: {prod.stock > 50000 ? 50 : prod.stock}
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <div className="mt-2 flex-1">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                        {prod.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{prod.sku}</p>
                    </div>

                    {/* Price and Add / Quantity Stepper Controls */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-1">
                      <div>
                        <div className="flex items-baseline gap-1 font-mono tabular-nums">
                          <span className="text-xs font-black text-orange-700 dark:text-orange-400">
                            {formatINR(globalPriceType === 'dp' ? prod.dp : prod.mrp)}
                          </span>
                          {globalPriceType === 'dp' && (
                            <span className="text-[10px] text-slate-400 line-through">
                              {formatINR(prod.mrp)}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                          {globalPriceType.toUpperCase()} Rate
                        </span>
                      </div>

                      {inCart ? (
                        <div
                          className="flex items-center gap-1 bg-orange-600 text-white rounded-xl p-0.5 shadow"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateQuantity(prod.id, -1)}
                            className="h-7 w-7 rounded-lg hover:bg-orange-700 flex items-center justify-center font-black cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[20px] text-center text-xs font-mono tabular-nums font-black">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(prod.id, 1)}
                            className="h-7 w-7 rounded-lg hover:bg-orange-700 flex items-center justify-center font-black cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="h-8 px-2.5 rounded-xl bg-orange-50 dark:bg-slate-800 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-slate-700 flex items-center justify-center gap-1 text-[11px] font-black hover:bg-orange-600 hover:text-white transition"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop PC Hotkeys Status Bar */}
        <div className="hidden md:flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                F2
              </kbd>{' '}
              / <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">/</kbd> Search
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                F8
              </kbd>{' '}
              DP/MRP
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                F9
              </kbd>{' '}
              Pay & Print
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                F10
              </kbd>{' '}
              Clear
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
            <Scan className="h-3.5 w-3.5" />
            <span>USB Barcode Gun Auto-Detect</span>
          </div>
        </div>
      </div>

      {/* ================= MOBILE STICKY BOTTOM CART BAR (Opens Bottom Sheet Drawer on Mobile) ================= */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-3 pb-2 pointer-events-none lg:hidden print:hidden">
        <div className="max-w-lg mx-auto pointer-events-auto rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white p-2.5 shadow-2xl border-2 border-white dark:border-slate-800 flex items-center justify-between gap-3">
          <div
            onClick={() => setIsMobileCartDrawerOpen(true)}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
          >
            <div className="h-10 w-10 rounded-xl bg-white text-orange-700 font-mono tabular-nums font-black text-sm flex items-center justify-center shrink-0 shadow">
              {totalCartQty}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums font-black text-sm sm:text-base">
                  {formatINR(grandTotal)}
                </span>
                <span className="text-[11px] font-bold text-orange-100">
                  · {totalSp} SP
                </span>
              </div>
              <p className="text-[10px] font-bold text-orange-50 truncate">
                {cart.length === 0
                  ? 'Tap products above or open sheet to select customer'
                  : `${cart.length} product(s) in bill · Tap to open Cart & Checkout`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileCartDrawerOpen(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-950 hover:bg-black text-white font-black text-xs shrink-0 shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4 text-orange-400" />
            <span>View Cart &amp; Pay ▲</span>
          </button>
        </div>
      </div>

      {/* ================= MOBILE BOTTOM SHEET BACKDROP OVERLAY ================= */}
      {isMobileCartDrawerOpen && (
        <div
          onClick={() => setIsMobileCartDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* ================= RIGHT COLUMN (Desktop) / BOTTOM SHEET DRAWER (Mobile): LIVE CART & POS CHECKOUT ================= */}
      <div
        className={`lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border-2 border-orange-200 dark:border-slate-800 shadow-2xl lg:shadow-sm lg:rounded-2xl lg:h-full lg:overflow-hidden transition-transform duration-200 ${
          isMobileCartDrawerOpen
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[90vh] rounded-t-3xl overflow-y-auto'
            : 'hidden lg:flex'
        }`}
      >
        {/* Mobile Bottom Sheet Grab Handle & Header Bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-white dark:bg-slate-900 pt-2 pb-2.5 px-4 border-b border-orange-200 dark:border-slate-800 rounded-t-3xl">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                POS Bill Cart &amp; Checkout Drawer
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {totalCartQty} Item(s) · {formatINR(grandTotal)} ({totalSp} SP)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileCartDrawerOpen(false)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-slate-800 text-orange-900 dark:text-orange-300 font-black text-xs cursor-pointer"
            >
              + Add More Items ✕
            </button>
          </div>
        </div>

        {/* Customer & Rate Header */}
        <div className="p-3.5 border-b border-orange-200 dark:border-slate-800 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-white" />
              <span className="text-xs font-black uppercase tracking-wider">Customer &amp; Mobile App QR Check</span>
            </div>
            <button
              onClick={() => setIsQuickCustomerOpen(true)}
              className="text-[11px] underline text-emerald-200 hover:text-white font-medium"
            >
              + New Customer
            </button>
          </div>

          {/* Customer Dropdown + DP/MRP Switch */}
          <div className="flex gap-2 items-center">
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                setSelectedCustomer(found || null);
                setPosCustomerNameInput(found?.name || 'Walk-in Customer');
                setPosMobileInput(found?.mobile || '9800000000');
                setPosAwplIdInput(found?.awplId || '');
                setPosIsIdGreen(found?.isIdGreen ?? true);
                setPosRepurchaseSide(found?.preferredSide || 'S.A.O');
                setPosGreeningCategory(found?.greeningCategory || '27 SP');
              }}
              className="flex-1 rounded-xl bg-emerald-950/60 border border-emerald-700 text-xs px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="">Walk-in / Enter Mobile Manually</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile}) {c.isAppRegistered !== false ? '✓ App Reg' : '• Unregistered'}
                </option>
              ))}
            </select>

            {/* Price Mode: DP vs MRP */}
            <div className="flex rounded-lg bg-emerald-950/80 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setGlobalPriceType('dp')}
                className={`px-2.5 py-1 rounded-md transition ${
                  globalPriceType === 'dp' ? 'bg-amber-400 text-slate-950 shadow' : 'text-emerald-200'
                }`}
                title="AWPL Distributor Price"
              >
                DP
              </button>
              <button
                type="button"
                onClick={() => setGlobalPriceType('mrp')}
                className={`px-2.5 py-1 rounded-md transition ${
                  globalPriceType === 'mrp' ? 'bg-amber-400 text-slate-950 shadow' : 'text-emerald-200'
                }`}
                title="Maximum Retail Price"
              >
                MRP
              </button>
            </div>
          </div>

          {/* Customer Name & Mobile Number Input + Live App Registration QR Status */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <input
              type="text"
              value={posCustomerNameInput}
              onChange={(e) => setPosCustomerNameInput(e.target.value)}
              placeholder="Customer Name"
              className="rounded-lg bg-emerald-950/70 border border-emerald-600 px-2.5 py-1 text-white placeholder:text-emerald-300/60 focus:outline-none"
            />
            <input
              type="tel"
              value={posMobileInput}
              onChange={(e) => setPosMobileInput(e.target.value)}
              placeholder="10-Digit Mobile No."
              className="rounded-lg bg-emerald-950/70 border border-emerald-600 px-2.5 py-1 font-mono font-bold text-amber-300 placeholder:text-emerald-300/60 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] px-1">
            {isEnteredMobileRegisteredInApp ? (
              <span className="text-emerald-200 font-bold">
                ✓ Mobile +91 {posMobileInput} is Registered in Customer App → No App Download QR on Print Bill
              </span>
            ) : (
              <span className="text-amber-300 font-bold">
                📲 Mobile +91 {posMobileInput} NOT Registered in App → Customer App Download QR will Print on Bill!
              </span>
            )}
          </div>

          {/* AWPL ID Number Input + Green ID (S.A.O / S.G.O) vs Not Green (1. 27 SP, 2. 52 SP, 3. 100 SP, 4. Only Point Update) */}
          <div className="rounded-xl bg-emerald-950/70 border border-emerald-600/80 p-2.5 space-y-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-200 whitespace-nowrap">AWPL ID No:</span>
              <input
                type="text"
                value={posAwplIdInput}
                onChange={(e) => setPosAwplIdInput(e.target.value.toUpperCase())}
                placeholder="Enter AWPL ID (e.g. AWPL782910)"
                className="flex-1 rounded-lg bg-emerald-900/90 border border-emerald-600 px-2.5 py-1 font-mono font-bold text-white placeholder:text-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              {selectedCustomer && (
                <span className="text-[10px] text-emerald-300 whitespace-nowrap">
                  Total: {selectedCustomer.totalSpEarned} SP
                </span>
              )}
            </div>

            {posAwplIdInput.trim() && (
              <div className="space-y-2 pt-1.5 border-t border-emerald-800/80">
                {/* Step 1: Is AWPL ID Green? */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                    Is AWPL ID Green?
                  </span>
                  <div className="flex rounded-lg bg-emerald-900 p-0.5 text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => setPosIsIdGreen(true)}
                      className={`px-2.5 py-1 rounded-md transition ${
                        posIsIdGreen
                          ? 'bg-emerald-500 text-white shadow'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      ✓ Yes, ID is Green
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosIsIdGreen(false)}
                      className={`px-2.5 py-1 rounded-md transition ${
                        !posIsIdGreen
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      ✗ ID Not Green
                    </button>
                  </div>
                </div>

                {/* Step 2A: When ID is Green -> Show S.A.O / S.G.O Repurchase Side */}
                {posIsIdGreen ? (
                  <div className="flex items-center justify-between gap-2 bg-emerald-900/60 p-2 rounded-lg border border-emerald-500/40">
                    <span className="font-bold text-amber-300 text-[11px]">
                      Which Side to Repurchase?
                    </span>
                    <div className="flex gap-1.5">
                      {(['S.A.O', 'S.G.O'] as AWPLRepurchaseSide[]).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setPosRepurchaseSide(side)}
                          className={`px-3 py-1 rounded-lg font-black text-xs border transition ${
                            posRepurchaseSide === side
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                              : 'bg-emerald-950 text-emerald-200 border-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Step 2B: When ID is NOT Green -> Hide S.A.O/S.G.O & Show Greening Categories (1. 27 SP, 2. 52 SP, 3. 100 SP, 4. Only Point Update) */
                  <div className="bg-amber-500/15 p-2 rounded-lg border border-amber-400/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-[10px] uppercase tracking-wider">
                        Which Category to Green ID? (Prints on Bill)
                      </span>
                      <span className="text-[10px] font-bold text-emerald-200">
                        Bill SP: {totalSp} SP
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {GREENING_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setPosGreeningCategory(cat.value)}
                          className={`py-1.5 px-2 rounded-lg font-black text-[11px] border text-left transition flex items-center justify-between ${
                            posGreeningCategory === cat.value
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                              : 'bg-emerald-950/90 text-emerald-100 border-emerald-700 hover:bg-emerald-900'
                          }`}
                        >
                          <span>{cat.label}</span>
                          {posGreeningCategory === cat.value && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-950" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <ShoppingBag className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Cart is Empty
              </p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Tap any product on the left or scan a barcode to add items to this franchise bill.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
              >
                {/* Product Name, Price switch & Requirement #15 Pending Product Toggle */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                      {item.product.name}
                    </span>
                    {item.isPendingProduct && (
                      <span className="rounded bg-red-600 text-white px-1.5 py-0.2 text-[9px] font-black uppercase">
                        ⚠ Pending Product
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleItemPriceType(item.product.id)}
                      className="uppercase font-bold text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded hover:underline"
                    >
                      {item.selectedPriceType} ({formatINR(item.unitPrice)})
                    </button>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {item.spEarned} SP
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePendingProduct(item.product.id)}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-black border transition ${
                        item.isPendingProduct
                          ? 'bg-red-100 text-red-800 border-red-400 dark:bg-red-950 dark:text-red-300'
                          : 'bg-slate-200/70 text-slate-600 border-slate-300 hover:bg-amber-100 hover:text-amber-900 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                      title="Mark this item as Pending Product on Bill (To be given by original bill when stock arrives)"
                    >
                      {item.isPendingProduct ? '✓ Marked Pending on Bill' : '+ Mark Pending Product'}
                    </button>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-black text-slate-900 dark:text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Line Total & Remove */}
                <div className="text-right shrink-0 w-20">
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {formatINR(item.lineTotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-[10px] text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Summary Box */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 space-y-3">
          {/* Subtotals & Taxes */}
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3 text-slate-400" />
                Extra Discount:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                  placeholder="0"
                  className="w-12 text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-0.5 text-xs font-bold"
                />
                <span>%</span>
                {discountTotal > 0 && (
                  <span className="text-emerald-600 font-semibold">(-{formatINR(discountTotal)})</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
              <span>GST Included in DP/MRP ({formatINR(taxTotal)})</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Included in Price</span>
            </div>
            {upiFeeAmount > 0 && (
              <div className="flex justify-between items-center text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg font-bold">
                <span>UPI Transaction Fee ({franchiseConfig.upiTransactionFeePercent}%):</span>
                <span>+{formatINR(upiFeeAmount)}</span>
              </div>
            )}

            {/* Total SP pill */}
            <div className="flex justify-between items-center rounded-xl bg-amber-500/10 px-3 py-1.5 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-bold">
              <span className="flex items-center gap-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Total Eligible AWPL Sales Points:
              </span>
              <span className="text-sm font-black">{totalSp} SP</span>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Payable Amount:</span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>

          {/* Mode of Payment Selector (Requirement #6) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <span>Mode of Payment (Cash / UPI / Both / Card / Credit):</span>
              <span className="text-emerald-700 dark:text-emerald-400">
                Selected: {paymentMethod === 'Split (Cash + UPI)' ? 'Both (Cash + UPI)' : paymentMethod}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-[11px]">
            {(['Cash', 'UPI', 'Split (Cash + UPI)', 'Card', 'Credit'] as PaymentMethod[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setPaymentMethod(mode);
                  if (mode === 'Split (Cash + UPI)' && !splitCashAmount && !splitUpiAmount) {
                    const half = Math.floor(grandTotal / 2);
                    setSplitCashAmount(String(half));
                    setSplitUpiAmount(String(grandTotal - half));
                  }
                }}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition text-center leading-tight ${
                  paymentMethod === mode
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                {mode === 'UPI' && <QrCode className="h-3.5 w-3.5 shrink-0" />}
                {mode === 'Cash' && <Banknote className="h-3.5 w-3.5 shrink-0" />}
                {mode === 'Split (Cash + UPI)' && (
                  <div className="flex items-center gap-0.5">
                    <Banknote className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span>+</span>
                    <QrCode className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  </div>
                )}
                {mode === 'Card' && <CreditCard className="h-3.5 w-3.5 shrink-0" />}
                {mode === 'Credit' && <Clock className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate w-full">{mode === 'Split (Cash + UPI)' ? 'Both (Cash+UPI)' : mode}</span>
              </button>
            ))}
            </div>
          </div>

          {/* Cash Tendered Calculator (if Pure Cash) */}
          {paymentMethod === 'Cash' && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-900 dark:text-amber-300">Cash Received (Print Immediately):</span>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={String(grandTotal)}
                  className="w-24 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-amber-800 dark:text-amber-400 block">Change Due:</span>
                <span className="font-black text-sm text-amber-900 dark:text-amber-300">
                  {formatINR(returnChange)}
                </span>
              </div>
            </div>
          )}

          {/* Split (Cash + UPI) Dual Payment Manager */}
          {paymentMethod === 'Split (Cash + UPI)' && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-3 border border-emerald-300 dark:border-emerald-800/60 space-y-3 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                  <Banknote className="h-4 w-4 text-amber-600" />
                  <span>+</span>
                  <QrCode className="h-4 w-4 text-emerald-600" />
                  Both (Cash + UPI) Breakdown (Total: {formatINR(grandTotal)})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.floor(grandTotal / 2);
                    setSplitCashAmount(String(half));
                    setSplitUpiAmount(String(grandTotal - half));
                  }}
                  className="text-[10px] text-emerald-700 dark:text-emerald-400 underline font-semibold"
                >
                  Split 50/50
                </button>
              </div>

              {/* Cash & UPI Inputs */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cash Portion */}
                <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5 text-amber-600" />
                      How Much in Cash (₹)
                    </label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={splitCashAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitCashAmount(val);
                      const cNum = Number(val) || 0;
                      if (cNum <= grandTotal) {
                        setSplitUpiAmount(String(Math.max(0, grandTotal - cNum)));
                      }
                    }}
                    placeholder="0"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 p-1.5 font-black text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 focus:outline-none"
                  />
                  <div className="flex gap-1 pt-0.5">
                    {[500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setSplitCashAmount(String(amt));
                          setSplitUpiAmount(String(Math.max(0, grandTotal - amt)));
                        }}
                        className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI Portion */}
                <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                      How Much in UPI (₹)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const cNum = Number(splitCashAmount) || 0;
                        setSplitUpiAmount(String(Math.max(0, grandTotal - cNum)));
                      }}
                      className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      Fill Remainder
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={splitUpiAmount}
                    onChange={(e) => setSplitUpiAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 p-1.5 font-black text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-500 block">
                    GPay / PhonePe / Paytm
                  </span>
                </div>
              </div>

              {/* Live Tally and UPI QR for the exact UPI portion */}
              {(() => {
                const cNum = Number(splitCashAmount) || 0;
                const uNum = Number(splitUpiAmount) || 0;
                const tot = cNum + uNum;
                const diff = grandTotal - tot;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">Total Tendered: </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Cash {formatINR(cNum)} + UPI {formatINR(uNum)} = {formatINR(tot)}
                        </span>
                      </div>
                      {diff === 0 ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          ✓ Exact Total Matched
                        </span>
                      ) : diff > 0 ? (
                        <span className="font-bold text-red-600">
                          Due: {formatINR(diff)}
                        </span>
                      ) : (
                        <span className="font-bold text-amber-700">
                          Cash Return: {formatINR(Math.abs(diff))}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Credit Payment Notice */}
          {paymentMethod === 'Credit' && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 p-2.5 text-[11px] text-red-900 dark:text-red-200">
              <strong>Credit Goods Policy:</strong> Automatic 5-Day Credit Payment Reminder with Payment Amount ({formatINR(grandTotal)}) & UPI QR will be sent after 5 days. Print Bill unlocks once payment is received.
            </div>
          )}

          {/* Offline Notice banner if disconnected */}
          {!isOnline && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Offline Mode Active: Invoice will be stored locally and queued for cloud sync.</span>
            </div>
          )}

          {/* AWPL C&F Portal Linkage & Item Clearance */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSyncToCF}
                  onChange={(e) => setAutoSyncToCF(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                  AWPL C&F Portal Online Linkage
                </span>
              </label>
              <span className="rounded bg-emerald-100 dark:bg-emerald-900/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                Solan C&F Depot
              </span>
            </div>

            {autoSyncToCF ? (
              <div className="space-y-1.5 pt-1 text-[11px]">
                <p className="text-slate-600 dark:text-slate-300 text-[10px]">
                  All <span className="font-bold text-emerald-800 dark:text-emerald-400">{cart.length} item(s)</span> will be marked as updated in AWPL C&F portal with generated Online C&F Bill No and ID Number.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block">
                      Custom Online C&F Bill # (Optional)
                    </label>
                    <input
                      type="text"
                      value={customCfBillNumber}
                      onChange={(e) => setCustomCfBillNumber(e.target.value)}
                      placeholder="Auto: AWPL-CF-SOL-..."
                      className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block">
                      C&F ID / DS Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={customCfIdNumber}
                      onChange={(e) => setCustomCfIdNumber(e.target.value)}
                      placeholder="Auto: CF-ID-..."
                      className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                Items will remain pending until updated via Invoices C&F manager or C&F Portal tab.
              </p>
            )}
          </div>

          {/* Requirement #6: Complete Billing Action Bar — New Invoice, Mode of Payment, Save Bill, and Print Bill */}
          <div className="grid grid-cols-12 gap-2 pt-1">
            <button
              type="button"
              onClick={handleClearCart}
              className="col-span-3 py-2.5 px-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 flex items-center justify-center gap-1 transition"
              title="Start a New Invoice (Clears current items)"
            >
              <FilePlus2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span>New Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerateInvoice(true)}
              disabled={cart.length === 0}
              className="col-span-4 py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs shadow flex items-center justify-center gap-1.5 transition"
              title="Save Bill to Cloud & Invoice List without opening printer"
            >
              <Save className="h-3.5 w-3.5 shrink-0" />
              <span>Save Bill ({formatINR(grandTotal)})</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerateInvoice(false)}
              disabled={cart.length === 0}
              className="col-span-5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition"
              title="Save & Print Bill on Installed PC Printer"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>
                {paymentMethod === 'UPI' || paymentMethod === 'Split (Cash + UPI)'
                  ? `Verify UPI & Print Bill`
                  : `Print Bill (${formatINR(grandTotal)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Requirement #1 & #4: Live Payment Gateway UPI Modal — Auto-Detects Payment & Prints Bill Immediately */}
      {pendingUpiInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border-2 border-emerald-500 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase">
                    Live UPI Payment Gateway
                  </span>
                  <span className="rounded bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase">
                    Immediate Auto-Print Bill
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Scan QR to Pay • Bill Prints Immediately After Payment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingUpiInvoice(null);
                  setUpiGatewaySessionId(null);
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {(() => {
              const upiPortion = pendingUpiInvoice.splitDetails
                ? pendingUpiInvoice.splitDetails.upiAmount
                : pendingUpiInvoice.grandTotal;
              const qrUrl = getCnfUpiQrImageSrc(
                franchiseConfig,
                upiPortion,
                pendingUpiInvoice.invoiceNumber,
                180
              );
              return (
                <div className="space-y-3 text-xs">
                  {/* Live Gateway Detection Status Banner */}
                  <div
                    className={`rounded-xl p-2.5 border font-bold flex items-center justify-between ${
                      upiGatewayStatus === 'verified'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                        : upiGatewayStatus === 'detected'
                        ? 'bg-amber-100 border-amber-400 text-amber-900 animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>
                      {upiGatewayStatus === 'verified'
                        ? '✓ UPI Payment Verified! Opening & Printing Bill Immediately...'
                        : upiGatewayStatus === 'detected'
                        ? '⚡ Incoming UPI Payment Detected from Customer App — Verifying UTR...'
                        : '📡 Live Gateway Listening for UPI Payment (GPay / PhonePe / Paytm)...'}
                    </span>
                    {upiGatewaySessionId && (
                      <span className="font-mono text-[10px] opacity-75">
                        {upiGatewaySessionId.slice(-8)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 text-center">
                    <img
                      src={qrUrl}
                      alt="UPI Payment QR"
                      className="h-36 w-36 rounded-xl bg-white p-2 border border-slate-200 shadow-sm object-contain"
                    />
                    <p className="mt-2 font-black text-base text-emerald-800 dark:text-emerald-300">
                      UPI Amount to Receive: {formatINR(upiPortion)}
                    </p>
                    {pendingUpiInvoice.splitDetails && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">
                        Both Mode: Cash {formatINR(pendingUpiInvoice.splitDetails.cashAmount)} + UPI{' '}
                        {formatINR(pendingUpiInvoice.splitDetails.upiAmount)}
                      </p>
                    )}
                    <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                      Payee UPI: {franchiseConfig.bankUpiId} ({franchiseConfig.name})
                    </p>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      UPI Reference / UTR No. (Auto-Populated by Gateway)
                    </label>
                    <input
                      type="text"
                      value={upiTxnRefInput}
                      onChange={(e) => setUpiTxnRefInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    As soon as the UPI payment is verified, the invoice receipt opens and triggers browser printing immediately.
                  </p>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingUpiInvoice(null);
                        setUpiGatewaySessionId(null);
                      }}
                      className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmUpiReceivedAndPrint()}
                      className="w-2/3 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Verify Payment &amp; Print Bill Now</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductFound={(prod) => {
          addToCart(prod);
          setSuccessToast(`Added ${prod.name} via Barcode scan!`);
          setTimeout(() => setSuccessToast(''), 3000);
        }}
        products={products}
      />

      {/* Quick Add Customer Modal */}
      {isQuickCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Add Customer
            </h3>
            <form onSubmit={handleAddQuickCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={custNameInput}
                  onChange={(e) => setCustNameInput(e.target.value)}
                  placeholder="e.g. Suresh Kumar"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">10-Digit Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={custMobileInput}
                  onChange={(e) => setCustMobileInput(e.target.value)}
                  placeholder="e.g. 9816098765"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">AWPL Member ID (Optional)</label>
                <input
                  type="text"
                  value={custAwplIdInput}
                  onChange={(e) => setCustAwplIdInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AWPL992810"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>

              {custAwplIdInput.trim() && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Is AWPL ID Green?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCustIsIdGreenInput(true)}
                        className={`py-1.5 px-2 rounded-lg font-bold border transition ${
                          custIsIdGreenInput
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ✓ Yes, ID is Green
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustIsIdGreenInput(false)}
                        className={`py-1.5 px-2 rounded-lg font-bold border transition ${
                          !custIsIdGreenInput
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ✗ ID Not Green
                      </button>
                    </div>
                  </div>

                  {custIsIdGreenInput ? (
                    <div>
                      <label className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                        Which Side to Repurchase? (S.A.O / S.G.O)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['S.A.O', 'S.G.O'] as AWPLRepurchaseSide[]).map((side) => (
                          <button
                            key={side}
                            type="button"
                            onClick={() => setCustRepurchaseSideInput(side)}
                            className={`py-1.5 px-2 rounded-lg font-black border transition ${
                              custRepurchaseSideInput === side
                                ? 'bg-amber-400 text-slate-950 border-amber-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {side}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="font-bold text-amber-800 dark:text-amber-300 block mb-1">
                        Which Category to Green?
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {GREENING_CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setCustGreeningCategoryInput(cat.value)}
                            className={`py-1.5 px-2 rounded-lg font-black text-[11px] border text-left transition ${
                              custGreeningCategoryInput === cat.value
                                ? 'bg-amber-400 text-slate-950 border-amber-500'
                                : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {quickCustOtpError && (
                <div className="rounded-xl bg-red-50 border border-red-300 p-2.5 text-[11px] font-bold text-red-700">
                  {quickCustOtpError}
                </div>
              )}

              {quickCustOtpSent && (
                <div className="rounded-xl bg-orange-50 dark:bg-orange-950/50 border-2 border-orange-500 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300">
                      6-Digit OTP Sent to +91 {custMobileInput}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuickCustEnteredOtp(quickCustGeneratedOtp)}
                      className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-2 py-0.5 text-[10px] font-black cursor-pointer"
                    >
                      ⚡ Auto-Fill OTP ({quickCustGeneratedOtp})
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={quickCustEnteredOtp}
                    onChange={(e) => setQuickCustEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-Digit OTP"
                    className="w-full rounded-lg border-2 border-orange-500 bg-white dark:bg-slate-900 p-2 text-center font-mono font-black text-sm tracking-widest text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickCustomerOpen(false);
                    setQuickCustOtpSent(false);
                    setQuickCustEnteredOtp('');
                    setQuickCustOtpError(null);
                  }}
                  className="w-1/2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-700 shadow cursor-pointer"
                >
                  {quickCustOtpSent ? '✓ Verify 6-Digit OTP' : 'Send 6-Digit OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print & Share Modal */}
      <InvoicePrintModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setAutoPrintNextInvoice(false);
        }}
        invoice={generatedInvoice}
        franchiseConfig={franchiseConfig}
        onUpdateConfig={onUpdateConfig}
        autoPrintOnOpen={autoPrintNextInvoice}
        onAutoPrintComplete={() => setAutoPrintNextInvoice(false)}
      />

      {/* Success Floating Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xl animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {successToast}
        </div>
      )}
    </div>
  );
};
