import { readDb } from "../_utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const txId = (req.query && (req.query.txId || req.query.id)) || (req.query && req.query.txid) || null;
    const userEmail = req.query?.userEmail;

    if (!txId) return res.status(400).json({ error: "txId query parameter is required (txId)" });

    const db = readDb();

    if (userEmail) {
      const user = db[userEmail.toString().toLowerCase().trim()];
      const tx = user?.transactions?.find((t: any) => t.id === txId);
      if (tx) return res.json({ status: tx.status, amount: tx.amount, tx: tx });
      return res.status(404).json({ error: "No transaction found matching reference ID for provided user." });
    }

    // Search all users
    for (const email of Object.keys(db)) {
      const user = db[email];
      const tx = user.transactions?.find((t: any) => t.id === txId);
      if (tx) return res.json({ status: tx.status, amount: tx.amount, tx: tx });
    }

    res.status(404).json({ error: "No transaction found matching reference ID." });
  } catch (error) {
    console.error("Status polling error (serverless):", error);
    res.status(500).json({ error: "Status polling error." });
  }
}
