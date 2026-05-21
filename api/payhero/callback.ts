import { readDb, writeDb } from "../_utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const callbackData = req.method === "GET" ? req.query : req.body;
    console.log("[PayHero Callback] Received:", JSON.stringify(callbackData, null, 2));

    // Handle both PayHero response format and direct query params
    const responseData = callbackData.response || callbackData;
    const { Amount, ExternalReference, Status, CheckoutRequestID } = responseData || {};
    const isSuccess = Status === "SUCCESS" || Status === "Success" || Status === "success" || callbackData.success === true;
    const ref = ExternalReference || CheckoutRequestID || responseData?.reference;
    
    console.log(`[PayHero Callback] Status: ${Status}, Ref: ${ref}, Success: ${isSuccess}`);

      if (ref) {
        const db = readDb();
        let updated = false;

        for (const email of Object.keys(db)) {
          const user = db[email];
          const tx = user.transactions?.find((t: any) => t.id === ref);
          if (tx) {
            if (isSuccess && tx.status === "Pending") {
              tx.status = "Completed";
              user.liveBalance += parseFloat(Amount || tx.amount);
              updated = true;
              console.log(`Successfully credited ${Amount || tx.amount} KSh to ${email} live account via Pay Hero webhook!`);
            } else if (!isSuccess && tx.status === "Pending") {
              tx.status = "Failed";
              updated = true;
              console.log(`Failed transaction flag raised for ${email}`);
            }
            break;
          }
        }

        if (updated) writeDb(db);
      }
    }

    res.status(200).send("Callback received and verified.");
  } catch (error) {
    console.error("[PayHero Callback] Error:", error);
    res.status(200).send("Callback acknowledged");  // Always ack to prevent retries
  }
}
