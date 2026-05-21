import { readDb, writeDb, formatKenyanPhone, sanitizeString, getPublicBaseUrl, PAYHERO_API_URL, PAYHERO_CHANNEL_ID, PAYHERO_CREDENTIAL_ID, PAYHERO_REQUEST_TIMEOUT_MS, PAYHERO_BASIC_AUTH_TOKEN, genTxId } from "../_utils";

const DEMO_MODE = !PAYHERO_BASIC_AUTH_TOKEN || process.env.NODE_ENV === "test";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { phone, amount, customer_name, reference_id, userEmail } = req.body || {};
    
    console.log(`[PayHero STK] ${DEMO_MODE ? 'DEMO MODE' : 'LIVE'} - Phone: ${phone}, Amount: ${amount}`)

    if (!phone || !amount) {
      return res.status(400).json({ error: "Contact Safaricom phone number and billing amount required!" });
    }

    const txId = reference_id || genTxId();
    const formattedPhone = formatKenyanPhone(phone);

    let payheroPhone = phone.replace(/\D/g, "");
    if (payheroPhone.startsWith("254")) {
      payheroPhone = "0" + payheroPhone.slice(3);
    } else if (!payheroPhone.startsWith("0")) {
      if (payheroPhone.startsWith("7") || payheroPhone.startsWith("1")) {
        payheroPhone = "0" + payheroPhone;
      }
    }

    const callback_url = `${getPublicBaseUrl(req)}/api/payhero/callback`;

    const requestBody: any = {
      amount: Math.round(amount),
      phone_number: payheroPhone,
      channel_id: PAYHERO_CHANNEL_ID,
      provider: "m-pesa",
      external_reference: txId,
      customer_name: sanitizeString(customer_name || "TraderPro254 Client"),
      callback_url: callback_url,
      ...(PAYHERO_CREDENTIAL_ID ? { credential_id: PAYHERO_CREDENTIAL_ID } : {})
    };

    // Demo/Test mode - return success without calling PayHero
    if (DEMO_MODE) {
      console.log(`[PayHero STK] Demo mode active - returning synthetic response`);
      if (userEmail) {
        try {
          const db = readDb();
          const user = db[userEmail.toLowerCase().trim()];
          if (user) {
            const pendingTx = {
              id: txId,
              type: "Deposit",
              phoneNumber: formattedPhone,
              amount: Math.round(amount),
              status: "Completed",  // Auto-complete in demo
              timestamp: Date.now()
            };
            if (!user.transactions) user.transactions = [];
            user.transactions.unshift(pendingTx);
            user.liveBalance += Math.round(amount);  // Auto-credit in demo
            writeDb(db);
            console.log(`[PayHero STK] Demo: Credited ${amount} KSh to ${userEmail}`);
          }
        } catch (dbErr) {
          console.warn(`[PayHero STK] Demo DB write warning:`, dbErr);
        }
      }
      return res.status(201).json({
        success: true,
        status: "QUEUED",
        reference: txId,
        CheckoutRequestID: "CO_DEMO_" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        txId: txId,
        demoMode: true,
        message: "Demo mode: Payment simulated. Check logs."
      });
    }

    if (!PAYHERO_BASIC_AUTH_TOKEN) {
      console.error(`[PayHero STK] No auth token - returning error`);
      return res.status(500).json({ error: "PayHero auth credentials are missing from the server configuration. Set PAYHERO_BASIC_AUTH_TOKEN environment variable." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAYHERO_REQUEST_TIMEOUT_MS);
    let apiResponse: Response;

    try {
      apiResponse = await fetch(PAYHERO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": PAYHERO_BASIC_AUTH_TOKEN
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await apiResponse.text();

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: "Pay Hero returned non-JSON payload.", raw: responseText });
    }

    if (apiResponse.ok && result.success) {
      if (userEmail) {
        const db = readDb();
        const user = db[userEmail.toLowerCase().trim()];
        if (user) {
          const pendingTx = {
            id: txId,
            type: "Deposit",
            phoneNumber: formattedPhone,
            amount: Math.round(amount),
            status: "Pending",
            timestamp: Date.now()
          };
          if (!user.transactions) user.transactions = [];
          user.transactions.unshift(pendingTx);
          writeDb(db);
        }
      }

      return res.status(201).json({
        success: true,
        status: "QUEUED",
        reference: result.reference || txId,
        CheckoutRequestID: result.CheckoutRequestID || "CO_" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        txId: txId
      });
    } else {
      return res.status(apiResponse.status || 400).json({
        success: false,
        error: result.message || result.error || result.detail || "M-Pesa Express network busy. Please retry in some seconds.",
        payhero: result
      });
    }

  } catch (error: any) {
    console.error("[PayHero STK] Error:", error);
    res.status(500).json({ 
      error: error?.message || "Payment service error",
      code: error?.code || "UNKNOWN_ERROR",
      demoFallback: true
    });
  }
}
