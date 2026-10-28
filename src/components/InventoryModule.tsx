import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  FileSpreadsheet,
  Edit3,
  Ban,
  CheckCircle2,
  Sparkles,
  Plus,
  Layers,
  Infinity as InfinityIcon,
  FileText,
  Truck,
  Trash2
} from 'lucide-react';
import {
  AWPLProduct,
  InventoryMovement,
  AuditLog,
  Role,
  ProductCategory,
  FranchiseConfig,
  PurchaseBill
} from '../types';
import { exportToCSV, formatINR, setStorageItem, saveToCloudBackup } from '../utils/storage';

interface InventoryModuleProps {
  products: AWPLProduct[];
  movements: InventoryMovement[];
  franchiseConfig?: FranchiseConfig;
  purchaseBills?: PurchaseBill[];
  currentUserRole: Role;
  currentUserName: string;
  onUpdateProducts: (products: AWPLProduct[]) => void;
  onUpdateMovements: (movements: InventoryMovement[]) => void;
  onUpdatePurchaseBills?: (bills: PurchaseBill[]) => void;
  onUpdateConfig?: (config: FranchiseConfig) => void;
  onAddAuditLog: (log: AuditLog) => void;
}

const WEBSITE_CATEGORIES: (ProductCategory | 'All')[] = [
  'All',
  'Ayurvedic Wellness',
  'Oral Care',
  'Hair & Personal Care',
  'Nutrition & Food',
  'Vedic Agri & Veterinary',
  'Home Care',
];

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  movements,
  franchiseConfig,
  purchaseBills = [],
  currentUserRole,
  currentUserName,
  onUpdateProducts,
  onUpdateMovements,
  onUpdatePurchaseBills,
  onUpdateConfig,
  onAddAuditLog,
}) => {
  const isCFUser = currentUserRole !== 'customer';
  const isDrightPermanentInfinity = Boolean(
    franchiseConfig?.isDrightWellness || franchiseConfig?.infinityStockPermanent
  );
  const isInfinityActive = isDrightPermanentInfinity || franchiseConfig?.infinityStockEnabled !== false;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [customerAppFilter, setCustomerAppFilter] = useState<'all' | 'allowed' | 'stopped'>('all');

  // Purchase Bill Entry Modal (Requirement #6: Stock Inventory with Purchase Bill for Other C&Fs)
  const [isPurchaseBillModalOpen, setIsPurchaseBillModalOpen] = useState(false);
  const [pbNumber, setPbNumber] = useState('');
  const [pbSupplier, setPbSupplier] = useState('Asclepius Wellness Pvt. Ltd. — Regional Hub');
  const [pbProductId, setPbProductId] = useState<string>(products[0]?.id || '');
  const [pbQty, setPbQty] = useState<number>(50);
  const [pbRate, setPbRate] = useState<number>(products[0]?.dp || 500);
  const [pbPaymentMode, setPbPaymentMode] = useState<'Bank Transfer / NEFT / RTGS' | 'UPI' | 'Cheque' | 'Cash'>('Bank Transfer / NEFT / RTGS');
  const [pbNotes, setPbNotes] = useState('');

  // Batch & C&F Dispatch Log Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AWPLProduct | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<InventoryMovement['type']>('Stock In (C&F)');
  const [adjustmentQty, setAdjustmentQty] = useState<number>(10);
  const [adjustmentBatch, setAdjustmentBatch] = useState<string>('');
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>('');

  // C&F-Only Edit Item & Rates (Name, SKU, Category, MRP, DP, SP, Batch, Stock) Modal
  const [editingRatesProduct, setEditingRatesProduct] = useState<AWPLProduct | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editSku, setEditSku] = useState<string>('');
  const [editMrp, setEditMrp] = useState<number>(0);
  const [editDp, setEditDp] = useState<number>(0);
  const [editSp, setEditSp] = useState<number>(0);
  const [editCategory, setEditCategory] = useState<ProductCategory>('Ayurvedic Wellness');
  const [editBatch, setEditBatch] = useState<string>('');
  const [editExpiry, setEditExpiry] = useState<string>('');
  const [editStock, setEditStock] = useState<number>(999999);
  const [editStopCustomerBill, setEditStopCustomerBill] = useState<boolean>(false);

  // Requirement #1: Remove / Delete Item from Item Stock Modal
  const [deletingProduct, setDeletingProduct] = useState<AWPLProduct | null>(null);

  // Add New Product in Item Inventory (C&F Only)
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newCategory, setNewCategory] = useState<ProductCategory>('Ayurvedic Wellness');
  const [newMrp, setNewMrp] = useState<number>(0);
  const [newDp, setNewDp] = useState<number>(0);
  const [newSp, setNewSp] = useState<number>(0);
  const [newGst, setNewGst] = useState<number>(12);

  // Calculations: Catalog DP Sum, MRP Sum, SP Sum, Stopped Items count
  const { totalCatalogDP, totalCatalogMRP, totalCatalogSP, stoppedCustomerCount } = useMemo(() => {
    let dpVal = 0;
    let mrpVal = 0;
    let spVal = 0;
    let stopped = 0;

    products.forEach((p) => {
      dpVal += p.dp;
      mrpVal += p.mrp;
      spVal += p.sp;
      if (p.stopCustomerAppSale) stopped += 1;
    });

    return {
      totalCatalogDP: dpVal,
      totalCatalogMRP: mrpVal,
      totalCatalogSP: spVal,
      stoppedCustomerCount: stopped,
    };
  }, [products]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { All: products.length };
    WEBSITE_CATEGORIES.forEach((c) => {
      if (c !== 'All') {
        map[c] = products.filter((p) => p.category === c).length;
      }
    });
    return map;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchAppStatus =
        customerAppFilter === 'all' ||
        (customerAppFilter === 'stopped' ? Boolean(p.stopCustomerAppSale) : !p.stopCustomerAppSale);
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase()) ||
        p.batchNumber.toLowerCase().includes(search.toLowerCase());

      return matchCat && matchAppStatus && matchSearch;
    });
  }, [products, selectedCategory, customerAppFilter, search]);

  // Toggle "Stop Bill for Customer App" directly from table (C&F Only)
  const handleToggleStopCustomerBill = (product: AWPLProduct) => {
    if (!isCFUser) return;
    const nextState = !product.stopCustomerAppSale;
    const updated = products.map((p) =>
      p.id === product.id
        ? {
            ...p,
            stopCustomerAppSale: nextState,
            lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
          }
        : p
    );
    onUpdateProducts(updated);
    setStorageItem('drw_products_v1', updated);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `${nextState ? 'Stopped Bill in Customer App' : 'Allowed Bill in Customer App'}: ${product.name}`,
      category: 'Inventory',
      user: `${currentUserName} (${currentUserRole})`,
      details: `SKU ${product.sku} Customer App Billing set to ${nextState ? 'STOPPED' : 'ALLOWED'}.`,
    });
  };

  // Open Edit Item & MRP / DP / SP Modal (C&F Only)
  const handleOpenEditRates = (product: AWPLProduct) => {
    if (!isCFUser) return;
    setEditingRatesProduct(product);
    setEditName(product.name);
    setEditSku(product.sku);
    setEditMrp(product.mrp);
    setEditDp(product.dp);
    setEditSp(product.sp);
    setEditCategory(product.category);
    setEditBatch(product.batchNumber);
    setEditExpiry(product.expiryDate);
    setEditStock(product.stock);
    setEditStopCustomerBill(Boolean(product.stopCustomerAppSale));
  };

  // Save Edited Item & MRP / DP / SP (C&F Only)
  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRatesProduct || !isCFUser) return;

    const history = editingRatesProduct.priceHistory ? [...editingRatesProduct.priceHistory] : [];
    if (
      editMrp !== editingRatesProduct.mrp ||
      editDp !== editingRatesProduct.dp ||
      editSp !== editingRatesProduct.sp
    ) {
      history.push({
        date: new Date().toISOString().split('T')[0],
        oldMrp: editingRatesProduct.mrp,
        newMrp: editMrp,
        oldDp: editingRatesProduct.dp,
        newDp: editDp,
        oldSp: editingRatesProduct.sp,
        newSp: editSp,
        reason: 'C&F Inventory Item & Rate Edit',
      });
    }

    const updatedProducts = products.map((p) =>
      p.id === editingRatesProduct.id
        ? {
            ...p,
            name: editName.trim() || p.name,
            sku: editSku.trim().toUpperCase() || p.sku,
            mrp: Number(editMrp),
            dp: Number(editDp),
            sp: Number(editSp),
            category: editCategory,
            batchNumber: editBatch || p.batchNumber,
            expiryDate: editExpiry || p.expiryDate,
            stock: isInfinityActive ? 999999 : Number(editStock) || p.stock,
            stopCustomerAppSale: editStopCustomerBill,
            priceHistory: history,
            source: 'Manual Entry' as const,
            lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
          }
        : p
    );

    onUpdateProducts(updatedProducts);
    setStorageItem('drw_products_v1', updatedProducts);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `C&F Edited Item Stock: ${editName || editingRatesProduct.name}`,
      category: 'Inventory',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Updated SKU: ${editSku} | MRP: ₹${editMrp}, DP: ₹${editDp}, SP: ${editSp} SP | Customer App Sale: ${
        editStopCustomerBill ? 'STOPPED' : 'ALLOWED'
      }`,
    });

    setEditingRatesProduct(null);
  };

  // Requirement #1: Remove / Delete Item from Item Stock (C&F Only)
  const handleConfirmRemoveItem = () => {
    if (!deletingProduct || !isCFUser) return;
    const updatedProducts = products.filter((p) => p.id !== deletingProduct.id);
    onUpdateProducts(updatedProducts);
    setStorageItem('drw_products_v1', updatedProducts);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Removed Item from Stock: ${deletingProduct.name}`,
      category: 'Inventory',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Removed SKU ${deletingProduct.sku} (${deletingProduct.category}) from Item Stock Inventory.`,
    });

    setDeletingProduct(null);
  };

  // Add New Product from Inventory (C&F Only)
  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCFUser || !newName.trim()) return;

    const created: AWPLProduct = {
      id: `prod-${Date.now()}`,
      sku: newSku.trim().toUpperCase() || `AWPL-INV-${Date.now().toString().slice(-4)}`,
      name: newName.trim(),
      category: newCategory,
      mrp: Number(newMrp) || 0,
      dp: Number(newDp) || 0,
      sp: Number(newSp) || 0,
      stock: 999999,
      lowStockThreshold: 0,
      batchNumber: `AWPL-26-${Math.floor(100 + Math.random() * 900)}`,
      expiryDate: '2028-12-31',
      description: 'Official AWPL C&F Inventory Item',
      gstRate: Number(newGst) || 12,
      status: 'active',
      barcode: `890608511${Math.floor(1000 + Math.random() * 9000)}`,
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
      source: 'Manual Entry',
      stopCustomerAppSale: false,
    };

    const next = [created, ...products];
    onUpdateProducts(next);
    setStorageItem('drw_products_v1', next);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Added AWPL Inventory Item: ${created.name}`,
      category: 'Inventory',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Category: ${created.category} | MRP: ₹${created.mrp}, DP: ₹${created.dp}, SP: ${created.sp}`,
    });

    setIsAddProductOpen(false);
    setNewName('');
    setNewSku('');
    setNewMrp(0);
    setNewDp(0);
    setNewSp(0);
  };

  // Handle Batch / C&F Movement Log Submit (Stock remains ∞ Infinite)
  const handlePerformStockMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const updatedProducts = products.map((p) =>
      p.id === selectedProduct.id
        ? {
            ...p,
            stock: 999999,
            status: 'active' as const,
            batchNumber: adjustmentBatch || p.batchNumber,
          }
        : p
    );
    onUpdateProducts(updatedProducts);
    setStorageItem('drw_products_v1', updatedProducts);

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: adjustmentType,
      quantityChange: adjustmentQty,
      batchNumber: adjustmentBatch || selectedProduct.batchNumber,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      referenceId: `REF-${Date.now().toString().slice(-5)}`,
      performedBy: currentUserName,
      notes: adjustmentNotes,
    };

    const updatedMovements = [newMovement, ...movements];
    onUpdateMovements(updatedMovements);
    setStorageItem('drw_inventory_movements_v1', updatedMovements);

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Batch / C&F Log (${adjustmentType}): ${selectedProduct.name}`,
      category: 'Inventory',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Batch: ${adjustmentBatch || selectedProduct.batchNumber} (Stock: ∞ Infinite). Note: ${adjustmentNotes || 'Standard'}`,
    });

    setIsAdjustModalOpen(false);
    setSelectedProduct(null);
    setAdjustmentNotes('');
    setAdjustmentBatch('');
  };

  // Requirement #6: Create Purchase Bill & Add Stock to Inventory
  const handleCreatePurchaseBill = (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = products.find((p) => p.id === pbProductId) || products[0];
    if (!targetProd) return;

    const lineTotal = Math.round(pbQty * pbRate);
    const nowDate = new Date().toISOString().split('T')[0];

    const billNo = pbNumber.trim().toUpperCase() || `AWPL-PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPb: PurchaseBill = {
      id: `pb-${Date.now()}`,
      cnfId: franchiseConfig?.id || 'cnf-other',
      cnfName: franchiseConfig?.name || 'C&F Franchise',
      purchaseBillNumber: billNo,
      supplierName: pbSupplier.trim() || 'Asclepius Wellness Pvt. Ltd.',
      date: nowDate,
      items: [
        {
          productId: targetProd.id,
          productName: targetProd.name,
          sku: targetProd.sku,
          quantityPurchased: pbQty,
          unitPurchaseDp: pbRate,
          spPerUnit: targetProd.sp,
          batchNumber: targetProd.batchNumber,
          lineTotal,
        },
      ],
      totalQuantity: pbQty,
      totalSp: Math.round(pbQty * targetProd.sp),
      totalAmount: lineTotal,
      paymentMode: pbPaymentMode,
      addedBy: `${currentUserName} (${currentUserRole})`,
      notes: pbNotes.trim() || 'Stock inward via Purchase Bill',
    };

    const nextPbs = [newPb, ...purchaseBills];
    if (onUpdatePurchaseBills) {
      onUpdatePurchaseBills(nextPbs);
    }
    setStorageItem('drw_purchase_bills_v1', nextPbs);

    // Update product stock quantity for Purchase Bill Stock Inventory
    const updatedProducts = products.map((p) => {
      if (p.id === targetProd.id) {
        const baseStock = p.stock > 50000 ? 0 : p.stock;
        return {
          ...p,
          stock: isInfinityActive ? 999999 : baseStock + pbQty,
          lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16),
        };
      }
      return p;
    });
    onUpdateProducts(updatedProducts);
    setStorageItem('drw_products_v1', updatedProducts);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: `Purchase Bill Recorded: ${newPb.purchaseBillNumber}`,
      category: 'Inventory',
      user: `${currentUserName} (${currentUserRole})`,
      details: `Added ${pbQty} units of ${targetProd.name} via Purchase Bill #${newPb.purchaseBillNumber} (${formatINR(lineTotal)}).`,
    });

    setIsPurchaseBillModalOpen(false);
    setPbNumber('');
    setPbNotes('');
  };

  // Toggle Infinity Stock for Other C&Fs (D RIGHT WELLNESS is permanently Infinity Stock)
  const handleToggleInfinityStock = () => {
    if (!franchiseConfig || !onUpdateConfig || isDrightPermanentInfinity) return;
    const nextInf = !franchiseConfig.infinityStockEnabled;
    const updatedCfg: FranchiseConfig = {
      ...franchiseConfig,
      infinityStockEnabled: nextInf,
    };
    onUpdateConfig(updatedCfg);
    setStorageItem('drw_franchise_config_v1', updatedCfg);
    saveToCloudBackup();
  };

  const handleExportStockReport = () => {
    const rows = products.map((p) => ({
      SKU: p.sku,
      ProductName: p.name,
      WebsiteCategory: p.category,
      MRP_Rate: p.mrp,
      DP_Rate: p.dp,
      SP_Points: p.sp,
      CustomerAppBilling: p.stopCustomerAppSale ? 'STOPPED BY C&F' : 'ALLOWED',
      StockAvailability: isInfinityActive ? 'INFINITE (UNLIMITED)' : String(p.stock > 50000 ? 50 : p.stock),
      BatchNumber: p.batchNumber,
      ExpiryDate: p.expiryDate,
    }));

    exportToCSV(`AWPL_Official_Inventory_${new Date().toISOString().slice(0, 10)}`, rows);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-5 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Boxes className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg sm:text-xl font-black">
              Official AWPL Website Item Inventory (Category-Wise)
            </h2>
            <span className="rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-[10px] font-black">
              {products.length} Official AWPL SKUs
            </span>
          </div>
          <p className="text-xs text-emerald-100 mt-1">
            All Asclepius Wellness Pvt. Ltd. website products organized by official category with editable <strong>MRP, DP & SP (C&F Only)</strong> and <strong>Stop Bill for Customer App</strong> control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCFUser && (
            <>
              <button
                type="button"
                onClick={() => setIsPurchaseBillModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black px-3.5 py-2 text-xs font-black shadow transition"
              >
                <Truck className="h-4 w-4" />
                <span>+ Enter Purchase Bill (Stock Inward)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-2 text-xs font-black shadow transition"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add AWPL Item (C&F)</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleExportStockReport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-300" />
            <span>Export Inventory CSV</span>
          </button>
        </div>
      </div>

      {/* Requirement #6 & #7: Stock Mode Banner (Permanent Infinity Stock for D RIGHT WELLNESS vs Purchase Bill Stock + Infinity Toggle for Other C&Fs) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-emerald-300 dark:border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <InfinityIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Active C&F: {franchiseConfig?.name || 'D RIGHT WELLNESS'} ({franchiseConfig?.shortName || 'DRW'})
              </h3>
              {isDrightPermanentInfinity ? (
                <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                  ∞ Permanent Infinity Stock (D RIGHT WELLNESS)
                </span>
              ) : isInfinityActive ? (
                <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                  ∞ Infinity Stock Option Enabled
                </span>
              ) : (
                <span className="rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                  📦 Purchase Bill Stock Inventory Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {isDrightPermanentInfinity
                ? 'D RIGHT WELLNESS has Permanent Infinity Stock enabled. You can also record Purchase Bills for accounting.'
                : 'Other C&Fs have Stock Inventory with Purchase Bills AND can toggle Infinity Stock anytime.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isDrightPermanentInfinity && isCFUser && (
            <button
              type="button"
              onClick={handleToggleInfinityStock}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition border ${
                isInfinityActive
                  ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
                  : 'bg-emerald-700 text-white border-emerald-600 hover:bg-emerald-800'
              }`}
            >
              {isInfinityActive ? 'Switch to Purchase Bill Stock Mode' : 'Enable ∞ Infinity Stock Mode'}
            </button>
          )}
          <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            Purchase Bills Logged: <strong>{purchaseBills.length}</strong>
          </span>
        </div>
      </div>

      {/* Purchase Bills History Strip (Requirement #6) */}
      {purchaseBills.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-orange-500" />
              <span>C&F Purchase Bills & Stock Inward Register ({purchaseBills.length})</span>
            </h4>
            {isCFUser && (
              <button
                type="button"
                onClick={() => setIsPurchaseBillModalOpen(true)}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                + New Purchase Bill
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {purchaseBills.slice(0, 4).map((pb) => (
              <div
                key={pb.id}
                className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {pb.purchaseBillNumber}
                    </span>
                    <span className="rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 px-1.5 py-0.2 text-[10px] font-bold">
                      {pb.cnfName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    {pb.items.map((it) => `${it.productName} (+${it.quantityPurchased} qty)`).join(', ')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {pb.date} • Supplier: {pb.supplierName} ({pb.paymentMode})
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                    {formatINR(pb.totalAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-emerald-300 dark:bg-slate-900 dark:border-emerald-800">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
            C&F Stock Supply
          </span>
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
            {isInfinityActive ? '∞ Infinite' : 'Purchase Stock'}
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
            {isDrightPermanentInfinity
              ? 'Permanent Infinity (D RIGHT WELLNESS)'
              : `${purchaseBills.length} Purchase Bills Recorded`}
          </span>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
            Catalog Unit DP & MRP
          </span>
          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
            DP: {formatINR(totalCatalogDP)}
          </span>
          <span className="text-[11px] text-slate-500">
            MRP Sum: {formatINR(totalCatalogMRP)} ({totalCatalogSP} SP)
          </span>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
            C&F Rate Edit Access
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
            {isCFUser ? '✓ C&F Editable (MRP/DP/SP)' : 'Read-Only (Customer)'}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            Only C&F can edit MRP, DP & SP
          </span>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
            Customer App Stop-Bill Control
          </span>
          <span className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 block">
            {stoppedCustomerCount} Stopped
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">
            {products.length - stoppedCustomerCount} Active in Customer App
          </span>
        </div>
      </div>

      {/* Website Category-Wise Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {WEBSITE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap border transition ${
                active
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{cat}</span>
              <span
                className={`rounded-full px-2 py-0.2 text-[10px] font-black ${
                  active
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {categoryCounts[cat] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search AWPL website products by name, category, SKU, or batch..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <select
            value={customerAppFilter}
            onChange={(e) => setCustomerAppFilter(e.target.value as any)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Customer App Status ({products.length})</option>
            <option value="allowed">Allowed in Customer App ({products.length - stoppedCustomerCount})</option>
            <option value="stopped">Stopped for Customer App ({stoppedCustomerCount})</option>
          </select>
        </div>
      </div>

      {/* Category-Wise Inventory Table with C&F MRP/DP/SP Edit & Stop Bill Toggle */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Product Name & Website Category</th>
                <th className="py-3 px-4">SKU & Batch</th>
                <th className="py-3 px-4 text-right">MRP (₹)</th>
                <th className="py-3 px-4 text-right">DP (₹)</th>
                <th className="py-3 px-4 text-center">AWPL SP</th>
                <th className="py-3 px-4 text-center">Customer App Billing</th>
                {isCFUser && <th className="py-3 px-4 text-right">C&F Controls (Edit MRP/DP/SP & Stop Bill)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((p) => {
                const isStopped = Boolean(p.stopCustomerAppSale);
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                      isStopped ? 'bg-red-50/30 dark:bg-red-950/15' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {p.category}
                        </span>
                        <span className="text-[10px] text-slate-400">GST {p.gstRate}%</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {p.sku}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {p.batchNumber} • Exp: {p.expiryDate}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                      {formatINR(p.mrp)}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-emerald-700 dark:text-emerald-400 text-sm">
                      {formatINR(p.dp)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 font-black text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                        <Sparkles className="h-3 w-3" />
                        {p.sp} SP
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isStopped ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950 px-2.5 py-0.5 text-[10px] font-black text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
                          <Ban className="h-3 w-3" />
                          BILL STOPPED (Customer App)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Allowed in Customer App
                        </span>
                      )}
                    </td>

                    {isCFUser && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRates(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 px-2.5 py-1.5 text-[11px] font-black text-slate-950 shadow-xs transition"
                            title="C&F Only: Edit Item Name, SKU, MRP, DP, SP & Batch"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit Item</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStopCustomerBill(p)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition ${
                              isStopped
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                            }`}
                            title="Stop or Allow Billing of this Item in Customer App"
                          >
                            {isStopped ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Allow Customer Bill</span>
                              </>
                            ) : (
                              <>
                                <Ban className="h-3 w-3" />
                                <span>Stop Bill (Customer App)</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProduct(p);
                              setAdjustmentBatch(p.batchNumber);
                              setIsAdjustModalOpen(true);
                            }}
                            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                          >
                            Batch
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 text-[11px] font-bold shadow-xs transition"
                            title="Remove Item from Item Stock"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* C&F-Only Edit Item Details, MRP, DP & SP Modal */}
      {editingRatesProduct && isCFUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="rounded bg-amber-400 text-slate-950 px-2 py-0.5 text-[10px] font-black uppercase">
                C&F Item Stock Editor (Requirement #1)
              </span>
              <h3 className="font-black text-base text-slate-900 dark:text-white mt-1">
                Edit Item & Rates — {editingRatesProduct.name}
              </h3>
              <p className="text-xs text-slate-500 font-mono">{editingRatesProduct.sku}</p>
            </div>

            <form onSubmit={handleSaveRates} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Website Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {WEBSITE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editMrp}
                    onChange={(e) => setEditMrp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-black text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-emerald-700 dark:text-emerald-400">DP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editDp}
                    onChange={(e) => setEditDp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-black text-sm bg-emerald-50/40 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-700 dark:text-amber-400">SP Points *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editSp}
                    onChange={(e) => setEditSp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-amber-500 p-2.5 font-black text-sm bg-amber-50/40 dark:bg-slate-800 text-amber-900 dark:text-amber-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Batch Number</label>
                  <input
                    type="text"
                    value={editBatch}
                    onChange={(e) => setEditBatch(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Expiry Date</label>
                  <input
                    type="date"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-black text-red-800 dark:text-red-300 block">
                      Stop Bill for Customer App
                    </span>
                    <span className="text-[11px] text-red-600 dark:text-red-400">
                      If enabled, customers cannot order or bill this item in the Customer App.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editStopCustomerBill}
                    onChange={(e) => setEditStopCustomerBill(e.target.checked)}
                    className="h-5 w-5 rounded text-red-600"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRatesProduct(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow"
                >
                  Save Item & Rates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requirement #1: Remove / Delete Item Confirmation Modal */}
      {deletingProduct && isCFUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-red-600">
              <Trash2 className="h-6 w-6 shrink-0" />
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Remove Item from Item Stock?
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to remove <strong>{deletingProduct.name}</strong> (SKU: <span className="font-mono">{deletingProduct.sku}</span>) from the Item Stock Inventory?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveItem}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow"
              >
                Confirm Remove Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New AWPL Item Modal (C&F Only) */}
      {isAddProductOpen && isCFUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              Add Official AWPL Product to Item Inventory
            </h3>
            <form onSubmit={handleCreateNewProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Asclepius Ayush Kwath"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Website Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ProductCategory)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    {WEBSITE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">SKU Code</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="AWPL-NEW-01"
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newMrp || ''}
                    onChange={(e) => setNewMrp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-emerald-700 dark:text-emerald-400">DP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newDp || ''}
                    onChange={(e) => setNewDp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-emerald-500 p-2.5 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-700 dark:text-amber-400">SP *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newSp || ''}
                    onChange={(e) => setNewSp(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-amber-500 p-2.5 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-black shadow"
                >
                  Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch & Movement Log Modal */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Batch & C&F Movement Log
            </h3>
            <p className="text-xs text-slate-500">
              Product: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProduct.name}</span>
            </p>

            <form onSubmit={handlePerformStockMovement} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Movement Operation Type</label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 font-bold"
                >
                  <option value="Stock In (C&F)">Stock In (Inward from Solan C&F Depot)</option>
                  <option value="Return">Customer Return</option>
                  <option value="Damage / Expiry Write-Off">Damage / Expiry Write-Off (-)</option>
                  <option value="Adjustment">Batch Audit Update</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Reference Units</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Batch Number</label>
                  <input
                    type="text"
                    value={adjustmentBatch}
                    onChange={(e) => setAdjustmentBatch(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Audit Remarks / Invoice Ref</label>
                <textarea
                  rows={2}
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder="e.g. Received from C&F Solan Invoice #INV-8891..."
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 shadow"
                >
                  Save Batch Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requirement #6: Enter Purchase Bill (Stock Inventory Inward) Modal */}
      {isPurchaseBillModalOpen && isCFUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black uppercase">
                  C&F Purchase Bill Entry
                </span>
                <h3 className="font-black text-base text-slate-900 dark:text-white mt-1">
                  Add Stock Inventory via Purchase Bill
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPurchaseBillModalOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseBill} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Purchase Invoice / Bill Number *
                </label>
                <input
                  type="text"
                  required
                  value={pbNumber}
                  onChange={(e) => setPbNumber(e.target.value)}
                  placeholder="e.g. AWPL-PUR-2026-8821"
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono font-bold bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Supplier / AWPL Depot Name *
                </label>
                <input
                  type="text"
                  required
                  value={pbSupplier}
                  onChange={(e) => setPbSupplier(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Select AWPL Product *
                </label>
                <select
                  value={pbProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setPbProductId(pid);
                    const found = products.find((p) => p.id === pid);
                    if (found) setPbRate(found.dp);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — DP ₹{p.dp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Inward Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pbQty}
                    onChange={(e) => setPbQty(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-black bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Purchase Rate (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pbRate}
                    onChange={(e) => setPbRate(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-black bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Payment Mode</label>
                <select
                  value={pbPaymentMode}
                  onChange={(e) => setPbPaymentMode(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-bold bg-white dark:bg-slate-800"
                >
                  <option value="Bank Transfer / NEFT / RTGS">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPurchaseBillModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow"
                >
                  Save Purchase Bill ({formatINR(pbQty * pbRate)})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

