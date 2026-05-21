export interface Asset {
  id: string;
  name: string;
  category: "Synthetics" | "Forex" | "Crypto";
  currentPrice: number;
  volatility: number; // multiplier for step random walk
  payout: number; // percentage payout (e.g., 90)
  change24h: number; // 24-hour rate of change
}

export type AccountType = "Demo" | "Live";

export interface TradeContract {
  id: string;
  assetId: string;
  assetName: string;
  type: "Higher" | "Lower" | "Match" | "Differ" | "Accumulator";
  mode?: "Rise/Fall" | "Digits" | "Accumulators";
  digitPrediction?: number; // 0-9
  entryPrice: number;
  stake: number;
  payoutRate: number; // e.g. 0.90 for 90%
  duration: number; // seconds
  startTime: number; // timestamp
  expiryTime: number; // timestamp
  settled: boolean;
  exitPrice?: number;
  result?: "WON" | "LOST";
  payoutAmount?: number;
  accountType: AccountType;

  // Accumulator additional fields
  accumulatorTicksCount?: number;
  accumulatorMultiplier?: number;
  isCashedOut?: boolean;
  winByPercentOverride?: boolean;
  crashTick?: number;
}

export interface MpesaTx {
  id: string;
  type: "Deposit" | "Withdrawal";
  phoneNumber: string;
  amount: number;
  status: "Completed" | "Pending" | "Failed";
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "coach";
  text: string;
  timestamp: number;
}
