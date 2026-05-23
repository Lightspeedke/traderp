import { PAYHERO_API_URL, PAYHERO_CHANNEL_ID, PAYHERO_BASIC_AUTH_TOKEN, PAYHERO_ACCOUNT_ID } from "../_utils";

export default async function handler(req: any, res: any) {
  try {
    console.log("[PayHero Health] Checking connection...");
    console.log("[PayHero Health] API URL:", PAYHERO_API_URL);
    console.log("[PayHero Health] Channel ID:", PAYHERO_CHANNEL_ID);
    console.log("[PayHero Health] Account ID:", PAYHERO_ACCOUNT_ID);
    console.log("[PayHero Health] Auth token exists:", !!PAYHERO_BASIC_AUTH_TOKEN);

    // Quick test - try to fetch PayHero API
    const testResponse = await fetch(PAYHERO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": PAYHERO_BASIC_AUTH_TOKEN
      },
      body: JSON.stringify({
        amount: 0,
        phone_number: "0712345678",
        channel_id: PAYHERO_CHANNEL_ID,
        provider: "m-pesa",
        external_reference: "HEALTH_CHECK",
        customer_name: "Health Check"
      })
    });

    const responseText = await testResponse.text();
    
    return res.json({
      status: "ok",
      payhero: {
        apiUrl: PAYHERO_API_URL,
        channelId: PAYHERO_CHANNEL_ID,
        accountId: PAYHERO_ACCOUNT_ID,
        hasAuthToken: !!PAYHERO_BASIC_AUTH_TOKEN,
        testResponse: {
          httpStatus: testResponse.status,
          body: responseText.substring(0, 200)
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL
      }
    });
  } catch (error: any) {
    console.error("[PayHero Health] Error:", error);
    res.status(500).json({
      error: error?.message || "Health check failed",
      code: error?.code
    });
  }
}
