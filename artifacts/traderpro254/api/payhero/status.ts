import type { VercelRequest, VercelResponse } from "@vercel/node";

// In-memory store (shared with stk.ts via module cache)
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
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { txId, userEmail } = req.query as Record<string, string>;

  if (!txId) {
    return res.status(400).json({ error: "Missing txId parameter" });
  }

  try {
    // For demo: simulate payment completion after a few seconds
    const tx = transactionStore.get(txId);

    if (!tx) {
      return res.status(404).json({
        error: "Transaction not found",
        txId,
      });
    }

    // Simulate: if 10+ seconds have passed, mark as completed (in production, verify with PayHero)
    const elapsedSeconds = (Date.now() - tx.timestamp) / 1000;
    if (elapsedSeconds > 10 && tx.status === "QUEUED") {
      tx.status = "Completed";
    }

    return res.status(200).json({
      success: true,
      tx: {
        id: txId,
        status: tx.status,
        amount: tx.amount,
        phone: tx.phone,
        mpesaRef: tx.mpesaRef,
        timestamp: tx.timestamp,
      },
    });
  } catch (err) {
    console.error("Status check error:", err);
    return res.status(500).json({
      error: "Failed to check transaction status",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
