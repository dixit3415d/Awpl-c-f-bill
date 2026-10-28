# D RIGHT WELLNESS — AWPL FRANCHISE BILLING, INVENTORY & C&F HUB
**Authorized Franchise of Asclepius Wellness Private Limited (AWPL)**  
**Location:** Near PNB Bank, Rabon, Solan, Himachal Pradesh - 173211, India  
**Currency:** Indian Rupee (INR ₹)  
**System Architecture:** Production Web & Android-Compatible Progressive Web Application (PWA)

---

## 1. Executive Summary & Capabilities

**D RIGHT WELLNESS** is a unified, enterprise-grade franchise operations platform custom-built for Asclepius Wellness Private Limited (AWPL) business operations. The application coordinates all retail and distributor workflows:

1. **AWPL Product Database & Master Synchronization**:
   - Master catalog with authentic categories: *Ayurvedic Wellness, Oral Care, Hair & Personal Care, Nutrition & Food, Vedic Agri & Veterinary, Home Care*.
   - Rigorous three-tier price and points tracking: **MRP** (Maximum Retail Price), **DP** (Distributor Price), and **SP** (Sale Points).
   - "Sync AWPL Products" trigger with automated price discrepancy detection, audit logger, and full price history.
   - Dual import/export engine supporting CSV/Excel backups and manual administrator corrections.

2. **Advanced Fast POS Billing & Invoicing**:
   - Touchscreen-optimized interface tailored for Android mobile phones, tablets, and desktop computers.
   - Laser camera barcode scanner simulator + external physical USB/Bluetooth handheld barcode gun support.
   - Strict Indian Financial Year invoice sequencing: `DRW/YYYY-YYYY/####` (e.g. `DRW/2026-2027/1001`), resetting automatically on April 1st.
   - Dynamic price switching: DP mode for verified AWPL distributors vs MRP for retail walk-in customers.
   - Automated tax computations (CGST/SGST), custom discount %, and total SP point tallying.
   - Dual print formats: **A4 GST Tax Invoice** and **80mm / 58mm Thermal Receipt**.
   - Instant WhatsApp sharing with one-click preformatted invoice text and payment link.
   - Dynamic UPI payment QR generation (`upi://pay?pa=...`).

3. **AWPL C&F Portal Integration**:
   - Dedicated C&F Solan Depot bridge for tracking customer orders pending at regional supply depots.
   - 2-factor OTP verification for customer identity before accessing pending orders.
   - C&F Assistance ticket workflow with audit trails and depot manifest CSV exports.
   - Safeguards: Never fabricates unauthorized API responses; uses verified semi-automated compliance manifests when official direct API is restricted.

4. **Customer Registration & Self-Ordering**:
   - Mobile + OTP registration distinguishing app accounts from official AWPL membership.
   - Store pickup at Rabon, Solan or local Solan home delivery.
   - Customer-isolated privacy: Customers can only access their own invoices and accumulated SP points.

5. **Paid App Subscription & Multi-Tenant SaaS Engine**:
   - Built-in plans: *14 Days Free Trial, Franchise Monthly Pro (₹499), Franchise Quarterly (₹1,299), All-India Annual (₹4,499)*.
   - Razorpay & UPI QR simulated payment gateway with automatic license key generation.
   - Strategic toggle: **Single Store (Solan Only)** vs **All-India SaaS Platform** (for selling subscriptions to other AWPL franchisees across Himachal & India).

6. **Inventory & Warehouse Management**:
   - Stock inward tracking from Solan C&F Depot, sales reconciliation, customer returns, and damage/expiry write-offs.
   - Batch number & expiration date tracking with low-stock alerts.
   - Real-time stock valuation calculated both at DP procurement cost and MRP retail revenue.

7. **Offline Mode & Data Security**:
   - LocalStorage & IndexedDB offline caching with service worker (`sw.js`).
   - Seamless offline billing with transaction queue and automatic conflict detection on reconnection.
   - Permanent immutable audit log for all critical actions (invoice cancellations, inventory adjustments, price edits).
   - One-click full JSON database backup export and disaster recovery restoration.

---

## 2. Production Database Schema (PostgreSQL / Relational)

For deployment with PostgreSQL or Supabase:

```sql
-- 1. Franchise Configuration
CREATE TABLE franchise_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_name VARCHAR(150) NOT NULL DEFAULT 'D RIGHT WELLNESS',
  franchise_code VARCHAR(50) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  gstin VARCHAR(20) NOT NULL,
  bank_upi_id VARCHAR(50) NOT NULL,
  current_financial_year VARCHAR(15) NOT NULL DEFAULT '2026-2027',
  invoice_sequence INT NOT NULL DEFAULT 1000,
  multi_franchise_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AWPL Products Catalog
CREATE TABLE awpl_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  mrp NUMERIC(10, 2) NOT NULL,
  dp NUMERIC(10, 2) NOT NULL,
  sp INT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  batch_number VARCHAR(50) NOT NULL,
  expiry_date DATE NOT NULL,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 12,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  barcode VARCHAR(50) NOT NULL,
  description TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'Official AWPL Sync',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(150) NOT NULL,
  customer_mobile VARCHAR(20) NOT NULL,
  customer_awpl_id VARCHAR(50),
  subtotal NUMERIC(10, 2) NOT NULL,
  discount_total NUMERIC(10, 2) DEFAULT 0,
  tax_total NUMERIC(10, 2) DEFAULT 0,
  grand_total NUMERIC(10, 2) NOT NULL,
  total_sp INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(30) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'paid',
  staff_name VARCHAR(100) NOT NULL,
  is_offline_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT
);

-- 4. Invoice Line Items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES awpl_products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  price_type VARCHAR(10) NOT NULL, -- 'dp' or 'mrp'
  sp_earned INT NOT NULL,
  line_total NUMERIC(10, 2) NOT NULL
);

-- 5. C&F Depot Assistance Records
CREATE TABLE cf_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no VARCHAR(50) NOT NULL UNIQUE,
  awpl_customer_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_mobile VARCHAR(20) NOT NULL,
  items_summary TEXT NOT NULL,
  total_sp INT NOT NULL,
  pending_amount NUMERIC(10, 2) NOT NULL,
  cf_branch VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Verification',
  otp_verified BOOLEAN DEFAULT FALSE,
  customer_remarks TEXT,
  admin_resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  user_identifier VARCHAR(150) NOT NULL,
  details TEXT NOT NULL
);
```

---

## 3. PWA Installation on Android & iOS

### Android Phones / Tablets:
1. Open the web application URL in Google Chrome on your Android phone.
2. Tap the **"Install Android App"** button in the header bar, or open the browser menu (3 dots) and select **"Add to Home screen"**.
3. The app installs as a native Android APK wrapper with offline support, full-screen viewport, and direct camera access for barcode scanning.

### iOS (iPhone / iPad):
1. Open the application in Safari.
2. Tap the **Share** button in Safari's bottom toolbar.
3. Tap **"Add to Home Screen"** and confirm.
