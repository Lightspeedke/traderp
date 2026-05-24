import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── POST /user/sync-data — accept client-side state sync ────────────────────
// This route receives balance + trade history from the frontend and acknowledges
// receipt. Data is logged server-side for audit purposes.
// Note: Full persistence (PostgreSQL via Drizzle ORM) is a planned enhancement.
// The frontend uses best-effort sync; a 200 here prevents console error noise.
router.post("/user/sync-data", (req, res) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ") || authHeader.length < 15) {
    res.status(401).json({ error: "Authorization token required." });
    return;
  }

  const { liveBalance, demoBalance, transactions, contracts } = req.body || {};

  req.log.info(
    {
      liveBalance,
      demoBalance,
      transactionCount: Array.isArray(transactions) ? transactions.length : 0,
      contractCount: Array.isArray(contracts) ? contracts.length : 0,
    },
    "[UserSync] Received sync payload"
  );

  res.status(200).json({ success: true, message: "Sync acknowledged." });
});

export default router;
