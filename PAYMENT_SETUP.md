# Payment Setup Guide

This document describes the payment system setup for TraderPro254, which integrates with PayHero's M-Pesa payment gateway.

## Environment Variables

### Backend (API Server) - `artifacts/api-server/.env`

```env
# PayHero Configuration
PAYHERO_API_URL=https://backend.payhero.co.ke/api/v2/payments
PAYHERO_CHANNEL_ID=8402
PAYHERO_BASIC_AUTH_TOKEN=Basic <your-base64-encoded-credentials>
NODE_ENV=production
PORT=8080
```

### Frontend Applications

```env
# For Traderpro254
REACT_APP_API_URL=http://localhost:8080/api
# OR for production
REACT_APP_API_URL=https://your-api-domain.com/api

# For Mockup Sandbox
NEXT_PUBLIC_API_URL=http://localhost:8080/api
# OR for production
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

## Setup Instructions

### 1. Get PayHero Credentials

1. Sign up at [PayHero](https://payhero.co.ke/)
2. Create an API channel
3. Get your Channel ID and Basic Auth Token
4. The Basic Auth Token should be in format: `Basic <base64-encoded-username:password>`

### 2. Configure Backend

1. Copy `.env.example` to `.env` in `artifacts/api-server/`
2. Set the PayHero credentials:
   ```bash
   PAYHERO_BASIC_AUTH_TOKEN=Basic <your-token>
   PAYHERO_CHANNEL_ID=<your-channel-id>
   ```

### 3. Configure Frontend

For each frontend application, set the API URL:

- **Traderpro254**: Set `REACT_APP_API_URL`
- **Mockup Sandbox**: Set `NEXT_PUBLIC_API_URL`

## Payment Flow

### 1. Initialize STK Push
```typescript
// Frontend sends payment request
const response = await fetch(`${PAYMENT_API_CONFIG.BASE_URL}/payhero/stk`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    phone: formatPhoneForPayment(phoneNumber),
    amount: paymentAmount,
    customer_name: customerName,
    reference_id: generateTransactionId(), // Optional
  }),
});
```

### 2. User Enters M-Pesa PIN
The user receives an STK prompt on their phone and enters their M-Pesa PIN.

### 3. PayHero Sends Callback
PayHero POSTs the payment confirmation to the `/payhero/callback` endpoint with a per-transaction secret embedded in the URL.

### 4. Check Transaction Status
```typescript
// Frontend polls for transaction status
const statusResponse = await fetch(
  `${PAYMENT_API_CONFIG.BASE_URL}/payhero/status?txId=${transactionId}`
);
```

## Utility Functions

The payment utilities are centralized in `/lib/utils.ts` for both frontend and backend.

### Frontend Utilities

```typescript
import { 
  PAYMENT_API_CONFIG,
  formatPhoneForPayment,
  isValidPhone,
  formatCurrency,
  generateTransactionId
} from "@/lib/utils";

// Format phone: 254712345678 → 0712345678
const formattedPhone = formatPhoneForPayment("+254712345678");

// Validate phone
if (isValidPhone(phone)) {
  // Process payment
}

// Format for display
const display = formatCurrency(1000); // "KES 1,000.00"

// Generate transaction ID
const txId = generateTransactionId(); // "TXN<timestamp><random>"
```

### Backend Configuration

Located in `artifacts/api-server/src/lib/env.ts`:

```typescript
import { PaymentConfig, validateEnv } from "./lib/env";

// Get configuration
const token = PaymentConfig.getPayheroToken();
const channelId = PaymentConfig.getPayheroChannelId();
const timeout = PaymentConfig.getPayheroTimeout();

// Validate on startup
validateEnv(); // Logs warnings if required variables are missing
```

## API Endpoints

### POST `/api/payhero/stk` - Initiate M-Pesa STK Push

**Request:**
```json
{
  "phone": "0712345678",
  "amount": 1000,
  "customer_name": "John Doe",
  "reference_id": "TXN<optional>"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": "QUEUED",
  "reference": "payhero-reference",
  "CheckoutRequestID": "CO_xxxxx",
  "txId": "MP<random>",
  "message": "STK Push sent to 0712345678"
}
```

### GET `/api/payhero/status` - Poll Transaction Status

**Query Parameters:**
- `txId` or `id` or `reference`: Transaction ID

**Response:**
```json
{
  "found": true,
  "tx": {
    "txId": "MPxxxx",
    "status": "Completed",
    "amount": 1000,
    "phone": "0712345678",
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

### POST `/api/payhero/callback` - Webhook (Called by PayHero)

This endpoint validates the callback using a per-transaction secret embedded in the URL and updates transaction status.

### GET `/api/payhero/health` - Health Check

Returns payment gateway configuration status:
```json
{
  "status": "ok",
  "payhero": {
    "apiUrl": "https://backend.payhero.co.ke/api/v2/payments",
    "channelId": 8402,
    "hasAuthToken": true
  },
  "environment": { "nodeEnv": "production" },
  "pendingTransactions": 0
}
```

## Error Handling

### 401/403 - Authentication Failed
```json
{
  "success": false,
  "error": "PayHero authentication failed. Please check PAYHERO_BASIC_AUTH_TOKEN configuration.",
  "details": "Authentication failed"
}
```

### 404 - Invalid Endpoint
```json
{
  "success": false,
  "error": "PayHero API endpoint not found.",
  "details": "Endpoint not found"
}
```

### 409 - Duplicate Transaction
```json
{
  "success": false,
  "error": "Duplicate transaction reference. Please use a unique reference_id."
}
```

### 502 - Gateway Timeout
```json
{
  "error": "PayHero took too long to respond. Please retry.",
  "code": "TIMEOUT"
}
```

## Security Features

1. **Per-Transaction Secrets**: Each transaction has a unique callback secret embedded in the URL
2. **Replay Protection**: Duplicate transaction references are rejected
3. **Sanitization**: Customer names are sanitized to prevent XSS
4. **CORS Enabled**: Only specified domains can make requests
5. **Timeout Protection**: 20-second timeout on PayHero API calls
6. **HTTP-Only Callbacks**: Callback URLs use the forwarded protocol and host headers for HTTPS support

## Testing

### Local Testing
1. Start the API server: `npm run dev` in `artifacts/api-server/`
2. Start the frontend: `npm run dev` in your frontend directory
3. Use test M-Pesa phone numbers from PayHero documentation
4. Check the transaction status via the health endpoint

### Production Deployment
1. Set real PayHero credentials in environment variables
2. Ensure callback URL is publicly accessible (uses `x-forwarded-proto` and `x-forwarded-host` headers)
3. Monitor the health endpoint for payment gateway status
4. Set up proper error logging and monitoring

## Troubleshooting

### Payment Gateway Not Configured
- Check that `PAYHERO_BASIC_AUTH_TOKEN` is set
- Run `/api/payhero/health` to verify configuration

### Authentication Errors (401/403)
- Verify the Basic Auth Token format: `Basic <base64-credentials>`
- Contact PayHero support if credentials are invalid

### Callback Not Received
- Ensure the backend is publicly accessible
- Check that callback URL includes the per-transaction secret
- Verify `x-forwarded-proto` and `x-forwarded-host` headers are properly set

### Timeout Errors
- Check PayHero API status
- Increase `PAYHERO_REQUEST_TIMEOUT_MS` if needed (currently 20s)
- Implement retry logic on the client side

## References

- [PayHero API Documentation](https://payhero.co.ke/api-documentation)
- [M-Pesa Integration Guide](https://www.safaricom.co.ke/business/m-pesa-payments)
- [Environment Variables Setup Guide](./docs/ENV_SETUP.md)
