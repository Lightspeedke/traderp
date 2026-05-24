import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const PAYHERO_API_URL = "https://backend.payhero.co.ke/api/v2/payments";
const PAYHERO_CHANNEL_ID = parseInt(process.env.PAYHERO_CHANNEL_ID || "8402", 10);
const PAYHERO_BASIC_AUTH_TOKEN = process.env.PAYHERO_BASIC_AUTH_TOKEN || "";
const PAYHERO_REQUEST_TIMEOUT_MS = 20000;

if (!PAYHERO_BASIC_AUTH_TOKEN) {
  console.warn("[PayHero] WARNING: PAYHERO_BASIC_AUTH_TOKEN env var is not set. M-Pesa payments will fail.");
}

// ── In-memory transaction state store ──────────────────────────────────────
// Maps txId → transaction record. Populated by /stk and updated by /callback.
type TxStatus = "Pending" | "Completed" | "Failed";

interface TxRecord {
  txId: string;
  status: TxStatus;
  amount: number;
  phone: string;
  createdAt: number;
  updatedAt: number;
  payheroRef?: string;
  checkoutId?: string;
}

const txStore = new Map<string, TxRecord>();

// Prune records older than 24 hours every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, rec] of txStore.entries()) {
    if (rec.createdAt < cutoff) txStore.delete(key);
  }
}, 30 * 60 * 1000);

function genTxId() {
  return "MP" + randomBytes(4).toString("hex").toUpperCase();
}

function sanitizeString(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

function getPublicBaseUrl(req: any): string {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || (req.secure ? "https" : "http");
  return `${protocol}://${host}`;
}

// ── POST /payhero/stk — initiate M-Pesa STK push ───────────────────────────
router.post("/payhero/stk", async (req, res) => {
  try {
    if (!PAYHERO_BASIC_AUTH_TOKEN) {
      res.status(503).json({ error: "Payment gateway not configured. Please contact support." });
      return;
    }

    const { phone, amount, reference_id, customer_name } = req.body;

    if (!phone || !amount) {
      res.status(400).json({ error: "Phone number and amount are required." });
      return;
    }

    const txId = reference_id || genTxId();

    let payheroPhone = phone.replace(/\D/g, "");
    if (payheroPhone.startsWith("254")) {
      payheroPhone = "0" + payheroPhone.slice(3);
    } else if (!payheroPhone.startsWith("0")) {
      if (payheroPhone.startsWith("7") || payheroPhone.startsWith("1")) {
        payheroPhone = "0" + payheroPhone;
      }
    }

    const baseUrl = getPublicBaseUrl(req);
    const callback_url = `${baseUrl}/api/payhero/callback`;

    req.log.info({ phone: payheroPhone, amount, callback_url }, "[PayHero STK] Request");

    const requestBody: Record<string, unknown> = {
      amount: Math.round(amount),
      phone_number: payheroPhone,
      channel_id: PAYHERO_CHANNEL_ID,
      provider: "m-pesa",
      external_reference: txId,
      customer_name: sanitizeString(customer_name || "TraderPro254 Client"),
      callback_url,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAYHERO_REQUEST_TIMEOUT_MS);
    let apiResponse: Response;

    try {
      apiResponse = await fetch(PAYHERO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": PAYHERO_BASIC_AUTH_TOKEN,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await apiResponse.text();
    req.log.info({ status: apiResponse.status, body: responseText.slice(0, 200) }, "[PayHero STK] Response");

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      res.status(500).json({ error: "PayHero returned non-JSON payload.", raw: responseText });
      return;
    }

    const hasCheckoutRequestID = result.CheckoutRequestID || (result.response && result.response.CheckoutRequestID);
    const isPayHeroSuccess = apiResponse.ok && (hasCheckoutRequestID || result.success === true || result.success === "true");

    if (isPayHeroSuccess) {
      const checkoutID = hasCheckoutRequestID || ("CO_" + Math.random().toString(36).slice(2, 10).toUpperCase());

      // Register transaction as Pending in the store
      const record: TxRecord = {
        txId,
        status: "Pending",
        amount: Math.round(amount),
        phone: payheroPhone,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        payheroRef: result.reference || undefined,
        checkoutId: checkoutID,
      };
      txStore.set(txId, record);

      res.status(201).json({
        success: true,
        status: "QUEUED",
        reference: result.reference || txId,
        CheckoutRequestID: checkoutID,
        txId,
        message: `STK Push sent to ${payheroPhone}`,
      });
    } else {
      res.status(apiResponse.status || 400).json({
        success: false,
        error: result.message || result.error || result.detail || "M-Pesa network busy. Please retry.",
        payhero: result,
      });
    }
  } catch (error: any) {
    const message = error?.name === "AbortError"
      ? "PayHero took too long to respond. Please retry."
      : `PayHero error: ${error?.message || "Unknown"}`;
    res.status(502).json({ error: message, code: error?.code || "UNKNOWN_ERROR" });
  }
});

// ── POST /payhero/callback — M-Pesa payment confirmation from PayHero ───────
router.post("/payhero/callback", (req, res) => {
  const callbackData = req.body;
  req.log.info({ data: JSON.stringify(callbackData).slice(0, 500) }, "[PayHero Callback] Received");

  const responseData = callbackData.response || callbackData;
  const Status = responseData?.Status || callbackData?.Status || callbackData?.status;
  const ExternalReference =
    responseData?.ExternalReference ||
    callbackData?.ExternalReference ||
    callbackData?.external_reference;

  const isSuccess =
    Status === "SUCCESS" ||
    Status === "Success" ||
    Status === "success" ||
    Status === "COMPLETED" ||
    Status === "Completed";

  const isFailed =
    Status === "FAILED" ||
    Status === "Failed" ||
    Status === "failed" ||
    Status === "CANCELLED" ||
    Status === "Cancelled";

  req.log.info({ ref: ExternalReference, status: Status, isSuccess, isFailed }, "[PayHero Callback] Parsed");

  // Update transaction status in the store
  if (ExternalReference) {
    const existing = txStore.get(ExternalReference);
    if (existing) {
      existing.status = isSuccess ? "Completed" : isFailed ? "Failed" : "Pending";
      existing.updatedAt = Date.now();
      req.log.info({ txId: ExternalReference, newStatus: existing.status }, "[PayHero Callback] Transaction updated");
    } else {
      // Create a record if it arrived out of order (e.g. txId unknown at callback time)
      txStore.set(ExternalReference, {
        txId: ExternalReference,
        status: isSuccess ? "Completed" : isFailed ? "Failed" : "Pending",
        amount: 0,
        phone: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  res.status(200).send("Callback received and verified.");
});

// ── GET /payhero/callback — handle GET pings from PayHero ───────────────────
router.get("/payhero/callback", (req, res) => {
  req.log.info({ query: req.query }, "[PayHero Callback GET] Received");
  res.status(200).send("Callback acknowledged.");
});

// ── GET /payhero/status — poll transaction status ───────────────────────────
router.get("/payhero/status", (req, res) => {
  const txId = (req.query?.txId || req.query?.id || req.query?.reference) as string | undefined;

  if (!txId) {
    res.status(400).json({ error: "txId query parameter required" });
    return;
  }

  const record = txStore.get(txId);
  if (!record) {
    // Transaction not yet received — could still be in flight (< 30s)
    res.status(202).json({
      found: false,
      status: "Pending",
      message: "Transaction is being processed. Check again in a moment.",
    });
    return;
  }

  res.status(200).json({
    found: true,
    tx: {
      txId: record.txId,
      status: record.status,
      amount: record.amount,
      phone: record.phone,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  });
});

// ── GET /payhero/health ──────────────────────────────────────────────────────
router.get("/payhero/health", async (_req, res) => {
  res.json({
    status: "ok",
    payhero: {
      apiUrl: PAYHERO_API_URL,
      channelId: PAYHERO_CHANNEL_ID,
      hasAuthToken: !!PAYHERO_BASIC_AUTH_TOKEN,
    },
    environment: { nodeEnv: process.env.NODE_ENV },
    pendingTransactions: txStore.size,
  });
});

export default router;
