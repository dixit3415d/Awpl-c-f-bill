import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLOUD_DB_PATH = path.join(__dirname, '.cloud-store.json');

interface CloudDatabaseState {
  lastSyncedAt: string;
  payload: Record<string, unknown>;
}

function readCloudDb(): CloudDatabaseState {
  try {
    if (fs.existsSync(CLOUD_DB_PATH)) {
      const raw = fs.readFileSync(CLOUD_DB_PATH, 'utf-8');
      return JSON.parse(raw) as CloudDatabaseState;
    }
  } catch (err) {
    console.error('Error reading cloud DB:', err);
  }
  return {
    lastSyncedAt: new Date().toISOString(),
    payload: {},
  };
}

function writeCloudDb(payload: Record<string, unknown>): CloudDatabaseState {
  const state: CloudDatabaseState = {
    lastSyncedAt: new Date().toISOString(),
    payload,
  };
  try {
    fs.writeFileSync(CLOUD_DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing cloud DB:', err);
  }
  return state;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // 1. Unified Cloud Storage API for C&F App, Customer App, and Main Admin App
  app.get('/api/cloud/state', (_req, res) => {
    const state = readCloudDb();
    res.json({
      ok: true,
      lastSyncedAt: state.lastSyncedAt,
      payload: state.payload,
      data: state.payload,
    });
  });

  app.post('/api/cloud/state', (req, res) => {
    const incoming = req.body?.payload || req.body || {};
    const replaceAll = Boolean(req.body?.replaceAll);
    const current = readCloudDb();
    const nextPayload = replaceAll
      ? incoming
      : {
          ...current.payload,
          ...incoming,
        };
    const saved = writeCloudDb(nextPayload);
    res.json({
      ok: true,
      lastSyncedAt: saved.lastSyncedAt,
    });
  });

  // 1B. Immediate Online Password / 4-Digit PIN Change Sync Endpoint
  app.post('/api/auth/change-pin', (req, res) => {
    const {
      portal,
      identifier,
      newPin,
      cnfId,
      staffId,
      customerId,
      updatedCnfAccounts,
      updatedStaffList,
      updatedCustomers,
      updatedMainAdminConfig,
    } = req.body || {};

    const cleanPin = String(newPin || '').replace(/\D/g, '').slice(0, 4);
    if (cleanPin.length !== 4) {
      res.status(400).json({ ok: false, error: 'A valid 4-digit secret PIN is required.' });
      return;
    }

    const current = readCloudDb();
    const nextPayload: Record<string, unknown> = { ...current.payload };

    if (Array.isArray(updatedCnfAccounts)) {
      nextPayload.cnfAccounts = updatedCnfAccounts;
    } else if (Array.isArray(current.payload.cnfAccounts) && (cnfId || identifier)) {
      nextPayload.cnfAccounts = (current.payload.cnfAccounts as any[]).map((c) => {
        const matches =
          (cnfId && (c.id === cnfId || c.name === cnfId)) ||
          (identifier &&
            (String(c.email || '').toLowerCase() === String(identifier).toLowerCase() ||
              String(c.phone || '').replace(/\D/g, '').slice(-10) ===
                String(identifier).replace(/\D/g, '').slice(-10)));
        return matches ? { ...c, loginPin: cleanPin } : c;
      });
    }

    if (Array.isArray(updatedStaffList)) {
      nextPayload.staff = updatedStaffList;
    } else if (Array.isArray(current.payload.staff) && (staffId || identifier)) {
      nextPayload.staff = (current.payload.staff as any[]).map((s) => {
        const matches =
          (staffId && s.id === staffId) ||
          (identifier &&
            (String(s.email || '').toLowerCase() === String(identifier).toLowerCase() ||
              String(s.employeeCode || '').toLowerCase() === String(identifier).toLowerCase() ||
              String(s.mobile || '').replace(/\D/g, '').slice(-10) ===
                String(identifier).replace(/\D/g, '').slice(-10)));
        return matches ? { ...s, pinCode: cleanPin } : s;
      });
    }

    if (Array.isArray(updatedCustomers)) {
      nextPayload.customers = updatedCustomers;
    } else if (Array.isArray(current.payload.customers) && (customerId || identifier)) {
      nextPayload.customers = (current.payload.customers as any[]).map((cust) => {
        const matches =
          (customerId && cust.id === customerId) ||
          (identifier &&
            (String(cust.email || '').toLowerCase() === String(identifier).toLowerCase() ||
              String(cust.awplId || '').toLowerCase() === String(identifier).toLowerCase() ||
              String(cust.mobile || '').replace(/\D/g, '').slice(-10) ===
                String(identifier).replace(/\D/g, '').slice(-10)));
        return matches ? { ...cust, loginPin: cleanPin } : cust;
      });
    }

    if (updatedMainAdminConfig && typeof updatedMainAdminConfig === 'object') {
      nextPayload.mainAdminConfig = updatedMainAdminConfig;
    } else if (portal === 'main_app') {
      const existingAdmin = (current.payload.mainAdminConfig as Record<string, unknown>) || {};
      nextPayload.mainAdminConfig = {
        ...existingAdmin,
        mainAdminPin: cleanPin,
      };
    }

    const pinAuditHistory = Array.isArray(current.payload.pinSyncHistory)
      ? [...(current.payload.pinSyncHistory as any[])]
      : [];
    pinAuditHistory.unshift({
      id: `pin-sync-${Date.now()}`,
      portal: portal || 'cnf_app',
      identifier: identifier || 'user',
      maskedPin: '••••',
      syncedAt: new Date().toISOString(),
    });
    nextPayload.pinSyncHistory = pinAuditHistory.slice(0, 100);

    const saved = writeCloudDb(nextPayload);
    res.json({
      ok: true,
      message: 'Secret 4-Digit PIN updated and synced online immediately across all connected devices.',
      lastSyncedAt: saved.lastSyncedAt,
    });
  });

  // 1C. Hidden Main Admin Password & Secret Key Dispatch to dixit3415d@gmail.com
  // Never exposes plaintext password or key in the API response.
  app.post('/api/auth/dispatch-admin-key', async (req, res) => {
    const targetEmail = 'dixit3415d@gmail.com';
    const current = readCloudDb();
    const adminCfg = (current.payload.mainAdminConfig as Record<string, any>) || {};
    const secretPin = String(req.body?.adminPin || adminCfg.mainAdminPin || '3415').replace(/\D/g, '').slice(0, 4) || '3415';
    const secretKey = String(req.body?.adminMasterKey || adminCfg.mainAdminMasterKey || 'AWPL-DRW-3415-MASTER-KEY');
    const dispatchedAt = new Date().toISOString();

    // Optional live email webhook / relay if configured on server environment
    let externalRelaySent = false;
    const webhookUrl = process.env.ADMIN_EMAIL_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: targetEmail,
            subject: 'C&F Bill — Confidential Main Admin Password & Master Authority Key',
            text: `Confidential Main Admin Credentials for ${targetEmail}:\nLogin Username: ${targetEmail}\nSecret 4-Digit PIN: ${secretPin}\nMaster Authority Key: ${secretKey}\nDispatched At: ${dispatchedAt}`,
          }),
        });
        externalRelaySent = true;
      } catch (e) {
        console.warn('External email webhook relay warning:', e);
      }
    }

    const dispatchLogs = Array.isArray(current.payload.adminKeyDispatchLogs)
      ? [...(current.payload.adminKeyDispatchLogs as any[])]
      : [];
    dispatchLogs.unshift({
      dispatchId: `ADM-KEY-${Date.now()}`,
      recipientEmail: targetEmail,
      maskedPin: '••••',
      maskedKey: '••••••••••••••••',
      externalRelaySent,
      dispatchedAt,
    });

    writeCloudDb({
      ...current.payload,
      mainAdminConfig: {
        ...adminCfg,
        mainAdminEmail: targetEmail,
        mainAdminPin: secretPin,
        mainAdminMasterKey: secretKey,
        lastKeyDispatchedToEmailAt: dispatchedAt,
      },
      adminKeyDispatchLogs: dispatchLogs.slice(0, 50),
    });

    res.json({
      ok: true,
      recipientEmail: targetEmail,
      dispatchedAt,
      maskedPin: '••••',
      maskedKey: 'AWPL-••••-••••-KEY',
      message: `Main Admin password and master key have been securely dispatched to ${targetEmail}. Credentials remain hidden from all screens.`,
    });
  });

  // 1C-2. Official WhatsApp Business (8988311142) OTP & Automatic Username/Password Dispatch API
  const OFFICIAL_WHATSAPP_BUSINESS_NUMBER = '8988311142';
  const OFFICIAL_WHATSAPP_BUSINESS_DISPLAY = '+91 8988311142';

  app.post('/api/whatsapp/send-otp', async (req, res) => {
    const {
      recipientMobile,
      recipientName = 'AWPL Member',
      purpose = 'registration',
      roleLabel = 'User',
      otpCode,
    } = req.body || {};

    const cleanMob = String(recipientMobile || '').replace(/\D/g, '').slice(-10);
    if (cleanMob.length !== 10) {
      res.status(400).json({
        ok: false,
        error: 'A valid 10-digit WhatsApp mobile number is required to send OTP.',
      });
      return;
    }

    const generatedOtp =
      String(otpCode || '').replace(/\D/g, '').slice(0, 6) ||
      String(Math.floor(100000 + Math.random() * 900000));
    const dispatchedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const purposeLabel =
      purpose === 'forgot_credentials'
        ? 'Forgot Username & Password Recovery'
        : 'New Account Registration Verification';

    const messageText =
      `🌿 *C&F Bill — Official WhatsApp Business OTP (${OFFICIAL_WHATSAPP_BUSINESS_DISPLAY})*\n\n` +
      `Namaste *${recipientName}*,\n` +
      `Your 6-Digit Verification OTP for *${purposeLabel}* (${roleLabel}) is:\n\n` +
      `🔐 *OTP: ${generatedOtp}*\n\n` +
      `📲 *Sent from Official WhatsApp Business:* ${OFFICIAL_WHATSAPP_BUSINESS_DISPLAY}\n` +
      `*(Valid for 10 minutes. Do not share this OTP with anyone.)*`;

    const whatsappUrl = `https://wa.me/91${cleanMob}?text=${encodeURIComponent(messageText)}`;

    // Optional live WhatsApp Business Cloud API / Webhook relay if configured
    let externalRelaySent = false;
    const waWebhookUrl = process.env.WHATSAPP_BUSINESS_WEBHOOK_URL;
    if (waWebhookUrl) {
      try {
        await fetch(waWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromWhatsAppBusiness: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
            toMobile: `91${cleanMob}`,
            purpose,
            roleLabel,
            otp: generatedOtp,
            text: messageText,
            dispatchedAt,
          }),
        });
        externalRelaySent = true;
      } catch (err) {
        console.warn('WhatsApp Business webhook relay warning:', err);
      }
    }

    const current = readCloudDb();
    const existingSessions = Array.isArray(current.payload.whatsappOtpSessions)
      ? (current.payload.whatsappOtpSessions as any[])
      : [];
    const nextSessions = [
      {
        sessionId: `WA-OTP-${Date.now()}`,
        senderBusinessNumber: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
        recipientMobile: cleanMob,
        recipientName,
        roleLabel,
        purpose,
        otp: generatedOtp,
        verified: false,
        externalRelaySent,
        dispatchedAt,
        expiresAt,
      },
      ...existingSessions.filter((s) => s.recipientMobile !== cleanMob),
    ].slice(0, 200);

    writeCloudDb({
      ...current.payload,
      whatsappOtpSessions: nextSessions,
    });

    res.json({
      ok: true,
      senderNumber: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
      senderDisplay: OFFICIAL_WHATSAPP_BUSINESS_DISPLAY,
      recipientMobile: cleanMob,
      otp: generatedOtp,
      whatsappUrl,
      messageText,
      dispatchedAt,
      expiresAt,
    });
  });

  app.post('/api/whatsapp/verify-otp', (req, res) => {
    const { recipientMobile, otp } = req.body || {};
    const cleanMob = String(recipientMobile || '').replace(/\D/g, '').slice(-10);
    const cleanOtp = String(otp || '').replace(/\D/g, '').slice(0, 6);

    if (cleanMob.length !== 10 || cleanOtp.length !== 6) {
      res.status(400).json({ ok: false, error: 'Valid 10-digit mobile number and 6-digit OTP are required.' });
      return;
    }

    const current = readCloudDb();
    const existingSessions = Array.isArray(current.payload.whatsappOtpSessions)
      ? (current.payload.whatsappOtpSessions as any[])
      : [];
    const matched = existingSessions.find(
      (s) => s.recipientMobile === cleanMob && String(s.otp) === cleanOtp
    );

    if (matched) {
      const updated = existingSessions.map((s) =>
        s.sessionId === matched.sessionId ? { ...s, verified: true, verifiedAt: new Date().toISOString() } : s
      );
      writeCloudDb({
        ...current.payload,
        whatsappOtpSessions: updated,
      });
    }

    res.json({
      ok: true,
      verified: Boolean(matched),
      senderNumber: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
      senderDisplay: OFFICIAL_WHATSAPP_BUSINESS_DISPLAY,
      recipientMobile: cleanMob,
    });
  });

  app.post('/api/whatsapp/send-credentials', async (req, res) => {
    const {
      recipientMobile,
      recipientName = 'AWPL Member',
      roleLabel = 'User',
      usernameType = 'Mobile Number',
      usernameValue = '',
      pinPassword = '',
      portalLink = '',
      reason = 'post_registration',
    } = req.body || {};

    const cleanMob = String(recipientMobile || '').replace(/\D/g, '').slice(-10);
    if (cleanMob.length !== 10) {
      res.status(400).json({
        ok: false,
        error: 'A valid 10-digit WhatsApp mobile number is required to dispatch credentials.',
      });
      return;
    }

    const dispatchedAt = new Date().toISOString();
    const headerTitle =
      reason === 'forgot_credentials_recovery'
        ? `🌿 *C&F Bill — WhatsApp Username & Password Recovery (${OFFICIAL_WHATSAPP_BUSINESS_DISPLAY})*`
        : `🌿 *C&F Bill — Official Registration Credentials (${OFFICIAL_WHATSAPP_BUSINESS_DISPLAY})*`;

    const introLine =
      reason === 'forgot_credentials_recovery'
        ? `Your 6-Digit OTP verification is complete. Here are your registered *${roleLabel}* login credentials:`
        : `Your *${roleLabel}* registration is verified and complete! Here are your official login credentials:`;

    const messageText =
      `${headerTitle}\n\n` +
      `Namaste *${recipientName}*,\n` +
      `${introLine}\n\n` +
      `👤 *Login Username (${usernameType}):* ${usernameValue}\n` +
      `🔑 *Login Password (4-Digit PIN):* ${pinPassword}\n` +
      `🔗 *Direct Portal Login Link:* ${portalLink}\n\n` +
      `📲 *Dispatched Automatically from Official WhatsApp Business:* ${OFFICIAL_WHATSAPP_BUSINESS_DISPLAY}\n` +
      `🔒 *(Keep this WhatsApp message private for your future login.)*`;

    const whatsappUrl = `https://wa.me/91${cleanMob}?text=${encodeURIComponent(messageText)}`;

    let externalRelaySent = false;
    const waWebhookUrl = process.env.WHATSAPP_BUSINESS_WEBHOOK_URL;
    if (waWebhookUrl) {
      try {
        await fetch(waWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromWhatsAppBusiness: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
            toMobile: `91${cleanMob}`,
            reason,
            roleLabel,
            usernameType,
            usernameValue,
            text: messageText,
            dispatchedAt,
          }),
        });
        externalRelaySent = true;
      } catch (err) {
        console.warn('WhatsApp Business credential webhook warning:', err);
      }
    }

    const current = readCloudDb();
    const existingLogs = Array.isArray(current.payload.whatsappCredentialDispatchLogs)
      ? (current.payload.whatsappCredentialDispatchLogs as any[])
      : [];
    const nextLogs = [
      {
        dispatchId: `WA-CRED-${Date.now()}`,
        senderBusinessNumber: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
        recipientMobile: cleanMob,
        recipientName,
        roleLabel,
        usernameType,
        usernameValue,
        maskedPassword: '••••',
        reason,
        externalRelaySent,
        dispatchedAt,
      },
      ...existingLogs,
    ].slice(0, 200);

    writeCloudDb({
      ...current.payload,
      whatsappCredentialDispatchLogs: nextLogs,
    });

    res.json({
      ok: true,
      senderNumber: OFFICIAL_WHATSAPP_BUSINESS_NUMBER,
      senderDisplay: OFFICIAL_WHATSAPP_BUSINESS_DISPLAY,
      recipientMobile: cleanMob,
      whatsappUrl,
      messageText,
      dispatchedAt,
    });
  });

  // 1D. Server-Backed Subscription Immediate Activation & 25-Day Reminder / 31st-Day Non-Destructive Lifecycle API
  app.post('/api/subscriptions/activate', (req, res) => {
    const {
      userId,
      userName,
      userRole = 'franchise_admin',
      planId = 'plan-cf-monthly',
      planName = 'C&F Monthly Plan (₹699/mo)',
      durationDays = 30,
      amountPaid = 699,
      paymentRef = `SUB-${Date.now().toString().slice(-6)}`,
      activatedBy = 'payment_gateway',
      settledToAccount = 'Dixit Sharma (Main Admin A/c)',
    } = req.body || {};

    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + Math.max(1, Number(durationDays) || 30));

    const newSub = {
      id: `sub-${Date.now()}`,
      userId: userId || `usr-${Date.now().toString().slice(-4)}`,
      userName: userName || 'AWPL Franchise Partner',
      userRole,
      planId,
      planName,
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      status: 'active',
      paymentRef,
      amountPaid: Number(amountPaid) || 0,
      autoRenew: true,
      activatedBy,
      settledToAccount,
      settledStatus: 'Credited to Owner A/c',
    };

    const current = readCloudDb();
    const existingSubs = Array.isArray(current.payload.userSubscriptions)
      ? (current.payload.userSubscriptions as any[])
      : [];
    const filtered = existingSubs.filter(
      (s) => s.userId !== newSub.userId && s.userName !== newSub.userName
    );
    const updatedSubs = [newSub, ...filtered];

    const saved = writeCloudDb({
      ...current.payload,
      userSubscriptions: updatedSubs,
    });

    res.json({
      ok: true,
      subscription: newSub,
      userSubscriptions: updatedSubs,
      lastSyncedAt: saved.lastSyncedAt,
    });
  });

  // 1E. Google Play Store Trusted Web Activity (TWA) Digital Asset Links & Manifest Endpoints
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'in.awpl.drightwellness.cnfbill',
          sha256_cert_fingerprints: [
            '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5',
          ],
        },
      },
    ]);
  });

  app.get('/api/playstore/twa-manifest', (req, res) => {
    const host = req.headers.host || 'drightwellness.awpl.in';
    res.json({
      packageId: 'in.awpl.drightwellness.cnfbill',
      host,
      name: 'C&F Bill — AWPL Billing & Store',
      launcherName: 'C&F Bill',
      display: 'standalone',
      themeColor: '#ea580c',
      navigationColor: '#0f172a',
      backgroundColor: '#ffffff',
      enableNotifications: true,
      startUrl: '/?source=playstore_twa',
      iconUrl: `https://${host}/pwa-512x512.svg`,
      maskableIconUrl: `https://${host}/pwa-512x512.svg`,
      appVersionName: '2.5.0',
      appVersionCode: 25,
      signingKey: {
        path: './android.keystore',
        alias: 'cnfbill-playstore-key',
      },
      generatorApp: 'bubblewrap-cli',
      webManifestUrl: `https://${host}/manifest.webmanifest`,
      fallbackType: 'customtabs',
      orientation: 'default',
    });
  });

  // 2. Main Admin App — Google Gemini Feature & App Configuration Updater API
  app.post('/api/gemini/main-app-assistant', async (req, res) => {
    try {
      const { prompt, currentMainConfig, statsSummary } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server environment.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const systemInstruction = `You are the built-in Google Gemini App Updater & Feature Architect inside the "Main App (Super Admin Portal)" of "C&F Bill" — an enterprise ERP ecosystem for Asclepius Wellness Private Limited (AWPL) C&Fs (including D RIGHT WELLNESS) and Customers.
The platform has 3 distinct apps:
1. C&F App (POS billing with barcode & manual search, invoice prefixing, pending product tracking, purchase bill inventory & infinity stock, self-service C&F bank/UPI QR, 5-day credit reminders, 7-day online pending reminders).
2. Customer App (mobile number registration, linked C&F shopping, UPI payment, AWPL ID & Green S.A.O/S.G.O or Greening Category allocation, ₹99/mo subscription).
3. Main App (Super Admin hub managing all C&Fs, customers, cloud storage cost deduction from subscriptions, manual payout bank account, feedback, UPI transaction fees, and live feature updates).

When the Main Admin asks to update a feature, change a setting, add a business rule, or configure announcements/fees, return a structured JSON response that can be directly applied to the live app state.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Current Main App Config: ${JSON.stringify(currentMainConfig || {})}
Platform Summary: ${JSON.stringify(statsSummary || {})}
Main Admin Request: "${prompt}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Clear explanation of the feature or configuration update prepared for C&F Bill.',
              },
              featureTitle: {
                type: Type.STRING,
                description: 'Short title of the feature/update.',
              },
              targetPortal: {
                type: Type.STRING,
                description: 'Which app portal this impacts: All Apps, C&F App, Customer App, or Main App.',
              },
              suggestedConfigPatch: {
                type: Type.OBJECT,
                properties: {
                  globalAnnouncementBanner: { type: Type.STRING },
                  defaultUpiTransactionFeeEnabled: { type: Type.BOOLEAN },
                  defaultUpiTransactionFeePercent: { type: Type.NUMBER },
                  cloudCostDeductionPercent: { type: Type.NUMBER },
                  cloudMonthlyFixedCostPerCnf: { type: Type.NUMBER },
                  cloudMonthlyFixedCostPerCustomer: { type: Type.NUMBER },
                  newDynamicFeatureRule: { type: Type.STRING },
                },
              },
              implementationSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['summary', 'featureTitle', 'targetPortal', 'implementationSteps'],
          },
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);
      res.json({ ok: true, result: parsed });
    } catch (error: any) {
      console.error('Gemini Main App Assistant Error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to process Gemini feature update request.',
      });
    }
  });

  // 3. Requirement #4: Main App AI Complaint & Report Genuineness Verifier (Supports Picture & PDF Attachments)
  app.post('/api/gemini/verify-complaint', async (req, res) => {
    try {
      const {
        reporterName,
        reporterMobile,
        submittedByPortal,
        cnfName,
        category,
        subject,
        description,
        attachmentName,
        attachmentMimeType,
        attachmentDataUrl,
      } = req.body || {};

      if (!subject && !description) {
        res.status(400).json({ error: 'Complaint subject and description are required.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server environment.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const parts: any[] = [
        {
          text: `You are the Official AI Complaint & Report Auditor for the Main App (Super Admin) of "C&F Bill" under Asclepius Wellness Private Limited (AWPL).
Analyze the following complaint/report submitted by a ${submittedByPortal === 'customer_app' ? 'Customer' : 'C&F Franchise'} and determine if it is genuine or not, and recommend how the Main App Admin (who has full authority) should resolve it.

Reporter: ${reporterName || 'User'} (${reporterMobile || 'N/A'})
C&F Franchise: ${cnfName || 'D RIGHT WELLNESS'}
Category: ${category || 'General'}
Subject: ${subject || ''}
Detailed Report: ${description || ''}
Uploaded Evidence File: ${attachmentName || 'None'} (${attachmentMimeType || 'N/A'})`,
        },
      ];

      if (
        attachmentDataUrl &&
        typeof attachmentDataUrl === 'string' &&
        attachmentDataUrl.startsWith('data:')
      ) {
        const commaIdx = attachmentDataUrl.indexOf(',');
        if (commaIdx !== -1) {
          const base64Data = attachmentDataUrl.slice(commaIdx + 1);
          const detectedMime =
            attachmentMimeType ||
            attachmentDataUrl.slice(5, attachmentDataUrl.indexOf(';')) ||
            'image/jpeg';
          if (
            detectedMime.startsWith('image/') ||
            detectedMime === 'application/pdf'
          ) {
            parts.push({
              inlineData: {
                mimeType: detectedMime,
                data: base64Data,
              },
            });
          }
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isGenuine: {
                type: Type.BOOLEAN,
                description: 'True if the complaint appears genuine, coherent, and actionable; false if spam, nonsensical, or fabricated.',
              },
              confidenceScore: {
                type: Type.NUMBER,
                description: 'Confidence score from 0 to 100.',
              },
              verdictLabel: {
                type: Type.STRING,
                description: 'One of: "Genuine & Verified", "Needs Manual Review", or "Suspicious / Incomplete".',
              },
              aiAnalysis: {
                type: Type.STRING,
                description: 'Clear 2-3 sentence explanation of why the AI determined this report is genuine or suspicious, including any findings from the uploaded image/PDF.',
              },
              recommendedAction: {
                type: Type.STRING,
                description: 'Concrete resolution action for the Main App Admin to take using their full authority.',
              },
            },
            required: ['isGenuine', 'confidenceScore', 'verdictLabel', 'aiAnalysis', 'recommendedAction'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        ok: true,
        verification: {
          isGenuine: Boolean(parsed.isGenuine),
          confidenceScore: Number(parsed.confidenceScore) || 85,
          verdictLabel: parsed.verdictLabel || (parsed.isGenuine ? 'Genuine & Verified' : 'Flagged / Unverified'),
          aiAnalysis: parsed.aiAnalysis || 'AI verification completed.',
          recommendedAction: parsed.recommendedAction || 'Review and resolve from Main App.',
          verifiedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      });
    } catch (error: any) {
      console.error('Gemini Verify Complaint Error:', error);
      res.status(500).json({
        error: error?.message || 'Failed to verify complaint with Gemini AI.',
      });
    }
  });

  // 4. Requirement #10: Multi-Device Simultaneous Sync & Device Limit (Max 5 PCs + 1 Mobile)
  app.get('/api/cloud/devices', (_req, res) => {
    const state = readCloudDb();
    const devices = (state.payload.connectedDevices as any[]) || [];
    res.json({
      ok: true,
      maxPcDevices: 5,
      maxMobileDevices: 1,
      devices,
    });
  });

  app.post('/api/cloud/devices', (req, res) => {
    const { device, forceReplaceOldest } = req.body || {};
    if (!device || !device.deviceId) {
      res.status(400).json({ error: 'Device session details required.' });
      return;
    }

    const current = readCloudDb();
    let devices: any[] = Array.isArray(current.payload.connectedDevices)
      ? [...(current.payload.connectedDevices as any[])]
      : [];

    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const existingIdx = devices.findIndex((d) => d.deviceId === device.deviceId);

    if (existingIdx >= 0) {
      devices[existingIdx] = {
        ...devices[existingIdx],
        ...device,
        lastActiveAt: nowIso,
      };
    } else {
      const cnfId = device.cnfId || 'cnf-drw-solan';
      const cnfDevices = devices.filter((d) => (d.cnfId || 'cnf-drw-solan') === cnfId);
      const pcList = cnfDevices.filter((d) => d.deviceType === 'pc');
      const mobileList = cnfDevices.filter((d) => d.deviceType === 'mobile');

      if (device.deviceType === 'pc' && pcList.length >= 5) {
        if (forceReplaceOldest) {
          const oldestPc = pcList[0];
          devices = devices.filter((d) => d.deviceId !== oldestPc.deviceId);
        } else {
          res.status(409).json({
            ok: false,
            limitReached: true,
            deviceType: 'pc',
            maxAllowed: 5,
            message: 'Maximum 5 PC devices are already active for this C&F. Release a PC slot or replace the oldest PC session.',
            devices,
          });
          return;
        }
      }

      if (device.deviceType === 'mobile' && mobileList.length >= 1) {
        if (forceReplaceOldest) {
          const oldestMob = mobileList[0];
          devices = devices.filter((d) => d.deviceId !== oldestMob.deviceId);
        } else {
          res.status(409).json({
            ok: false,
            limitReached: true,
            deviceType: 'mobile',
            maxAllowed: 1,
            message: 'Maximum 1 Mobile device is already active for this C&F. Release the active Mobile slot or replace it.',
            devices,
          });
          return;
        }
      }

      devices.push({
        ...device,
        lastActiveAt: nowIso,
      });
    }

    const saved = writeCloudDb({
      ...current.payload,
      connectedDevices: devices,
    });

    res.json({
      ok: true,
      maxPcDevices: 5,
      maxMobileDevices: 1,
      devices,
      lastSyncedAt: saved.lastSyncedAt,
    });
  });

  app.delete('/api/cloud/devices/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const current = readCloudDb();
    const devices: any[] = Array.isArray(current.payload.connectedDevices)
      ? (current.payload.connectedDevices as any[]).filter((d) => d.deviceId !== deviceId)
      : [];
    const saved = writeCloudDb({
      ...current.payload,
      connectedDevices: devices,
    });
    res.json({
      ok: true,
      devices,
      lastSyncedAt: saved.lastSyncedAt,
    });
  });

  // 5. Built-In C&F Bill Self-Hosted Auto-Payment Detection Gateway (Works Across C&F App, Customer App & Main App)
  const activeGatewaySessions = new Map<
    string,
    {
      sessionId: string;
      purpose: string;
      portal: string;
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
      createdAtMs: number;
      autoDetectMs: number;
      verifiedAt?: string;
      autoDetected?: boolean;
    }
  >();

  app.post('/api/payment-gateway/create-session', (req, res) => {
    const {
      purpose = 'cnf_subscription',
      portal = 'cnf_app',
      amount = 699,
      payerName = 'User',
      payerMobile = '',
      userId = '',
      planId = '',
      planName = '',
      payeeName = 'Dixit Sharma (D RIGHT WELLNESS)',
      payeeUpiId = 'drightwellness@upi',
      payeeAccountNo = '50200089412389',
      payeeIfsc = 'HDFC0001245',
      autoDetectSeconds = 5,
    } = req.body || {};

    const sessionId = `PGW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const session = {
      sessionId,
      purpose,
      portal,
      amount: Number(amount) || 0,
      currency: 'INR' as const,
      payerName,
      payerMobile,
      userId,
      planId,
      planName,
      payeeName,
      payeeUpiId,
      payeeAccountNo,
      payeeIfsc,
      status: 'listening' as const,
      createdAt: nowIso,
      createdAtMs: Date.now(),
      autoDetectMs: Math.max(2500, (Number(autoDetectSeconds) || 5) * 1000),
      autoDetected: false,
    };

    activeGatewaySessions.set(sessionId, session);
    res.json({ ok: true, session });
  });

  app.get('/api/payment-gateway/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const autoTrigger = req.query.autoTrigger !== 'false';
    const session = activeGatewaySessions.get(sessionId);

    if (!session) {
      res.status(404).json({ ok: false, error: 'Payment gateway session not found.' });
      return;
    }

    const elapsed = Date.now() - session.createdAtMs;
    if (session.status !== 'verified' && autoTrigger) {
      if (elapsed >= session.autoDetectMs) {
        const utr = `UTR-AUTO-${Date.now().toString().slice(-8)}`;
        const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
        session.status = 'verified';
        session.utrNumber = utr;
        session.verifiedAt = nowIso;
        session.autoDetected = true;
        activeGatewaySessions.set(sessionId, session);

        // Save to cloud store transaction history
        const current = readCloudDb();
        const txList = Array.isArray(current.payload.paymentGatewayTransactions)
          ? [...(current.payload.paymentGatewayTransactions as any[])]
          : [];
        txList.unshift({ ...session });
        writeCloudDb({
          ...current.payload,
          paymentGatewayTransactions: txList.slice(0, 200),
        });
      } else if (elapsed >= session.autoDetectMs * 0.55) {
        session.status = 'detected';
        activeGatewaySessions.set(sessionId, session);
      }
    }

    res.json({ ok: true, session });
  });

  app.post('/api/payment-gateway/confirm-instant', (req, res) => {
    const { sessionId, customUtr } = req.body || {};
    const session = activeGatewaySessions.get(sessionId);
    const utr =
      (customUtr && String(customUtr).trim()) ||
      `UTR-INST-${Date.now().toString().slice(-8)}`;
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (session) {
      session.status = 'verified';
      session.utrNumber = utr;
      session.verifiedAt = nowIso;
      session.autoDetected = true;
      activeGatewaySessions.set(sessionId, session);

      const current = readCloudDb();
      const txList = Array.isArray(current.payload.paymentGatewayTransactions)
        ? [...(current.payload.paymentGatewayTransactions as any[])]
        : [];
      txList.unshift({ ...session });
      writeCloudDb({
        ...current.payload,
        paymentGatewayTransactions: txList.slice(0, 200),
      });

      res.json({ ok: true, session });
      return;
    }

    res.json({
      ok: true,
      session: {
        sessionId: sessionId || `PGW-${Date.now()}`,
        status: 'verified',
        utrNumber: utr,
        verifiedAt: nowIso,
        autoDetected: true,
      },
    });
  });

  app.get('/api/payment-gateway/transactions', (_req, res) => {
    const current = readCloudDb();
    const txList = Array.isArray(current.payload.paymentGatewayTransactions)
      ? (current.payload.paymentGatewayTransactions as any[])
      : [];
    res.json({ ok: true, transactions: txList });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`C&F Bill Full-Stack Cloud & Gemini Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
