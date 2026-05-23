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

export default function App() {
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
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

      {/* Professional Trading Platform Header - Deriv Style */}
      <header className="bg-gradient-to-b from-[#11152b] to-[#0a0e18]/95 border-b border-[#1e2338] sticky top-0 z-40 backdrop-blur-md px-4 sm:px-6 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#00b59c]/20 to-[#00b59c]/10 border border-[#00b59c]/30">
              <Activity className="w-5 h-5 text-[#00b59c]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tighter text-white">TraderPro254</h1>
                <span className="text-[9px] font-bold text-[#e95e4b] bg-[#e95e4b]/15 px-2 py-1 rounded-full border border-[#e95e4b]/30 font-mono">
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-[#6c737f] hidden sm:block font-medium">Binary & Options Trading</p>
            </div>
          </div>

          {/* Account Type Switcher */}
          <div className="flex items-center gap-2 bg-[#11152b] border border-[#1e2338] p-1 rounded-lg">
            {/* Demo Account */}
            <button
              onClick={() => setAccountType("Demo")}
              className={`px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                accountType === "Demo"
                  ? "bg-[#00b59c]/20 text-[#00b59c] border border-[#00b59c]/40"
                  : "text-[#b8bcc4] hover:text-white"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${accountType === "Demo" ? "bg-[#00b59c]" : "bg-[#6c737f]"}`}></div>
              Demo
            </button>

            {/* Live Account */}
            <button
              onClick={() => {
                if (!authToken) {
                  showNotification("Login required for Live trading", false);
                  setIsAuthOpen(true);
                  return;
                }
                setAccountType("Live");
              }}
              className={`px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                accountType === "Live"
                  ? "bg-[#e95e4b]/20 text-[#e95e4b] border border-[#e95e4b]/40"
                  : "text-[#b8bcc4] hover:text-white"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${accountType === "Live" ? "bg-[#e95e4b]" : "bg-[#6c737f]"}`}></div>
              Live
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Balance Display - Professional Card */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#11152b] border border-[#1e2338] backdrop-blur-sm hover:border-[#00b59c]/30 transition-colors">
              <div className="text-right">
                <span className="text-[10px] text-[#6c737f] uppercase tracking-wider font-semibold block mb-1">
                  {accountType} Balance
                </span>
                <div className="text-lg font-mono font-bold text-white">
                  KSh {accountType === "Demo" ? demoBalance.toLocaleString() : liveBalance.toLocaleString()}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold border ${
                accountType === "Demo"
                  ? 'bg-[#00b59c]/10 border-[#00b59c]/30 text-[#00b59c]'
                  : liveBalance > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-[#e95e4b]/10 border-[#e95e4b]/30 text-[#e95e4b]'
              }`}>
                {accountType === "Demo" ? "T" : liveBalance > 0 ? "L" : "!"}
              </div>
            </div>

            {/* User Authentication Status */}
            <div className="border-t border-[#1e2338] pt-4 md:border-t-0 md:border-l md:pl-4 flex items-center gap-3 w-full md:w-auto">
              {authToken && userProfile ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <span className="text-[9px] text-[#00b59c] font-bold block leading-none tracking-wider">VERIFIED</span>
                    <strong className="text-xs text-white font-semibold">{userProfile.name}</strong>
                  </div>
                  <button
                    onClick={() => setCurrentView("cashier")}
                    className="px-3 py-2 rounded-lg bg-[#00b59c] text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 transition-all hover:bg-[#00a389] active:scale-95"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cashier</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-4 py-2 bg-[#e95e4b] hover:bg-[#d94033] text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Email Verification check banner */}

      {/* Navigation Tabs */}
      <div className="bg-[#0a0e18] border-b border-[#1e2338]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0 text-xs overflow-x-auto py-0 scrollbar-none">
          <button
            onClick={() => setCurrentView("trade")}
            className={`py-4 px-4 border-b-2 transition-colors font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              currentView === "trade"
                ? "border-[#00b59c] text-[#00b59c]"
                : "border-transparent text-[#b8bcc4] hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trading Desk
          </button>
          
          <button
            onClick={() => setCurrentView("cashier")}
            className={`py-4 px-4 border-b-2 transition-colors font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              currentView === "cashier"
                ? "border-[#00b59c] text-[#00b59c]"
                : "border-transparent text-[#b8bcc4] hover:text-white"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Cashier
          </button>
          
          <button
            onClick={() => setCurrentView("ai")}
            className={`py-4 px-4 border-b-2 transition-colors font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              currentView === "ai"
                ? "border-[#00b59c] text-[#00b59c]"
                : "border-transparent text-[#b8bcc4] hover:text-white"
            }`}
          >
            <Zap className="w-4 h-4" />
            Signals
          </button>
          
          <button
            onClick={() => setCurrentView("academy")}
            className={`py-4 px-4 border-b-2 transition-colors font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              currentView === "academy"
                ? "border-[#00b59c] text-[#00b59c]"
                : "border-transparent text-[#b8bcc4] hover:text-white"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Academy
          </button>
        </div>
      </div>

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
            <div className="xl:col-span-1 bg-[#131722]/50 border-l border-[#1e222d] overflow-y-auto max-h-[calc(100vh-180px)]">
              <div className="p-4 space-y-4">
                
                {/* Trade mode selector */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Trade Mode</label>
                  <div className="flex gap-1.5">
                    {["Rise/Fall", "Digits", "Accumulators"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setTradeMode(mode as any)}
                        className={`flex-1 px-2 py-2 text-[10px] font-bold rounded cursor-pointer transition-all ${
                          tradeMode === mode
                            ? "bg-[#00b59c] text-white shadow-lg shadow-[#00b59c]/20"
                            : "bg-[#0b0e11] border border-[#1e222d] text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stake Input */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Stake (KES)</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.max(50, s - 500))}
                      className="px-2 py-2 bg-[#0b0e11] hover:bg-slate-900 text-slate-400 border border-[#1e222d] rounded cursor-pointer text-xs font-bold"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(Math.min(50000, Math.max(50, parseInt(e.target.value) || 50)))}
                      className="flex-1 bg-[#0b0e11] border border-[#1e222d] rounded text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-[#00b59c]"
                    />
                    <button
                      type="button"
                      onClick={() => setStake((s) => Math.min(50000, s + 500))}
                      className="px-2 py-2 bg-[#0b0e11] hover:bg-slate-900 text-slate-400 border border-[#1e222d] rounded cursor-pointer text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Quick amounts */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {[100, 500, 1000, 5000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setStake(val)}
                        className={`py-1.5 text-[9px] font-bold rounded cursor-pointer transition-all ${
                          stake === val
                            ? "bg-[#00b59c]/10 text-[#00b59c] border border-[#00b59c]/30"
                            : "bg-[#0b0e11] border border-[#1e222d] text-slate-400 hover:border-[#2a2e39]"
                        }`}
                      >
                          Sh {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Duration</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[5, 10, 15, 30].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setDuration(sec)}
                        className={`py-2 text-xs font-bold rounded cursor-pointer transition-all ${
                          duration === sec
                            ? "bg-[#f33350]/10 text-[#f33350] border border-[#f33350]/30"
                            : "bg-[#0b0e11] border border-[#1e222d] text-slate-400 hover:border-[#2a2e39]"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payout Display */}
                <div className="bg-[#0b0e11] border border-[#1e222d] p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Payout:</span>
                    <span className="font-bold text-[#00b59c]">+{selectedAsset.payout}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-[#1e222d] pt-2">
                    <span className="text-slate-400">Profit Potential:</span>
                    <span className="font-mono font-bold text-[#00b59c]">KSh {(stake * selectedAsset.payout / 100).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </div>
                </div>

                {/* Trade Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => placeContract("Higher")}
                    className="py-3 bg-[#00b59c] hover:bg-[#009c86] text-white rounded-lg font-bold text-xs cursor-pointer shadow-lg shadow-[#00b59c]/20 transition-all active:scale-95 flex flex-col items-center gap-0.5"
                  >
                    <span>▲ RISE</span>
                    <span className="text-[9px] font-normal opacity-80">Higher</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => placeContract("Lower")}
                    className="py-3 bg-[#f33350] hover:bg-[#d01d37] text-white rounded-lg font-bold text-xs cursor-pointer shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex flex-col items-center gap-0.5"
                  >
                    <span>▼ FALL</span>
                    <span className="text-[9px] font-normal opacity-80">Lower</span>
                  </button>
                </div>
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
                <span className="text-[10px] text-slate-500 block mb-1">Your Live Balance:</span>
                <strong className="text-[#00b59c] text-base font-mono">
                  KSh {liveBalance.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>
        )}



        {/* VIEW 4: EDU ACADEMY */}
        {currentView === "academy" && (
          <div className="space-y-6">
            <EduSection />
          </div>
        )}

      </main>

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
            <button className="hover:text-white transition-colors font-medium">Risk Management</button>
            <button className="hover:text-white transition-colors font-medium">Terms & Conditions</button>
            <button className="hover:text-white transition-colors font-medium">Privacy Policy</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
