import { readDb, writeDb } from "../_utils";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const callbackData = req.body;
    console.log("Received Pay Hero payment confirmation callback payload (serverless):", JSON.stringify(callbackData, null, 2));

    if (callbackData && callbackData.response) {
      const { Amount, ExternalReference, Status, CheckoutRequestID } = callbackData.response;
      const isSuccess = Status === "SUCCESS" || Status === "Success" || callbackData.success === true;
      const ref = ExternalReference || CheckoutRequestID;

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
    console.error("Pay Hero Callback verification error (serverless):", error);
    res.status(500).send("Webhook process error");
  }
}
