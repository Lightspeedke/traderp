import { readDb } from "../_utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const txId = (req.query?.txId || req.query?.id || req.query?.reference || null);
    const userEmail = req.query?.userEmail;

    if (!txId) {
      return res.status(400).json({ error: "txId query parameter required" });
    }

    const db = readDb();

    if (userEmail) {
      const user = db[userEmail.toString().toLowerCase().trim()];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const tx = user.transactions?.find((t: any) => t.id === txId);
      if (tx) {
        return res.json({ 
          status: tx.status, 
          amount: tx.amount, 
          tx: tx,
          message: `Transaction ${txId} status: ${tx.status}`
        });
      }
      return res.status(404).json({ error: "Transaction not found for user" });
    }

    // Search all users
    for (const email of Object.keys(db)) {
      const user = db[email];
      const tx = user.transactions?.find((t: any) => t.id === txId);
      if (tx) {
        return res.json({ 
          status: tx.status, 
          amount: tx.amount, 
          tx: tx,
          message: `Transaction ${txId} status: ${tx.status}`
        });
      }
    }

    res.status(404).json({ error: "Transaction not found in system" });
  } catch (error) {
    console.error("[PayHero Status] Error:", error);
    res.status(500).json({ error: "Status check failed" });
  }
}
