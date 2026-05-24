import { sanitizeString } from "../_utils";

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

    // Log the payment result - no database storage needed
    if (isSuccess) {
      console.log(`[PayHero Callback] ✓ Payment confirmed for transaction ${ref}, Amount: ${Amount} KSh`);
    } else {
      console.log(`[PayHero Callback] ✗ Payment failed for transaction ${ref}`);
    }

    // Always return 200 OK to acknowledge receipt
    res.status(200).send("Callback received and verified.");
  } catch (error) {
    console.error("[PayHero Callback] Error:", error);
    res.status(200).send("Callback acknowledged");  // Always ack to prevent PayHero retries
  }
}
