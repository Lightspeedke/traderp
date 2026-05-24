/**
 * Environment configuration and validation for payment and app services
 */

export const ENV = {
  // PayHero Payment Gateway Configuration
  PAYHERO_API_URL: process.env.PAYHERO_API_URL || "https://backend.payhero.co.ke/api/v2/payments",
  PAYHERO_CHANNEL_ID: parseInt(process.env.PAYHERO_CHANNEL_ID || "8402", 10),
  PAYHERO_BASIC_AUTH_TOKEN: process.env.PAYHERO_BASIC_AUTH_TOKEN || "",
  PAYHERO_REQUEST_TIMEOUT_MS: 20000,

  // Application
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || "8080",
};

/**
 * Validate required environment variables
 */
export function validateEnv() {
  const required = ["PAYHERO_BASIC_AUTH_TOKEN"];
  const missing: string[] = [];

  for (const key of required) {
    if (!ENV[key as keyof typeof ENV]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ CRITICAL: Missing required environment variables: ${missing.join(", ")}`);
    console.error("The payment system will not work without these variables.");
    console.error("Please set PAYHERO_BASIC_AUTH_TOKEN in your environment.");
    // Don't throw - allow app to start but payment routes will fail gracefully
  } else {
    console.log("✅ Payment system environment variables validated successfully.");
  }

  return missing.length === 0;
}

/**
 * Get payment configuration safely
 */
export const PaymentConfig = {
  getPayheroToken: () => ENV.PAYHERO_BASIC_AUTH_TOKEN,
  getPayheroChannelId: () => ENV.PAYHERO_CHANNEL_ID,
  getPayheroApiUrl: () => ENV.PAYHERO_API_URL,
  getPayheroTimeout: () => ENV.PAYHERO_REQUEST_TIMEOUT_MS,
  isPayheroConfigured: () => !!ENV.PAYHERO_BASIC_AUTH_TOKEN,
};
