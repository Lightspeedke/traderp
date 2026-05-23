import { readDb, writeDb } from "../_utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const callbackData = req.method === "GET" ? req.query : req.body;
    console.log("[PayHero Callback] Received full data:", JSON.stringify(callbackData, null, 2));

    // Handle both PayHero response format and direct query params
    const responseData = callbackData.response || callbackData;
    
    // Extract values from PayHero callback format
    const Amount = responseData?.Amount || callbackData?.Amount;
    const ExternalReference = responseData?.ExternalReference || callbackData?.ExternalReference || callbackData?.external_reference;
    const Status = responseData?.Status || callbackData?.Status || callbackData?.status;
    const CheckoutRequestID = responseData?.CheckoutRequestID || callbackData?.CheckoutRequestID;
    
    // Determine success based on Status field
    const isSuccess = Status === "SUCCESS" || Status === "Success" || Status === "success" || Status === "COMPLETED";
    const ref = ExternalReference || CheckoutRequestID;
    
    console.log(`[PayHero Callback] Parsed - Amount: ${Amount}, Ref: ${ref}, Status: ${Status}, IsSuccess: ${isSuccess}`);

    if (!ref) {
      console.warn("[PayHero Callback] No reference ID found in callback data");
      return res.status(200).send("Callback received - no reference ID");
    }

    const db = readDb();
    let updated = false;

    for (const email of Object.keys(db)) {
      const user = db[email];
      if (!user.transactions) continue;
      
      const tx = user.transactions.find((t: any) => t.id === ref);
      if (tx) {
        console.log(`[PayHero Callback] Found transaction ${ref} for user ${email}, current status: ${tx.status}`);
        
        if (isSuccess && tx.status === "Pending") {
          const creditAmount = parseFloat(Amount || tx.amount);
          tx.status = "Completed";
          user.liveBalance += creditAmount;
          updated = true;
          console.log(`[PayHero Callback] ✓ Successfully credited ${creditAmount} KSh to ${email} live account!`);
        } else if (!isSuccess && tx.status === "Pending") {
          tx.status = "Failed";
          updated = true;
          console.log(`[PayHero Callback] ✗ Failed transaction marked for ${email}`);
        } else {
          console.log(`[PayHero Callback] Transaction already processed or status mismatch - skipping`);
        }
        break;
      }
    }

    if (updated) {
      writeDb(db);
      console.log("[PayHero Callback] Database updated successfully");
    } else {
      console.warn("[PayHero Callback] No database update performed");
    }

    res.status(200).send("Callback received and verified.");
  } catch (error) {
    console.error("[PayHero Callback] Error:", error);
    res.status(200).send("Callback acknowledged");  // Always ack to prevent retries
  }
}
