import {
  AWPLProduct,
  Customer,
  FranchiseConfig,
  SubscriptionPlan,
  CFBillRecord,
  UserSubscription,
  AuditLog,
  Invoice,
  LinkedCFDepot,
  StaffMember,
  BankDeposit,
  PurchaseOrder,
  ProductCategory,
  PurchaseBill,
  AppFeedback,
  MainAdminConfig,
  BillPrintConfig,
  ComplaintReport
} from '../types';

export const LINKED_CF_DEPOTS: LinkedCFDepot[] = [
  {
    id: 'cf-solan-main',
    name: 'D RIGHT WELLNESS — Solan Regional C&F Depot Hub (HP)',
    code: 'AWPL-FR-HP-SOL-092',
    city: 'Solan',
    state: 'Himachal Pradesh',
    address: 'Near PNB Bank, Rabon, Solan, HP - 173211',
    upiId: 'drightwellness@upi',
    contactPhone: '+91 98160 54321',
  },
  {
    id: 'cf-shimla-hub',
    name: 'Shimla Zonal AWPL C&F Depot Hub (HP)',
    code: 'AWPL-CF-HP-SML-014',
    city: 'Shimla',
    state: 'Himachal Pradesh',
    address: 'NH-5 Bypass, Kachighatti, Shimla, HP - 171010',
    upiId: 'drightwellness@upi',
    contactPhone: '+91 98160 54321',
  },
  {
    id: 'cf-chandigarh-super',
    name: 'Chandigarh Tri-City AWPL Super C&F Depot',
    code: 'AWPL-CF-CHD-005',
    city: 'Chandigarh / Zirakpur',
    state: 'Chandigarh',
    address: 'Industrial Area Phase-II, Chandigarh - 160002',
    upiId: 'drightwellness@upi',
    contactPhone: '+91 98160 54321',
  },
  {
    id: 'cf-mandi-kangra',
    name: 'Mandi & Kangra AWPL Regional C&F Hub (HP)',
    code: 'AWPL-CF-HP-MND-028',
    city: 'Mandi',
    state: 'Himachal Pradesh',
    address: 'Gutkar NH-21, Mandi, HP - 175021',
    upiId: 'drightwellness@upi',
    contactPhone: '+91 98160 54321',
  },
  {
    id: 'cf-dehradun-north',
    name: 'Dehradun North Zone AWPL C&F Hub (UK)',
    code: 'AWPL-CF-UK-DDN-019',
    city: 'Dehradun',
    state: 'Uttarakhand',
    address: 'ISBT Saharanpur Road, Dehradun - 248002',
    upiId: 'drightwellness@upi',
    contactPhone: '+91 98160 54321',
  },
];

export const DEFAULT_BILL_PRINT_CONFIG: BillPrintConfig = {
  paperSize: 'A4',
  orientation: 'portrait',
  invoiceTitle: 'GST TAX INVOICE',
  customHeaderMatter: 'Authorized Franchise Under Asclepius Wellness Private Limited (AWPL)',
  customSubHeaderMatter: '100% Authentic Ayurvedic & Herbal Healthcare Preparations',
  customFooterMatter: 'Thank you for choosing authentic AWPL Wellness products! Wishing you good health & prosperity.',
  termsAndConditions: [
    'All pending products will be given by the original bill.',
    'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.',
  ],
  showCompanyLogo: true,
  showGstinAndLicenses: true,
  showBatchColumn: true,
  showMrpColumn: true,
  showSpColumn: true,
  showSpPoints: true,
  showGstColumn: true,
  showGstBreakdown: true,
  showCfClearanceBlock: true,
  showUpiQr: true,
  showBankAndQr: true,
  showCustomerAppQr: true,
  showSignaturesAndStamp: true,
  showSignatureAndSeal: true,
  selectedPrinterName: 'System Default PC Printer (Auto-Detected)',
  detectedPrinters: ['System Default PC Printer (Auto-Detected)'],
  autoPrinterDetect: true,
  autoPrintOnSave: false,
};

export const INITIAL_FRANCHISE_CONFIG: FranchiseConfig = {
  id: 'cnf-drw-solan',
  name: 'D RIGHT WELLNESS',
  shortName: 'DRW',
  startingInvoiceNumber: 3000,
  franchiseCode: 'AWPL-FR-HP-SOL-092',
  address: 'Near PNB Bank, Rabon, Solan, Himachal Pradesh - 173211, India',
  phone: '+91 98160 54321',
  email: 'drightwellness.solan@gmail.com',
  gstin: '02AABCA8921R1Z9',
  dlNumber: 'HP-SOL-DRW-2024-88',
  fssaiNumber: '10924011000142',
  panNumber: 'AABCA8921R',
  corporateAwplAddress: 'Asclepius Wellness Private Limited, Plot No. 18, Pocket 8, Block C, Sector 17, Dwarka, New Delhi - 110075',
  parentCompany: 'Asclepius Wellness Private Limited',
  cinNumber: 'U51909DL2014PTC272990',
  officialDepotName: 'Solan Regional C&F Depot Hub (HP)',
  franchiseOwner: 'Dixit Sharma',
  cfOwnerName: 'Dixit Sharma',
  authorizationValidTill: '31-March-2028',
  isoCertification: 'ISO 9001:2015 & GMP Certified Ayush Preparations',
  bankUpiId: 'drightwellness@upi',
  upiNumber: '9816054321',
  bankName: 'Punjab National Bank, Rabon Solan Branch',
  accountNo: '3029002100049182',
  ifscCode: 'PUNB0302900',
  qrMode: 'auto_upi',
  currentFinancialYear: '2026-2027',
  invoiceSequence: 2999,
  sessionSequences: {
    '2026-2027': 2999,
  },
  availableSessions: ['2025-2026', '2026-2027', '2027-2028'],
  multiFranchiseEnabled: true,
  isDrightWellness: true,
  infinityStockPermanent: true,
  infinityStockEnabled: true,
  upiTransactionFeeEnabled: false,
  upiTransactionFeePercent: 1.5,
  termsAndConditions: [
    'All pending products will be given by the original bill.',
    'Goods once sold will be accepted for return or exchange strictly in accordance with Asclepius Wellness Private Limited (AWPL) policy.'
  ],
  billPrintConfig: DEFAULT_BILL_PRINT_CONFIG,
  privacyAccessPermission: {
    grantedToMainApp: true,
    grantedBy: 'Dixit Sharma',
    grantedAt: '2026-10-25 09:00',
    purpose: 'Primary Admin C&F — Full Access Enabled',
  },
  pin: '1234',
  password: '1234',
  ownerApprovalCode: 'AWPL-3000',
  registeredAt: '2026-04-01',
};

// Helper to create official AWPL product entries across all 6 website categories
const makeProduct = (
  idx: number,
  sku: string,
  name: string,
  category: ProductCategory,
  mrp: number,
  dp: number,
  sp: number,
  gstRate: number,
  description: string,
  stopCustomerAppSale: boolean = false
): AWPLProduct => ({
  id: `prod-${String(idx).padStart(2, '0')}`,
  sku,
  name,
  category,
  mrp,
  dp,
  sp,
  stock: 999999,
  lowStockThreshold: 0,
  batchNumber: `AWPL-26-${String(idx).padStart(3, '0')}`,
  expiryDate: '2028-09-30',
  description,
  gstRate,
  status: 'active',
  barcode: `890608511${String(idx).padStart(4, '0')}`,
  lastUpdated: '2026-10-25 10:00',
  source: 'Official AWPL Sync',
  stopCustomerAppSale,
});

export const INITIAL_PRODUCTS: AWPLProduct[] = [
  // ================= 1. AYURVEDIC WELLNESS (35 Official Products) =================
  makeProduct(1, 'AWPL-IMM-001', 'Asclepius Immunodoc Ras (1000ml)', 'Ayurvedic Wellness', 2073, 1789, 12, 12, 'Official AWPL immunity & cellular defense herbal liquid ras with Giloy, Tulsi & Ashwagandha.'),
  makeProduct(2, 'AWPL-THN-002', 'Asclepius Thunderblast Ras (1000ml)', 'Ayurvedic Wellness', 2248, 1939, 13, 12, 'Vitality, stamina and nerve tonic enriched with Safed Musli, Shilajit & Shatavari.'),
  makeProduct(3, 'AWPL-ORT-003', 'Asclepius Orthodoc Pravahi Kwath (1000ml)', 'Ayurvedic Wellness', 1980, 1650, 11, 12, 'Joint and musculoskeletal care formula with Shallaki, Nirgundi & Rasna.'),
  makeProduct(4, 'AWPL-DIA-004', 'Asclepius Diabodoc Ras (1000ml)', 'Ayurvedic Wellness', 1460, 1259, 8, 12, 'Glycemic balance herbal ras with Karela, Jamun, Gudmar & Vijaysar.'),
  makeProduct(5, 'AWPL-LIV-005', 'Asclepius Livodoc Ras (500ml)', 'Ayurvedic Wellness', 1494, 1289, 8, 12, 'Hepatoprotective liver enzyme & digestion tonic with Bhumi Amla, Kutki & Punarnava.'),
  makeProduct(6, 'AWPL-CAR-006', 'Asclepius Cardiodoc Ras (1000ml)', 'Ayurvedic Wellness', 2253, 1945, 13, 12, 'Cardiovascular wellness & lipid support ras with Arjuna Chall, Pushkarmool & Dalchini.'),
  makeProduct(7, 'AWPL-GYN-007', 'Asclepius Gynaedoc Ras (1000ml)', 'Ayurvedic Wellness', 1620, 1350, 8, 12, 'Complete women hormonal & uterine wellness ras with Ashok Chall, Lodhra & Shatavari.'),
  makeProduct(8, 'AWPL-CHL-008', 'Asclepius Chlorodoc Ras (1000ml)', 'Ayurvedic Wellness', 1740, 1450, 9, 12, 'Liquid chlorophyll detoxifier and blood purifier with Wheatgrass & Spirulina.'),
  makeProduct(9, 'AWPL-NON-009', 'Asclepius Nonidoc Juice (500ml)', 'Ayurvedic Wellness', 1380, 1150, 7, 12, 'Morinda Citrifolia (Noni) cellular wellness concentrate with Kokum & Garcinia.'),
  makeProduct(10, 'AWPL-STO-010', 'Asclepius Stonodoc Ras (1000ml)', 'Ayurvedic Wellness', 1590, 1325, 8, 12, 'Renal & urinary tract calculus flush formulation with Pashanbhed, Varuna & Gokshura.'),
  makeProduct(11, 'AWPL-ALR-011', 'Asclepius Alrgydoc Pravahi Kwath (500ml)', 'Ayurvedic Wellness', 1255, 1083, 7, 12, 'Respiratory & skin allergy defense kwath with Haridra, Shirish & Kantakari.'),
  makeProduct(12, 'AWPL-ADI-012', 'Asclepius Adidoc Pravahi Kwath (500ml)', 'Ayurvedic Wellness', 444, 383, 2, 12, 'De-addiction & liver recovery herbal formulation with Vidarikand & Brahmi.'),
  makeProduct(13, 'AWPL-PIL-013', 'Asclepius Piledoc Ras (1000ml)', 'Ayurvedic Wellness', 1420, 1185, 7, 12, 'Anorectal comfort & digestive fiber tonic with Nagkesar, Haritaki & Nishoth.'),
  makeProduct(14, 'AWPL-THY-014', 'Asclepius Thyrodoc Pravahi Kwath (500ml)', 'Ayurvedic Wellness', 1680, 1400, 9, 12, 'Thyroid gland & metabolic balance kwath with Kanchnar Guggulu & Shigru.'),
  makeProduct(15, 'AWPL-FEV-015', 'Asclepius Feverdoc Ras (500ml)', 'Ayurvedic Wellness', 980, 820, 5, 12, 'Antipyretic & seasonal viral recovery tonic with Chirayata, Giloy & Papaya Leaf.'),
  makeProduct(16, 'AWPL-COU-016', 'Asclepius Coughdoc Pravahi Kwath (500ml)', 'Ayurvedic Wellness', 650, 540, 3, 12, 'Soothing bronchial expectorant with Vasaka, Mulethi, Kantakari & Pipali.'),
  makeProduct(17, 'AWPL-KID-017', 'Asclepius Kidgdoc Ras (1000ml)', 'Ayurvedic Wellness', 1540, 1285, 8, 12, 'Nephroprotective kidney filtration tonic with Punarnava, Gokshura & Kasni.'),
  makeProduct(18, 'AWPL-NEU-018', 'Asclepius Neurodoc Ras (1000ml)', 'Ayurvedic Wellness', 2150, 1790, 11, 12, 'Cognitive & nervous system support ras with Shankhpushpi, Brahmi & Jyotishmati.'),
  makeProduct(19, 'AWPL-VIR-019', 'Asclepius Viradoc Pravahi Kwath (500ml)', 'Ayurvedic Wellness', 1480, 1235, 8, 12, 'Antiviral & respiratory defense herbal decoction with Kalmegh, Tulsi & Kutki.'),
  makeProduct(20, 'AWPL-TRI-020', 'Asclepius Triphala Ras (1000ml)', 'Ayurvedic Wellness', 590, 490, 3, 12, 'Classical Amla, Harad & Baheda digestive colon cleanser and rejuvenator.'),
  makeProduct(21, 'AWPL-ALO-021', 'Asclepius Aloe Vera Ras (1000ml)', 'Ayurvedic Wellness', 620, 515, 3, 12, 'Pure cold-pressed Aloe Barbadensis juice for gut health, liver & radiant skin.'),
  makeProduct(22, 'AWPL-GIL-022', 'Asclepius Giloy Tulsi Ras (500ml)', 'Ayurvedic Wellness', 580, 485, 3, 12, 'Daily immunity & platelet support juice with Amrita Giloy and Panch Tulsi.'),
  makeProduct(23, 'AWPL-TUL-023', 'Asclepius Panch Tulsi Drop (30ml)', 'Ayurvedic Wellness', 260, 215, 1, 12, 'Concentrated distillates of Rama, Shyama, Van, Kapoor & Vishnu Tulsi.'),
  makeProduct(24, 'AWPL-CUR-024', 'Asclepius Curcidoc Drop (30ml)', 'Ayurvedic Wellness', 420, 350, 2, 12, 'High-curcuminoid Haldi extract drops with black pepper piperine for absorption.'),
  makeProduct(25, 'AWPL-STE-025', 'Asclepius Steviadoc Drop (30ml)', 'Ayurvedic Wellness', 340, 285, 1.5, 12, 'Zero-calorie natural Stevia leaf liquid sweetener for diabetic & fitness diets.'),
  makeProduct(26, 'AWPL-SLM-026', 'Asclepius Slimdoc Powder (250g)', 'Ayurvedic Wellness', 1650, 1375, 8, 12, 'Ayurvedic fat metabolism & weight management powder with Vrikshamla & Medohar Guggulu.'),
  makeProduct(27, 'AWPL-MAS-027', 'Asclepius Massdoc Powder (500g)', 'Ayurvedic Wellness', 1590, 1325, 8, 12, 'Healthy muscle mass & weight gain supplement with Ashwagandha & Shatavari.'),
  makeProduct(28, 'AWPL-HGT-028', 'Asclepius Heightdoc Powder (250g)', 'Ayurvedic Wellness', 1480, 1230, 7, 12, 'Growth & bone mineral density herbal nutrition with Bambusa & Asthisamharaka.'),
  makeProduct(29, 'AWPL-DIG-029', 'Asclepius Digedoc Powder (200g)', 'Ayurvedic Wellness', 690, 575, 3, 12, 'Instant relief from acidity, bloating & indigestion with Jeera, Ajwain & Hing.'),
  makeProduct(30, 'AWPL-JCO-030', 'Asclepius Joint Curcumin Oil (100ml)', 'Ayurvedic Wellness', 480, 400, 2.5, 12, 'Deep-penetrating Mahanarayan & Gandhapura pain relief massage oil.'),
  makeProduct(31, 'AWPL-BRN-031', 'Asclepius Braindoc Capsule (60 Caps)', 'Ayurvedic Wellness', 960, 800, 5, 12, 'Memory, focus & stress relief capsules with Mandukaparni & Vacha.'),
  makeProduct(32, 'AWPL-VIT-032', 'Asclepius VitaDoc Multivitamin Capsule (60 Caps)', 'Ayurvedic Wellness', 890, 740, 4.5, 12, 'Natural herbal multivitamin & trace mineral complex for daily energy.'),
  makeProduct(33, 'AWPL-SHL-033', 'Asclepius Shilajit Gold Capsule (30 Caps)', 'Ayurvedic Wellness', 1350, 1125, 7, 12, 'Purified Himalayan Shilajit with Swarna Vanga & Kesar for peak vitality.'),
  makeProduct(34, 'AWPL-OMG-034', 'Asclepius OmegaDoc Flaxseed Capsule (60 Caps)', 'Ayurvedic Wellness', 1120, 935, 6, 12, 'Plant-based Omega 3-6-9 cold-pressed Alsi oil softgels for heart & joints.'),
  makeProduct(35, 'AWPL-MOR-035', 'Asclepius Moringadoc Superfood Capsule (60 Caps)', 'Ayurvedic Wellness', 780, 650, 4, 12, 'Organic Sahjan (Moringa Oleifera) leaf extract rich in iron, calcium & antioxidants.'),

  // ================= 2. ORAL CARE (3 Official Products) =================
  makeProduct(36, 'AWPL-DEN-036', 'Asclepius Dentodoc Dental Cream (100g)', 'Oral Care', 252, 210, 1, 18, 'Flagship AWPL herbal dental cream with Clove, Neem, Babool, Tomar & Vajradanti.'),
  makeProduct(37, 'AWPL-KDN-037', 'Asclepius Kids Dentodoc Gel (80g)', 'Oral Care', 195, 162, 0.75, 18, 'Fluoride-free gentle fruit-herbal dental gel for children cavity protection.'),
  makeProduct(38, 'AWPL-DMW-038', 'Asclepius Dentodoc Herbal Mouthwash (200ml)', 'Oral Care', 280, 235, 1, 18, 'Alcohol-free mint & clove anti-plaque mouth rinse for 12-hour fresh breath.'),

  // ================= 3. HAIR & PERSONAL CARE (10 Official Products) =================
  makeProduct(39, 'AWPL-HDO-039', 'Asclepius Hairdoc Herbal Hair Oil (200ml)', 'Hair & Personal Care', 229, 204, 1, 18, 'Intensive root nourishment hair oil with Bhringraj, Amla, Brahmi & Hibiscus.'),
  makeProduct(40, 'AWPL-HDS-040', 'Asclepius Hairdoc Anti-Dandruff Shampoo (200ml)', 'Hair & Personal Care', 360, 300, 1.5, 18, 'Sulphate-free herbal cleanser with Shikakai, Reetha & Tea Tree oil.'),
  makeProduct(41, 'AWPL-SCF-041', 'Sniss Herbal Charcoal Face Wash (100ml)', 'Hair & Personal Care', 357, 255, 1, 18, 'Activated bamboo charcoal deep pore anti-pollution face cleanser.'),
  makeProduct(42, 'AWPL-SVF-042', 'Sniss Vitamin C Brightening Face Wash (100ml)', 'Hair & Personal Care', 419, 299, 1, 18, 'Kakadu Plum & Orange peel Vitamin C foaming face wash for radiant glow.'),
  makeProduct(43, 'AWPL-SAO-043', 'Sniss Herbal Almond Olive Hair Oil (200ml)', 'Hair & Personal Care', 125, 89, 0.5, 18, 'Non-sticky daily conditioning hair oil enriched with Sweet Almond & Olive.'),
  makeProduct(44, 'AWPL-SPF-044', 'Sniss Papaya Blemish Facial Kit (6-Step)', 'Hair & Personal Care', 1150, 890, 5, 18, 'Professional 6-step salón facial kit with Papain enzyme & Saffron.'),
  makeProduct(45, 'AWPL-SAG-045', 'Sniss Pure Aloe Vera Skin Gel (150g)', 'Hair & Personal Care', 290, 230, 1, 18, 'Soothing multipurpose Aloe Vera & Cucumber hydrating gel for face and hair.'),
  makeProduct(46, 'AWPL-BNS-046', 'Bathveda Neem Tulsi Soap Bar (Pack of 3)', 'Hair & Personal Care', 216, 165, 0.5, 18, 'Grade-1 high-TFM antibacterial herbal bathing bar with Neem & Tulsi oil.'),
  makeProduct(47, 'AWPL-BLS-047', 'Bathveda Fresh Lime & Aloe Soap Bar (Pack of 3)', 'Hair & Personal Care', 264, 189, 0.5, 18, 'Refreshing citrus & aloe vera moisturizing family bath soap pack.'),
  makeProduct(48, 'AWPL-EHW-048', 'Exe Herbal Hand Wash Refill (500ml)', 'Hair & Personal Care', 194, 162, 0.5, 18, 'Natural Neem & Lemon germ-protection liquid hand cleanser.'),

  // ================= 4. NUTRITION & FOOD (8 Official Products) =================
  makeProduct(49, 'AWPL-SSR-049', 'Shiitake Shake Rabdi Falooda (400g)', 'Nutrition & Food', 678, 503, 2, 12, 'High-protein wellness meal shake fortified with Shiitake Mushroom & 24 vitamins.'),
  makeProduct(50, 'AWPL-EAT-050', 'Eco Arogyam Herbal Green Tea (200g)', 'Nutrition & Food', 149, 124, 0.5, 5, 'Antioxidant-rich metabolic tea blend with Dalchini, Elaichi, Saunf & Tulsi.'),
  makeProduct(51, 'AWPL-JRB-051', 'Jeeveda Physically Refined Rice Bran Oil (1L)', 'Nutrition & Food', 399, 285, 0.5, 5, '14000 ppm Oryzanol heart-healthy cooking oil for balanced cholesterol.'),
  makeProduct(52, 'AWPL-MFH-052', 'Asclepius Multiflora Raw Honey (500g)', 'Nutrition & Food', 531, 379, 1, 5, 'NMR-tested pure Himalayan multiflora forest honey with zero added sugar.'),
  makeProduct(53, 'AWPL-FDP-053', 'Asclepius Fitdoc Whey & Soy Protein Powder (500g)', 'Nutrition & Food', 1450, 1210, 7, 18, 'Complete amino acid profile protein supplement with DHA & Ashwagandha.'),
  makeProduct(54, 'AWPL-KDG-054', 'Asclepius Kidsdoc Growth Nutrition Choco (400g)', 'Nutrition & Food', 980, 815, 5, 18, 'Brain & immunity nutrition drink for growing children with Colostrum & Brahmi.'),
  makeProduct(55, 'AWPL-SBT-055', 'Asclepius Sea Buckthorn Wellness Juice (1000ml)', 'Nutrition & Food', 1560, 1300, 9, 12, 'Himalayan Ladakh Berry rich in Omega-7 and 190+ bioactive phytonutrients.'),
  makeProduct(56, 'AWPL-SPC-056', 'Jeeveda Shudh Spices Combo (Haldi, Mirch, Dhaniya, Garam Masala)', 'Nutrition & Food', 340, 275, 1, 5, 'Cold-ground cryogenically processed pure Indian kitchen spice combo.'),

  // ================= 5. VEDIC AGRI & VETERINARY (6 Official Products) =================
  makeProduct(57, 'AWPL-VAB-057', 'Vedik Agro Bhuvita Granules (4kg Bucket)', 'Vedic Agri & Veterinary', 744, 496, 2, 5, 'Organic soil conditioner & root bio-stimulant with Seaweed, Humic & Fulvic acid.'),
  makeProduct(58, 'AWPL-VEH-058', 'Vedik Agro Eco Hariyali Crop Booster (500g)', 'Vedic Agri & Veterinary', 1523, 1015, 6, 5, 'Organic yield enhancer for orchards, vegetables and cereals.'),
  makeProduct(59, 'AWPL-VPG-059', 'Vedik Agro PGPR Liquid Bio-Fertilizer (1000ml)', 'Vedic Agri & Veterinary', 1180, 890, 5, 5, 'Plant Growth Promoting Rhizobacteria for nitrogen fixation & root vigor.'),
  makeProduct(60, 'AWPL-VHM-060', 'Vedik Agro Humic 98 Shiny Flakes (500g)', 'Vedic Agri & Veterinary', 960, 720, 4, 5, '98% water-soluble potassium humate for rapid white root development.'),
  makeProduct(61, 'AWPL-VST-061', 'Vedik Agro Agrovera Silicon Spreader & Sticker (500ml)', 'Vedic Agri & Veterinary', 480, 360, 2, 12, 'Non-ionic super spreader for uniform foliar spray absorption on leaves.'),
  makeProduct(62, 'AWPL-VET-062', 'Vetdoc Cattle Milk & Calcium Supplement (1000ml)', 'Vedic Agri & Veterinary', 1250, 980, 5, 12, 'Chelated calcium, phosphorus, Shatavari & Jivanti tonic for dairy cattle.'),

  // ================= 6. HOME CARE (4 Official Products) =================
  makeProduct(63, 'AWPL-CDW-063', 'Cleanveda Herbal Dishwash Gel Lemon (500ml)', 'Home Care', 240, 190, 1, 18, 'Tough grease-cutting plant-based dishwashing liquid gentle on hands.'),
  makeProduct(64, 'AWPL-CFC-064', 'Cleanveda Pine & Neem Floor Cleaner (1000ml)', 'Home Care', 310, 245, 1, 18, '99.9% germ protection herbal surface & floor disinfectant.'),
  makeProduct(65, 'AWPL-CTC-065', 'Cleanveda Active Toilet Cleaner (500ml)', 'Home Care', 220, 175, 0.75, 18, 'Thick limescale & stain remover for sparkling hygienic washrooms.'),
  makeProduct(66, 'AWPL-CDL-066', 'Cleanveda Fabric Care Detergent Liquid (1000ml)', 'Home Care', 390, 310, 1.5, 18, 'Bio-enzyme color-safe liquid laundry detergent for machine & bucket wash.'),
];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-cf-monthly',
    name: 'C&F & Franchise Monthly All-Access',
    durationDays: 30,
    price: 699,
    billingPeriod: 'Monthly',
    targetAudience: 'cf_franchise',
    unlimitedBilling: true,
    features: [
      'UNLIMITED C&F & POS Billing (No Invoice Cap)',
      'All Features Unlocked: Online C&F Bill No & ID Sync',
      'Official AWPL DP / MRP / SP & GST Tax Billing',
      'Full Inventory, Batch & Expiry Stock Control',
      'Thermal 80mm, A4 Official Print & WhatsApp Sharing',
      '100% Amount Credited Directly to Your Bank / UPI Account'
    ],
    maxInvoicesPerMonth: 999999,
    isActive: true,
  },
  {
    id: 'plan-cf-yearly',
    name: 'C&F & Franchise Yearly All-Access (15% OFF)',
    durationDays: 365,
    price: 7130,
    originalPrice: 8388,
    discountPercent: 15,
    billingPeriod: 'Yearly',
    targetAudience: 'cf_franchise',
    unlimitedBilling: true,
    features: [
      'UNLIMITED C&F & POS Billing for 365 Days',
      '15% Yearly Discount Applied (₹699 × 12 = ₹8,388 → ₹7,130)',
      'All Features Unlocked: Complete AWPL C&F Portal Bridge',
      'Unlimited Staff Roles, PC Hotkeys & Offline Queue Sync',
      'Cloud Backup, Audit Trail & Multi-Counter Support',
      '100% Amount Credited Directly to Your Bank / UPI Account'
    ],
    maxInvoicesPerMonth: 999999,
    isActive: true,
    isPopular: true,
  },
  {
    id: 'plan-customer-monthly',
    name: 'Customer VIP Monthly Plan',
    durationDays: 30,
    price: 99,
    billingPeriod: 'Monthly',
    targetAudience: 'customer',
    unlimitedBilling: false,
    features: [
      'Exclusive Customer Monthly Plan Only (₹99 / Month)',
      'Priority Online Ordering & Solan Depot Home Delivery',
      'Verified AWPL Distributor DP Pricing & SP Points Ledger',
      'Live Online C&F Bill & ID Dispatch Status Tracking',
      'Instant Digital GST Tax Invoices & WhatsApp Alerts',
      '100% Subscription Paid Directly to D RIGHT WELLNESS Account'
    ],
    maxInvoicesPerMonth: 999999,
    isActive: true,
  }
];

export const INITIAL_USER_SUBSCRIPTIONS: UserSubscription[] = [];

export const INITIAL_CF_RECORDS: CFBillRecord[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_INVOICES: Invoice[] = [];

export const INITIAL_BANK_DEPOSITS: BankDeposit[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_STAFF_MEMBERS: StaffMember[] = [];

export const INITIAL_CNF_ACCOUNTS: FranchiseConfig[] = [];

export const INITIAL_COMPLAINTS: ComplaintReport[] = [];

export const INITIAL_PURCHASE_BILLS: PurchaseBill[] = [];

export const INITIAL_APP_FEEDBACKS: AppFeedback[] = [];

export const INITIAL_MAIN_ADMIN_CONFIG: MainAdminConfig = {
  appName: 'C&F Bill',
  mainAdminName: 'Dixit Sharma (Main App Super Admin)',
  adminEmail: 'Dixit3415d@gmail.com',
  adminPassword: '2026',
  adminSecurityPin: '2026',
  adminMasterKey: 'DRW-MASTER-KEY',
  masterApprovalCode: 'AWPL-3000',
  mainBankAccountNumber: '3029002100049182',
  mainBankIfsc: 'PUNB0302900',
  mainBankName: 'Punjab National Bank, Rabon Solan Branch',
  mainUpiId: 'drightwellness@upi',
  mainUpiNumber: '9816054321',
  cloudProviderName: 'AWPL Enterprise Cloud Vault (Managed Node + Firestore Sync)',
  cloudMonthlyFixedCostPerCnf: 49,
  cloudMonthlyFixedCostPerCustomer: 9,
  cloudCostDeductionPercent: 5,
  defaultUpiTransactionFeeEnabled: false,
  defaultUpiTransactionFeePercent: 1.5,
  globalAnnouncementBanner: 'C&F Bill Official AWPL Cloud Network — All C&F & Customer bills are backed up in real time (Max 5 PCs + 1 Mobile per C&F).',
  dynamicFeatureRules: [
    'D RIGHT WELLNESS has Permanent Infinity Stock enabled across all 66 AWPL products.',
    'All pending products for D RIGHT WELLNESS will be given only upon presenting the original bill.',
    'Unregistered customer mobile numbers automatically receive a Customer App Download QR on printed bills.',
    'Main App cannot access another C&F portal without explicit privacy permission granted by that C&F.'
  ],
  lastGeminiUpdateAt: '2026-10-25 10:00',
};





