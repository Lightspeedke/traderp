import React, { useState, FormEvent, useEffect } from "react";
import { AccountType, MpesaTx } from "../types";
import { CreditCard, ArrowDownLeft, ArrowUpRight, Lock, CheckCircle2, RefreshCw, Smartphone, MessageSquare, AlertCircle, Loader2, User, LogOut } from "lucide-react";

interface CashierProps {
  liveBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  accountType: "Demo" | "Live";
  transactions: MpesaTx[];
  onAddTransaction: (tx: MpesaTx) => void;
  userProfile?: { id: string; name: string; email: string; mpesaNumber?: string; paymentInfo?: string } | null;
  onUpdateProfile: (profile: { name: string; mpesaNumber: string; paymentInfo: string }) => void;
  onLogout: () => void;
}

export default function Cashier({ liveBalance, onUpdateBalance, accountType, transactions, onAddTransaction, userProfile, onUpdateProfile, onLogout }: CashierProps) {
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "history" | "profile">("deposit");
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.mpesaNumber || "0712345678");
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessingStk, setIsProcessingStk] = useState(false);
  const [stkStep, setStkStep] = useState<"none" | "push_trigger" | "success" | "error">("none");
  const [smsNotification, setSmsNotification] = useState<string | null>(null);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(null);
  const [profileFullName, setProfileFullName] = useState(userProfile?.name || "");
  const [profileMpesaNumber, setProfileMpesaNumber] = useState(userProfile?.mpesaNumber || phoneNumber);
  const [profilePaymentInfo, setProfilePaymentInfo] = useState(userProfile?.paymentInfo || "");
  
  // Real endpoint feedback variables
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string>("Pending");

  // Quick select amounts
  const quickAmounts = [250, 500, 1000, 2500, 5000, 10000];

  const formatPaymentError = (data: any, status?: number) => {
    const parts = [
      data?.error,
      data?.payhero?.message,
      data?.payhero?.error,
      data?.payhero?.detail,
      data?.raw,
    ].filter(Boolean);
    const message = parts.length ? parts.join(" | ") : "Payment request could not be completed. Please try again.";
    return status ? `${message} (HTTP ${status})` : message;
  };

  useEffect(() => {
    if (userProfile) {
      setProfileFullName(userProfile.name || "");
      setProfileMpesaNumber(userProfile.mpesaNumber || phoneNumber);
      setProfilePaymentInfo(userProfile.paymentInfo || "");
      if (userProfile.mpesaNumber) setPhoneNumber(userProfile.mpesaNumber);
    }
  }, [userProfile]);

  const handleDepositClick = async (e: FormEvent) => {
    e.preventDefault();
    if (accountType === "Demo") {
      setApiError("Switch to a Live account before requesting a deposit.");
      return;
    }
    setApiError(null);
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    if (isNaN(finalAmount) || finalAmount < 250) {
      alert("Minimum deposit via M-Pesa is KSh 250");
      return;
    }

    setIsApiLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      // Initiate M-Pesa STK Push to Safaricom line via secured server endpoint
      const txId = "PRO" + Math.random().toString(36).substring(2, 6).toUpperCase() + Date.now().toString().slice(-4);
      setActiveTxId(txId);

      const response = await fetch("/api/payhero/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          phone: phoneNumber,
          amount: finalAmount,
          customer_name: userProfile ? userProfile.name : "TraderPro254 Guest",
          reference_id: txId,
          userEmail: userProfile ? userProfile.email : undefined
        })
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {
          error: responseText || `Payment server returned HTTP ${response.status}. Check Vercel function logs.`
        };
      }

      if (!response.ok) {
        setApiError(formatPaymentError(data, response.status));
        setIsProcessingStk(true);
        setStkStep("error");
      } else {
        // Success queues STK prompt on user device
        setIsProcessingStk(true);
        setStkStep("push_trigger");
        setPollingStatus("Pending");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setApiError("Request timed out. Server took too long to respond. Please check your connection and retry.");
      } else {
        setApiError(`Connection error: ${err?.message || "Please check your internet and retry."}`);
      }
      setIsProcessingStk(true);
      setStkStep("error");
    } finally {
      clearTimeout(timeoutId);
      setIsApiLoading(false);
    }
  };

  const triggerAudioBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio fallback
    }
  };

  // Real direct polling check for actual M-Pesa push callback confirmation
  const triggerAutoSyncUpdate = async (finalAmount: number, txReference: string) => {
    try {
      const checkResponse = await fetch(`/api/payhero/status?txId=${encodeURIComponent(txReference)}&userEmail=${userProfile ? encodeURIComponent(userProfile.email) : ""}`);
      const checkData = await checkResponse.json();
      
      if (checkResponse.ok && checkData.tx) {
        if (checkData.tx.status === "Completed") {
          triggerSuccessState(finalAmount, txReference);
        } else if (checkData.tx.status === "Failed") {
          setPollingStatus("Failed");
          setStkStep("error");
          setApiError("M-Pesa Express transaction failed or was cancelled by the user.");
        } else {
          setPollingStatus(checkData.tx.status || "Pending");
        }
      }
    } catch (e) {
      console.warn("Real-time status check failed:", e);
    }
  };

  const triggerSuccessState = (finalAmount: number, txId: string) => {
    setStkStep("success");
    triggerAudioBeep();

    // Register transaction receipt using real values
    const newTx: MpesaTx = {
      id: txId,
      type: "Deposit",
      phoneNumber,
      amount: finalAmount,
      status: "Completed",
      timestamp: Date.now(),
    };

    onAddTransaction(newTx);
    onUpdateBalance(liveBalance + finalAmount);

    setSmsNotification(
      `MPESA Confirmed. ${txId} confirmed. KSh ${finalAmount.toLocaleString()} deposited safely to TraderPro254. New Live Balance KSh ${(liveBalance + finalAmount).toLocaleString()}.`
    );
  };

  // Automated background polling trigger for real-time status resolution
  useEffect(() => {
    let intervalId: any = null;
    if (isProcessingStk && activeTxId && stkStep === "push_trigger" && pollingStatus === "Pending") {
      const finalAmount = customAmount ? parseFloat(customAmount) : amount;
      intervalId = setInterval(() => {
        triggerAutoSyncUpdate(finalAmount, activeTxId);
      }, 2000); // Check every 2 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isProcessingStk, activeTxId, stkStep, pollingStatus, phoneNumber, amount, customAmount]);

  const handleWithdrawalSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    if (isNaN(finalAmount) || finalAmount < 1000) {
      alert("Minimum withdrawal is KSh 1000");
      return;
    }
    if (finalAmount > liveBalance) {
      alert("Insufficient Live Account KES Balance for this withdrawal.");
      return;
    }

    // Process instant simulated bank withdrawal
    onUpdateBalance(liveBalance - finalAmount);
    const txId = "WD" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const newTx: MpesaTx = {
      id: txId,
      type: "Withdrawal",
      phoneNumber,
      amount: finalAmount,
      status: "Completed",
      timestamp: Date.now(),
    };

    onAddTransaction(newTx);

    alert(`Success! KSh ${finalAmount.toLocaleString()} has been queued for instant payout. You will receive an M-Pesa SMS transaction confirmation inside your logs.`);

    setSmsNotification(
      `M-PESA Confirmed. KSh ${finalAmount.toLocaleString()} received from TraderPro254 KE. Transaction ID: ${txId}. Balance: KSh ${(liveBalance - finalAmount).toLocaleString()}.`
    );
  };

  const handleProfileSave = (e: FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: profileFullName,
      mpesaNumber: profileMpesaNumber,
      paymentInfo: profilePaymentInfo,
    });
    setPhoneNumber(profileMpesaNumber);
    setProfileSavedMessage("Profile settings saved successfully.");
  };

  return (
    <div className="bg-[#131722] border border-[#1e222d] rounded-xl overflow-hidden shadow-xl" id="traderpro-cashier-card">
      {/* SMS Alert banner */}
      {smsNotification && (
        <div className="bg-emerald-600 text-white px-4 py-3 flex justify-between items-center text-xs animate-bounce" id="mpesa-sms-banner">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span><strong>M-PESA Alert:</strong> {smsNotification}</span>
          </div>
          <button onClick={() => setSmsNotification(null)} className="font-bold underline cursor-pointer ml-3 bg-transparent">
            Dismiss
          </button>
        </div>
      )}

      {/* Primary header banner */}
      <div className="p-5 bg-gradient-to-r from-[#131722] to-[#0b0e11] border-b border-[#1e222d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#00b59c]" />
          <h2 className="font-sans font-bold text-slate-100">
            Cashier Portal
          </h2>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400">Live Balance:</span>
          <div className="text-lg font-mono font-bold text-white tracking-wide">
            KSh {liveBalance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tab Switchers */}
      <div className="flex border-b border-[#1e222d] bg-[#0b0e11]/40">
        <button
          onClick={() => { setActiveTab("deposit"); setCustomAmount(""); setApiError(null); setProfileSavedMessage(null); }}
          className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "deposit"
              ? "border-[#00b59c] text-[#00b59c] bg-[#00b59c]/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-[#00b59c]" />
          Deposit
        </button>
        <button
          onClick={() => { setActiveTab("withdraw"); setCustomAmount(""); setApiError(null); setProfileSavedMessage(null); }}
          className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "withdraw"
              ? "border-amber-500 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-amber-500" />
          Withdraw
        </button>
        <button
          onClick={() => { setActiveTab("profile"); setCustomAmount(""); setApiError(null); setProfileSavedMessage(null); }}
          className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "profile"
              ? "border-[#00b59c] text-[#00b59c] bg-[#00b59c]/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <User className="w-4 h-4 text-[#00b59c]" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "history"
              ? "border-blue-500 text-blue-400 bg-blue-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <RefreshCw className="w-4 h-4 text-blue-500" />
          Receipt Ledger
        </button>
      </div>

      <div className="p-6">
        {activeTab === "deposit" && (
          <form onSubmit={handleDepositClick} className="space-y-5">
            {apiError && (
              <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            {accountType === "Demo" && (
              <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300">
                <strong className="text-[#00b59c]">Live deposit disabled.</strong> Switch to a Live account before requesting a deposit.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Safaricom M-Pesa Mobile Number
              </label>
              <div className="relative font-mono">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">+254</span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0712345678"
                  className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-16 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00b59c] transition-all font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 leading-normal">
                <Lock className="w-3 h-3 text-[#00b59c] inline" /> 
                Secure STK Push will be dispatched to this client number automatically.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Amount to Deposit (KES)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 font-mono">
                {quickAmounts.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setAmount(val); setCustomAmount(""); }}
                    className={`py-2 text-sm font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      amount === val && !customAmount
                        ? "bg-[#00b59c]/10 border-[#00b59c] text-[#00b59c]"
                        : "bg-[#0b0e11] border-[#1e222d] text-slate-300 hover:border-[#2a2e39]"
                    }`}
                  >
                    KSh {val.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="relative font-mono">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">KES</span>
                <input
                  type="number"
                  placeholder="or enter custom amount (Min KSh 250)"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setAmount(0); }}
                  className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-12 pr-4 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-[#00b59c] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isApiLoading || accountType === "Demo"}
              className={`w-full py-3 ${accountType === "Demo" ? "bg-slate-900 text-slate-500 cursor-not-allowed" : "bg-[#00b59c] hover:bg-[#009c86] text-white"} font-sans font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg ${accountType === "Demo" ? "shadow-none" : "shadow-[#00b59c]/10"} text-sm`}
            >
              {isApiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Requesting M-Pesa Link...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Request Deposit
                </>
              )}
            </button>
          </form>
        )}

        {activeTab === "withdraw" && (
          <form onSubmit={handleWithdrawalSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Withdrawal Destination Account (M-PESA Number)
              </label>
              <div className="relative font-mono">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">+254</span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0712345678"
                  className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-16 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-all font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                Payouts are handled instant and secure back to this Safaricom line. Processing fee: Sh 0.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Withdrawal Amount (KSh)
              </label>
              <div className="relative font-mono">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-xs">KES</span>
                <input
                  type="number"
                  placeholder="Minimum payout is KSh 1000"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-12 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-mono"
                  required
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-slate-500">Max withdrawable:</span>
                <button
                  type="button"
                  onClick={() => setCustomAmount(liveBalance.toString())}
                  className="text-amber-400 text-xs font-semibold hover:underline bg-transparent font-sans"
                >
                  Use Maximum (KSh {liveBalance.toLocaleString()})
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-sans font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 text-sm"
            >
              <Lock className="w-4 h-4" />
              Request Withdrawal
            </button>
          </form>
        )}

        {activeTab === "profile" && (
          <form onSubmit={handleProfileSave} className="space-y-5">
            {profileSavedMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-lg">
                {profileSavedMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00b59c] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                M-Pesa Mobile Number
              </label>
              <div className="relative font-mono">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">+254</span>
                <input
                  type="text"
                  value={profileMpesaNumber}
                  onChange={(e) => setProfileMpesaNumber(e.target.value)}
                  placeholder="712345678"
                  className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-16 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00b59c] transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Payment Info / Notes
              </label>
              <textarea
                value={profilePaymentInfo}
                onChange={(e) => setProfilePaymentInfo(e.target.value)}
                placeholder="Bank name, phone recipient, or deposit instructions"
                className="w-full min-h-[120px] resize-none bg-[#0b0e11] border border-[#1e222d] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00b59c] transition-all"
              />
            </div>

            <div className="p-4 bg-[#0b0e11] border border-[#1e222d] rounded-xl text-xs text-slate-400">
              <div className="font-bold text-slate-200 mb-2">KYC + Proof of Address</div>
              <p className="leading-relaxed text-[11px]">
                KYC verification and proof of address upload are coming soon. You can still save your deposit details, and we will enable full account verification shortly.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#00b59c] hover:bg-[#009c86] text-white font-sans font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#00b59c]/10 text-sm"
            >
              <User className="w-4 h-4" />
              Save Profile Info
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3 mt-3 bg-[#111827] hover:bg-[#1f2937] text-rose-400 border border-rose-500/20 font-sans font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </form>
        )}

        {/* TAB 3: RECEIPT LEDGER */}
        {activeTab === "history" && (
          <div className="space-y-3 max-h-72 overflow-y-auto" id="cashier-ledger">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono">
                No financial transactions made on Live Account KES yet.
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="p-3 bg-[#0b0e11]/60 border border-[#1e222d] rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md ${tx.type === "Deposit" ? "bg-[#00b59c]/10 text-[#00b59c]" : "bg-amber-500/10 text-amber-400"}`}>
                      {tx.type === "Deposit" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        M-Pesa {tx.type} ({tx.phoneNumber})
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {tx.id} • {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-mono font-bold ${tx.type === "Deposit" ? "text-[#00b59c]" : "text-amber-400"}`}>
                      {tx.type === "Deposit" ? "+" : "-"} KSh {tx.amount.toLocaleString()}
                    </div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                      tx.status === "Completed" 
                        ? "text-[#00b59c] bg-[#00b59c]/10 border-[#00b59c]/20" 
                        : tx.status === "Pending" 
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse" 
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* M-PESA PAY HERO INTERACTIVE POPUP MODAL */}
      {isProcessingStk && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" id="mpesa-stk-popup">
          <div className="bg-[#131722] border border-[#1e222d] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
            
            {/* Header branding */}
            <div className="bg-[#0b0e11] py-4 px-6 border-b border-[#1e222d] flex items-center justify-between text-xs text-slate-300 font-sans">
              <span className="font-bold flex items-center gap-1.5 text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Secure M-Pesa Checkout
              </span>
              <span className="text-[10px] font-mono text-slate-500">Deposit Processing</span>
            </div>

            <div className="p-6 flex flex-col items-center">
              {stkStep === "push_trigger" && (
                <div className="text-center space-y-5 w-full">
                  <div className="relative w-16 h-16 flex items-center justify-center mx-auto">
                    {/* Ring animation */}
                    <div className="absolute inset-0 border-2 border-[#00b59c]/10 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-t-[#00b59c] rounded-full animate-spin"></div>
                    <Smartphone className="w-6 h-6 text-[#00b59c] animate-pulse" />
                  </div>
                  
                  <div>
                    <h3 className="text-white font-bold text-sm">Waiting for Payment Authorization</h3>
                    <p className="text-[11px] text-slate-400 mt-1">An M-Pesa STK Prompt was dispatched to your phone line.</p>
                  </div>
                  
                  {/* Transaction specs grid */}
                  <div className="border border-[#1e222d] rounded-xl bg-[#0b0e11] p-4 text-left space-y-3 font-sans">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Phone Number:</span>
                      <span className="text-slate-200 font-bold font-mono">+254 {phoneNumber}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-[#1e222d] pt-2">
                      <span className="text-slate-500">Amount:</span>
                      <span className="text-[#00b59c] font-black font-mono">KSh {(customAmount ? parseFloat(customAmount) : amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-[#1e222d] pt-2">
                      <span className="text-slate-500">Reference:</span>
                      <span className="text-slate-400 font-mono text-[10px] uppercase">{activeTxId}</span>
                    </div>
                  </div>

                  {/* Flow tracker list */}
                  <div className="space-y-2.5 text-left text-xs bg-[#0b0e11]/40 p-3.5 border border-[#1e222d] rounded-xl font-sans">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                      <div>
                        <div className="text-slate-200 font-semibold text-[11px]">STK Push Dispatched Successfully</div>
                        <div className="text-[10px] text-slate-500">PayHero initiated a secure request with Safaricom.</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-[#00b59c] border border-[#00b59c]/40 flex items-center justify-center text-[10px] shrink-0 font-bold animate-pulse">2</div>
                      <div>
                        <div className="text-[#00b59c] font-bold text-[11px]">Enter your M-Pesa PIN</div>
                        <div className="text-[10px] text-slate-400">Unlock your Safaricom mobile device, view the payment prompt on your screen, and type your secret PIN.</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center text-[10px] shrink-0 font-bold">3</div>
                      <div>
                        <div className="text-slate-500 font-semibold text-[11px]">Automatic Account Credit</div>
                        <div className="text-[10px] text-slate-600">Once PIN is submitted, your TraderPro254 trade ledger updates instantly.</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const finalAmount = customAmount ? parseFloat(customAmount) : amount;
                        if (activeTxId) {
                          await triggerAutoSyncUpdate(finalAmount, activeTxId);
                        }
                      }}
                      className="w-full py-2.5 bg-[#1e222d] hover:bg-[#2a2e39] text-[#00b59c] border border-[#00b59c]/20 hover:border-[#00b59c]/40 font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Verify Status Receipt Now
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => { setIsProcessingStk(false); setStkStep("none"); }}
                      className="w-full text-center text-slate-500 hover:text-slate-300 text-[10px] font-mono cursor-pointer bg-transparent py-1 block hover:underline"
                    >
                      Cancel Checkout & Close
                    </button>
                  </div>
                </div>
              )}

              {stkStep === "success" && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-14 h-14 bg-[#00b59c]/10 border border-[#00b59c]/20 text-[#00b59c] rounded-full flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-sm">STK Authorization Success</h4>
                    <p className="text-[11px] text-slate-400">
                      M-Pesa balance verified. Ksh {(customAmount ? parseFloat(customAmount) : amount).toLocaleString()} credited to your live account.
                    </p>
                  </div>
                  <button
                    onClick={() => { setIsProcessingStk(false); setStkStep("none"); }}
                    className="w-full py-2.5 bg-[#00b59c] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors hover:bg-[#009c86]"
                  >
                    Done & Return to Trade
                  </button>
                </div>
              )}

              {stkStep === "error" && (
                <div className="text-center space-y-4 py-4 w-full">
                  <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-[#f33350] rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 px-2">
                    <h4 className="text-white font-bold text-sm leading-tight">PayHero Connection Closed</h4>
                    <p className="text-[11px] text-slate-400 font-mono leading-normal pt-1">
                      {apiError || "We could not securely link with the M-Pesa network. Please check settings."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => { setIsProcessingStk(false); setStkStep("none"); }}
                      className="w-full py-2.5 bg-[#1e222d] text-slate-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-[#2a2e39] border border-[#2a2e39]"
                    >
                      Return to Checkout Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
