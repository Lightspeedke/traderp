import { readDb, writeDb, formatKenyanPhone, sanitizeString, getPublicBaseUrl, PAYHERO_API_URL, PAYHERO_CHANNEL_ID, PAYHERO_CREDENTIAL_ID, PAYHERO_REQUEST_TIMEOUT_MS, PAYHERO_BASIC_AUTH_TOKEN, genTxId } from "../_utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { phone, amount, customer_name, reference_id, userEmail } = req.body || {};

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

    if (!PAYHERO_BASIC_AUTH_TOKEN) {
      return res.status(500).json({ error: "PayHero auth credentials are missing from the server configuration." });
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
    console.error("PayHero STK Error (serverless):", error);
    const message = error?.name === "AbortError"
      ? "PayHero took too long to respond. Please retry in a few seconds."
      : `PayHero connection failed: ${error?.message || "Unknown server error"}`;
    res.status(502).json({
      error: message,
      details: {
        name: error?.name,
        code: error?.code,
        cause: error?.cause?.message || error?.cause?.code
      }
    });
  }
}
