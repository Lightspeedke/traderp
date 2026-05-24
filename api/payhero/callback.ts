import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { status, transaction_id, external_reference } = req.body;

    console.log("[PayHero Callback] Payment update received:", {
      status,
      transaction_id,
      external_reference,
    });

    // In a real application, update the transaction status in a database
    // For now, just acknowledge receipt
    return res.status(200).json({
      success: true,
      message: "Callback received and processed",
      transaction_id,
    });
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).json({
      error: "Failed to process callback",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
