import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

export const DB_PATH = path.join(process.cwd(), "db_users.json");

export function readDb(): any {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return {};
}

export function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

export function sanitizeString(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function formatKenyanPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "254" + clean.slice(1);
  } else if (clean.startsWith("7") || clean.startsWith("1")) {
    clean = "254" + clean;
  } else if (!clean.startsWith("254") && clean.length === 9) {
    clean = "254" + clean;
  }
  return clean;
}

export function getPublicBaseUrl(req: any): string {
  const configuredUrl = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (configuredUrl) {
    return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
  }
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host || "traderpro254.ke";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || (req.secure ? "https" : "http");
  return `${protocol}://${host}`;
}

// Hardcoded PayHero Production Credentials - Verified & Working
export const PAYHERO_API_URL = "https://backend.payhero.co.ke/api/v2/payments";
export const PAYHERO_CHANNEL_ID = 8402;
export const PAYHERO_CREDENTIAL_ID = "";
export const PAYHERO_REQUEST_TIMEOUT_MS = 20000;
// Hardcoded Base64 encoded credentials for PayHero (zxpqZgTeQfztBsiuEAKk:Zx8gypaDFJLLXAZB4ig8kMCqK8wXcGTGWgmSBb5Y)
export const PAYHERO_BASIC_AUTH_TOKEN = "Basic enhwcVpnVGVRZnp0QnNpdUVBS2s6Wng4Z3lwYURGSkxMWEFaQjRpZzhrTUNxSzh3WGNHVEdXZ21TQmI1WQ==";

export function genTxId() {
  return "MP" + randomBytes(4).toString("hex").toUpperCase();
}
