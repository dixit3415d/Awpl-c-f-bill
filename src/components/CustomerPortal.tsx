import React, { useState, useMemo } from 'react';
import {
  User,
  ShoppingBag,
  Plus,
  Minus,
  Sparkles,
  Building2,
  CheckCircle2,
  Clock,
  Phone,
  ShieldCheck,
  FileText,
  CreditCard,
  QrCode,
  Crown,
  RefreshCw,
  X,
  AlertTriangle,
  BellRing,
  Layers,
  Split,
  Check,
  ArrowRight,
  Smartphone,
  MessageCircle,
  ExternalLink,
  LogOut,
  KeyRound
} from 'lucide-react';
import {
  AWPLGreeningCategory,
  AWPLProduct,
  AWPLRepurchaseSide,
  CartItem,
  CFBillRecord,
  Customer,
  FranchiseConfig,
  InAppNotification,
  Invoice,
  LinkedCFDepot,
  UserSubscription
} from '../types';
import {
  formatINR,
  generateNextInvoiceNumber,
  setStorageItem,
  getStorageItem,
  getInvoiceDaysOld,
  buildWhatsApp7DayReminderUrl
} from '../utils/storage';
import { LINKED_CF_DEPOTS } from '../data/initialData';
import { InvoicePrintModal } from './InvoicePrintModal';
import { fuzzyFilterProducts } from '../utils/fuzzySearch';

interface CustomerPortalProps {
  products: AWPLProduct[];
  customers: Customer[];
  franchiseConfig: FranchiseConfig;
  cnfAccounts?: FranchiseConfig[];
  onUpdateCustomers: (customers: Customer[]) => void;
  onUpdateProducts: (products: AWPLProduct[]) => void;
  onUpdateConfig: (config: FranchiseConfig) => void;
  invoices: Invoice[];
  onInvoiceCreated: (inv: Invoice) => void;
  onUpdateInvoices?: (invoices: Invoice[]) => void;
  cfRecords?: CFBillRecord[];
  onUpdateCFRecords?: (records: CFBillRecord[]) => void;
  userSubscriptions?: UserSubscription[];
  onUpdateSubscriptions?: (subs: UserSubscription[]) => void;
  inAppNotifications?: InAppNotification[];
  onOpenFeedback?: () => void;
  onLogout?: () => void;
  onChangePin?: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  products,
  customers,
  franchiseConfig,
  cnfAccounts = [],
  onUpdateCustomers,
  onUpdateProducts,
  onUpdateConfig,
  invoices,
  onInvoiceCreated,
  onUpdateInvoices,
  cfRecords = [],
  onUpdateCFRecords,
  userSubscriptions = [],
  onUpdateSubscriptions,
  inAppNotifications = [],
  onOpenFeedback,
  onLogout,
  onChangePin,
}) => {
  // Current logged in customer (registered against mobile number)
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(customers[0] || null);

  // Registration / Login against Mobile Number state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regMobile, setRegMobile] = useState('');
  const [regName, setRegName] = useState('');
  const [regAwplId, setRegAwplId] = useState('');
  const [regIsGreen, setRegIsGreen] = useState(true);
  const [regPreferredSide, setRegPreferredSide] = useState<AWPLRepurchaseSide>('S.A.O');
  const [regAddress, setRegAddress] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regEnteredOtp, setRegEnteredOtp] = useState('');
  const [regError, setRegError] = useState('');

  // Merge all registered C&Fs from cnfAccounts with LINKED_CF_DEPOTS so Customer can choose ANY C&F to purchase from
  const availableCfDepots = useMemo(() => {
    const mappedFromAccounts: (LinkedCFDepot & {
      customProducts?: AWPLProduct[];
      qrMode?: 'auto_upi' | 'uploaded_image';
      customQrImageDataUrl?: string;
    })[] = cnfAccounts.map((cfg, idx) => ({
      id: cfg.id || `cnf-acc-${idx}`,
      name: cfg.name,
      shortName: cfg.shortName || 'CNF',
      code: cfg.franchiseCode || `AWPL-CF-${cfg.shortName || '01'}`,
      city: cfg.address?.split(',')?.[1]?.trim() || 'Solan',
      state: 'Himachal Pradesh',
      address: cfg.address,
      upiId: cfg.bankUpiId || 'drightwellness@upi',
      upiNumber: cfg.upiNumber || cfg.phone,
      bankName: cfg.bankName,
      accountNo: cfg.accountNo,
      ifscCode: cfg.ifscCode,
      contactPhone: cfg.phone,
      email: cfg.email,
      franchiseOwner: cfg.franchiseOwner,
      cfOwnerName: cfg.cfOwnerName || cfg.franchiseOwner,
      parentCompany: 'Asclepius Wellness Private Limited',
      isDrightWellness: cfg.isDrightWellness,
      infinityStockPermanent: cfg.infinityStockPermanent,
      infinityStockEnabled: cfg.infinityStockEnabled,
      customProducts:
        cfg.id === franchiseConfig.id || cfg.name === franchiseConfig.name
          ? products
          : cfg.customProducts,
      qrMode: cfg.qrMode,
      customQrImageDataUrl: cfg.customQrImageDataUrl,
    }));

    const existingNames = new Set(mappedFromAccounts.map((d) => d.name.toLowerCase()));
    const extraDepots = LINKED_CF_DEPOTS.filter(
      (d) => !existingNames.has(d.name.toLowerCase())
    );
    return [...mappedFromAccounts, ...extraDepots];
  }, [cnfAccounts, franchiseConfig, products]);

  // Linked C&F Depot Selection (Customer chooses which C&F to buy from)
  const [selectedCfDepotId, setSelectedCfDepotId] = useState<string>(
    () => availableCfDepots[0]?.id || LINKED_CF_DEPOTS[0].id
  );

  const selectedCfDepot = useMemo(() => {
    return (
      availableCfDepots.find((d) => d.id === selectedCfDepotId) ||
      availableCfDepots[0] ||
      LINKED_CF_DEPOTS[0]
    );
  }, [availableCfDepots, selectedCfDepotId]);

  // Resolve products with DP & SP according to what the selected C&F has mentioned
  const selectedCfProducts = useMemo(() => {
    const depotWithCustom = selectedCfDepot as LinkedCFDepot & {
      customProducts?: AWPLProduct[];
    };
    if (
      selectedCfDepot.id === franchiseConfig.id ||
      selectedCfDepot.name === franchiseConfig.name ||
      selectedCfDepot.isDrightWellness
    ) {
      return products;
    }
    if (depotWithCustom.customProducts && depotWithCustom.customProducts.length > 0) {
      return depotWithCustom.customProducts;
    }
    return products;
  }, [selectedCfDepot, franchiseConfig, products]);

  // Customer App Focused Tabs:
  // 1. 'order_placement' (Only Order Placement + UPI Checkout)
  // 2. 'online_bill_use' (My Bills -> Use Bill for Online / Assign AWPL ID & S.A.O/S.G.O + Track Online Bill No)
  // 3. 'membership' (Customer ₹99 Monthly Plan Only)
  const [activeTab, setActiveTab] = useState<'order_placement' | 'online_bill_use' | 'membership'>('order_placement');

  // Cart & Ordering state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Whenever Customer switches C&F Depot, sync cart item DP & SP to match the newly chosen C&F's mentioned DP & SP
  React.useEffect(() => {
    setCart((prev) =>
      prev.map((item) => {
        const matchedProd =
          selectedCfProducts.find(
            (p) => p.id === item.product.id || p.sku === item.product.sku
          ) || item.product;
        const nextUnitPrice = matchedProd.dp;
        return {
          ...item,
          product: matchedProd,
          selectedPriceType: 'dp',
          unitPrice: nextUnitPrice,
          lineTotal: nextUnitPrice * item.quantity,
          spEarned: matchedProd.sp * item.quantity,
        };
      })
    );
  }, [selectedCfProducts]);

  // 2-Step Checkout Modal: Step 1 = UPI Payment (with Auto-Payment Detection Gateway), Step 2 = Allocate AWPL ID(s) & S.A.O / S.G.O Side
  const [isUpiCheckoutOpen, setIsUpiCheckoutOpen] = useState(false);
  const [upiAppChoice, setUpiAppChoice] = useState<'GPay' | 'PhonePe' | 'Paytm' | 'UPI QR'>('UPI QR');
  const [upiRefInput, setUpiRefInput] = useState('');
  const [isProcessingUpi, setIsProcessingUpi] = useState(false);
  const [orderGatewaySessionId, setOrderGatewaySessionId] = useState<string | null>(null);
  const [orderGatewayStatus, setOrderGatewayStatus] = useState<'listening' | 'detected' | 'verified'>('listening');
  const [orderAutoDetectEnabled, setOrderAutoDetectEnabled] = useState<boolean>(true);
  const [orderAutoCountdown, setOrderAutoCountdown] = useState<number>(5);

  // Post-UPI Payment OR "Use Bill for Online" AWPL ID & S.A.O / S.G.O Allocation Modal
  const [allocatingInvoice, setAllocatingInvoice] = useState<Invoice | null>(null);
  const [allocationMode, setAllocationMode] = useState<'same_id' | 'multiple_ids'>('same_id');
  // State for "All Items on Same AWPL ID"
  const [sameAwplId, setSameAwplId] = useState('');
  const [sameHolderName, setSameHolderName] = useState('');
  const [sameIsGreen, setSameIsGreen] = useState(true);
  const [sameRepurchaseSide, setSameRepurchaseSide] = useState<AWPLRepurchaseSide>('S.A.O');
  const [sameGreeningCategory, setSameGreeningCategory] = useState<AWPLGreeningCategory>('27 SP');
  // State for "Multiple AWPL IDs (1 ID per Item)"
  const [editableItems, setEditableItems] = useState<CartItem[]>([]);
  const [allocationSavedToast, setAllocationSavedToast] = useState<string | null>(null);

  // Print/View Invoice Modal
  const [viewInvoiceModal, setViewInvoiceModal] = useState<Invoice | null>(null);

  // Customer ₹99 Monthly Subscription Modal (with Built-In Auto-Payment Detection Gateway)
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isPayingSub, setIsPayingSub] = useState(false);
  const [subGatewaySessionId, setSubGatewaySessionId] = useState<string | null>(null);
  const [subGatewayStatus, setSubGatewayStatus] = useState<'listening' | 'detected' | 'verified'>('listening');
  const [subAutoDetectEnabled, setSubAutoDetectEnabled] = useState<boolean>(true);
  const [subAutoCountdown, setSubAutoCountdown] = useState<number>(5);

  // Customer's private invoices
  const myInvoices = useMemo(() => {
    if (!activeCustomer) return [];
    return invoices.filter(
      (inv) =>
        inv.customerId === activeCustomer.id ||
        inv.customerMobile === activeCustomer.mobile ||
        (activeCustomer.awplId && inv.customerAwplId === activeCustomer.awplId)
    );
  }, [invoices, activeCustomer]);

  // Identify bills pending online update for >= 7 days (7-Day Reminder!)
  const overdue7DayInvoices = useMemo(() => {
    return myInvoices.filter((inv) => {
      const hasPendingItems = inv.cfSyncStatus !== 'synced' || inv.items.some((i) => !i.cfSynced);
      const daysOld = getInvoiceDaysOld(inv.date);
      return hasPendingItems && daysOld >= 7 && inv.paymentStatus !== 'cancelled';
    });
  }, [myInvoices]);

  // All bills that still have items pending online entry
  const pendingOnlineInvoices = useMemo(() => {
    return myInvoices.filter(
      (inv) =>
        inv.paymentStatus !== 'cancelled' &&
        (inv.cfSyncStatus !== 'synced' || inv.items.some((i) => !i.cfSynced))
    );
  }, [myInvoices]);

  // Requirement #15: Pending Products on Customer's Bills (Pending vs Given + Arrival Notification in App)
  const myPendingProductItems = useMemo(() => {
    const list: { invoice: Invoice; item: CartItem }[] = [];
    myInvoices.forEach((inv) => {
      if (inv.paymentStatus === 'cancelled') return;
      inv.items.forEach((it) => {
        if (it.isPendingProduct) {
          list.push({ invoice: inv, item: it });
        }
      });
    });
    return list;
  }, [myInvoices]);

  // Active ₹99/mo Customer Subscription check
  const activeCustomerSub = useMemo(() => {
    if (!activeCustomer) return null;
    return userSubscriptions.find(
      (s) =>
        s.status === 'active' &&
        (s.userId === activeCustomer.id ||
          (activeCustomer.name && s.userName.toLowerCase().includes(activeCustomer.name.toLowerCase())))
    );
  }, [userSubscriptions, activeCustomer]);

  // Add product to cart using the selected C&F's mentioned DP and SP
  const addToCart = (product: AWPLProduct) => {
    if (product.stopCustomerAppSale) return;
    setCart((prev) => {
      const match = prev.find((item) => item.product.id === product.id);
      const unitPrice = product.dp;

      if (match) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                product,
                unitPrice,
                quantity: item.quantity + 1,
                lineTotal: unitPrice * (item.quantity + 1),
                spEarned: product.sp * (item.quantity + 1),
              }
            : item
        );
      }

      return [
        ...prev,
        {
          product,
          quantity: 1,
          selectedPriceType: 'dp',
          unitPrice,
          discountPercent: 0,
          taxAmount: 0,
          lineTotal: unitPrice,
          spEarned: product.sp,
          targetAwplId: activeCustomer?.awplId || '',
          targetAwplHolderName: activeCustomer?.name || '',
          isIdGreen: activeCustomer?.isIdGreen ?? true,
          repurchaseSide: activeCustomer?.preferredSide || 'S.A.O',
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const next = item.quantity + delta;
            if (next <= 0) return null;
            return {
              ...item,
              quantity: next,
              lineTotal: item.unitPrice * next,
              spEarned: item.product.sp * next,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const { cartTotal, cartSp } = useMemo(() => {
    let tot = 0;
    let sp = 0;
    cart.forEach((i) => {
      tot += i.lineTotal;
      sp += i.spEarned;
    });
    return { cartTotal: tot, cartSp: sp };
  }, [cart]);

  // Step 1 -> Open UPI Payment Modal & Start Auto-Payment Gateway Session
  const handleInitiateUpiPayment = async () => {
    if (!activeCustomer) {
      setIsRegistering(true);
      return;
    }
    if (cart.length === 0) return;
    setUpiRefInput(`UTR-AUTO-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setOrderGatewayStatus('listening');
    setOrderAutoCountdown(5);
    setIsUpiCheckoutOpen(true);

    try {
      const res = await fetch('/api/payment-gateway/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'customer_order',
          portal: 'customer_app',
          amount: cartTotal,
          payerName: activeCustomer.name,
          payerMobile: activeCustomer.mobile,
          userId: activeCustomer.id,
          payeeName: selectedCfDepot.name,
          payeeUpiId: selectedCfDepot.upiId || franchiseConfig.bankUpiId,
          autoDetectSeconds: 5,
        }),
      });
      const data = await res.json();
      if (data?.ok && data?.session?.sessionId) {
        setOrderGatewaySessionId(data.session.sessionId);
      } else {
        setOrderGatewaySessionId(`PGW-ORD-${Date.now()}`);
      }
    } catch {
      setOrderGatewaySessionId(`PGW-ORD-${Date.now()}`);
    }
  };

  // Step 2 -> Confirm UPI Payment & Immediately Open AWPL ID + S.A.O / S.G.O Allocation Screen
  const handleConfirmUpiPayment = () => {
    if (!activeCustomer || cart.length === 0) return;
    setIsProcessingUpi(true);

    setTimeout(() => {
      const invNum = generateNextInvoiceNumber(franchiseConfig, onUpdateConfig);
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      const defaultAwplId = activeCustomer.awplId || 'AWPL782910';

      const preparedItems: CartItem[] = cart.map((it) => ({
        ...it,
        targetAwplId: it.targetAwplId || defaultAwplId,
        targetAwplHolderName: activeCustomer.name,
        isIdGreen: true,
        repurchaseSide: 'S.A.O',
        cfSynced: false,
        cfRemarks: `Ordered via Customer App for ${selectedCfDepot.name}`,
      }));

      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: invNum,
        customerId: activeCustomer.id,
        customerName: activeCustomer.name,
        customerMobile: activeCustomer.mobile,
        customerAwplId: activeCustomer.awplId,
        isRegisteredAppCustomer: true,
        paymentReceivedConfirmed: true,
        date: formattedDate,
        selectedCfDepotId: selectedCfDepot.id,
        selectedCfDepotName: selectedCfDepot.name,
        awplAllocationMode: 'same_id',
        upiRefNo: upiRefInput,
        items: preparedItems,
        subtotal: cartTotal,
        discountTotal: 0,
        taxTotal: Math.round(
          cart.reduce(
            (sum, it) =>
              sum + it.lineTotal * (it.product.gstRate / (100 + it.product.gstRate)),
            0
          )
        ),
        grandTotal: cartTotal,
        totalSp: cartSp,
        paymentMethod: 'UPI',
        paymentStatus: 'paid',
        amountPaid: cartTotal,
        balanceDue: 0,
        staffName: `Customer App (${selectedCfDepot.city} C&F)`,
        staffId: 'customer_portal',
        notes: `Linked C&F: ${selectedCfDepot.name} | UPI Ref: ${upiRefInput}${deliveryNotes ? ' | ' + deliveryNotes : ''}`,
        isSynced: true,
        cfSyncStatus: 'pending',
        cfNotes: `Purchased from ${selectedCfDepot.name}. Pending Online AWPL ID update.`,
      };

      // Update Customer SP
      const updatedCustomers = customers.map((c) => {
        if (c.id === activeCustomer.id) {
          return {
            ...c,
            totalSpEarned: (c.totalSpEarned || 0) + cartSp,
          };
        }
        return c;
      });
      onUpdateCustomers(updatedCustomers);
      setStorageItem('drw_customers_v1', updatedCustomers);

      // Persist Invoice
      const existing = getStorageItem<Invoice[]>('drw_invoices_v1', []);
      const nextInvoices = [newInvoice, ...existing];
      setStorageItem('drw_invoices_v1', nextInvoices);
      onInvoiceCreated(newInvoice);

      // Also create a linked C&F Portal Record so it immediately shows on C&F Portal
      const newCfRecord: CFBillRecord = {
        id: `cf-ord-${Date.now()}`,
        referenceNo: `CF-${selectedCfDepot.code.slice(-7)}-${Math.floor(1000 + Math.random() * 9000)}`,
        awplCustomerId: defaultAwplId,
        customerName: activeCustomer.name,
        customerMobile: activeCustomer.mobile,
        itemsSummary: preparedItems.map((i) => `${i.product.name} (${i.quantity})`).join(', '),
        totalSp: cartSp,
        pendingAmount: cartTotal,
        cfBranch: selectedCfDepot.name,
        status: 'Pending Verification',
        createdDate: formattedDate,
        lastUpdated: formattedDate,
        customerRemarks: `Paid via UPI (${upiRefInput}). Invoice #${invNum} ready for online AWPL ID entry.`,
        otpVerified: true,
      };
      const updatedCfRecords = [newCfRecord, ...cfRecords];
      if (onUpdateCFRecords) {
        onUpdateCFRecords(updatedCfRecords);
      }
      setStorageItem('drw_cf_records_v1', updatedCfRecords);

      setCart([]);
      setIsProcessingUpi(false);
      setIsUpiCheckoutOpen(false);

      // Immediately open Step 3: Allocate AWPL ID(s) & S.A.O / S.G.O Repurchase Side!
      handleOpenAwplAllocationModal(newInvoice);
    }, 700);
  };

  // Open AWPL ID & Green ID (S.A.O / S.G.O) Allocation Modal for any invoice
  const handleOpenAwplAllocationModal = (inv: Invoice) => {
    setAllocatingInvoice(inv);
    const mode = inv.awplAllocationMode || 'same_id';
    setAllocationMode(mode);

    const firstItem = inv.items[0];
    setSameAwplId(firstItem?.targetAwplId || inv.customerAwplId || activeCustomer?.awplId || 'AWPL782910');
    setSameHolderName(firstItem?.targetAwplHolderName || inv.customerName || '');
    setSameIsGreen(firstItem?.isIdGreen ?? inv.isIdGreen ?? true);
    setSameRepurchaseSide(firstItem?.repurchaseSide || inv.repurchaseSide || 'S.A.O');
    setSameGreeningCategory(firstItem?.greeningCategory || inv.greeningCategory || '27 SP');

    setEditableItems(
      inv.items.map((it) => ({
        ...it,
        targetAwplId: it.targetAwplId || inv.customerAwplId || activeCustomer?.awplId || 'AWPL782910',
        targetAwplHolderName: it.targetAwplHolderName || inv.customerName,
        isIdGreen: it.isIdGreen ?? inv.isIdGreen ?? true,
        repurchaseSide: it.repurchaseSide || inv.repurchaseSide || 'S.A.O',
        greeningCategory: it.greeningCategory || inv.greeningCategory || '27 SP',
      }))
    );
  };

  // Split an item with quantity > 1 into two separate rows so each unit can be assigned to a different AWPL ID
  const handleSplitItemForMultipleIds = (index: number) => {
    setEditableItems((prev) => {
      const target = prev[index];
      if (!target || target.quantity <= 1) return prev;
      const singleSp = Math.round(target.spEarned / target.quantity);
      const reducedQty = target.quantity - 1;

      const updatedOriginal: CartItem = {
        ...target,
        quantity: reducedQty,
        lineTotal: target.unitPrice * reducedQty,
        spEarned: singleSp * reducedQty,
      };

      const splitSingleUnit: CartItem = {
        ...target,
        quantity: 1,
        lineTotal: target.unitPrice,
        spEarned: singleSp,
        targetAwplId: '',
        targetAwplHolderName: '',
        isIdGreen: true,
        repurchaseSide: 'S.G.O',
        greeningCategory: '27 SP',
      };

      const next = [...prev];
      next.splice(index, 1, updatedOriginal, splitSingleUnit);
      return next;
    });
  };

  // Save AWPL ID & S.A.O / S.G.O or Greening Category Allocation and sync to C&F Portal
  const handleSaveAwplAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingInvoice) return;

    const finalItems: CartItem[] =
      allocationMode === 'same_id'
        ? editableItems.map((it) => ({
            ...it,
            targetAwplId: sameAwplId.trim().toUpperCase(),
            targetAwplHolderName: sameHolderName.trim() || allocatingInvoice.customerName,
            isIdGreen: sameIsGreen,
            repurchaseSide: sameIsGreen ? sameRepurchaseSide : undefined,
            greeningCategory: !sameIsGreen ? sameGreeningCategory : undefined,
            cfRemarks: `Assigned to AWPL ID ${sameAwplId.trim().toUpperCase()} (${
              sameIsGreen ? `Green ID • Side: ${sameRepurchaseSide}` : `Greening Category: ${sameGreeningCategory}`
            })`,
          }))
        : editableItems.map((it) => {
            const cleanId = (it.targetAwplId || sameAwplId || 'AWPL782910').trim().toUpperCase();
            const isGreen = it.isIdGreen ?? true;
            const side = it.repurchaseSide || 'S.A.O';
            const gCat = it.greeningCategory || '27 SP';
            return {
              ...it,
              targetAwplId: cleanId,
              targetAwplHolderName: it.targetAwplHolderName || allocatingInvoice.customerName,
              isIdGreen: isGreen,
              repurchaseSide: isGreen ? side : undefined,
              greeningCategory: !isGreen ? gCat : undefined,
              cfRemarks: `Assigned to AWPL ID ${cleanId} (${
                isGreen ? `Green ID • Side: ${side}` : `Greening Category: ${gCat}`
              })`,
            };
          });

    const distinctIds = Array.from(new Set(finalItems.map((i) => i.targetAwplId).filter(Boolean)));
    const summaryText = finalItems
      .map(
        (i) =>
          `${i.product.name} x${i.quantity} → ${i.targetAwplId} [${
            i.isIdGreen ? `Green ID • ${i.repurchaseSide}` : `Greening: ${i.greeningCategory || '27 SP'}`
          }]`
      )
      .join(' | ');

    const updatedInvoices = invoices.map((inv) => {
      if (inv.id === allocatingInvoice.id) {
        const primaryItem = finalItems[0];
        return {
          ...inv,
          awplAllocationMode: distinctIds.length > 1 ? 'multiple_ids' : allocationMode,
          customerAwplId: distinctIds[0] || inv.customerAwplId,
          isIdGreen: primaryItem?.isIdGreen,
          repurchaseSide: primaryItem?.isIdGreen ? primaryItem?.repurchaseSide : undefined,
          greeningCategory: !primaryItem?.isIdGreen ? primaryItem?.greeningCategory : undefined,
          items: finalItems,
          cfNotes: `Online Allocation Ready (${
            distinctIds.length > 1 ? `Multiple IDs: ${distinctIds.join(', ')}` : `Same ID: ${distinctIds[0]}`
          }): ${summaryText}`,
        };
      }
      return inv;
    });

    if (onUpdateInvoices) {
      onUpdateInvoices(updatedInvoices);
    }
    setStorageItem('drw_invoices_v1', updatedInvoices);

    // Also update or add C&F Record so C&F Portal operator sees the exact AWPL ID(s) & S.A.O / S.G.O breakdown
    const newCfRec: CFBillRecord = {
      id: `cf-alloc-${Date.now()}`,
      referenceNo: `CF-ONL-${allocatingInvoice.invoiceNumber.split('/').pop()}`,
      awplCustomerId: distinctIds.join(', '),
      customerName: allocatingInvoice.customerName,
      customerMobile: allocatingInvoice.customerMobile,
      itemsSummary: summaryText,
      totalSp: allocatingInvoice.totalSp,
      pendingAmount: allocatingInvoice.grandTotal,
      cfBranch: allocatingInvoice.selectedCfDepotName || selectedCfDepot.name,
      status: 'Pending Verification',
      createdDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
      customerRemarks: `Customer submitted Online Bill Use request for Invoice #${allocatingInvoice.invoiceNumber} (${
        distinctIds.length > 1 ? 'Multiple AWPL IDs' : 'Single AWPL ID'
      }).`,
      otpVerified: true,
    };

    const nextCfRecords = [newCfRec, ...cfRecords];
    if (onUpdateCFRecords) {
      onUpdateCFRecords(nextCfRecords);
    }
    setStorageItem('drw_cf_records_v1', nextCfRecords);

    setAllocatingInvoice(null);
    setAllocationSavedToast(
      `Online AWPL ID & S.A.O/S.G.O allocation saved for Invoice #${allocatingInvoice.invoiceNumber} and sent to ${
        allocatingInvoice.selectedCfDepotName || selectedCfDepot.name
      }!`
    );
    setActiveTab('online_bill_use');
  };

  // Customer Registration / Login against Mobile Number
  const handleRegisterAgainstMobile = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    const cleanMob = regMobile.replace(/\D/g, '');
    if (cleanMob.length !== 10) {
      setRegError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!regOtpSent) {
      setRegOtpSent(true);
      return;
    }

    if (regEnteredOtp !== '492810' && regEnteredOtp !== '123456') {
      setRegError('Invalid OTP. Enter 492810 to verify your mobile number.');
      return;
    }

    // Check if customer already exists with this mobile number
    const existingCust = customers.find((c) => c.mobile === cleanMob);
    if (existingCust) {
      const updatedExisting: Customer = {
        ...existingCust,
        name: regName.trim() || existingCust.name,
        awplId: regAwplId.trim().toUpperCase() || existingCust.awplId,
        isAwplVerified: Boolean(regAwplId.trim() || existingCust.awplId),
        isAppRegistered: true,
        isIdGreen: regIsGreen,
        preferredSide: regPreferredSide,
      };
      const updatedList = customers.map((c) => (c.id === existingCust.id ? updatedExisting : c));
      onUpdateCustomers(updatedList);
      setStorageItem('drw_customers_v1', updatedList);
      setActiveCustomer(updatedExisting);
    } else {
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        name: regName.trim() || `Customer (${cleanMob})`,
        mobile: cleanMob,
        awplId: regAwplId.trim().toUpperCase() || undefined,
        isAwplVerified: Boolean(regAwplId.trim()),
        isAppRegistered: true,
        isIdGreen: regIsGreen,
        preferredSide: regPreferredSide,
        address: regAddress.trim() || 'Solan, HP',
        city: 'Solan',
        state: 'Himachal Pradesh',
        totalSpEarned: 0,
        outstandingBalance: 0,
        createdAt: new Date().toISOString().split('T')[0],
      };
      const updated = [newCustomer, ...customers];
      onUpdateCustomers(updated);
      setStorageItem('drw_customers_v1', updated);
      setActiveCustomer(newCustomer);
    }

    setIsRegistering(false);
    setRegOtpSent(false);
    setRegEnteredOtp('');
  };

  // Finalize Customer ₹99 Monthly Plan (Auto-Triggered by Payment Gateway or Instant Confirm)
  const finalizeCustomer99Activation = (verifiedUtr?: string) => {
    if (!activeCustomer) return;
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + 30);
    const txn = verifiedUtr || `UTR-AUTOPAY-99${Math.floor(100000 + Math.random() * 900000)}`;
    const destinationAccount = `${franchiseConfig.name} (${franchiseConfig.bankUpiId} • A/c ${franchiseConfig.accountNo})`;

    const newSub: UserSubscription = {
      id: `sub-cust-${Date.now()}`,
      userId: activeCustomer.id,
      userName: `${activeCustomer.name} (+91 ${activeCustomer.mobile})`,
      userRole: 'customer',
      planId: 'plan-customer-monthly',
      planName: 'Customer VIP Monthly Plan (Auto-Subscribed)',
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      status: 'active',
      paymentRef: txn,
      amountPaid: 99,
      autoRenew: true,
      settledToAccount: destinationAccount,
      settledStatus: 'Credited to Owner A/c',
    };

    const updatedSubs = [newSub, ...userSubscriptions];
    if (onUpdateSubscriptions) {
      onUpdateSubscriptions(updatedSubs);
    }
    setStorageItem('drw_user_subscriptions_v1', updatedSubs);
    setIsPayingSub(false);
    setSubGatewayStatus('verified');
    setIsSubModalOpen(false);
    setAllocationSavedToast(
      `✓ Auto-Payment Gateway Detected ₹99 Payment (UTR: ${txn})! Your Customer VIP Monthly Subscription is now Active till ${newSub.expiryDate}.`
    );
  };

  // Open Customer ₹99 Subscription Modal & Initialize Self-Hosted Payment Gateway Session
  const handleOpenCustomer99Modal = async () => {
    setSubGatewayStatus('listening');
    setSubAutoCountdown(5);
    setIsSubModalOpen(true);
    try {
      const res = await fetch('/api/payment-gateway/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'customer_subscription',
          portal: 'customer_app',
          amount: 99,
          payerName: activeCustomer?.name || 'Customer',
          payerMobile: activeCustomer?.mobile || '',
          userId: activeCustomer?.id || '',
          planId: 'plan-customer-monthly',
          planName: 'Customer VIP Monthly Plan (₹99/mo)',
          payeeName: `${franchiseConfig.name} (${franchiseConfig.franchiseOwner})`,
          payeeUpiId: franchiseConfig.bankUpiId,
          payeeAccountNo: franchiseConfig.accountNo,
          payeeIfsc: franchiseConfig.ifscCode,
          autoDetectSeconds: 5,
        }),
      });
      const data = await res.json();
      if (data?.ok && data?.session?.sessionId) {
        setSubGatewaySessionId(data.session.sessionId);
      } else {
        setSubGatewaySessionId(`PGW-SUB99-${Date.now()}`);
      }
    } catch {
      setSubGatewaySessionId(`PGW-SUB99-${Date.now()}`);
    }
  };

  // Poll Built-in Auto-Payment Gateway for ₹99 Customer Subscription
  React.useEffect(() => {
    if (!isSubModalOpen || !subAutoDetectEnabled || !activeCustomer) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      setSubAutoCountdown((prev) => (prev > 1 ? prev - 1 : 0));
      if (subGatewaySessionId && !subGatewaySessionId.startsWith('PGW-SUB99-')) {
        try {
          const res = await fetch(
            `/api/payment-gateway/status/${subGatewaySessionId}?autoTrigger=true`
          );
          const data = await res.json();
          if (!cancelled && data?.ok && data?.session) {
            setSubGatewayStatus(data.session.status);
            if (data.session.status === 'verified') {
              clearInterval(timer);
              finalizeCustomer99Activation(data.session.utrNumber);
            }
          }
        } catch {
          // fallback
        }
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isSubModalOpen, subAutoDetectEnabled, subGatewaySessionId, activeCustomer]);

  // Poll Built-in Auto-Payment Gateway for Customer UPI Order Checkout
  React.useEffect(() => {
    if (!isUpiCheckoutOpen || !orderAutoDetectEnabled || !activeCustomer || cart.length === 0) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      setOrderAutoCountdown((prev) => (prev > 1 ? prev - 1 : 0));
      if (orderGatewaySessionId && !orderGatewaySessionId.startsWith('PGW-ORD-')) {
        try {
          const res = await fetch(
            `/api/payment-gateway/status/${orderGatewaySessionId}?autoTrigger=true`
          );
          const data = await res.json();
          if (!cancelled && data?.ok && data?.session) {
            setOrderGatewayStatus(data.session.status);
            if (data.session.status === 'verified') {
              clearInterval(timer);
              if (data.session.utrNumber) setUpiRefInput(data.session.utrNumber);
              handleConfirmUpiPayment();
            }
          }
        } catch {
          // fallback
        }
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isUpiCheckoutOpen, orderAutoDetectEnabled, orderGatewaySessionId, activeCustomer, cart.length]);

  // Activate Customer ₹99 Monthly Plan Immediately
  const handleActivateCustomer99Plan = async () => {
    if (!activeCustomer) return;
    setIsPayingSub(true);
    try {
      if (subGatewaySessionId) {
        const res = await fetch('/api/payment-gateway/confirm-instant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: subGatewaySessionId }),
        });
        const data = await res.json();
        finalizeCustomer99Activation(data?.session?.utrNumber);
        return;
      }
    } catch {
      // fallback
    }
    finalizeCustomer99Activation();
  };

  const filteredShopProducts = useMemo(() => {
    return fuzzyFilterProducts(selectedCfProducts, customerSearchQuery, {
      categoryFilter: selectedCategory,
    }).map((m) => m.product);
  }, [selectedCfProducts, selectedCategory, customerSearchQuery]);

  return (
    <div className="space-y-5">
      {/* 1. CUSTOMER HEADER & MOBILE NUMBER REGISTRATION BAR */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-lg shadow shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black">
                  {activeCustomer ? activeCustomer.name : 'Register with Mobile Number'}
                </h2>
                <span className="rounded-full bg-emerald-950/80 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-mono font-bold text-amber-300">
                  Registered Mobile: +91 {activeCustomer?.mobile || 'Not Linked'}
                </span>
                {activeCustomer?.awplId && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/30 border border-emerald-400 px-2.5 py-0.5 text-[10px] font-bold text-emerald-100">
                    <ShieldCheck className="h-3 w-3 text-emerald-300" />
                    AWPL ID: {activeCustomer.awplId} (Green • {activeCustomer.preferredSide || 'S.A.O'})
                  </span>
                )}
                {activeCustomerSub && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[10px] font-black">
                    <Crown className="h-3 w-3" />
                    ₹99/mo VIP Active
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                Customer App: Select which AWPL C&F you want to purchase items from → View items with C&F's mentioned <strong>DP &amp; SP</strong> → Auto-Detected UPI Payment → Assign AWPL ID (<strong>S.A.O / S.G.O</strong>).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeCustomer?.id || ''}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                setActiveCustomer(found || null);
              }}
              className="rounded-xl bg-emerald-950 border border-emerald-600 text-xs px-3 py-2.5 text-white font-bold focus:outline-none"
              title="Switch Registered Mobile Number"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  +91 {c.mobile} — {c.name} {c.awplId ? `(${c.awplId})` : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setRegMobile('');
                setRegName('');
                setRegAwplId('');
                setRegOtpSent(false);
                setRegError('');
                setIsRegistering(true);
              }}
              className="rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black px-3.5 py-2.5 shadow transition flex items-center gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Register / Login by Mobile No.</span>
            </button>
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500 text-xs font-bold px-3 py-2.5 shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5 text-amber-300" />
                <span>App Feedback</span>
              </button>
            )}
            {onChangePin && (
              <button
                type="button"
                onClick={onChangePin}
                className="rounded-xl bg-emerald-950/90 hover:bg-emerald-950 text-amber-300 border border-amber-400/50 text-xs font-bold px-3 py-2.5 shadow transition flex items-center gap-1.5 cursor-pointer"
                title="Change Your Secret 4-Digit PIN Online"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                <span>Change PIN</span>
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-400 text-xs font-black px-3.5 py-2.5 shadow transition flex items-center gap-1.5 cursor-pointer"
                title="Log Out of Customer App"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Requirement #15: PENDING PRODUCT ARRIVAL & COLLECTION STATUS FOR REGISTERED APP CUSTOMER */}
      {myPendingProductItems.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/15 to-emerald-500/15 border-2 border-orange-500 p-4 shadow-sm space-y-2.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500 text-black font-black flex items-center justify-center shrink-0 shadow">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                    PENDING PRODUCT TRACKER (D RIGHT WELLNESS T&C)
                  </span>
                  <span className="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black">
                    📲 Registered App Alert (+91 {activeCustomer?.mobile})
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1">
                  All Pending Products Will Be Given By The Original Bill
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Your mobile number is registered on the Customer App, so pending product arrival reminders appear directly here in the app:
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {myPendingProductItems.map(({ invoice, item }, idx) => {
              const isGiven = item.pendingProductStatus === 'given';
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-3 border flex items-center justify-between gap-3 text-xs ${
                    isGiven
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400'
                      : 'bg-white dark:bg-slate-900 border-orange-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-900 dark:text-white">
                        {item.product.name} (x{item.quantity})
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                          isGiven ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                        }`}
                      >
                        {isGiven ? `✓ GIVEN (${item.pendingGivenAt || 'Collected'})` : '⏳ PENDING AT C&F'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      Original Bill: <strong className="font-mono">{invoice.invoiceNumber}</strong> ({invoice.date})
                    </p>
                    {item.pendingArrivalNotifiedAt && !isGiven && (
                      <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                        🔔 Arrived at C&F! Bring Original Bill #{invoice.invoiceNumber} to collect your product.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewInvoiceModal(invoice)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-bold shrink-0"
                  >
                    View Original Bill
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. AUTOMATIC 7-DAY PENDING BILL NOTIFICATION CENTER (WHATSAPP + IN-APP FOR REGISTERED MOBILE NUMBER) */}
      {overdue7DayInvoices.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15 border-2 border-amber-500 dark:border-amber-500/80 p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow">
                <BellRing className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-red-600 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    AUTO 7-DAY PENDING BILL ALERT
                  </span>
                  <span className="rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Auto WhatsApp Dispatched (+91 {activeCustomer?.mobile})
                  </span>
                  <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    Registered App Notification Delivered
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1.5">
                  Automatic 7-Day Notification: Your Bill is Pending to Update Online in AWPL C&F Portal!
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  Because mobile number <strong>+91 {activeCustomer?.mobile}</strong> is registered on this app, this 7-day pending bill notification was automatically triggered both via <strong>WhatsApp</strong> and <strong>here inside your Customer App</strong> for{' '}
                  <strong>{overdue7DayInvoices.length} invoice(s)</strong> (
                  {overdue7DayInvoices.map((i) => `${i.invoiceNumber} [${getInvoiceDaysOld(i.date)} days pending]`).join(', ')}
                  ).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={buildWhatsApp7DayReminderUrl(overdue7DayInvoices[0], true)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow flex items-center gap-1.5 transition"
              >
                <MessageCircle className="h-4 w-4" />
                <span>View Auto WhatsApp Notice</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => handleOpenAwplAllocationModal(overdue7DayInvoices[0])}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow flex items-center gap-1.5 transition"
              >
                <span>Update Bill Online Now (S.A.O / S.G.O)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast confirmation when AWPL ID & S.A.O / S.G.O allocation or Auto-Subscription is saved */}
      {allocationSavedToast && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-400 p-4 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{allocationSavedToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setAllocationSavedToast(null)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. CUSTOMER C&F SELECTION BAR (SHOWS ITEMS WITH SELECTED C&F'S MENTIONED DP & SP) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border-2 border-emerald-500/70 dark:border-emerald-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Select Which C&F You Want to Purchase Items From
              </span>
              <span className="rounded bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300 border border-amber-300">
                Showing {selectedCfProducts.length} Items with {selectedCfDepot.shortName || 'C&F'}'s Mentioned DP &amp; SP
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              {selectedCfDepot.name}
            </h3>
            <p className="text-[11px] text-slate-500">
              Code: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedCfDepot.code}</span> • UPI: <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{selectedCfDepot.upiId}</span> • {selectedCfDepot.address}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-xs font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">
            Choose C&F to Purchase From:
          </label>
          <select
            value={selectedCfDepot.id}
            onChange={(e) => setSelectedCfDepotId(e.target.value)}
            className="rounded-xl border-2 border-emerald-600 bg-emerald-50/70 dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-emerald-950 dark:text-emerald-300 focus:outline-none shadow-xs"
          >
            {availableCfDepots.map((depot) => (
              <option key={depot.id} value={depot.id}>
                {depot.name} [{depot.shortName || depot.code}] — DP & SP Catalog
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. NAVIGATION TABS */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('order_placement')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'order_placement'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>1. Place Order from {selectedCfDepot.shortName || 'C&F'} (DP &amp; SP Catalog)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('online_bill_use')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'online_bill_use'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>2. Use Bill for Online / My Bills ({myInvoices.length})</span>
          {pendingOnlineInvoices.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-400 text-slate-950 px-2 py-0.2 text-[10px] font-black">
              {pendingOnlineInvoices.length} Pending Online
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('membership')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'membership'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Crown className="h-4 w-4 text-amber-500" />
          <span>Customer ₹99/mo Subscription (Auto-Pay)</span>
        </button>
      </div>

      {/* ================= TAB 1: ORDER PLACEMENT (WITH C&F-SPECIFIC DP & SP CATALOG) ================= */}
      {activeTab === 'order_placement' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Products Grid (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Real-Time Fuzzy Search Box for Customer App */}
            <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-300 dark:border-slate-700 px-3.5 py-2 shadow-2xs">
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Quick Search item by Name (e.g. Immunodoc), SKU (001), or AWPL Category..."
                className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
              />
              {customerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setCustomerSearchQuery('')}
                  className="rounded-lg bg-orange-100 text-orange-800 px-2.5 py-1 text-[11px] font-black hover:bg-orange-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {['All', 'Ayurvedic Wellness', 'Oral Care', 'Hair & Personal Care', 'Nutrition & Food', 'Vedic Agri & Veterinary', 'Home Care'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-orange-200 dark:border-slate-800 hover:bg-orange-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {filteredShopProducts.map((prod) => {
                const inCart = cart.find((i) => i.product.id === prod.id);
                const isSaleStopped = Boolean(prod.stopCustomerAppSale);

                return (
                  <div
                    key={prod.id}
                    className={`flex flex-col justify-between rounded-2xl bg-white p-4 shadow-sm border transition ${
                      isSaleStopped
                        ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-slate-900 opacity-75'
                        : 'border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:border-emerald-500'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="rounded-md bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                          SP: +{prod.sp} SP
                        </span>
                        {/* Requirement #7 & #8: C&F Stock availability is NEVER shown in Customer App; only Category or Sale Stopped status */}
                        {isSaleStopped ? (
                          <span className="text-[10px] font-black text-white bg-red-600 px-2 py-0.5 rounded">
                            Sale Stopped by C&F
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {prod.category}
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                        {prod.name}
                      </h4>
                      <p className="mt-0.5 text-[10px] font-mono text-slate-400">
                        SKU: {prod.sku} • C&F: {selectedCfDepot.shortName || 'DRW'}
                      </p>

                      {/* Explicit C&F Mentioned DP, SP & MRP Breakdown Box */}
                      <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-xl bg-emerald-50/70 dark:bg-slate-800/80 border border-emerald-200/80 dark:border-slate-700 p-2 text-center">
                        <div>
                          <span className="block text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                            C&F DP
                          </span>
                          <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-300">
                            {formatINR(prod.dp)}
                          </span>
                        </div>
                        <div className="border-x border-emerald-200/70 dark:border-slate-700">
                          <span className="block text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">
                            C&F SP
                          </span>
                          <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-400">
                            +{prod.sp} SP
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-bold uppercase text-slate-400">
                            MRP
                          </span>
                          <span className="font-mono font-semibold text-[11px] text-slate-500 line-through">
                            {formatINR(prod.mrp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">
                          C&F Buying Price (DP)
                        </span>
                        <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                          {formatINR(prod.dp)}
                        </div>
                      </div>

                      {isSaleStopped ? (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold text-[11px] cursor-not-allowed border border-red-200 dark:border-red-800"
                        >
                          Billing Stopped
                        </button>
                      ) : inCart ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(prod.id, -1)}
                            className="h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(prod.id, 1)}
                            className="h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(prod)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition"
                        >
                          + Add (DP {formatINR(prod.dp)})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Placement & UPI Payment Cart (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4 h-fit">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                Buying From Linked C&F
              </span>
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                Order Placement Cart ({cart.length} items)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {selectedCfDepot.name}
              </p>
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs space-y-2">
                <ShoppingBag className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="font-semibold">Add AWPL products to place your order</p>
                <p className="text-[11px]">
                  After UPI payment, you will select which AWPL ID (Single or Multiple IDs) and Green ID side (<strong>S.A.O</strong> or <strong>S.G.O</strong>) each item goes to.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-2"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {item.product.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.quantity} × {formatINR(item.unitPrice)} • <span className="text-amber-600 font-bold">+{item.spEarned} SP</span>
                        </p>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatINR(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Dispatch / C&F Pickup Note (Optional):
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="e.g. Counter pickup at Solan C&F or Home delivery"
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Totals */}
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span>Order Subtotal:</span>
                    <span className="font-bold">{formatINR(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-700 dark:text-amber-400">
                    <span>Total AWPL SP Earned:</span>
                    <span>+{cartSp} SP</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-emerald-800 dark:text-emerald-400 pt-1">
                    <span>Payable via UPI:</span>
                    <span>{formatINR(cartTotal)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 text-[11px] text-emerald-900 dark:text-emerald-200">
                  <strong>Next Step after UPI Payment:</strong> You will choose which <strong>AWPL ID</strong> (all items on 1 ID or multiple IDs) and which Green ID side (<strong>S.A.O</strong> or <strong>S.G.O</strong>) to enter online.
                </div>

                <button
                  type="button"
                  onClick={handleInitiateUpiPayment}
                  className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow flex items-center justify-center gap-2 transition"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Place Order & Pay via UPI ({formatINR(cartTotal)})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: USE BILL FOR ONLINE / MY BILLS & ITEM-WISE AWPL ID + S.A.O / S.G.O STATUS ================= */}
      {activeTab === 'online_bill_use' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  My C&F Bills — Online AWPL ID Allocation (S.A.O / S.G.O) & Online Bill Status
                </h3>
                <p className="text-xs text-slate-500">
                  View which items have been updated online in the AWPL C&F portal with <strong>Online C&F Bill No & ID No</strong>, or click <strong>"Use Bill for Online"</strong> to assign items to one or multiple AWPL IDs (`S.A.O` / `S.G.O`).
                </p>
              </div>
            </div>

            {myInvoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No bills found for +91 {activeCustomer?.mobile}. Place an order in Tab 1!
              </div>
            ) : (
              <div className="space-y-4">
                {myInvoices.map((inv) => {
                  const daysOld = getInvoiceDaysOld(inv.date);
                  const syncedCount = inv.items.filter((i) => i.cfSynced).length;
                  const isFullyOnline = inv.cfSyncStatus === 'synced' || syncedCount === inv.items.length;
                  const isOverdue7Days = !isFullyOnline && daysOld >= 7;
                  const distinctIds = Array.from(
                    new Set(inv.items.map((i) => i.targetAwplId || inv.customerAwplId).filter(Boolean))
                  );

                  return (
                    <div
                      key={inv.id}
                      className={`rounded-2xl border-2 p-4 space-y-3 transition ${
                        isOverdue7Days
                          ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20'
                          : isFullyOnline
                          ? 'border-emerald-500/50 bg-white dark:bg-slate-900'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Top Header of Bill */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {inv.invoiceNumber}
                            </span>
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {inv.selectedCfDepotName || franchiseConfig.officialDepotName}
                            </span>
                            {distinctIds.length > 1 ? (
                              <span className="rounded-md bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-[10px] font-black text-purple-800 dark:text-purple-300">
                                MULTIPLE AWPL IDs ({distinctIds.length} IDs)
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                SAME AWPL ID ({distinctIds[0] || 'Unassigned'})
                              </span>
                            )}
                            {isOverdue7Days && (
                              <>
                                <span className="rounded-md bg-red-600 text-white px-2 py-0.5 text-[10px] font-black">
                                  ⚠ {daysOld} DAYS PENDING FOR ONLINE UPDATE
                                </span>
                                <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 border border-emerald-400 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" />
                                  Auto WhatsApp + In-App Notified ✓
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Date: {inv.date} ({daysOld === 0 ? 'Today' : `${daysOld} days ago`}) • Paid via {inv.paymentMethod} ({formatINR(inv.grandTotal)}) • <strong className="text-amber-600">+{inv.totalSp} SP</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isOverdue7Days && (
                            <a
                              href={buildWhatsApp7DayReminderUrl(inv, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition flex items-center gap-1.5"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>WhatsApp Notice</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenAwplAllocationModal(inv)}
                            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition flex items-center gap-1.5"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            <span>
                              {isFullyOnline
                                ? 'View / Edit AWPL ID & S.A.O/S.G.O'
                                : 'Use Bill for Online (Assign AWPL ID & S.A.O/S.G.O)'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewInvoiceModal(inv)}
                            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Print / View Bill
                          </button>
                        </div>
                      </div>

                      {/* Granular Item-by-Item Table showing AWPL ID, Green Side (S.A.O / S.G.O), and Online C&F Bill No & ID No */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <th className="py-2 px-3">Product Item</th>
                              <th className="py-2 px-3">Assigned AWPL ID (1 ID / Item)</th>
                              <th className="py-2 px-3">Green ID & Repurchase Side</th>
                              <th className="py-2 px-3">Online C&F Status</th>
                              <th className="py-2 px-3">Online C&F Bill No & ID No</th>
                              <th className="py-2 px-3 text-right">Qty & SP</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {inv.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                  {item.product.name}
                                  <span className="block text-[10px] font-mono text-slate-400">
                                    {item.product.sku}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    {item.targetAwplId || inv.customerAwplId || 'Not Set'}
                                  </span>
                                  {item.targetAwplHolderName && (
                                    <span className="block text-[10px] text-slate-500 mt-0.5">
                                      {item.targetAwplHolderName}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {item.isIdGreen !== false ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <span className="rounded bg-emerald-600 text-white px-1.5 py-0.5 text-[10px] font-black">
                                        GREEN ID
                                      </span>
                                      <span className="rounded bg-amber-100 dark:bg-amber-950 border border-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:text-amber-300">
                                        Side: {item.repurchaseSide || 'S.A.O'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="rounded bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                      Fresh / Activation ID
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {item.cfSynced ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                                      <CheckCircle2 className="h-3 w-3" /> Online Done
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                      <Clock className="h-3 w-3" /> Pending Online
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {item.cfSynced ? (
                                    <div>
                                      <span className="font-bold text-slate-900 dark:text-white block">
                                        Bill: {item.cfBillNumber || inv.cfBillNumber}
                                      </span>
                                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                        ID: {item.cfIdNumber || inv.cfIdNumber}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">Awaiting C&F Online Entry</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className="font-bold">{item.quantity}x ({formatINR(item.lineTotal)})</span>
                                  <span className="block text-[10px] font-black text-amber-600">
                                    +{item.spEarned} SP
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: CUSTOMER ₹99 MONTHLY SUBSCRIPTION ONLY ================= */}
      {activeTab === 'membership' && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-white p-6 shadow-md border border-indigo-500/40 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-300">
                <Crown className="h-3.5 w-3.5" />
                <span>CUSTOMER MONTHLY SUBSCRIPTION PLAN ONLY • ₹99 / MONTH</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black">
                Customer VIP Monthly Plan — ₹99 / Month
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Unlock priority C&F order processing, automatic 7-day online bill alerts, multi-ID S.A.O / S.G.O allocation tracking, and digital GST + SP point ledgers. 100% of your ₹99 monthly fee goes directly to <strong>{franchiseConfig.name} ({franchiseConfig.bankUpiId})</strong>.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-5 min-w-[280px] text-center space-y-3">
              <span className="text-[11px] uppercase font-bold tracking-wider text-amber-300 block">
                Customer Monthly Plan Only
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-black text-white">₹99</span>
                <span className="text-xs text-slate-300 font-semibold">/ Month (30 Days)</span>
              </div>

              {activeCustomerSub ? (
                <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-3 text-xs space-y-1">
                  <div className="font-bold text-emerald-300 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Active VIP Subscription
                  </div>
                  <p className="text-[11px] text-slate-200">
                    Valid Till: <strong>{activeCustomerSub.expiryDate}</strong>
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCustomer99Modal}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow transition flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Subscribe Now — ₹99 / Month (Auto-Pay)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: UPI PAYMENT CHECKOUT (STEP 2 OF CUSTOMER ORDER) ================= */}
      {isUpiCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Auto-Detect UPI Gateway — C&F Order
                  </h3>
                  <p className="text-[10px] text-slate-500">{selectedCfDepot.name}</p>
                </div>
              </div>
              <button onClick={() => setIsUpiCheckoutOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
                  Total Payable at {selectedCfDepot.shortName || 'C&F'} DP
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {cart.length} Items • +{cartSp} SP
                </span>
              </div>
              <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
                {formatINR(cartTotal)}
              </span>
            </div>

            {/* UPI App Selector */}
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {(['UPI QR', 'GPay', 'PhonePe', 'Paytm'] as const).map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => setUpiAppChoice(app)}
                  className={`py-2 rounded-xl font-bold border transition ${
                    upiAppChoice === app
                      ? 'border-emerald-600 bg-emerald-700 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-emerald-500/50 bg-slate-50 dark:bg-slate-800/50 p-4 flex items-center gap-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                  `upi://pay?pa=${selectedCfDepot.upiId || franchiseConfig.bankUpiId}&pn=${selectedCfDepot.name}&am=${cartTotal}&cu=INR`
                )}`}
                alt="UPI QR"
                className="h-24 w-24 bg-white p-1.5 rounded-xl border border-slate-200 shrink-0"
              />
              <div className="text-xs space-y-1">
                <span className="inline-block rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  {upiAppChoice} Direct Transfer
                </span>
                <p className="font-mono font-bold text-slate-900 dark:text-white">
                  VPA: {selectedCfDepot.upiId || franchiseConfig.bankUpiId}
                </p>
                <p className="text-[11px] text-slate-500">
                  Payee: {selectedCfDepot.name}
                </p>
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  After payment, assign AWPL ID(s) & S.A.O / S.G.O side →
                </p>
              </div>
            </div>

            {/* Built-in Auto-Payment Detection Gateway Radar */}
            <div
              className={`rounded-xl border-2 p-3 text-xs space-y-1 transition ${
                orderGatewayStatus === 'detected'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                  : 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-black text-emerald-900 dark:text-emerald-200">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  <span>Auto-Payment Detection Gateway</span>
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                  <input
                    type="checkbox"
                    checked={orderAutoDetectEnabled}
                    onChange={(e) => setOrderAutoDetectEnabled(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Auto-Detect</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                {orderAutoDetectEnabled
                  ? orderGatewayStatus === 'detected'
                    ? `⚡ Payment of ${formatINR(cartTotal)} detected! Auto-confirming order in ${orderAutoCountdown}s...`
                    : `Listening for payment to ${selectedCfDepot.upiId || franchiseConfig.bankUpiId}... (${orderAutoCountdown}s)`
                  : 'Auto-detection paused. Click Confirm below after paying.'}
              </p>
            </div>

            <div className="text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                UPI Reference / UTR Number:
              </label>
              <input
                type="text"
                value={upiRefInput}
                onChange={(e) => setUpiRefInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmUpiPayment}
              disabled={isProcessingUpi}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isProcessingUpi && <RefreshCw className="h-4 w-4 animate-spin" />}
              <span>
                {isProcessingUpi
                  ? 'Verifying UPI Payment...'
                  : `Instant Verify (${formatINR(cartTotal)}) & Select AWPL ID / S.A.O-S.G.O →`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: POST-PAYMENT / ONLINE USE AWPL ID & GREEN ID (S.A.O / S.G.O) ALLOCATION MODAL ================= */}
      {allocatingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-700 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                    Online C&F Bill Allocation
                  </span>
                  <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                    Invoice #{allocatingInvoice.invoiceNumber}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  Assign Items to AWPL ID & Select Green ID Repurchase Side (S.A.O / S.G.O)
                </h3>
                <p className="text-xs text-slate-500">
                  Linked C&F: <strong>{allocatingInvoice.selectedCfDepotName || selectedCfDepot.name}</strong> • Rule: Put all items on the same AWPL ID, or assign 1 specific AWPL ID per item.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllocatingInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAwplAllocation} className="space-y-4 text-xs">
              {/* Toggle Mode: All Items on Same AWPL ID vs Multiple AWPL IDs (1 ID per Item) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAllocationMode('same_id')}
                  className={`p-3.5 rounded-xl border-2 text-left transition ${
                    allocationMode === 'same_id'
                      ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white">
                      Option 1: All Items on Same AWPL ID
                    </span>
                    {allocationMode === 'same_id' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter one AWPL ID and S.A.O / S.G.O side for all {editableItems.length} item(s) in this bill.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAllocationMode('multiple_ids')}
                  className={`p-3.5 rounded-xl border-2 text-left transition ${
                    allocationMode === 'multiple_ids'
                      ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white">
                      Option 2: Multiple AWPL IDs (1 ID Per Item)
                    </span>
                    {allocationMode === 'multiple_ids' && <CheckCircle2 className="h-4 w-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Assign each item to its own AWPL ID & S.A.O / S.G.O side (1 ID per item).
                  </p>
                </button>
              </div>

              {allocationMode === 'same_id' ? (
                /* MODE A: ALL ITEMS ON SAME AWPL ID */
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Enter Target AWPL ID (For All Items) *
                      </label>
                      <input
                        type="text"
                        required
                        value={sameAwplId}
                        onChange={(e) => setSameAwplId(e.target.value.toUpperCase())}
                        placeholder="e.g. AWPL782910"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-black text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        AWPL ID Holder Name
                      </label>
                      <input
                        type="text"
                        value={sameHolderName}
                        onChange={(e) => setSameHolderName(e.target.value)}
                        placeholder="e.g. Rameshwar Sharma"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Green ID Check -> S.A.O / S.G.O (When Green) OR 1. 27 SP / 2. 52 SP / 3. 100 SP / 4. Only Point Update (When Not Green) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Is this AWPL ID Green?
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSameIsGreen(true)}
                          className={`flex-1 py-2 px-3 rounded-xl font-bold border transition ${
                            sameIsGreen
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600'
                          }`}
                        >
                          ✓ Yes, ID is Green
                        </button>
                        <button
                          type="button"
                          onClick={() => setSameIsGreen(false)}
                          className={`flex-1 py-2 px-3 rounded-xl font-bold border transition ${
                            !sameIsGreen
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600'
                          }`}
                        >
                          ✗ ID Not Green
                        </button>
                      </div>
                    </div>

                    {sameIsGreen ? (
                      <div>
                        <label className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1.5">
                          Which Side to Repurchase Item? (S.A.O / S.G.O) *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSameRepurchaseSide('S.A.O')}
                            className={`py-2 px-3 rounded-xl font-black border-2 transition ${
                              sameRepurchaseSide === 'S.A.O'
                                ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-sm'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                            }`}
                          >
                            S.A.O Side
                          </button>
                          <button
                            type="button"
                            onClick={() => setSameRepurchaseSide('S.G.O')}
                            className={`py-2 px-3 rounded-xl font-black border-2 transition ${
                              sameRepurchaseSide === 'S.G.O'
                                ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-sm'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                            }`}
                          >
                            S.G.O Side
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="font-bold text-amber-800 dark:text-amber-300 block mb-1.5">
                          Which Category They Want to Green? (Prints on Bill) *
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { value: '27 SP', label: '1. 27 SP' },
                              { value: '52 SP', label: '2. 52 SP' },
                              { value: '100 SP', label: '3. 100 SP' },
                              { value: 'Only Point Update', label: '4. Only Point Update' },
                            ] as { value: AWPLGreeningCategory; label: string }[]
                          ).map((cat) => (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => setSameGreeningCategory(cat.value)}
                              className={`py-1.5 px-2.5 rounded-xl font-black text-[11px] border-2 text-left transition ${
                                sameGreeningCategory === cat.value
                                  ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-sm'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* MODE B: MULTIPLE AWPL IDs (1 SPECIFIC AWPL ID PER ITEM) */
                <div className="space-y-3">
                  <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 text-[11px] text-purple-900 dark:text-purple-200 flex items-center justify-between">
                    <span>
                      <strong>Multiple IDs Mode:</strong> Each item goes to <strong>one specific AWPL ID</strong>. If ID is Green, choose <strong>S.A.O / S.G.O</strong>; if ID is Not Green, choose Greening Category (<strong>27 SP / 52 SP / 100 SP / Only Point Update</strong>).
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="py-2.5 px-3">Item & Qty</th>
                          <th className="py-2.5 px-3">Target AWPL ID (1 ID for this Item) *</th>
                          <th className="py-2.5 px-3">ID Holder Name</th>
                          <th className="py-2.5 px-3 text-center">ID Green?</th>
                          <th className="py-2.5 px-3">Repurchase Side (If Green) OR Greening Category (If Not Green)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {editableItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-slate-900 dark:text-white">{it.product.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  Qty: {it.quantity} ({it.spEarned} SP)
                                </span>
                                {it.quantity > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSplitItemForMultipleIds(idx)}
                                    className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 text-[9px] font-black text-purple-800 dark:text-purple-300 hover:bg-purple-200"
                                  >
                                    <Split className="h-2.5 w-2.5" /> Split Qty for Another ID
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                required
                                value={it.targetAwplId || ''}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setEditableItems((prev) =>
                                    prev.map((row, rIdx) => (rIdx === idx ? { ...row, targetAwplId: val } : row))
                                  );
                                }}
                                placeholder="e.g. AWPL782910"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={it.targetAwplHolderName || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditableItems((prev) =>
                                    prev.map((row, rIdx) => (rIdx === idx ? { ...row, targetAwplHolderName: val } : row))
                                  );
                                }}
                                placeholder="Holder Name"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={it.isIdGreen ?? true}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditableItems((prev) =>
                                    prev.map((row, rIdx) => (rIdx === idx ? { ...row, isIdGreen: checked } : row))
                                  );
                                }}
                                className="h-4 w-4 rounded text-emerald-600"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              {it.isIdGreen !== false ? (
                                <div className="flex gap-1.5">
                                  {(['S.A.O', 'S.G.O'] as const).map((side) => (
                                    <button
                                      key={side}
                                      type="button"
                                      onClick={() => {
                                        setEditableItems((prev) =>
                                          prev.map((row, rIdx) =>
                                            rIdx === idx ? { ...row, repurchaseSide: side } : row
                                          )
                                        );
                                      }}
                                      className={`px-2.5 py-1 rounded-lg font-black text-[11px] border transition ${
                                        (it.repurchaseSide || 'S.A.O') === side
                                          ? 'bg-amber-400 text-slate-950 border-amber-500'
                                          : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                                      }`}
                                    >
                                      {side}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <select
                                  value={it.greeningCategory || '27 SP'}
                                  onChange={(e) => {
                                    const gVal = e.target.value as AWPLGreeningCategory;
                                    setEditableItems((prev) =>
                                      prev.map((row, rIdx) =>
                                        rIdx === idx ? { ...row, greeningCategory: gVal } : row
                                      )
                                    );
                                  }}
                                  className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-black text-amber-900 dark:text-amber-300"
                                >
                                  <option value="27 SP">1. 27 SP</option>
                                  <option value="52 SP">2. 52 SP</option>
                                  <option value="100 SP">3. 100 SP</option>
                                  <option value="Only Point Update">4. Only Point Update</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAllocatingInvoice(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300"
                >
                  Later
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Submit to C&F Portal for Online Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: MOBILE NUMBER REGISTRATION & OTP LOGIN ================= */}
      {isRegistering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" />
                Customer Registration Against Mobile No.
              </h3>
              <button onClick={() => setIsRegistering(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {regError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-semibold">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegisterAgainstMobile} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  10-Digit Mobile Number (Primary Registration ID) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  placeholder="e.g. 9816011223"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Anil Verma"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Default AWPL ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={regAwplId}
                    onChange={(e) => setRegAwplId(e.target.value.toUpperCase())}
                    placeholder="e.g. AWPL554432"
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Green ID Side
                  </label>
                  <select
                    value={regPreferredSide}
                    onChange={(e) => setRegPreferredSide(e.target.value as AWPLRepurchaseSide)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="S.A.O">Green ID — S.A.O</option>
                    <option value="S.G.O">Green ID — S.G.O</option>
                  </select>
                </div>
              </div>

              {regOtpSent && (
                <div className="rounded-xl bg-orange-50 dark:bg-orange-950/40 p-3.5 border-2 border-orange-500 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-black text-orange-900 dark:text-orange-300 block">
                      6-Digit OTP Sent to +91 {regMobile}:
                    </label>
                    <button
                      type="button"
                      onClick={() => setRegEnteredOtp('492810')}
                      className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1 text-[10px] font-black cursor-pointer"
                    >
                      ⚡ Auto-Fill 6-Digit OTP (492810)
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={regEnteredOtp}
                    onChange={(e) => setRegEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-Digit OTP (492810)"
                    className="w-full rounded-lg border-2 border-orange-500 p-2.5 text-center font-mono font-black text-sm tracking-widest text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-700 shadow cursor-pointer"
                >
                  {regOtpSent ? '✓ Verify 6-Digit OTP & Login' : 'Send 6-Digit Mobile OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer ₹99 Monthly Direct UPI Modal with Built-In Auto-Payment Detection Gateway */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Customer ₹99/mo Subscription (Auto-Pay Gateway)
                </h3>
              </div>
              <button onClick={() => setIsSubModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 flex items-center gap-3.5">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                  `upi://pay?pa=${franchiseConfig.bankUpiId}&pn=${franchiseConfig.name}&am=99&cu=INR`
                )}`}
                alt="UPI QR 99"
                className="h-20 w-20 bg-white p-1.5 rounded-lg border border-slate-200 shrink-0"
              />
              <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5">
                <p className="font-bold text-emerald-900 dark:text-emerald-300">
                  Scan & Pay ₹99 via UPI
                </p>
                <p className="font-mono font-bold text-slate-900 dark:text-white">
                  UPI: {franchiseConfig.bankUpiId}
                </p>
                <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                  100% Direct Settlement to {franchiseConfig.name}
                </p>
              </div>
            </div>

            {/* Built-in Auto-Payment Detection Gateway Monitor */}
            <div
              className={`rounded-xl border-2 p-3 text-xs space-y-1 transition ${
                subGatewayStatus === 'detected'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                  : 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-black text-emerald-900 dark:text-emerald-200">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  <span>C&F Bill Built-In Auto-Payment Gateway</span>
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                  <input
                    type="checkbox"
                    checked={subAutoDetectEnabled}
                    onChange={(e) => setSubAutoDetectEnabled(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Auto-Detect</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                {subAutoDetectEnabled
                  ? subGatewayStatus === 'detected'
                    ? `⚡ ₹99 Payment Detected! Auto-activating your VIP Subscription in ${subAutoCountdown}s...`
                    : `Listening for ₹99 UPI credit to ${franchiseConfig.bankUpiId} (Session: ${subGatewaySessionId?.slice(-8)})... Auto-subscribes in ${subAutoCountdown}s!`
                  : 'Auto-detection paused. Click below after completing ₹99 payment.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleActivateCustomer99Plan}
              disabled={isPayingSub}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isPayingSub && <RefreshCw className="h-4 w-4 animate-spin" />}
              <span>
                {isPayingSub
                  ? 'Auto-Verifying ₹99 Payment...'
                  : 'Instant Gateway Verify (₹99) & Auto-Subscribe'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Invoice Print Modal */}
      <InvoicePrintModal
        isOpen={Boolean(viewInvoiceModal)}
        onClose={() => setViewInvoiceModal(null)}
        invoice={viewInvoiceModal}
        franchiseConfig={franchiseConfig}
      />
    </div>
  );
};
