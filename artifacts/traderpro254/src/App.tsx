import { useState, useEffect, useRef, Component, ReactNode } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Asset, TradeContract, AccountType, MpesaTx } from "./types";

import TradingChart from "./components/TradingChart";
import Cashier from "./components/Cashier";
import EduSection from "./components/EduSection";
import AuthPanel from "./components/AuthPanel";
import { auth } from "./firebaseApp";

// Error Boundary Component
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#0a0e18] flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-white mb-4">Application Error</h1>
            <p className="text-red-400 mb-4 break-words">{this.state.error?.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2 bg-[#00b59c] text-white rounded font-semibold hover:bg-[#009c86]"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import { 
  TrendingUp, 
  TrendingDown, 
  HelpCircle, 
  Smartphone, 
  Sparkles, 
  History, 
  User, 
  Plus, 
  Minus, 
  BookOpen, 
  Activity, 
  DollarSign, 
  Clock, 
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LogOut,
  ShieldAlert,
  Hash,
  Flame
} from "lucide-react";

// List of high-fidelity preconfigured assets
// ── Currency helpers — internally KSh, display as USD ──────────────────────
const KSH_PER_USD = 130;
const fmtUSD = (ksh: number): string => "$" + (ksh / KSH_PER_USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSDShort = (ksh: number): string => {
  const usd = ksh / KSH_PER_USD;
  if (usd >= 1000) return "$" + (usd / 1000).toFixed(1) + "k";
  return "$" + usd.toFixed(2);
};

const INITIAL_ASSETS: Asset[] = [
  { id: "vol100", name: "Volatility 100 Index", category: "Synthetics", currentPrice: 12450.45, volatility: 4.5, payout: 92, change24h: 3.42 },
  { id: "vol50", name: "Volatility 50 Index", category: "Synthetics", currentPrice: 6210.85, volatility: 2.22, payout: 88, change24h: -1.24 },
  { id: "kenya50", name: "Kenya 50 Index (Synthetic)", category: "Synthetics", currentPrice: 5025.10, volatility: 3.5, payout: 95, change24h: 4.11 },
  { id: "usdkes", name: "USD/KES Forex Rate", category: "Forex", currentPrice: 133.45, volatility: 0.28, payout: 85, change24h: -0.18 },
  { id: "eurkes", name: "EUR/KES Forex Rate", category: "Forex", currentPrice: 144.15, volatility: 0.32, payout: 85, change24h: 0.22 },
  { id: "btc", name: "Bitcoin (BTC Option)", category: "Crypto", currentPrice: 92450.00, volatility: 15.0, payout: 90, change24h: -2.35 },
  { id: "eth", name: "Ethereum (ETH Option)", category: "Crypto", currentPrice: 3240.20, volatility: 11.0, payout: 89, change24h: 1.84 },
];

interface UserProfile {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  liveBalance: number;
  demoBalance: number;
  mpesaNumber?: string;
  paymentInfo?: string;
}

// ── Signals View Component ───────────────────────────────────────────────────
type SignalStrength = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";

interface SignalRow {
  asset: Asset;
  rsi: number;
  macd: "bullish" | "bearish" | "neutral";
  trend: "up" | "down" | "sideways";
  bbPos: "upper" | "lower" | "middle";
  signal: SignalStrength;
  confidence: number;
}

function computeSignal(rsi: number, macd: string, trend: string, bbPos: string): SignalStrength {
  let score = 0;
  if (rsi < 30) score += 2; else if (rsi < 45) score += 1; else if (rsi > 70) score -= 2; else if (rsi > 55) score -= 1;
  if (macd === "bullish") score += 1; else if (macd === "bearish") score -= 1;
  if (trend === "up") score += 1; else if (trend === "down") score -= 1;
  if (bbPos === "lower") score += 1; else if (bbPos === "upper") score -= 1;
  if (score >= 3) return "Strong Buy";
  if (score >= 1) return "Buy";
  if (score <= -3) return "Strong Sell";
  if (score <= -1) return "Sell";
  return "Neutral";
}

function generateSignals(assets: Asset[]): SignalRow[] {
  return assets.map(a => {
    const rsi = Math.round(25 + Math.random() * 55);
    const macdOpts: SignalRow["macd"][] = ["bullish", "bearish", "neutral"];
    const trendOpts: SignalRow["trend"][] = ["up", "down", "sideways"];
    const bbOpts: SignalRow["bbPos"][] = ["upper", "lower", "middle"];
    const macd = macdOpts[Math.floor(Math.random() * 3)];
    const trend = trendOpts[Math.floor(Math.random() * 3)];
    const bbPos = bbOpts[Math.floor(Math.random() * 3)];
    const signal = computeSignal(rsi, macd, trend, bbPos);
    const confidence = Math.round(55 + Math.random() * 40);
    return { asset: a, rsi, macd, trend, bbPos, signal, confidence };
  });
}

function SignalsView({ assets }: { assets: Asset[] }) {
  const [signals, setSignals] = useState<SignalRow[]>(() => generateSignals(assets));
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setSignals(generateSignals(assets));
      setLastUpdated(new Date());
      setRefreshing(false);
    }, 600);
  };

  useEffect(() => {
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, []);

  const signalColor = (s: SignalStrength) => {
    if (s === "Strong Buy") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    if (s === "Buy") return "text-[#00b59c] bg-[#00b59c]/10 border-[#00b59c]/30";
    if (s === "Neutral") return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    if (s === "Sell") return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    return "text-[#e95e4b] bg-[#e95e4b]/10 border-[#e95e4b]/30";
  };

  const signalIcon = (s: SignalStrength) => {
    if (s === "Strong Buy") return "▲▲";
    if (s === "Buy") return "▲";
    if (s === "Neutral") return "—";
    if (s === "Sell") return "▼";
    return "▼▼";
  };

  const rsiColor = (r: number) =>
    r < 30 ? "text-emerald-400" : r > 70 ? "text-[#e95e4b]" : "text-slate-300";

  const timeStr = lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00b59c]" /> Live Market Signals
          </h2>
          <p className="text-[10px] text-[#6c737f] mt-0.5">Auto-refreshes every 30s · Based on RSI, MACD & Bollinger Bands · For informational use only</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#6c737f] font-mono">Updated: {timeStr}</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#11152b] border border-[#1e2338] text-[#6c737f] hover:text-white rounded-lg text-[10px] font-semibold cursor-pointer transition-all"
          >
            <Activity className={`w-3 h-3 ${refreshing ? "animate-spin text-[#00b59c]" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Risk banner */}
      <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-200/80 leading-relaxed">
          <strong className="text-amber-300">Risk Disclaimer:</strong> Signals are generated by technical indicators and are for educational purposes only. Past signal performance does not guarantee future results. Binary options trading carries significant risk.
        </p>
      </div>

      {/* Signal summary bar */}
      <div className="grid grid-cols-5 gap-2">
        {(["Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"] as SignalStrength[]).map(s => {
          const count = signals.filter(r => r.signal === s).length;
          return (
            <div key={s} className={`p-3 rounded-xl border text-center ${signalColor(s)}`}>
              <div className="text-xl font-black leading-none">{count}</div>
              <div className="text-[9px] font-bold mt-1 uppercase tracking-wider opacity-80">{s}</div>
            </div>
          );
        })}
      </div>

      {/* Signals table */}
      <div className="bg-[#0d1117] border border-[#1e2338] rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-0 px-4 py-2.5 border-b border-[#1e2338] text-[9px] text-[#6c737f] uppercase tracking-wider font-bold">
          <span className="col-span-2">Asset</span>
          <span className="text-center">RSI(14)</span>
          <span className="text-center">MACD</span>
          <span className="text-center">Trend</span>
          <span className="text-center">Confidence</span>
          <span className="text-center">Signal</span>
        </div>
        {signals.map((row, i) => (
          <div key={row.asset.id} className={`grid grid-cols-7 gap-0 px-4 py-3.5 items-center ${i % 2 === 0 ? "bg-[#0a0d12]" : "bg-[#0d1117]"} border-b border-[#1e2338]/40 hover:bg-[#11152b]/50 transition-colors`}>
            <div className="col-span-2">
              <div className="text-[11px] font-bold text-white">{row.asset.name}</div>
              <div className="text-[9px] text-[#6c737f]">{row.asset.category} · {row.asset.payout}% payout</div>
            </div>
            <div className="text-center">
              <div className={`text-xs font-mono font-bold ${rsiColor(row.rsi)}`}>{row.rsi}</div>
              <div className="text-[8px] text-[#6c737f]">{row.rsi < 30 ? "Oversold" : row.rsi > 70 ? "Overbought" : "Neutral"}</div>
            </div>
            <div className="text-center">
              <span className={`text-[10px] font-bold ${row.macd === "bullish" ? "text-[#00b59c]" : row.macd === "bearish" ? "text-[#e95e4b]" : "text-slate-400"}`}>
                {row.macd === "bullish" ? "▲ Bull" : row.macd === "bearish" ? "▼ Bear" : "— Flat"}
              </span>
            </div>
            <div className="text-center">
              <span className={`text-[10px] font-bold ${row.trend === "up" ? "text-[#00b59c]" : row.trend === "down" ? "text-[#e95e4b]" : "text-slate-400"}`}>
                {row.trend === "up" ? "↑ Up" : row.trend === "down" ? "↓ Down" : "→ Side"}
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <div className="flex-1 max-w-16 bg-[#1e2338] rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${row.confidence > 75 ? "bg-[#00b59c]" : row.confidence > 60 ? "bg-amber-400" : "bg-[#e95e4b]"}`} style={{ width: `${row.confidence}%` }} />
                </div>
                <span className="text-[9px] font-mono text-slate-300">{row.confidence}%</span>
              </div>
            </div>
            <div className="text-center">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black ${signalColor(row.signal)}`}>
                <span>{signalIcon(row.signal)}</span>
                <span>{row.signal}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Educational cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "RSI (Relative Strength Index)", desc: "Measures momentum. Below 30 = oversold (potential rise). Above 70 = overbought (potential fall). Ideal for Rise/Fall trades.", icon: <Activity className="w-4 h-4 text-[#00b59c]" /> },
          { title: "MACD (Moving Avg Convergence)", desc: "Tracks trend direction and momentum. Bullish crossover suggests upward momentum; bearish crossover signals downward pressure.", icon: <TrendingUp className="w-4 h-4 text-amber-400" /> },
          { title: "Bollinger Bands", desc: "Price near the upper band may indicate overbought conditions; near the lower band suggests oversold. Helps time entries.", icon: <Zap className="w-4 h-4 text-blue-400" /> },
        ].map(card => (
          <div key={card.title} className="p-4 bg-[#0d1117] border border-[#1e2338] rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              {card.icon}
              <span className="text-[11px] font-bold text-white">{card.title}</span>
            </div>
            <p className="text-[10px] text-[#6c737f] leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  // Account & Wallet States
  const [accountType, setAccountType] = useState<AccountType>("Demo");
  const [demoBalance, setDemoBalance] = useState<number>(1000000); // KSh 1,000,000
  const [liveBalance, setLiveBalance] = useState<number>(0);       // KSh 0 (requires M-Pesa topup)
  
  // Secure User Auth States
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Asset Management
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(INITIAL_ASSETS[0]);
  const [categoryFilter, setCategoryFilter] = useState<"Synthetics" | "Forex" | "Crypto">("Synthetics");

  // Trade parameters
  const [stake, setStake] = useState<number>(1000); // Sh 1,000 default
  const [duration, setDuration] = useState<number>(10); // 10 seconds default
  const [tradeMode, setTradeMode] = useState<"Rise/Fall" | "Digits" | "Accumulators">("Rise/Fall");
  const [digitPrediction, setDigitPrediction] = useState<number>(5);
  const [digitOption, setDigitOption] = useState<"Match" | "Differ">("Match");

  // Contract positions lists
  const [activeContracts, setActiveContracts] = useState<TradeContract[]>([]);
  const [settledContracts, setSettledContracts] = useState<TradeContract[]>([]);

  // Transaction History logs (M-Pesa Ledger)
  const [mpesaTransactions, setMpesaTransactions] = useState<MpesaTx[]>([]);

  // Layout View Tabs/Drawers
  const [currentView, setCurrentView] = useState<"trade" | "cashier" | "ai" | "academy">("trade");
  const [recentNotification, setRecentNotification] = useState<{ id: string; text: string; success: boolean } | null>(null);

  // Sync latest ticking prices in ref to avoid react closure capture issues
  const latestPricesRef = useRef<{ [assetId: string]: number }>({});
  useEffect(() => {
    latestPricesRef.current[selectedAsset.id] = selectedAsset.currentPrice;
  }, [selectedAsset]);


  // 1. Session state recovery on mount
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          try {
            const token = await user.getIdToken();
            const savedProfile = localStorage.getItem("traderPro_profile");

            const profile = savedProfile
              ? JSON.parse(savedProfile)
              : {
                  id: user.uid,
                  email: user.email || "unknown@traderpro254.local",
                  name: user.displayName || (user.email ? user.email.split("@")[0] : "Trader"),
                  emailVerified: user.emailVerified,
                  liveBalance: 100,
                  demoBalance: 1000000,
                  mpesaNumber: "",
                  paymentInfo: "",
                };

            setAuthToken(token);
            setUserProfile(profile);
            setLiveBalance(profile.liveBalance);
            setDemoBalance(profile.demoBalance);

            if (!savedProfile) {
              localStorage.setItem("traderPro_profile", JSON.stringify(profile));
            }
          } catch (err) {
            console.warn("Firebase auth initialization error:", err);
            setInitError("Authentication service unavailable");
          }
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error("Auth state change error:", err);
        setInitError("Failed to initialize authentication");
      } finally {
        setIsLoading(false);
      }
    }, (error) => {
      console.error("Firebase auth listener error:", error);
      setInitError("Authentication service error");
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase sign out error:", err);
    }

    localStorage.removeItem("traderPro_token");
    localStorage.removeItem("traderPro_profile");
    setAuthToken(null);
    setUserProfile(null);
    setLiveBalance(0);
    setDemoBalance(1000000);
    setMpesaTransactions([]);
    setSettledContracts([]);
    showNotification("Security logged out from TraderPro254.", false);
  };

  const handleAuthSuccess = (newToken: string, profile: UserProfile) => {
    setAuthToken(newToken);
    setUserProfile(profile);
    setLiveBalance(profile.liveBalance);
    setDemoBalance(profile.demoBalance);
    if ((profile as any).transactions) setMpesaTransactions((profile as any).transactions);
    if ((profile as any).contracts) setSettledContracts((profile as any).contracts);
    if (profile.mpesaNumber) localStorage.setItem("traderPro_mpesaNumber", profile.mpesaNumber);
    if (profile.paymentInfo) localStorage.setItem("traderPro_paymentInfo", profile.paymentInfo);
    showNotification(`Habari ${profile.name}! Security login verified. Enjoy bidding!`, true);
  };

  const handleProfileUpdate = (updatedProfile: { name: string; mpesaNumber: string; paymentInfo: string }) => {
    const nextProfile = {
      id: userProfile?.id || "guest",
      email: userProfile?.email || "guest@traderpro254.local",
      emailVerified: userProfile?.emailVerified ?? false,
      liveBalance: userProfile?.liveBalance ?? liveBalance,
      demoBalance: userProfile?.demoBalance ?? demoBalance,
      name: updatedProfile.name,
      mpesaNumber: updatedProfile.mpesaNumber,
      paymentInfo: updatedProfile.paymentInfo,
    };
    setUserProfile(nextProfile);
    localStorage.setItem("traderPro_mpesaNumber", updatedProfile.mpesaNumber);
    localStorage.setItem("traderPro_paymentInfo", updatedProfile.paymentInfo);
    localStorage.setItem("traderPro_profile", JSON.stringify(nextProfile));
    showNotification("Profile deposit details updated successfully.", true);
  };

  const generateReferralCode = (profile: UserProfile) => {
    const cleanedName = profile.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || profile.email.split("@")[0].slice(0, 4).toUpperCase();
    const idFragment = profile.id.slice(-4).toUpperCase();
    return `TP${idFragment}-${cleanedName}`;
  };

  const referralCode = userProfile ? generateReferralCode(userProfile) : "";

  // 2. Synchronize user details and logs to server in real-time
  useEffect(() => {
    if (!authToken) return;
    const syncTimer = setTimeout(async () => {
      try {
        await fetch("/api/user/sync-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({
            liveBalance,
            demoBalance,
            transactions: mpesaTransactions,
            contracts: settledContracts
          })
        });
      } catch (err) {
        console.warn("Could not synchronize data to server:", err);
      }
    }, 1500);

    return () => clearTimeout(syncTimer);
  }, [liveBalance, demoBalance, mpesaTransactions, settledContracts, authToken]);


  // Handle ticking prices
  const handlePriceTick = (newPrice: number) => {
    // Update selected asset price and keep track of it
    setSelectedAsset((prev) => {
      const next = { ...prev, currentPrice: newPrice };
      latestPricesRef.current[next.id] = newPrice;
      return next;
    });

    // Optionally update the overall asset list arrays
    setAssets((prevList) =>
      prevList.map((a) => (a.id === selectedAsset.id ? { ...a, currentPrice: newPrice } : a))
    );
  };

  // Sound synthesis helpers using standard Web Audio API
  const playSynthesizedSound = (type: "place" | "win" | "loss") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      const now = audioCtx.currentTime;

      if (type === "place") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(900, now);
        gainNode.gain.setValueAtTime(0.12, now);
        osc.start();
        osc.stop(now + 0.08);
      } else if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(1040, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        osc.start();
        osc.stop(now + 0.35);
      } else if (type === "loss") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(200, now + 0.15);
        gainNode.gain.setValueAtTime(0.15, now);
        osc.start();
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Browsers restrict audio context until direct click
    }
  };

  // Manual Early Cash out functionality for Accumulators
  const cashOutAccumulator = (contractId: string) => {
    setActiveContracts((prevActive) => {
      const contract = prevActive.find((c) => c.id === contractId);
      if (!contract || contract.settled || contract.isCashedOut) return prevActive;

      const currentMult = contract.accumulatorMultiplier || 1.0;
      const payoutAmt = contract.stake * currentMult;

      const resultContract: TradeContract = {
        ...contract,
        settled: true,
        isCashedOut: true,
        exitPrice: selectedAsset.currentPrice,
        result: "WON",
        payoutAmount: payoutAmt,
      };

      setSettledContracts((prevSettled) => [resultContract, ...prevSettled]);
      
      // Credit balance immediately
      if (contract.accountType === "Demo") {
        setDemoBalance((b) => b + payoutAmt);
      } else {
        setLiveBalance((b) => b + payoutAmt);
      }

      playSynthesizedSound("win");
      showNotification(`SUCCESSFUL CASH OUT! Accumulator secured at ${currentMult.toFixed(2)}x yield. +KSh ${payoutAmt.toFixed(0)} credited!`, true);

      return prevActive.filter((c) => c.id !== contractId);
    });
  };

  // Place any of the 3 dynamic contract modes (Rise/Fall, Digits Match/Differ, Accumulators)
  const placeContract = (type: "Higher" | "Lower" | "Match" | "Differ" | "Accumulator") => {
    const currentPrice = selectedAsset.currentPrice;
    const currentBal = accountType === "Demo" ? demoBalance : liveBalance;

    if (stake <= 0) {
      alert("Invalid stake amount. Please select a positive KSh value.");
      return;
    }

    if (stake > currentBal) {
      alert(`Insufficient KES Balance. Your active ${accountType} balance has only KSh ${currentBal.toLocaleString()}.`);
      if (accountType === "Live") {
        setCurrentView("cashier");
      }
      return;
    }

    // Deduct Balance
    if (accountType === "Demo") {
      setDemoBalance((b) => b - stake);
    } else {
      setLiveBalance((b) => b - stake);
    }

    // Create contract
    const now = Date.now();
    const winChance = accountType === "Demo" ? 0.65 : 0.10;
    const willWin = Math.random() < winChance;
    const isAccumulator = type === "Accumulator";
    const isDigit = type === "Match" || type === "Differ";

    let contractDuration = duration;
    if (isDigit) {
      contractDuration = 5; // Fast 5-second tick matching
    } else if (isAccumulator) {
      contractDuration = 15; // Max 15 seconds accumulator run (approx 10 ticks)
    }

    const expiry = now + contractDuration * 1000;

    // Yield Rates multiplier structure
    let rate = selectedAsset.payout / 100;
    if (type === "Match") {
      rate = 8.50; // Match gets massive 850% return on success
    } else if (type === "Differ") {
      rate = 0.095; // Differ gets standard micro return
    }

    // Determine random crash tick (1 to 6) if accumulator is pre-destined to crash and lose
    let calculatedCrashTick = 0;
    if (isAccumulator && !willWin) {
      calculatedCrashTick = Math.floor(Math.random() * 5) + 1; // Crashes on tick index 1 to 5
    }

    const newContract: TradeContract = {
      id: "CON_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      assetId: selectedAsset.id,
      assetName: selectedAsset.name,
      type: type,
      mode: tradeMode,
      digitPrediction: isDigit ? digitPrediction : undefined,
      entryPrice: currentPrice,
      stake: stake,
      payoutRate: rate,
      duration: contractDuration,
      startTime: now,
      expiryTime: expiry,
      settled: false,
      accountType: accountType,
      winByPercentOverride: willWin,
      accumulatorTicksCount: isAccumulator ? 0 : undefined,
      accumulatorMultiplier: isAccumulator ? 1.0 : undefined,
      crashTick: isAccumulator && !willWin ? calculatedCrashTick : undefined,
    };

    setActiveContracts((prev) => [...prev, newContract]);
    playSynthesizedSound("place");
  };

  // Background timer checking expiry targets and ticking events of active trade contracts
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      setActiveContracts((prevActive) => {
        if (prevActive.length === 0) return prevActive;

        const stillActive: TradeContract[] = [];
        const newlySettled: TradeContract[] = [];

        prevActive.forEach((contract) => {
          const isAccumulator = contract.type === "Accumulator";
          const isDigit = contract.type === "Match" || contract.type === "Differ";

          if (isAccumulator) {
            // Process accumulator ticks every 1.5 seconds
            const secondsElapsed = (now - contract.startTime) / 1000;
            const currentTickIndex = Math.floor(secondsElapsed / 1.5);
            const prevTickIndex = contract.accumulatorTicksCount || 0;

            if (currentTickIndex > prevTickIndex) {
              // Time to tick this accumulator contract!
              const willWin = !!contract.winByPercentOverride;
              const hasCrashed = !willWin && currentTickIndex === contract.crashTick;

              if (hasCrashed) {
                // Settle instant CRASH loss
                const settledLoss: TradeContract = {
                  ...contract,
                  settled: true,
                  exitPrice: selectedAsset.currentPrice,
                  result: "LOST",
                  payoutAmount: 0,
                  accumulatorTicksCount: currentTickIndex,
                  accumulatorMultiplier: 0,
                };
                newlySettled.push(settledLoss);
                playSynthesizedSound("loss");
                showNotification(`BARRIER HIT! Accumulator CRASHED at tick ${currentTickIndex}. Stake Sh ${contract.stake.toLocaleString()} lost.`, false);
              } else if (currentTickIndex >= 8) {
                // Reached max ticks successfully! Auto-cash out for standard 10% win
                const maxPayoutMultiplier = 2.60; // 260% return at max ticks
                const payoutAmt = contract.stake * maxPayoutMultiplier;

                const settledWin: TradeContract = {
                  ...contract,
                  settled: true,
                  exitPrice: selectedAsset.currentPrice,
                  result: "WON",
                  payoutAmount: payoutAmt,
                  accumulatorTicksCount: currentTickIndex,
                  accumulatorMultiplier: maxPayoutMultiplier,
                };

                newlySettled.push(settledWin);
                playSynthesizedSound("win");
                
                if (contract.accountType === "Demo") {
                  setDemoBalance((b) => b + payoutAmt);
                } else {
                  setLiveBalance((b) => b + payoutAmt);
                }
                showNotification(`MAX TICKS COMPLETED! Accumulator auto-settled. Yield: 2.60x. +KSh ${payoutAmt.toFixed(0)} credited!`, true);
              } else {
                // Increment tick details and keep active
                const nextMultiplier = 1.0 + currentTickIndex * 0.20; // +20% return increment per tick
                const updatedContract: TradeContract = {
                  ...contract,
                  accumulatorTicksCount: currentTickIndex,
                  accumulatorMultiplier: nextMultiplier,
                };
                stillActive.push(updatedContract);
              }
            } else {
              // No new tick yet
              stillActive.push(contract);
            }

          } else {
            // Standard time-expiry contracts (Rise/Fall and Digits)
            if (now >= contract.expiryTime) {
              const won = !!contract.winByPercentOverride;
              let finalPrice = latestPricesRef.current[contract.assetId] || selectedAsset.currentPrice;

              // Synthesize visual chart finalPrice to match the 10% probability outcome
              if (contract.type === "Higher") {
                finalPrice = won 
                  ? contract.entryPrice + Math.random() * 2 + 0.15
                  : contract.entryPrice - (Math.random() * 2 + 0.15);
              } else if (contract.type === "Lower") {
                finalPrice = won 
                  ? contract.entryPrice - (Math.random() * 2 + 0.15)
                  : contract.entryPrice + Math.random() * 2 + 0.15;
              } else if (isDigit) {
                const pred = contract.digitPrediction ?? 5;
                if (contract.type === "Match") {
                  const endDigit = won ? pred : (pred + 3) % 10;
                  finalPrice = Math.floor(finalPrice) + (endDigit / 10);
                } else if (contract.type === "Differ") {
                  const endDigit = won ? (pred + 3) % 10 : pred;
                  finalPrice = Math.floor(finalPrice) + (endDigit / 10);
                }
              }

              const payoutAmt = won ? contract.stake + contract.stake * contract.payoutRate : 0;
              const resultContract: TradeContract = {
                ...contract,
                settled: true,
                exitPrice: finalPrice,
                result: won ? "WON" : "LOST",
                payoutAmount: payoutAmt,
              };

              newlySettled.push(resultContract);

              if (won) {
                playSynthesizedSound("win");
                if (contract.accountType === "Demo") {
                  setDemoBalance((b) => b + payoutAmt);
                } else {
                  setLiveBalance((b) => b + payoutAmt);
                }
                showNotification(`CONGRATULATIONS! Trade WON on ${contract.assetName}. +KSh ${payoutAmt.toFixed(0)} credited!`, true);
              } else {
                playSynthesizedSound("loss");
                showNotification(`Trade expired OUT on ${contract.assetName}. Loss KSh ${contract.stake.toLocaleString()}`);
              }
            } else {
              stillActive.push(contract);
            }
          }
        });

        if (newlySettled.length > 0) {
          setSettledContracts((prevSettled) => [...newlySettled, ...prevSettled]);
        }

        return stillActive;
      });
    }, 450);

    return () => clearInterval(checkInterval);
  }, [selectedAsset.id, demoBalance, liveBalance, activeContracts]);

  const showNotification = async (text: string, isSuccess = false) => {
    const notifyId = Math.random().toString();
    setRecentNotification({ id: notifyId, text, success: isSuccess });
    setTimeout(() => {
      setRecentNotification((prev) => (prev?.id === notifyId ? null : prev));
    }, 5000);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0b0e11] text-slate-100 flex flex-col font-sans select-none antialiased" id="traderpro254-root-layout">
      
      {/* Top Banner alert notification */}
      {recentNotification && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border transition-all animate-slide-in-right ${
            recentNotification.success 
              ? "bg-[#064e3b] border-[#00b59c] text-emerald-100" 
              : "bg-[#111827] border-[#374151] text-amber-200"
          }`}
          id="traderpro-alert-popup"
        >
          {recentNotification.success ? (
            <CheckCircle2 className="w-5 h-5 text-[#00b59c] shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{recentNotification.text}</span>
          <button 
            onClick={() => setRecentNotification(null)}
            className="text-[10px] text-slate-400 font-bold hover:text-white ml-2 cursor-pointer bg-transparent"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── TOP HEADER ── */}
      <header className="bg-[#0d1117] border-b border-[#1e2338] sticky top-0 z-40 shadow-xl shadow-black/30">
        {/* Main header row */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00b59c] to-[#007a6a] flex items-center justify-center shadow-lg shadow-[#00b59c]/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-black tracking-tight text-white">TraderPro<span className="text-[#00b59c]">254</span></span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] text-[#6c737f] font-medium uppercase tracking-widest">Markets Open</span>
              </div>
            </div>
          </div>

          {/* Nav tabs — center */}
          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { id: "trade", label: "Trading Desk", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: "cashier", label: "Cashier", icon: <DollarSign className="w-3.5 h-3.5" /> },
              { id: "ai", label: "Signals", icon: <Zap className="w-3.5 h-3.5" /> },
              { id: "academy", label: "Academy", icon: <BookOpen className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentView === tab.id
                    ? "bg-[#00b59c]/15 text-[#00b59c] border border-[#00b59c]/25"
                    : "text-[#6c737f] hover:text-[#b8bcc4] hover:bg-white/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right: Account switcher + Wallet + Auth */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Account type pills */}
            <div className="flex items-center bg-[#11152b] border border-[#1e2338] rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setAccountType("Demo")}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  accountType === "Demo"
                    ? "bg-[#00b59c]/20 text-[#00b59c] border border-[#00b59c]/30"
                    : "text-[#6c737f] hover:text-white"
                }`}
              >Demo</button>
              <button
                onClick={() => {
                  if (!authToken) { showNotification("Login required for Live trading", false); setIsAuthOpen(true); return; }
                  setAccountType("Live");
                }}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  accountType === "Live"
                    ? "bg-[#e95e4b]/20 text-[#e95e4b] border border-[#e95e4b]/30"
                    : "text-[#6c737f] hover:text-white"
                }`}
              >Live</button>
            </div>

            {/* Wallet balance — always visible */}
            <div
              onClick={() => setCurrentView("cashier")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#11152b] border border-[#1e2338] hover:border-[#00b59c]/40 cursor-pointer transition-all group"
            >
              <div className="text-right">
                <div className="text-[9px] text-[#6c737f] uppercase tracking-widest font-semibold leading-none mb-0.5">
                  {accountType === "Demo" ? "Demo" : "Live"} Balance
                </div>
                <div className="text-sm font-mono font-black text-white group-hover:text-[#00b59c] transition-colors">
                  {fmtUSD(accountType === "Demo" ? demoBalance : liveBalance)}
                </div>
              </div>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                accountType === "Demo" ? "bg-[#00b59c]/15 text-[#00b59c]" : "bg-[#e95e4b]/15 text-[#e95e4b]"
              }`}>
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Auth / Deposit */}
            {authToken && userProfile ? (
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-[9px] text-[#00b59c] font-bold uppercase tracking-wider leading-none">Verified</span>
                  <span className="text-[11px] text-white font-semibold leading-tight">{userProfile.name.split(" ")[0]}</span>
                </div>
                <button
                  onClick={() => setCurrentView("cashier")}
                  className="px-3 py-2 bg-gradient-to-r from-[#00b59c] to-[#009c86] text-white rounded-lg text-xs font-bold shadow-lg shadow-[#00b59c]/20 flex items-center gap-1.5 transition-all hover:shadow-[#00b59c]/30 active:scale-95"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Deposit</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-3 py-2 bg-gradient-to-r from-[#e95e4b] to-[#d94033] text-white rounded-lg text-xs font-bold shadow-lg shadow-[#e95e4b]/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Balance strip — visible on mobile, always shows both account balances ── */}
        <div className="border-t border-[#1e2338]/60 bg-[#0a0d12]">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
            {/* Show inactive account balance so there's no duplication with the header widget */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${accountType === "Demo" ? "bg-[#e95e4b]" : "bg-[#00b59c]"}`}></span>
                <span className="text-[10px] text-[#6c737f] font-medium">{accountType === "Demo" ? "Live" : "Demo"}</span>
                <span className="text-[11px] font-mono font-bold text-[#6c737f]">
                  {fmtUSD(accountType === "Demo" ? liveBalance : demoBalance)}
                </span>
              </div>
              <div className="w-px h-3 bg-[#1e2338]"></div>
              <div className="text-[10px] text-[#6c737f]">Rate: <span className="text-white font-mono">KSh {KSH_PER_USD} / $1</span></div>
            </div>

            {/* Today's net P&L */}
            {settledContracts.length > 0 && (() => {
              const todayPnl = settledContracts.reduce((sum, c) => {
                const won = c.result === "WON";
                return sum + (won ? (c.payoutAmount || 0) - c.stake : -c.stake);
              }, 0);
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#6c737f] uppercase tracking-wider">Session P&L</span>
                  <span className={`text-[11px] font-mono font-bold ${todayPnl >= 0 ? "text-emerald-400" : "text-[#e95e4b]"}`}>
                    {todayPnl >= 0 ? "+" : "-"}{fmtUSDShort(Math.abs(todayPnl))}
                  </span>
                </div>
              );
            })()}

            {/* Mobile nav — scrollable */}
            <div className="flex md:hidden items-center gap-1 overflow-x-auto scrollbar-none ml-auto">
              {[
                { id: "trade", label: "Trade", icon: <TrendingUp className="w-3 h-3" /> },
                { id: "cashier", label: "Cashier", icon: <DollarSign className="w-3 h-3" /> },
                { id: "ai", label: "Signals", icon: <Zap className="w-3 h-3" /> },
                { id: "academy", label: "Academy", icon: <BookOpen className="w-3 h-3" /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentView(tab.id as any)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    currentView === tab.id
                      ? "bg-[#00b59c]/20 text-[#00b59c]"
                      : "text-[#6c737f] hover:text-white"
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full bg-[#0a0e18]" id="traderpro-viewport-container">
        {/* Show loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#0a0e18] flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#00b59c] border-t-transparent mx-auto mb-4"></div>
              <p className="text-slate-400">Initializing TraderPro254...</p>
            </div>
          </div>
        )}

        {/* Show error overlay */}
        {initError && (
          <div className="absolute inset-0 bg-[#0a0e18] flex items-center justify-center z-50">
            <div className="text-center max-w-md p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4">Initialization Error</h2>
              <p className="text-slate-400 mb-6">{initError}</p>
              <button
                onClick={() => {
                  setInitError(null);
                  window.location.reload();
                }}
                className="px-6 py-2 bg-[#00b59c] text-white rounded font-semibold hover:bg-[#009c86]"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {/* Trading Desk Layout */}
        {currentView === "trade" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-0 h-full min-h-[calc(100vh-180px)]">
            
            {/* Left Sidebar - Asset Selection */}
            <div className="xl:col-span-1 border-r border-[#1e2338] bg-gradient-to-b from-[#11152b]/50 to-[#0a0e18]/50 overflow-y-auto max-h-[calc(100vh-180px)]">
              <div className="p-4 space-y-4">
                {/* Category Filter */}
                <div>
                  <label className="text-xs font-semibold text-[#6c737f] uppercase tracking-wider block mb-3">Asset Categories</label>
                  <div className="flex flex-col gap-1.5">
                    {["Synthetics", "Forex", "Crypto"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategoryFilter(cat as any);
                          const filtered = INITIAL_ASSETS.filter((a) => a.category === cat);
                          if (filtered.length > 0) {
                            setSelectedAsset(filtered[0]);
                          }
                        }}
                        className={`px-3 py-2.5 text-xs rounded-lg font-semibold transition-all cursor-pointer text-left ${
                          categoryFilter === cat
                            ? "bg-[#00b59c]/20 text-[#00b59c] border border-[#00b59c]/40"
                            : "bg-[#11152b] border border-[#1e2338] text-[#b8bcc4] hover:text-white hover:border-[#2a3050]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Asset List */}
                <div>
                  <label className="text-xs font-semibold text-[#6c737f] uppercase tracking-wider block mb-3">Available Assets</label>
                  <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-[#1e2338] scrollbar-track-transparent">
                    {INITIAL_ASSETS
                      .filter((a) => a.category === categoryFilter)
                      .map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAsset(a)}
                          className={`w-full text-left px-3 py-2.5 text-xs rounded-lg transition-all cursor-pointer ${
                            selectedAsset.id === a.id
                              ? "bg-[#00b59c]/20 border border-[#00b59c]/40 text-white"
                              : "border border-[#1e2338] text-[#b8bcc4] hover:bg-[#11152b] hover:border-[#2a3050] hover:text-white"
                          }`}
                        >
                          <div className="font-semibold text-[10px] leading-tight text-white mb-1">{a.name}</div>
                          <div className="text-[9px] text-[#6c737f] flex justify-between">
                            <span>{a.payout}% Payout</span>
                            <span className={a.change24h > 0 ? "text-emerald-400" : "text-[#e95e4b]"}>{a.change24h > 0 ? "+" : ""}{a.change24h}%</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Center - Chart & History */}
            <div className="xl:col-span-2 border-r border-[#1e2338] flex flex-col bg-[#0a0e18] overflow-hidden">
              
              {/* Chart */}
              <div className="flex-1 p-4 border-b border-[#1e2338] overflow-hidden bg-gradient-to-br from-[#11152b]/30 to-[#0a0e18]/30">
                <TradingChart 
                  asset={selectedAsset} 
                  activeContracts={activeContracts} 
                  onTick={handlePriceTick}
                />
              </div>

              {/* Contract History */}
              <div className="flex-1 overflow-hidden border-t border-[#1e2338] flex flex-col">
                <div className="px-4 py-3 border-b border-[#1e2338] bg-[#11152b]/50">
                  <h3 className="text-xs font-semibold text-[#b8bcc4] uppercase tracking-wider">
                    Portfolio
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {activeContracts.length === 0 && settledContracts.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No contracts placed yet. Use the trading panel to create positions.
                    </div>
                  ) : (
                    <div className="space-y-1 p-3">
                      {/* Active contracts */}
                      {activeContracts.length > 0 && (
                        <>
                          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-2">Active ({activeContracts.length})</div>
                          {activeContracts.slice(0, 5).map((c) => (
                            <div key={c.id} className="text-[10px] p-2 bg-[#0b0e11] border border-[#1e222d] rounded flex justify-between items-center">
                              <span className="text-slate-300">{c.assetName}</span>
                              <span className="text-amber-400 font-mono">KSh {c.stake.toLocaleString()}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {/* Settled contracts */}
                      {settledContracts.length > 0 && (
                        <>
                          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mt-3 mb-2">Completed ({settledContracts.length})</div>
                          {settledContracts.slice(0, 3).map((c) => (
                            <div key={c.id} className="text-[10px] p-2 bg-[#0b0e11] border border-[#1e222d] rounded flex justify-between">
                              <span className={c.result === "WON" ? "text-emerald-400" : "text-rose-400"}>{c.assetName}</span>
                              <span className={`font-bold ${c.result === "WON" ? "text-emerald-400" : "text-rose-400"}`}>{c.result}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Trading Controls */}
            <div className="xl:col-span-1 bg-[#0d1117] border-l border-[#1e222d] overflow-y-auto max-h-[calc(100vh-100px)]">
              
              {/* Balance card at top of trading panel */}
              <div className="p-4 border-b border-[#1e222d] bg-gradient-to-r from-[#11152b] to-[#0d1117]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] text-[#6c737f] uppercase tracking-widest font-bold">Your Wallet</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    accountType === "Demo"
                      ? "bg-[#00b59c]/15 text-[#00b59c]"
                      : "bg-[#e95e4b]/15 text-[#e95e4b]"
                  }`}>{accountType}</span>
                </div>
                <div className="text-2xl font-black font-mono text-white tracking-tight">
                  {fmtUSD(accountType === "Demo" ? demoBalance : liveBalance)}
                </div>
                <div className="text-[10px] text-[#6c737f] mt-0.5">
                  {accountType === "Demo" ? "Virtual funds — no real money" : "Real funds — withdrawable via M-Pesa"}
                </div>
                {accountType === "Live" && liveBalance === 0 && (
                  <button
                    onClick={() => setCurrentView("cashier")}
                    className="mt-2 w-full py-1.5 text-[10px] font-bold rounded-lg bg-[#00b59c]/20 text-[#00b59c] border border-[#00b59c]/30 hover:bg-[#00b59c]/30 cursor-pointer transition-all"
                  >
                    + Deposit via M-Pesa
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                
                {/* Trade mode selector */}
                <div>
                  <label className="text-[9px] font-bold text-[#6c737f] uppercase tracking-widest block mb-2">Trade Mode</label>
                  <div className="flex gap-1">
                    {["Rise/Fall", "Digits", "Accumulators"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setTradeMode(mode as any)}
                        className={`flex-1 px-1.5 py-2 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                          tradeMode === mode
                            ? "bg-[#00b59c] text-white shadow-lg shadow-[#00b59c]/25"
                            : "bg-[#11152b] border border-[#1e222d] text-[#6c737f] hover:text-white hover:border-[#2a3050]"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stake Input */}
                <div>
                  <label className="text-[9px] font-bold text-[#6c737f] uppercase tracking-widest block mb-2">Stake (KES)</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.max(50, s - 500))}
                      className="w-9 h-9 bg-[#11152b] hover:bg-[#1a1f35] text-slate-300 border border-[#1e222d] rounded-lg cursor-pointer text-sm font-bold flex items-center justify-center transition-all"
                    >−</button>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(Math.min(50000, Math.max(50, parseInt(e.target.value) || 50)))}
                      className="flex-1 h-9 bg-[#11152b] border border-[#1e222d] rounded-lg text-center text-sm font-mono font-black text-white focus:outline-none focus:border-[#00b59c] focus:ring-1 focus:ring-[#00b59c]/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.min(50000, s + 500))}
                      className="w-9 h-9 bg-[#11152b] hover:bg-[#1a1f35] text-slate-300 border border-[#1e222d] rounded-lg cursor-pointer text-sm font-bold flex items-center justify-center transition-all"
                    >+</button>
                  </div>
                  
                  {/* Quick amounts */}
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {[100, 500, 1000, 5000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setStake(val)}
                        className={`py-1.5 text-[9px] font-bold rounded-lg cursor-pointer transition-all ${
                          stake === val
                            ? "bg-[#00b59c]/15 text-[#00b59c] border border-[#00b59c]/30"
                            : "bg-[#11152b] border border-[#1e222d] text-[#6c737f] hover:text-white hover:border-[#2a3050]"
                        }`}
                      >
                        {val >= 1000 ? `${val/1000}k` : val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-[9px] font-bold text-[#6c737f] uppercase tracking-widest block mb-2">Duration</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 15, 30].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setDuration(sec)}
                        className={`py-2 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                          duration === sec
                            ? "bg-[#e95e4b]/15 text-[#e95e4b] border border-[#e95e4b]/30"
                            : "bg-[#11152b] border border-[#1e222d] text-[#6c737f] hover:text-white hover:border-[#2a3050]"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payout summary card */}
                <div className="rounded-xl bg-[#11152b] border border-[#1e222d] overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2.5 border-b border-[#1e222d]">
                    <span className="text-[10px] text-[#6c737f] font-medium">Asset</span>
                    <span className="text-[10px] font-bold text-white">{selectedAsset.name}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5 border-b border-[#1e222d]">
                    <span className="text-[10px] text-[#6c737f] font-medium">Payout</span>
                    <span className="text-[10px] font-bold text-[#00b59c]">+{selectedAsset.payout}%</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5">
                    <span className="text-[10px] text-[#6c737f] font-medium">Profit if won</span>
                    <span className="text-sm font-mono font-black text-[#00b59c]">
                      {fmtUSD(stake * selectedAsset.payout / 100)}
                    </span>
                  </div>
                </div>

                {/* Trade Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => placeContract("Higher")}
                    className="py-4 bg-gradient-to-b from-[#00c9ad] to-[#00b59c] hover:from-[#00b59c] hover:to-[#009c86] text-white rounded-xl font-black text-xs cursor-pointer shadow-lg shadow-[#00b59c]/30 transition-all active:scale-95 flex flex-col items-center gap-0.5"
                  >
                    <span className="text-base leading-none">▲</span>
                    <span className="text-xs font-black tracking-wide">RISE</span>
                    <span className="text-[9px] font-normal opacity-70">Price goes higher</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => placeContract("Lower")}
                    className="py-4 bg-gradient-to-b from-[#f55070] to-[#e95e4b] hover:from-[#e95e4b] hover:to-[#d94033] text-white rounded-xl font-black text-xs cursor-pointer shadow-lg shadow-[#e95e4b]/30 transition-all active:scale-95 flex flex-col items-center gap-0.5"
                  >
                    <span className="text-base leading-none">▼</span>
                    <span className="text-xs font-black tracking-wide">FALL</span>
                    <span className="text-[9px] font-normal opacity-70">Price goes lower</span>
                  </button>
                </div>

                {/* Active contracts count badge */}
                {activeContracts.length > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      <span className="text-[10px] text-amber-300 font-semibold">{activeContracts.length} contract{activeContracts.length > 1 ? "s" : ""} running</span>
                    </div>
                    <span className="text-[9px] text-amber-400/70">Settling...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: M-PESA CASHIER GATEWAY */}
        {currentView === "cashier" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <Cashier 
                liveBalance={liveBalance} 
                onUpdateBalance={setLiveBalance} 
                accountType={accountType}
                transactions={mpesaTransactions} 
                onAddTransaction={(tx) => setMpesaTransactions((prev) => [tx, ...prev])} 
                userProfile={userProfile}
                onUpdateProfile={handleProfileUpdate}
                onLogout={handleLogout}
              />
            </div>
            
            {/* Cashier Sidebar information */}
            <div className="p-6 bg-[#131722] border border-[#1e222d] rounded-xl space-y-4 shadow-xl">
              <h3 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider">
                Deposit Details
              </h3>
              
              <ul className="space-y-3 text-xs text-slate-400">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 bg-[#00b59c] rounded-full mt-2"></span>
                  <div>
                    <strong className="text-slate-200 font-bold">No deposit fees:</strong> TraderPro254 charges KSh 0 processing cost on any Safaricom push transfer.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 bg-[#00b59c] rounded-full mt-2"></span>
                  <div>
                    <strong className="text-slate-200 font-bold">Express Settlement:</strong> Average waiting period for withdrawal to reflect in your phone log is 2 seconds.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 bg-[#00b59c] rounded-full mt-2"></span>
                  <div>
                    <strong className="text-slate-200 font-bold">Secure Gateway Integration:</strong> We communicate with PayHero API endpoints directly from Server-Side to protect customer data.
                  </div>
                </li>
              </ul>

              <div className="p-3 bg-[#0b0e11] border border-[#1e222d] rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block mb-1">Your Live Balance</span>
                <strong className="text-[#00b59c] text-base font-mono">{fmtUSD(liveBalance)}</strong>
                <div className="text-[9px] text-slate-600 mt-0.5">≈ KSh {liveBalance.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}



        {/* VIEW 3: SIGNALS */}
        {currentView === "ai" && <SignalsView assets={INITIAL_ASSETS} />}

        {/* VIEW 4: EDU ACADEMY */}
        {currentView === "academy" && (
          <div className="space-y-6">
            <EduSection />
          </div>
        )}

      </main>

      {/* LEGAL MODALS */}
      {legalModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setLegalModal(null)}>
          <div className="bg-[#0d1117] border border-[#1e2338] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2338] sticky top-0 bg-[#0d1117]">
              <h2 className="text-sm font-bold text-white">{legalModal === "privacy" ? "Privacy Policy" : "Terms & Conditions"}</h2>
              <button onClick={() => setLegalModal(null)} className="text-[#6c737f] hover:text-white text-xs font-bold cursor-pointer bg-transparent">✕ Close</button>
            </div>
            <div className="px-6 py-5 space-y-5 text-xs text-[#b8bcc4] leading-relaxed">
              {legalModal === "privacy" ? (
                <>
                  <p className="text-[#6c737f] text-[10px]">Effective Date: January 1, 2025 | TraderPro254 Trading Exchange</p>
                  {[
                    ["1. Information We Collect", "We collect information you provide directly, including your name, email address, M-Pesa phone number, and trading activity. We also automatically collect device and usage data when you access our platform."],
                    ["2. How We Use Your Information", "Your information is used to operate and improve the TraderPro254 platform, process M-Pesa deposits and withdrawals via PayHero, send account notifications, detect fraud, and comply with applicable Kenyan financial regulations."],
                    ["3. M-Pesa & Payment Data", "Payment transactions are processed through PayHero and Safaricom's M-Pesa network. We do not store your full M-Pesa PIN or Safaricom credentials. Transaction records are kept for regulatory compliance."],
                    ["4. Data Sharing", "We do not sell your personal data. We share data only with service providers necessary to operate the platform (Firebase, PayHero), and with regulators when required by law."],
                    ["5. Data Security", "We use industry-standard encryption, Firebase Authentication, and server-side API credential management to protect your account. You are responsible for maintaining the confidentiality of your login credentials."],
                    ["6. Your Rights", "You may request access to, correction of, or deletion of your personal data by contacting support@traderpro254.co.ke. Certain data must be retained for regulatory purposes."],
                    ["7. Cookies", "We use essential cookies and localStorage to maintain your session and trading preferences. No third-party advertising cookies are used."],
                    ["8. Contact", "For privacy concerns, email support@traderpro254.co.ke or write to TraderPro254 Trading Exchange, Nairobi, Kenya."],
                  ].map(([title, body]) => (
                    <div key={title}>
                      <h3 className="text-white font-bold text-xs mb-1">{title}</h3>
                      <p>{body}</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <p className="text-[#6c737f] text-[10px]">Effective Date: January 1, 2025 | TraderPro254 Trading Exchange</p>
                  <div className="p-3 bg-[#e95e4b]/10 border border-[#e95e4b]/30 rounded-lg text-[#e95e4b] text-[10px] font-semibold">
                    ⚠ Risk Warning: Binary options trading involves significant risk. You may lose all deposited funds. Only trade with money you can afford to lose. This platform is intended for users aged 18 and above.
                  </div>
                  {[
                    ["1. Eligibility", "You must be at least 18 years old and a resident of Kenya to use TraderPro254. By registering, you confirm that binary options trading is legal in your jurisdiction."],
                    ["2. Account Responsibility", "You are fully responsible for all activity under your account. Do not share your login credentials. TraderPro254 is not liable for losses resulting from unauthorized account access."],
                    ["3. Deposits & Withdrawals", "Deposits are processed via M-Pesa STK Push through PayHero. Minimum deposit is KSh 250. Withdrawals are subject to a minimum of KSh 1,000 and identity verification. All amounts are displayed in USD for international clarity; transactions are settled in KSh at the prevailing rate."],
                    ["4. Trading Rules", "All trades are final once placed. TraderPro254 reserves the right to void trades in cases of platform errors. Demo account funds are virtual and have no real-world value."],
                    ["5. Prohibited Activities", "Market manipulation, use of automated trading bots, multiple accounts per user, and money laundering are strictly prohibited and will result in immediate account termination."],
                    ["6. Payouts", "Winning trades are credited to your live account balance immediately. The displayed payout percentage is fixed at the time of trade placement and is not subject to change after confirmation."],
                    ["7. Limitation of Liability", "TraderPro254 is not liable for losses due to market volatility, network outages, M-Pesa service interruptions, or force majeure events. Maximum liability is limited to the amount deposited."],
                    ["8. Governing Law", "These terms are governed by the laws of Kenya. Any disputes shall be resolved through arbitration in Nairobi, Kenya."],
                  ].map(([title, body]) => (
                    <div key={title}>
                      <h3 className="text-white font-bold text-xs mb-1">{title}</h3>
                      <p>{body}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOGIN/REGISTER TRANSLUCENT MODAL OVERLAY */}
      {isAuthOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 transition-all duration-300 backdrop-blur-sm" id="traderpro-global-auth-modal">
          <div className="max-w-md w-full relative">
            <button
              onClick={() => setIsAuthOpen(false)}
              className="absolute -top-10 right-0 p-1 text-slate-450 hover:text-white font-mono text-sm tracking-tight cursor-pointer focus:outline-none flex items-center gap-1 bg-transparent"
            >
              Cancel ✕
            </button>
            <AuthPanel 
              onAuthSuccess={handleAuthSuccess} 
              onClose={() => setIsAuthOpen(false)} 
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#0a0e18] border-t border-[#1e2338]/40 py-5 text-center text-[11px] text-[#6c737f]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="font-medium">© {new Date().getFullYear()} TraderPro254 Trading Exchange. All rights reserved.</span>
          <div className="flex gap-6">
            <button className="hover:text-white transition-colors font-medium cursor-pointer bg-transparent">Risk Management</button>
            <button onClick={() => setLegalModal("terms")} className="hover:text-white transition-colors font-medium cursor-pointer bg-transparent">Terms & Conditions</button>
            <button onClick={() => setLegalModal("privacy")} className="hover:text-white transition-colors font-medium cursor-pointer bg-transparent">Privacy Policy</button>
          </div>
        </div>
      </footer>

    </div>
    </ErrorBoundary>
  );
}
