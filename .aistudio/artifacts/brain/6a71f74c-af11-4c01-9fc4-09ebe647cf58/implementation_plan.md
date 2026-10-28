# WhatsApp Business (`8988311142`) OTP & Auto-Credential Dispatch Plan

## 1. Objective & Scope
Integrate the official WhatsApp Business sender number **`8988311142` (`+91 8988311142`)** for all user accounts (**C&F Owners, Counter Staff, and Customers**) to support:
1. **Registration OTP via WhatsApp Business (`8988311142`)**: When a user registers (C&F Owner, C&F Staff, or Customer), a 6-digit OTP is generated and dispatched from WhatsApp Business number `+91 8988311142` to the user's mobile number via the server WhatsApp API plus an instant WhatsApp message trigger.
2. **Automatic Post-Registration Username & Password/PIN Dispatch to WhatsApp**: Immediately after registration is completed and verified, the system automatically dispatches the user's **Username** and **Password (4-Digit PIN)** from `+91 8988311142` to the user's registered WhatsApp mobile number (both via the server WhatsApp API and automatic WhatsApp message trigger).
3. **Forgot Username & Password Recovery via WhatsApp (`8988311142`)**: When any user forgets their Username or Password/PIN, they enter their registered mobile number (or email), receive a 6-digit verification OTP from WhatsApp Business `+91 8988311142`, and immediately upon verifying the OTP, their **existing Username and Password (4-Digit PIN)** are automatically sent directly to their WhatsApp number without requiring a password reset.

---

## 2. Server-Side WhatsApp Business (`8988311142`) API (`/server.ts`)
- Define official sender constant `OFFICIAL_WHATSAPP_BUSINESS_NUMBER = '8988311142'` (`+91 8988311142`).
- Add **`POST /api/whatsapp/send-otp`**:
  - Accepts `recipientMobile`, `recipientName`, `purpose` (`'registration'` | `'forgot_credentials'`), and `roleLabel`.
  - Generates and stores a 6-digit OTP in the server state (with a 10-minute expiry window), dispatches via configured WhatsApp Business Cloud API / webhook from `+91 8988311142`, and returns the formatted WhatsApp deep-link (`https://wa.me/91<recipientMobile>?text=...`) and OTP verification payload.
- Add **`POST /api/whatsapp/verify-otp`**:
  - Validates the 6-digit OTP for the target mobile number.
- Add **`POST /api/whatsapp/send-credentials`**:
  - Accepts `recipientMobile`, `recipientName`, `roleLabel`, `usernameType`, `usernameValue`, `pinPassword`, `portalLink`, and `reason` (`'post_registration'` | `'forgot_credentials_recovery'`).
  - Logs the dispatch from official WhatsApp Business sender `+91 8988311142`, triggers any configured WhatsApp Business Cloud API / webhook, and returns the ready-to-send WhatsApp message URL (`https://wa.me/91<recipientMobile>?text=...`) containing the user's exact Username and Password/PIN.

---

## 3. Client-Side Registration & Recovery Flows (`/src/components/PortalAuthGateway.tsx` & `/src/utils/storage.ts`)
- **Shared WhatsApp Helper Utilities (`/src/utils/storage.ts`)**:
  - Export `WHATSAPP_BUSINESS_OTP_SENDER = '8988311142'` and `WHATSAPP_BUSINESS_OTP_SENDER_DISPLAY = '+91 8988311142'`.
  - Add helper functions `dispatchWhatsAppOtpFrom8988311142(...)` and `dispatchCredentialsToUserWhatsApp(...)` that call the `/api/whatsapp/*` endpoints and build the direct WhatsApp chat trigger link to the user's mobile number.
- **Registration Flow Updates (C&F Owner, C&F Staff, Customer)**:
  - Display the official WhatsApp Business sender badge (`WhatsApp Business OTP Sender: +91 8988311142`) in Step 1 & Step 2 of registration.
  - When Step 1 ("Send 6-Digit OTP") is clicked, call `/api/whatsapp/send-otp` from `8988311142` to the user's mobile number and provide a 1-click/instant WhatsApp OTP delivery trigger.
  - Immediately upon completing registration (Step 3), automatically call `/api/whatsapp/send-credentials` from `8988311142` and trigger the WhatsApp message containing the user's **Login Username** and **Password (4-Digit PIN)** directly to their registered WhatsApp number, while also showing the confirmation modal with a direct "Send Username & Password to WhatsApp (+91 ...)" button.
- **"Forgot Username & Password" Direct WhatsApp Recovery Flow**:
  - Add a dedicated **"Forgot Username & Password (Send to WhatsApp)"** mode inside the Login & Recovery screens (accessible via a prominent `"Forgot Username or Password? Get on WhatsApp"` button directly below the Login button for C&F Owner, C&F Staff, and Customer).
  - **Step 1**: User enters their registered 10-digit WhatsApp Mobile Number (or Email ID for C&F Owner, which resolves their registered mobile number) and clicks **"Send 6-Digit OTP from WhatsApp Business (+91 8988311142)"**.
  - **Step 2**: User enters the 6-digit OTP received from `8988311142`.
  - **Step 3 (Immediate Credential Delivery on OTP Verification)**: Right after OTP verification succeeds, the app looks up the user's existing **Username** and **Password (4-Digit PIN)**, dispatches them via `/api/whatsapp/send-credentials` from `+91 8988311142`, and immediately triggers the WhatsApp message to the user's WhatsApp number containing their exact Username, Password/PIN, and Direct Login Link.
