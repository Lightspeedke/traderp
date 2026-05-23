import React, { useState, FormEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { Lock, Mail, User as UserIcon, Shield, CheckCircle2, AlertCircle, Key, ArrowRight } from "lucide-react";
import { auth } from "../firebaseApp";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  liveBalance: number;
  demoBalance: number;
  mpesaNumber: string;
  paymentInfo: string;
}

interface AuthPanelProps {
  onAuthSuccess: (token: string, profile: UserProfile) => void;
  onClose: () => void;
}

export default function AuthPanel({ onAuthSuccess, onClose }: AuthPanelProps) {
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; success: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Simulated secure notification displayed during password reset or account actions
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);

  const displayMessage = (text: string, success: boolean) => {
    setFeedback({ text, success });
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);

    try {
      const resp = await signInWithEmailAndPassword(auth, email, password);
      const user = resp.user;
      const profile: UserProfile = {
        id: user.uid,
        email: user.email || email,
        name: user.displayName || email.split("@")[0],
        emailVerified: user.emailVerified,
        liveBalance: Number(localStorage.getItem("traderPro_liveBalance") || 0) || 0,
        demoBalance: Number(localStorage.getItem("traderPro_demoBalance") || 1000000) || 1000000,
        mpesaNumber: localStorage.getItem("traderPro_mpesaNumber") || "",
        paymentInfo: localStorage.getItem("traderPro_paymentInfo") || "",
      };

      localStorage.setItem("traderPro_token", user.uid);
      localStorage.setItem("traderPro_profile", JSON.stringify(profile));
      displayMessage("Ahlan! Login successful.", true);
      setTimeout(() => {
        onAuthSuccess(user.uid, profile);
        onClose();
      }, 800);
    } catch (err: any) {
      displayMessage(err.message || "Authentication failed.", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setIsLoading(true);

    try {
      const resp = await createUserWithEmailAndPassword(auth, email, password);
      const user = resp.user;
      await updateProfile(user, { displayName: name });

      const profile: UserProfile = {
        id: user.uid,
        email: user.email || email,
        name,
        emailVerified: true,
        liveBalance: 100,
        demoBalance: 1000000,
        mpesaNumber: "",
        paymentInfo: "",
      };
      localStorage.setItem("traderPro_profile", JSON.stringify(profile));
      localStorage.setItem("traderPro_token", user.uid);

      displayMessage("Registration successful. You may now log in.", true);
      setTimeout(() => {
        onAuthSuccess(user.uid, profile);
        onClose();
      }, 1200);
    } catch (err: any) {
      displayMessage(err.message || "Registration failed.", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSimulatedCode("Password reset email sent. Check your inbox.");
      displayMessage("Reset email sent successfully.", true);
      setTimeout(() => {
        setAuthMode("login");
      }, 1500);
    } catch (err: any) {
      displayMessage(err.message || "Cannot process reset request.", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      displayMessage("Use the reset link in your email to complete the password change.", true);
      setSimulatedCode(null);
      setTimeout(() => {
        setAuthMode("login");
        setPassword("");
      }, 1500);
    } catch (err: any) {
      displayMessage(err.message || "Cannot confirm reset.", false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#131722] border border-[#1e222d] rounded-2xl p-6 shadow-2xl space-y-5 max-w-md w-full mx-auto" id="traderpro-auth-panel">
      {/* Visual Identity Title */}
      <div className="text-center space-y-1">
        <h3 className="text-lg font-black tracking-tight text-white">
          {authMode === "login" && "Login to TraderPro254"}
          {authMode === "register" && "Create TraderPro254 Profile"}
          {authMode === "forgot" && "Recover Security Portal"}
          {authMode === "reset" && "Secure Password Reset"}
        </h3>
        <p className="text-xs text-slate-400">
          {authMode === "login" && "Safaricom top-ups and live trading account dashboard."}
          {authMode === "register" && "Create your secure trading account and credentials instantly."}
          {authMode === "forgot" && "Send a password reset email to your account."}
          {authMode === "reset" && "Update your credentials with a new password."}
        </p>
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg flex items-center gap-2 border text-xs leading-relaxed animate-fade-in ${
          feedback.success 
            ? "bg-[#064e3b]/80 border-[#00b59c] text-emerald-100" 
            : "bg-[#111827] border-red-500/20 text-red-200"
        }`}>
          {feedback.success ? (
            <CheckCircle2 className="w-4 h-4 text-[#00b59c] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Verification Code Dispatch Visual Card */}
      {simulatedCode && (
        <div className="bg-[#1a2333]/90 border border-emerald-500/30 rounded-xl p-3 text-center space-y-1 animation-pulse">
          <span className="text-[10px] font-mono tracking-wider uppercase text-emerald-400 font-bold block">
            [SECURE SYSTEM TRANSACTION CODE]
          </span>
          <span className="text-lg font-mono font-black text-emerald-500 tracking-widest block">
            {simulatedCode}
          </span>
          <span className="text-[9px] text-slate-400 font-medium block">
            Secure account messages and reset confirmations appear here.
          </span>
        </div>
      )}

      {/* Auth Modes forms */}
      {authMode === "login" && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-[#00b59c]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Profile Password</label>
              <button 
                type="button" 
                onClick={() => setAuthMode("forgot")}
                className="text-[9px] text-[#f33350] hover:underline font-bold bg-transparent pr-1"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00b59c]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#f33350] hover:bg-[#d01d37] disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow shadow-[#f33350]/10"
          >
            Authenticate Trader
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-[11px] text-slate-400">
            First time trading TraderPro254?{" "}
            <button
              type="button"
              onClick={() => { setAuthMode("register"); setFeedback(null); }}
              className="text-[#00b59c] font-bold hover:underline bg-transparent"
            >
              Register here
            </button>
          </p>
        </form>
      )}

      {authMode === "register" && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Full Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Kenyan Tiger"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00b59c]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="mwanabiashara@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-[#00b59c]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Referral Email (optional)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="referrer@example.com"
                value={referrerEmail}
                onChange={(e) => setReferrerEmail(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-[#00b59c]"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Referees earn KSh 50 for every successful referral and new users start with KSh 100.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Secure Access Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                placeholder="6+ complex characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00b59c]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#00b59c] hover:bg-[#009c86] disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow shadow-[#00b59c]/10"
          >
            Create Secured Account
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Already have a secured registry?{" "}
            <button
              type="button"
              onClick={() => { setAuthMode("login"); setFeedback(null); }}
              className="text-[#f33350] font-bold hover:underline bg-transparent"
            >
              Sign In
            </button>
          </p>
        </form>
      )}


      {authMode === "forgot" && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Account Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="enter your account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-[#f33350]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-2.5 bg-[#f33350] hover:bg-[#d01d37] disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer"
          >
            Send Reset Link
          </button>

          <button
            type="button"
            onClick={() => setAuthMode("login")}
            className="w-full text-center text-[11px] text-[#00b59c] hover:underline bg-transparent cursor-pointer"
          >
            Return to Login panel
          </button>
        </form>
      )}

      {authMode === "reset" && (
        <form onSubmit={handleResetConfirm} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">6-Digit Reset Passcode</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Check OTP code above"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 font-mono text-center tracking-widest text-sm text-white focus:outline-none focus:border-[#f33350]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">New Secured Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                placeholder="6+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#1e222d] rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#f33350]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || otpCode.length < 6 || !password}
            className="w-full py-2.5 bg-[#f33350] hover:bg-[#d01d37] disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer"
          >
            Save Password Parameters
          </button>
        </form>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full text-center text-slate-500 hover:text-slate-300 text-xs font-mono tracking-tight pt-1 cursor-pointer hover:underline bg-transparent"
        >
          Cancel & Continue as Guest Demo
        </button>
      )}
    </div>
  );
}
