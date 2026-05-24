import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

interface STKRequest {
  phone: string;
  amount: number;
  customer_name: string;
  reference_id: string;
  userEmail?: string;
}

// In-memory store for transactions (will be lost on function restart)
const transactionStore: Map<
  string,
  {
    status: string;
    amount: number;
    phone: string;
    timestamp: number;
    mpesaRef?: string;
  }
> = new Map();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let { phone, amount, customer_name, reference_id, userEmail } =
    req.body as STKRequest;

  // Validate required fields
  if (!phone || !amount || !reference_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (amount < 250) {
    return res.status(400).json({ error: "Minimum amount is 250" });
  }

  // Format phone number: remove +, ensure it starts with 254 (Kenya country code)
  phone = phone.replace(/^\+/, ""); // Remove + prefix if present
  if (phone.startsWith("0")) {
    phone = "254" + phone.substring(1); // 0712345678 -> 254712345678
  } else if (!phone.startsWith("254")) {
    phone = "254" + phone; // Add country code if missing
  }

  try {
    const authToken = "Basic enhwcVpnVGVRZnp0QnNpdUVBS2s6Wng4Z3lwYURGSkxMWEFaQjRpZzhrTUNxSzh3WGNHVEdXZ21TQmI1WQ==";
    const channelId = "8402";

    console.log("[STK] Initiating payment:", { phone, amount, channelId });

    const payheroResponse = (await fetch(
      "https://api.payhero.io/api/v2/payments/mobile-money/stk-push",
      {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          amount,
          channel_id: channelId,
          customer_name,
          description: `TraderPro254 Deposit - Ref: ${reference_id}`,
          external_reference: reference_id,
          callback_url: "https://tradepro254.com/api/payhero/callback",
        }),
      }
    )) as any;

    const payheroData = await payheroResponse.json();

    if (!payheroResponse.ok) {
      console.error("[STK] PayHero API error:", {
        status: payheroResponse.status,
        data: payheroData,
      });
      return res.status(payheroResponse.status).json({
        error: "Payment service error",
        payhero: payheroData,
        status: payheroResponse.status,
      });
    }

    // Store transaction with pending status
    const mpesaRef = payheroData.data?.checkout_request_id || reference_id;
    transactionStore.set(reference_id, {
      status: "QUEUED",
      amount,
      phone,
      timestamp: Date.now(),
      mpesaRef,
    });

    return res.status(201).json({
      success: true,
      status: "QUEUED",
      CheckoutRequestID: mpesaRef,
      txId: reference_id,
      message: "STK push sent to customer phone",
      data: payheroData.data,
    });
  } catch (err) {
    console.error("[STK] Payment error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      error: "Failed to initiate payment",
      message: errorMessage,
      details: err instanceof Error ? err.stack : undefined,
    });
  }
}
