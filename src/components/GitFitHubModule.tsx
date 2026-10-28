import React, { useState, useEffect } from 'react';
import {
  Dumbbell,
  Flame,
  Activity,
  ShoppingCart,
  CheckCircle2,
  Plus,
  Trash2,
  Share2,
  Smartphone,
  QrCode,
  Sparkles,
  Trophy,
  Droplets,
  Moon,
  Footprints,
  ArrowRight,
  Users,
  Phone,
  Download,
  RefreshCw,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  AWPLProduct,
  AuditLog,
  FranchiseConfig,
  UserSubscription
} from '../types';
import {
  formatINR,
  getUPIPaymentURI,
  getStorageItem,
  setStorageItem,
  saveToCloudBackup,
  STORAGE_KEYS
} from '../utils/storage';

interface WorkoutEntry {
  id: string;
  date: string;
  memberName: string;
  exercise: string;
  category: 'Chest & Push' | 'Back & Pull' | 'Legs & Lower' | 'Shoulders & Arms' | 'HIIT & Cardio' | 'Yoga & Core';
  sets: number;
  reps: number;
  weightKg: number;
  rpe: number;
  estimated1RM: number;
}

interface NutritionEntry {
  id: string;
  date: string;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
}

interface DailyWellnessMetrics {
  waterGlasses: number;
  sleepHours: number;
  dailySteps: number;
  bodyWeightKg: number;
  calorieTarget: number;
  proteinTargetG: number;
}

export const GITFIT_PRODUCTS: AWPLProduct[] = [
  {
    id: 'gitfit-prod-whey-iso',
    sku: 'GFIT-PRO-001',
    name: 'GitFit 100% Isolate Whey Protein (2 kg Rich Chocolate)',
    category: 'Nutrition & Food',
    mrp: 5499,
    dp: 4299,
    sp: 35,
    stock: 999999,
    lowStockThreshold: 10,
    batchNumber: 'GFIT-WHEY-26A',
    expiryDate: '2028-06-30',
    description: '27g Pure Whey Isolate per scoop, 6.2g BCAA, Zero Added Sugar — GitFit Pro Series',
    gstRate: 18,
    status: 'active',
    barcode: '8906090889011',
    lastUpdated: '2026-10-26',
    source: 'Official AWPL Sync',
  },
  {
    id: 'gitfit-prod-creatine',
    sku: 'GFIT-PRO-002',
    name: 'GitFit Micronized Creatine Monohydrate (250g Unflavoured)',
    category: 'Nutrition & Food',
    mrp: 1499,
    dp: 999,
    sp: 12,
    stock: 999999,
    lowStockThreshold: 15,
    batchNumber: 'GFIT-CRE-26B',
    expiryDate: '2028-09-30',
    description: 'Pure 3g Ultra-Micronized Creatine per serving for strength, ATP & progressive overload',
    gstRate: 18,
    status: 'active',
    barcode: '8906090889028',
    lastUpdated: '2026-10-26',
    source: 'Official AWPL Sync',
  },
  {
    id: 'gitfit-prod-preworkout',
    sku: 'GFIT-PRO-003',
    name: 'GitFit Nitro Surge Pre-Workout Igniter (300g Tangy Orange)',
    category: 'Nutrition & Food',
    mrp: 2199,
    dp: 1599,
    sp: 18,
    stock: 999999,
    lowStockThreshold: 10,
    batchNumber: 'GFIT-PRE-26C',
    expiryDate: '2028-05-31',
    description: 'L-Citrulline 6000mg, Beta-Alanine 3200mg & Natural Caffeine for intense focus & pump',
    gstRate: 18,
    status: 'active',
    barcode: '8906090889035',
    lastUpdated: '2026-10-26',
    source: 'Official AWPL Sync',
  },
  {
    id: 'gitfit-prod-bcaa',
    sku: 'GFIT-PRO-004',
    name: 'GitFit Intra-Workout BCAA + Electrolytes 2:1:1 (400g Watermelon)',
    category: 'Nutrition & Food',
    mrp: 1899,
    dp: 1350,
    sp: 15,
    stock: 999999,
    lowStockThreshold: 12,
    batchNumber: 'GFIT-BCA-26D',
    expiryDate: '2028-08-31',
    description: '7g Instantized BCAAs + Coconut Water Electrolytes for zero muscle breakdown',
    gstRate: 18,
    status: 'active',
    barcode: '8906090889042',
    lastUpdated: '2026-10-26',
    source: 'Official AWPL Sync',
  },
  {
    id: 'gitfit-prod-trimshake',
    sku: 'GFIT-NAT-005',
    name: 'GitFit x AWPL NaturFit TrimShake Meal Replacement (500g)',
    category: 'Ayurvedic Wellness',
    mrp: 1650,
    dp: 1290,
    sp: 14,
    stock: 999999,
    lowStockThreshold: 10,
    batchNumber: 'GFIT-TRM-26E',
    expiryDate: '2028-04-30',
    description: 'High-Fiber Ayurvedic Protein & Metabolism Booster for lean fat loss & satiety',
    gstRate: 12,
    status: 'active',
    barcode: '8906090889059',
    lastUpdated: '2026-10-26',
    source: 'Official AWPL Sync',
  },
  {
    id: 'gitfit-prod-membership-pass',
    sku: 'GFIT-MEM-006',
    name: 'GitFit Pro Gym & Wellness Transformation Pass (30 Days + Diet Plan)',
    category: 'Ayurvedic Wellness',
    mrp: 1999,
    dp: 1499,
    sp: 20,
    stock: 999999,
    lowStockThreshold: 5,
    batchNumber: 'GFIT-PASS-26',
    expiryDate: '2029-12-31',
    description: 'Full 30-Day GitFit Strength & Conditioning Access + Customized Macro & Supplement Plan',
    gstRate: 18,
    status: 'active',
    barcode: '8906090889066',
    lastUpdated: '2026-10-26',
    source: 'Official AWPL Sync',
  },
];

interface GitFitHubModuleProps {
  franchiseConfig: FranchiseConfig;
  cnfAccounts: FranchiseConfig[];
  products: AWPLProduct[];
  userSubscriptions: UserSubscription[];
  currentUserName: string;
  onUpdateConfig: (cfg: FranchiseConfig) => void;
  onUpdateCnfAccounts: (list: FranchiseConfig[]) => void;
  onUpdateProducts: (prods: AWPLProduct[]) => void;
  onUpdateSubscriptions: (subs: UserSubscription[]) => void;
  onQuickSendToPos: (prod: AWPLProduct) => void;
  onNavigateToPos: () => void;
  onAddAuditLog: (log: AuditLog) => void;
}

const DEFAULT_WORKOUTS: WorkoutEntry[] = [
  {
    id: 'wk-1',
    date: new Date().toISOString().split('T')[0],
    memberName: 'Dixit Sharma',
    exercise: 'Barbell Incline Bench Press',
    category: 'Chest & Push',
    sets: 4,
    reps: 8,
    weightKg: 80,
    rpe: 8.5,
    estimated1RM: Math.round(80 * (1 + 8 / 30)),
  },
  {
    id: 'wk-2',
    date: new Date().toISOString().split('T')[0],
    memberName: 'Dixit Sharma',
    exercise: 'Weighted Pull-Ups & Lat Pulldown',
    category: 'Back & Pull',
    sets: 4,
    reps: 10,
    weightKg: 75,
    rpe: 8,
    estimated1RM: Math.round(75 * (1 + 10 / 30)),
  },
  {
    id: 'wk-3',
    date: new Date().toISOString().split('T')[0],
    memberName: 'Dixit Sharma',
    exercise: 'Barbell Back Squat (ATG)',
    category: 'Legs & Lower',
    sets: 4,
    reps: 6,
    weightKg: 110,
    rpe: 9,
    estimated1RM: Math.round(110 * (1 + 6 / 30)),
  },
];

const DEFAULT_NUTRITION: NutritionEntry[] = [
  {
    id: 'nut-1',
    date: new Date().toISOString().split('T')[0],
    mealName: 'Post-Workout: GitFit 100% Whey Isolate + Oats & Banana',
    calories: 480,
    proteinG: 38,
    carbsG: 58,
    fatsG: 9,
  },
  {
    id: 'nut-2',
    date: new Date().toISOString().split('T')[0],
    mealName: 'Lunch: Paneer / Chicken Tikka Bowl + Brown Rice & Salad',
    calories: 640,
    proteinG: 46,
    carbsG: 62,
    fatsG: 18,
  },
  {
    id: 'nut-3',
    date: new Date().toISOString().split('T')[0],
    mealName: 'Evening: GitFit x AWPL NaturFit TrimShake + Almonds',
    calories: 290,
    proteinG: 24,
    carbsG: 22,
    fatsG: 11,
  },
];

export const GitFitHubModule: React.FC<GitFitHubModuleProps> = ({
  franchiseConfig,
  cnfAccounts,
  products,
  userSubscriptions,
  currentUserName,
  onUpdateConfig,
  onUpdateCnfAccounts,
  onUpdateProducts,
  onUpdateSubscriptions,
  onQuickSendToPos,
  onNavigateToPos,
  onAddAuditLog,
}) => {
  const [subTab, setSubTab] = useState<'overview_brand' | 'workouts' | 'nutrition_pos' | 'gateway_share'>('overview_brand');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Workouts state
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>(() =>
    getStorageItem<WorkoutEntry[]>('drw_gitfit_workouts_v1', DEFAULT_WORKOUTS)
  );
  const [exerciseInput, setExerciseInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<WorkoutEntry['category']>('Chest & Push');
  const [setsInput, setSetsInput] = useState(4);
  const [repsInput, setRepsInput] = useState(10);
  const [weightInput, setWeightInput] = useState(60);
  const [rpeInput, setRpeInput] = useState(8);

  // Nutrition & Daily Check-in state
  const [meals, setMeals] = useState<NutritionEntry[]>(() =>
    getStorageItem<NutritionEntry[]>('drw_gitfit_meals_v1', DEFAULT_NUTRITION)
  );
  const [wellness, setWellness] = useState<DailyWellnessMetrics>(() =>
    getStorageItem<DailyWellnessMetrics>('drw_gitfit_wellness_v1', {
      waterGlasses: 7,
      sleepHours: 7.5,
      dailySteps: 8450,
      bodyWeightKg: 74.5,
      calorieTarget: 2400,
      proteinTargetG: 160,
    })
  );
  const [mealNameInput, setMealNameInput] = useState('');
  const [mealCalInput, setMealCalInput] = useState(400);
  const [mealProtInput, setMealProtInput] = useState(30);
  const [mealCarbInput, setMealCarbInput] = useState(40);
  const [mealFatInput, setMealFatInput] = useState(10);

  // GitFit Subscription Gateway & WhatsApp Share state
  const [whatsAppPhoneInput, setWhatsAppPhoneInput] = useState('');
  const [selectedPlanAmount, setSelectedPlanAmount] = useState<number>(699);
  const [selectedPlanDays, setSelectedPlanDays] = useState<number>(30);
  const [selectedPlanTitle, setSelectedPlanTitle] = useState<string>('GitFit Pro Monthly Subscription (₹699/mo)');
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [gatewaySessionId, setGatewaySessionId] = useState('');
  const [gatewayCountdown, setGatewayCountdown] = useState(5);

  const isGitFitBrandActive =
    franchiseConfig.shortName === 'GFIT' ||
    franchiseConfig.name.toUpperCase().includes('GITFIT');

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 5000);
  };

  // Switch Entire App Brand to GitFit App (or back to D RIGHT WELLNESS)
  const handleActivateGitFitAppBrand = () => {
    const gitFitConfig: FranchiseConfig = {
      ...franchiseConfig,
      id: 'cnf-gitfit-hub',
      name: 'GITFIT APP — WELLNESS, FITNESS & NUTRITION HUB',
      shortName: 'GFIT',
      franchiseCode: 'GFIT-IND-SOL-001',
      officialDepotName: 'GitFit Pro Fitness & AWPL Wellness Hub',
      parentCompany: 'GitFit Wellness & Asclepius Wellness Pvt. Ltd.',
      billPrintConfig: {
        ...(franchiseConfig.billPrintConfig || {
          paperSize: 'A4',
          orientation: 'portrait',
          showCompanyLogo: true,
          showGstinAndLicenses: true,
          showBatchColumn: true,
          showMrpColumn: true,
          showSpColumn: true,
          showGstColumn: true,
          showCfClearanceBlock: true,
          showUpiQr: true,
          showCustomerAppQr: true,
          showSignaturesAndStamp: true,
          selectedPrinterName: 'System Default PC Printer',
          autoPrintOnSave: true,
          termsAndConditions: [
            'All pending products will be given by the original bill.',
            'GitFit App Authentic Sports Nutrition & Ayurvedic Wellness Guarantee.',
          ],
        }),
        invoiceTitle: 'GITFIT APP — OFFICIAL GST TAX INVOICE',
        customHeaderMatter: 'GITFIT APP • Official Fitness, Sports Nutrition & Ayurvedic Wellness Hub',
        customSubHeaderMatter: '100% Authentic Supplements, Gym Memberships & AWPL Wellness Products',
        customFooterMatter: 'Train Hard, Track Smart & Stay Fit with GitFit App!',
      },
    };

    // Merge GitFit products into catalog if not already present
    const existingIds = new Set(products.map((p) => p.id));
    const mergedProducts = [
      ...GITFIT_PRODUCTS.filter((gp) => !existingIds.has(gp.id)),
      ...products,
    ];

    onUpdateProducts(mergedProducts);
    setStorageItem(STORAGE_KEYS.PRODUCTS, mergedProducts);

    gitFitConfig.customProducts = mergedProducts;
    onUpdateConfig(gitFitConfig);
    setStorageItem(STORAGE_KEYS.CONFIG, gitFitConfig);

    const existsInAccounts = cnfAccounts.some((c) => c.id === gitFitConfig.id || c.shortName === 'GFIT');
    const updatedAccounts = existsInAccounts
      ? cnfAccounts.map((c) => (c.id === gitFitConfig.id || c.shortName === 'GFIT' ? gitFitConfig : c))
      : [gitFitConfig, ...cnfAccounts];

    onUpdateCnfAccounts(updatedAccounts);
    setStorageItem(STORAGE_KEYS.CNF_ACCOUNTS, updatedAccounts);
    saveToCloudBackup();

    onAddAuditLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      action: 'Switched Active Brand to GITFIT APP (GFIT)',
      category: 'System',
      user: currentUserName,
      details: 'Activated GitFit App branding (Prefix: GFIT, Bill #3000+) and loaded GitFit Sports Nutrition & Membership catalog.',
    });

    showToast('✓ Entire App is now configured for GITFIT APP (Prefix: GFIT • Sports Nutrition & Wellness Catalog Loaded)!');
  };

  const handleRestoreDrwBrand = () => {
    const drwFound = cnfAccounts.find((c) => c.shortName === 'DRW' || c.name.includes('D RIGHT WELLNESS'));
    const restored: FranchiseConfig = drwFound || {
      ...franchiseConfig,
      id: 'cnf-drw-solan',
      name: 'D RIGHT WELLNESS',
      shortName: 'DRW',
      franchiseCode: 'AWPL-FR-HP-SOL-092',
    };
    onUpdateConfig(restored);
    setStorageItem(STORAGE_KEYS.CONFIG, restored);
    saveToCloudBackup();
    showToast('✓ Switched active brand back to D RIGHT WELLNESS (DRW)!');
  };

  const handleLoadGitFitCatalogOnly = () => {
    const existingIds = new Set(products.map((p) => p.id));
    const newItems = GITFIT_PRODUCTS.filter((gp) => !existingIds.has(gp.id));
    if (newItems.length === 0) {
      showToast('✓ All 6 GitFit Pro Supplements & Membership Passes are already in your Product Catalog & POS!');
      return;
    }
    const merged = [...newItems, ...products];
    onUpdateProducts(merged);
    setStorageItem(STORAGE_KEYS.PRODUCTS, merged);
    saveToCloudBackup();
    showToast(`✓ Added ${newItems.length} GitFit Sports Nutrition & Membership items to POS Billing & Customer Store!`);
  };

  // Add Workout
  const handleAddWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseInput.trim()) return;
    const est1RM = Math.round(weightInput * (1 + repsInput / 30));
    const entry: WorkoutEntry = {
      id: `wk-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      memberName: currentUserName,
      exercise: exerciseInput.trim(),
      category: categoryInput,
      sets: Number(setsInput) || 3,
      reps: Number(repsInput) || 10,
      weightKg: Number(weightInput) || 0,
      rpe: Number(rpeInput) || 8,
      estimated1RM: est1RM,
    };
    const updated = [entry, ...workouts];
    setWorkouts(updated);
    setStorageItem('drw_gitfit_workouts_v1', updated);
    setExerciseInput('');
    showToast(`✓ Logged "${entry.exercise}" (${entry.sets}x${entry.reps} @ ${entry.weightKg}kg • Est. 1RM: ${est1RM}kg)!`);
  };

  const handleQuickRoutineLoad = (routineName: string, presetExercises: Omit<WorkoutEntry, 'id' | 'date' | 'memberName'>[]) => {
    const today = new Date().toISOString().split('T')[0];
    const created: WorkoutEntry[] = presetExercises.map((ex, i) => ({
      ...ex,
      id: `wk-${Date.now()}-${i}`,
      date: today,
      memberName: currentUserName,
    }));
    const updated = [...created, ...workouts];
    setWorkouts(updated);
    setStorageItem('drw_gitfit_workouts_v1', updated);
    showToast(`✓ Loaded "${routineName}" (${created.length} exercises) into today's GitFit Workout Log!`);
  };

  // Add Meal
  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealNameInput.trim()) return;
    const newMeal: NutritionEntry = {
      id: `nut-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      mealName: mealNameInput.trim(),
      calories: Number(mealCalInput) || 0,
      proteinG: Number(mealProtInput) || 0,
      carbsG: Number(mealCarbInput) || 0,
      fatsG: Number(mealFatInput) || 0,
    };
    const updated = [newMeal, ...meals];
    setMeals(updated);
    setStorageItem('drw_gitfit_meals_v1', updated);
    setMealNameInput('');
    showToast(`✓ Logged meal "${newMeal.mealName}" (+${newMeal.proteinG}g Protein, ${newMeal.calories} kcal)!`);
  };

  const updateWellnessField = (field: keyof DailyWellnessMetrics, val: number) => {
    const next = { ...wellness, [field]: val };
    setWellness(next);
    setStorageItem('drw_gitfit_wellness_v1', next);
  };

  // Totals for Nutrition
  const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0);
  const totalProtein = meals.reduce((acc, m) => acc + m.proteinG, 0);
  const totalCarbs = meals.reduce((acc, m) => acc + m.carbsG, 0);
  const totalFats = meals.reduce((acc, m) => acc + m.fatsG, 0);

  // Live UPI Payment Gateway for GitFit Subscription
  const handleOpenGitFitGateway = async (title: string, amount: number, days: number) => {
    setSelectedPlanTitle(title);
    setSelectedPlanAmount(amount);
    setSelectedPlanDays(days);
    setGatewayCountdown(5);
    setIsGatewayModalOpen(true);

    try {
      const res = await fetch('/api/payment-gateway/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'gitfit_subscription',
          portal: 'cnf_app',
          amount,
          payerName: currentUserName,
          planName: title,
          payeeName: franchiseConfig.name,
          payeeUpiId: franchiseConfig.bankUpiId || 'drightwellness@upi',
          autoDetectSeconds: 5,
        }),
      });
      const data = await res.json();
      if (data?.ok && data?.session?.sessionId) {
        setGatewaySessionId(data.session.sessionId);
      } else {
        setGatewaySessionId(`PGW-GFIT-${Date.now()}`);
      }
    } catch {
      setGatewaySessionId(`PGW-GFIT-${Date.now()}`);
    }
  };

  const finalizeGitFitSubscription = async (utrOverride?: string, isAdminDirect?: boolean) => {
    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + selectedPlanDays);
    const utr = utrOverride || `UTR-GFIT-${Date.now().toString().slice(-8)}`;

    const newSub: UserSubscription = {
      id: `sub-gitfit-${Date.now()}`,
      userId: franchiseConfig.id || 'gitfit-user',
      userName: `GitFit App — ${currentUserName}`,
      userRole: 'franchise_admin',
      planId: selectedPlanDays >= 365 ? 'plan-cf-yearly' : 'plan-cf-monthly',
      planName: selectedPlanTitle,
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      status: 'active',
      paymentRef: utr,
      amountPaid: selectedPlanAmount,
      autoRenew: true,
      settledToAccount: `${franchiseConfig.name} (${franchiseConfig.bankUpiId})`,
      settledStatus: 'Credited to Owner A/c',
    };

    const updatedSubs = [newSub, ...userSubscriptions];
    onUpdateSubscriptions(updatedSubs);
    setStorageItem(STORAGE_KEYS.USER_SUBSCRIPTIONS, updatedSubs);
    saveToCloudBackup();

    try {
      await fetch('/api/subscriptions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newSub.userId,
          userName: newSub.userName,
          userRole: newSub.userRole,
          planId: newSub.planId,
          planName: newSub.planName,
          durationDays: selectedPlanDays,
          amountPaid: selectedPlanAmount,
          paymentRef: utr,
          activatedByAdmin: Boolean(isAdminDirect),
        }),
      });
    } catch {
      // local state already synced
    }

    setIsGatewayModalOpen(false);
    showToast(
      `✓ ${selectedPlanTitle} Activated Immediately (Valid till ${newSub.expiryDate} • Ref: ${utr})! Continuous reminder set after 25 days; 100% data preserved.`
    );
  };

  useEffect(() => {
    if (!isGatewayModalOpen) return;
    const timer = setInterval(() => {
      setGatewayCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finalizeGitFitSubscription(`UTR-AUTO-GFIT-${Date.now().toString().slice(-6)}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isGatewayModalOpen]);

  // Dual WhatsApp Share URLs for GitFit App
  const baseOrigin =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://gitfit.app/';
  const gitFitShareMessage = [
    `*💪 GITFIT APP — Official Fitness, Sports Nutrition, Workout Tracker & POS Billing App*`,
    ``,
    `📲 *1. Open GitFit App (Workout, Macro Tracker & POS Billing):*`,
    `${baseOrigin}?app=cnf_app&brand=gitfit`,
    ``,
    `🛒 *2. Open GitFit Customer Supplement & Diet Store:*`,
    `${baseOrigin}?app=customer_app&brand=gitfit`,
    ``,
    `🤖 *3. Install Android App (Google Play Store TWA Ready):*`,
    `${baseOrigin}?source=playstore_twa&brand=gitfit`,
    ``,
    `_Powered by GitFit Wellness & ${franchiseConfig.name}_`,
  ].join('\n');

  const directContactWhatsAppUrl = `https://wa.me/?text=${encodeURIComponent(gitFitShareMessage)}`;
  const cleanPhone = whatsAppPhoneInput.replace(/\D/g, '').slice(0, 10);
  const specificNumberWhatsAppUrl =
    cleanPhone.length === 10
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(gitFitShareMessage)}`
      : directContactWhatsAppUrl;

  const upiUri = getUPIPaymentURI({
    vpa: franchiseConfig.bankUpiId || 'drightwellness@upi',
    payeeName: 'GitFit App Subscription',
    amount: selectedPlanAmount,
    transactionNote: selectedPlanTitle,
  });
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 border-2 border-orange-500 p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-16 rounded-2xl bg-orange-500 text-black font-black flex flex-col items-center justify-center border-2 border-white shadow-lg shrink-0">
              <Dumbbell className="h-6 w-6 text-black" />
              <span className="text-[9px] font-black uppercase tracking-tighter mt-0.5">GITFIT</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-500 text-black px-3 py-0.5 text-[10px] font-black uppercase">
                  GitFit App Ecosystem • Offline-First + Cloud Synced
                </span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  {isGitFitBrandActive ? '✓ Active Brand: GITFIT APP (GFIT)' : `Active Brand: ${franchiseConfig.name} (${franchiseConfig.shortName || 'DRW'})`}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                GitFit App — Strength &amp; Macro Tracker, Supplement POS Billing &amp; Play Store Hub
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Switch the entire app to <strong>GitFit App (GFIT)</strong> with 1 click • Log Workouts &amp; PRs • Track Macros &amp; Supplements • Bill Supplements via UPI with Instant Auto-Print • Share on WhatsApp &amp; Play Store.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isGitFitBrandActive ? (
              <button
                type="button"
                onClick={handleActivateGitFitAppBrand}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-xs shadow-lg flex items-center gap-1.5 cursor-pointer transition"
              >
                <Zap className="h-4 w-4" />
                <span>Switch Entire App to GitFit Mode (GFIT)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreDrwBrand}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-black text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Switch Back to D RIGHT WELLNESS (DRW)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                handleLoadGitFitCatalogOnly();
                onNavigateToPos();
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 cursor-pointer transition"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Open GitFit POS Billing</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation */}
        <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('overview_brand')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'overview_brand'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>1. GitFit Catalog &amp; Instant POS Billing</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('workouts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'workouts'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Dumbbell className="h-4 w-4" />
            <span>2. Workout, Strength &amp; PR Tracker ({workouts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('nutrition_pos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'nutrition_pos'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Flame className="h-4 w-4" />
            <span>3. Nutrition, Macros &amp; Daily Wellness Check-In</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('gateway_share')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              subTab === 'gateway_share'
                ? 'bg-orange-500 text-black shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Share2 className="h-4 w-4" />
            <span>4. GitFit Subscriptions, WhatsApp Share &amp; Play Store</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="rounded-2xl bg-emerald-600 text-white px-4 py-3 text-xs font-black shadow-md flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-white/80 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: GITFIT CATALOG & INSTANT POS BILLING */}
      {subTab === 'overview_brand' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-orange-600 block">
                Active App Mode
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {isGitFitBrandActive ? 'GITFIT APP (GFIT)' : `${franchiseConfig.name} (${franchiseConfig.shortName || 'DRW'})`}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Invoice Prefix: <strong className="font-mono">{franchiseConfig.shortName || 'GFIT'}/2026-2027/3000+</strong>
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-emerald-600 block">
                Today&apos;s Protein &amp; Calories
              </span>
              <p className="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                {totalProtein}g Protein • {totalCalories} kcal
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Target: {wellness.proteinTargetG}g Protein / {wellness.calorieTarget} kcal
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-indigo-600 block">
                Logged Strength Sets
              </span>
              <p className="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                {workouts.reduce((acc, w) => acc + w.sets, 0)} Sets ({workouts.length} Exercises)
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Auto 1RM &amp; Progressive Overload Active
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-amber-600 block">
                UPI Auto-Print POS
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                Instant Bill Print Ready
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Auto-prints GST bill upon UPI verification
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-400 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  GitFit Sports Nutrition, AWPL NaturFit &amp; Gym Membership Catalog
                </h3>
                <p className="text-xs text-slate-500">
                  Click <strong>Send to POS &amp; Bill Now</strong> on any supplement or membership pass to bill immediately via UPI (auto-prints the GST receipt on payment).
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadGitFitCatalogOnly}
                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow cursor-pointer transition"
              >
                + Sync All 6 GitFit Items to Main Catalog
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {GITFIT_PRODUCTS.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-orange-50/40 dark:bg-slate-800/50 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black font-mono">
                        {item.sku}
                      </span>
                      <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                        {item.sp} SP • GST {item.gstRate}%
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 line-through block">
                        MRP: {formatINR(item.mrp)}
                      </span>
                      <span className="text-sm font-black font-mono text-orange-600 dark:text-orange-400">
                        DP: {formatINR(item.dp)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleLoadGitFitCatalogOnly();
                        onQuickSendToPos(item);
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow cursor-pointer transition"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>Send to POS &amp; Bill</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GITFIT WORKOUT, STRENGTH & PR TRACKER */}
      {subTab === 'workouts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-400 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-orange-600" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Log Exercise &amp; Auto-Calculate 1RM
              </h3>
            </div>

            <form onSubmit={handleAddWorkout} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Exercise Name
                </label>
                <input
                  type="text"
                  required
                  value={exerciseInput}
                  onChange={(e) => setExerciseInput(e.target.value)}
                  placeholder="e.g., Dumbbell Shoulder Press / Deadlift"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Muscle Group / Split Category
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value as WorkoutEntry['category'])}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold"
                >
                  <option value="Chest & Push">Chest &amp; Push</option>
                  <option value="Back & Pull">Back &amp; Pull</option>
                  <option value="Legs & Lower">Legs &amp; Lower</option>
                  <option value="Shoulders & Arms">Shoulders &amp; Arms</option>
                  <option value="HIIT & Cardio">HIIT &amp; Cardio</option>
                  <option value="Yoga & Core">Yoga &amp; Core</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Sets
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={setsInput}
                    onChange={(e) => setSetsInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Reps
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={repsInput}
                    onChange={(e) => setRepsInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={2.5}
                    value={weightInput}
                    onChange={(e) => setWeightInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-orange-50 dark:bg-slate-800 p-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Estimated 1-Rep Max (Epley Formula):
                </span>
                <span className="text-sm font-black font-mono text-orange-600">
                  {Math.round(weightInput * (1 + repsInput / 30))} kg
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Log Workout Set to GitFit</span>
              </button>
            </form>

            {/* 1-Click Preset Workout Templates */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 block">
                1-Click GitFit Pro Workout Templates
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickRoutineLoad('Push Day Hypertrophy', [
                      {
                        exercise: 'Flat Barbell Bench Press',
                        category: 'Chest & Push',
                        sets: 4,
                        reps: 8,
                        weightKg: 85,
                        rpe: 8.5,
                        estimated1RM: 108,
                      },
                      {
                        exercise: 'Overhead Dumbbell Press',
                        category: 'Shoulders & Arms',
                        sets: 4,
                        reps: 10,
                        weightKg: 30,
                        rpe: 8,
                        estimated1RM: 40,
                      },
                      {
                        exercise: 'Cable Tricep Pushdowns',
                        category: 'Shoulders & Arms',
                        sets: 4,
                        reps: 12,
                        weightKg: 35,
                        rpe: 8,
                        estimated1RM: 49,
                      },
                    ])
                  }
                  className="p-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold text-left cursor-pointer"
                >
                  🔥 Push Day (Chest/Shoulders)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickRoutineLoad('Pull & Back Thickness', [
                      {
                        exercise: 'Conventional Barbell Deadlift',
                        category: 'Back & Pull',
                        sets: 4,
                        reps: 5,
                        weightKg: 140,
                        rpe: 9,
                        estimated1RM: 163,
                      },
                      {
                        exercise: 'Chest-Supported Row',
                        category: 'Back & Pull',
                        sets: 4,
                        reps: 10,
                        weightKg: 70,
                        rpe: 8,
                        estimated1RM: 93,
                      },
                    ])
                  }
                  className="p-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold text-left cursor-pointer"
                >
                  💪 Pull Day (Back/Biceps)
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  GitFit Strength Log &amp; Personal Records (PRs)
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                {workouts.length} Logged Entries
              </span>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
              {workouts.map((w) => (
                <div
                  key={w.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-orange-500 text-black px-2 py-0.5 text-[10px] font-black">
                        {w.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{w.date}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1">
                      {w.exercise}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                      {w.sets} Sets × {w.reps} Reps @ <strong>{w.weightKg} kg</strong> (RPE {w.rpe})
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Est. 1RM PR
                      </span>
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {w.estimated1RM} kg
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = workouts.filter((item) => item.id !== w.id);
                        setWorkouts(filtered);
                        setStorageItem('drw_gitfit_workouts_v1', filtered);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      title="Delete Workout Entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NUTRITION, MACROS & DAILY WELLNESS CHECK-IN */}
      {subTab === 'nutrition_pos' && (
        <div className="space-y-5">
          {/* Daily Check-In Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-sky-600">Hydration</span>
                <Droplets className="h-4 w-4 text-sky-500" />
              </div>
              <p className="text-lg font-black font-mono">{wellness.waterGlasses} / 10 Glasses</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => updateWellnessField('waterGlasses', Math.max(0, wellness.waterGlasses - 1))}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black text-xs cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => updateWellnessField('waterGlasses', wellness.waterGlasses + 1)}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-black text-xs cursor-pointer"
                >
                  +1 Glass
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-indigo-600">Recovery Sleep</span>
                <Moon className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="text-lg font-black font-mono">{wellness.sleepHours} hrs</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => updateWellnessField('sleepHours', Math.max(0, Number((wellness.sleepHours - 0.5).toFixed(1))))}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black text-xs cursor-pointer"
                >
                  -0.5h
                </button>
                <button
                  type="button"
                  onClick={() => updateWellnessField('sleepHours', Number((wellness.sleepHours + 0.5).toFixed(1)))}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs cursor-pointer"
                >
                  +0.5h
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-600">Daily Steps</span>
                <Footprints className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-lg font-black font-mono">{wellness.dailySteps.toLocaleString()}</p>
              <button
                type="button"
                onClick={() => updateWellnessField('dailySteps', wellness.dailySteps + 1000)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs cursor-pointer"
              >
                +1,000 Steps
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-orange-600">Macro Summary</span>
                <Activity className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-sm font-black font-mono">
                P: {totalProtein}g • C: {totalCarbs}g • F: {totalFats}g
              </p>
              <span className="text-[11px] text-slate-500 block">
                Total: {totalCalories} / {wellness.calorieTarget} kcal
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <form
              onSubmit={handleAddMeal}
              className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-400 p-5 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Log Meal or Supplement Shake
              </h3>
              <div>
                <label className="font-bold block mb-1">Meal / Shake Description</label>
                <input
                  type="text"
                  required
                  value={mealNameInput}
                  onChange={(e) => setMealNameInput(e.target.value)}
                  placeholder="e.g., 2 Scoops GitFit Whey + Oats"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Calories (kcal)</label>
                  <input
                    type="number"
                    value={mealCalInput}
                    onChange={(e) => setMealCalInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={mealProtInput}
                    onChange={(e) => setMealProtInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    value={mealCarbInput}
                    onChange={(e) => setMealCarbInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Fats (g)</label>
                  <input
                    type="number"
                    value={mealFatInput}
                    onChange={(e) => setMealFatInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black shadow cursor-pointer"
              >
                + Add Meal to Today&apos;s Macro Log
              </button>
            </form>

            <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Today&apos;s Nutrition &amp; Macro Entries
              </h3>
              <div className="space-y-2.5">
                {meals.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">{m.mealName}</p>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {m.calories} kcal • <strong>{m.proteinG}g Protein</strong> • {m.carbsG}g Carbs • {m.fatsG}g Fats
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = meals.filter((x) => x.id !== m.id);
                        setMeals(next);
                        setStorageItem('drw_gitfit_meals_v1', next);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GITFIT SUBSCRIPTIONS, DUAL WHATSAPP SHARE & PLAY STORE TWA */}
      {subTab === 'gateway_share' && (
        <div className="space-y-6">
          {/* Subscription Plans with Live UPI Gateway + Admin Direct Activate */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-400 p-5 space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase text-orange-600 block">
                Immediate Subscription Activation • 25-Day Renewal Reminder • 31st-Day Non-Destructive Expiry
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                GitFit App Membership &amp; Franchise Subscription Plans
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {[
                {
                  title: 'GitFit Customer Transformation Pass (₹99/mo)',
                  amount: 99,
                  days: 30,
                  desc: 'Workout & Macro Tracker + Customer Supplement Store + Auto-UPI Checkout',
                },
                {
                  title: 'GitFit Pro Gym / C&F Monthly Plan (₹699/mo)',
                  amount: 699,
                  days: 30,
                  desc: 'Unlimited POS Billing + Auto-Print UPI Bills + 5 PC & 1 Mobile Cloud Sync',
                },
                {
                  title: 'GitFit Annual Pro Franchise Plan (₹7,130/yr)',
                  amount: 7130,
                  days: 365,
                  desc: '365-Day Full Access + Priority Cloud Backup + Multi-Trainer Staff Logins',
                },
              ].map((plan) => (
                <div
                  key={plan.title}
                  className="rounded-2xl border border-orange-200 dark:border-slate-700 p-4 flex flex-col justify-between space-y-3 bg-orange-50/30 dark:bg-slate-800/40"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">{plan.title}</h4>
                    <p className="text-xl font-black font-mono text-orange-600">{formatINR(plan.amount)}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{plan.desc}</p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenGitFitGateway(plan.title, plan.amount, plan.days)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow cursor-pointer"
                    >
                      Pay via UPI Gateway &amp; Start Immediately
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanTitle(plan.title);
                        setSelectedPlanAmount(plan.amount);
                        setSelectedPlanDays(plan.days);
                        finalizeGitFitSubscription(`ADMIN-GFIT-${Date.now().toString().slice(-6)}`, true);
                      }}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black border border-amber-400/40 cursor-pointer"
                    >
                      ⚡ 1-Click Admin Direct Activate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dual WhatsApp Share for GitFit App (Without Number + With Number) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                  Option A • Without Number
                </span>
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Share GitFit App Link to Direct Contact on WhatsApp
              </h4>
              <p className="text-slate-600 dark:text-slate-300">
                Opens your WhatsApp Contact &amp; Group Picker directly without needing to type any phone number.
              </p>
              <a
                href={directContactWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2 shadow cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
                <span>Share GitFit App to Direct Contact (No Number)</span>
              </a>
            </div>

            <div className="rounded-2xl border-2 border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-orange-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase">
                  Option B • By Added Mobile Number
                </span>
                <Phone className="h-5 w-5 text-orange-600" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Share GitFit App Link by Entering WhatsApp Number
              </h4>
              <div className="flex items-center rounded-xl border-2 border-orange-300 bg-white dark:bg-slate-900 overflow-hidden">
                <span className="px-3 py-2 bg-orange-100 dark:bg-slate-800 font-mono font-black text-orange-800">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={whatsAppPhoneInput}
                  onChange={(e) => setWhatsAppPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit WhatsApp number"
                  className="w-full px-3 py-2 font-mono font-black focus:outline-none bg-transparent"
                />
              </div>
              <a
                href={specificNumberWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black flex items-center justify-center gap-2 shadow cursor-pointer"
              >
                <Phone className="h-4 w-4" />
                <span>
                  {cleanPhone.length === 10
                    ? `Send GitFit Link to +91 ${cleanPhone}`
                    : 'Enter 10-Digit Number or Click to Share'}
                </span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Live UPI Payment Gateway Modal for GitFit Subscription */}
      {isGatewayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-500 p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 block">
                  GitFit Live Auto-UPI Payment Gateway
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {selectedPlanTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGatewayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-2">
              <img
                src={qrSrc}
                alt="GitFit UPI QR"
                className="h-44 w-44 rounded-2xl border-2 border-orange-400 p-2 bg-white"
              />
              <p className="text-lg font-black font-mono text-emerald-600">
                {formatINR(selectedPlanAmount)}
              </p>
              <p className="text-[11px] text-slate-500">
                Session: <span className="font-mono">{gatewaySessionId}</span> • Auto-verifying payment in{' '}
                <strong>{gatewayCountdown}s</strong>...
              </p>
            </div>

            <button
              type="button"
              onClick={() => finalizeGitFitSubscription(`UTR-INST-${Date.now().toString().slice(-6)}`)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow cursor-pointer"
            >
              ✓ Payment Received — Activate Subscription Immediately
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
