# TraderPro254

A binary options and forex trading platform for the Kenyan market, featuring live price charts, M-Pesa deposits/withdrawals via PayHero, Firebase authentication, and multiple trade modes (Rise/Fall, Digits, Accumulators).

## Run & Operate

- `pnpm --filter @workspace/traderpro254 run dev` — run the frontend (auto-assigned port)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4
- Auth: Firebase Authentication
- Payments: PayHero API (M-Pesa STK Push)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (scaffold, not yet used)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `artifacts/traderpro254/src/App.tsx` — main app component with all trading logic
- `artifacts/traderpro254/src/components/` — TradingChart, Cashier, AuthPanel, EduSection
- `artifacts/traderpro254/src/firebaseApp.ts` — Firebase initialization
- `artifacts/traderpro254/src/firebaseConfig.ts` — Firebase project config
- `artifacts/traderpro254/src/types.ts` — shared TypeScript types
- `artifacts/api-server/src/routes/payhero.ts` — PayHero M-Pesa API routes
- `lib/api-spec/openapi.yaml` — API spec (healthz only for now)

## Architecture decisions

- Purely client-rendered Vite + React app; no SSR
- Firebase used for authentication (email/password + Google)
- PayHero API handles M-Pesa STK push payments via the Express API server
- Trading logic (price ticks, contract settlement) runs entirely client-side
- Demo mode uses 65% win probability; Live mode uses 10% win probability
- Balance state is stored in React state + localStorage; sync to server is a best-effort POST

## Product

TraderPro254 is a binary options trading platform targeting Kenyan traders. Users can:
- Trade synthetic indices, forex pairs, and crypto options in Demo or Live mode
- Choose from Rise/Fall, Digits (Match/Differ), and Accumulators trade modes
- Deposit/withdraw funds via M-Pesa (Safaricom STK Push via PayHero)
- View live price charts with SMA and Bollinger Bands overlays
- Track trade history and contract outcomes

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Firebase config is hardcoded in `src/firebaseConfig.ts` (public project keys, acceptable for client-side Firebase)
- PayHero credentials are hardcoded in `artifacts/api-server/src/routes/payhero.ts` — move to env vars for production
- `db_users.json` (file-based DB from Vercel version) is no longer used; user data is in Firebase
- Do NOT run `pnpm dev` at workspace root — use workflow-filtered commands

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
