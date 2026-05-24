import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Payment API Configuration
 */
export const PAYMENT_API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
  PAYHERO_ENDPOINT: "/payhero/stk",
  PAYHERO_STATUS_ENDPOINT: "/payhero/status",
  PAYHERO_HEALTH_ENDPOINT: "/payhero/health",
};

/**
 * Format phone number for payment processing
 */
export function formatPhoneForPayment(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  // Handle Kenyan phone numbers
  if (cleaned.startsWith("254")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (!cleaned.startsWith("0")) {
    if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
      cleaned = "0" + cleaned;
    }
  }
  
  return cleaned;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10;
}

/**
 * Format amount for display
 */
export function formatCurrency(amount: number, currency: string = "KES"): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Generate transaction ID
 */
export function generateTransactionId(): string {
  return "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
}
