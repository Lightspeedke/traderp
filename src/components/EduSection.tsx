import { BookOpen, AlertTriangle, Lightbulb, Shield, Award, HelpCircle } from "lucide-react";

export default function EduSection() {
  const guides = [
    {
      title: "What is Rise / Fall Trading?",
      icon: <BookOpen className="w-5 h-5 text-[#00b59c]" />,
      description: "You predict whether the price of an asset (like Volatility 100) will be HIGHER or LOWER than your purchase price at the end of a specified duration (e.g. 5 seconds, 1 minute). if you are correct, you earn a return (typically 90%+ of your stake) instantly!"
    },
    {
      title: "Synthetics vs. Forex Assets",
      icon: <Award className="w-5 h-5 text-amber-400" />,
      description: "Synthetics (Volatility Indexes) are algorithmic markets with mathematically steady volatility, open 24/7. Forex markets (like USD/KES) represent live global exchange rates governed by direct macroeconomic variables."
    },
    {
      title: "Sound Risk Coordination",
      icon: <Shield className="w-5 h-5 text-[#00b59c]" />,
      description: "Never stake more than 5% of your KES bankroll on a single trade. Keep a cool head! Utilize 'Sauti ya TagOption' AI triggers to analyze market consolidations before bidding."
    }
  ];

  return (
    <div className="bg-[#131722] border border-[#1e222d] rounded-xl p-6 space-y-5 shadow-xl" id="tagoption-edu-card">
      <div className="flex items-center gap-2.5 border-b border-[#1e222d] pb-3">
        <Lightbulb className="w-5 h-5 text-[#00b59c] animate-pulse" />
        <h3 className="font-sans font-bold text-slate-100 text-sm">TagOption East Africa Academy</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {guides.map((g, idx) => (
          <div key={idx} className="p-4 bg-[#0b0e11] border border-[#1e222d] rounded-lg hover:border-[#2a2e39] transition-colors space-y-2">
            <div className="flex items-center gap-2">
              {g.icon}
              <h4 className="font-sans font-bold text-slate-200 text-xs">{g.title}</h4>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {g.description}
            </p>
          </div>
        ))}
      </div>

      <div className="p-3.5 bg-rose-500/5 border border-rose-500/15 rounded-lg flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-400 leading-relaxed">
          <strong className="text-rose-400">Risk Disclosure:</strong> Trading options carries high leverage risk. Under extreme conditions, rapid fluctuations in currency indices can happen. Users must secure their M-Pesa channels and secret PIN numbers. Always practice professional risk management.
        </p>
      </div>
    </div>
  );
}
