import { useEffect, useState, useRef } from "react";
import { Asset, TradeContract } from "../types";
import { TrendingUp, TrendingDown, Eye, Activity, Sliders, BarChart3, LineChart } from "lucide-react";

interface TradingChartProps {
  asset: Asset;
  activeContracts: TradeContract[];
  onTick: (price: number) => void;
}

interface ChartPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function TradingChart({ asset, activeContracts, onTick }: TradingChartProps) {
  const [chartMode, setChartMode] = useState<"line" | "candles">("line");
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [showSma, setShowSma] = useState(true);
  const [showBands, setShowBands] = useState(false);
  const onTickRef = useRef(onTick);

  // Keep references updated to prevent useEffect stale closure issues
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  // Generate initial historical points when asset changes
  useEffect(() => {
    let basePrice = asset.currentPrice;
    const initialPoints: ChartPoint[] = [];
    const now = Date.now();
    
    // Seed 40 historical points back in time
    for (let i = 40; i >= 1; i--) {
      const time = now - i * 3000;
      const change = (Math.random() - 0.48) * asset.volatility * 3;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * asset.volatility * 0.8;
      const low = Math.min(open, close) - Math.random() * asset.volatility * 0.8;
      
      initialPoints.push({ time, open, high, low, close });
      basePrice = close;
    }
    setPoints(initialPoints);
  }, [asset.id, asset.currentPrice, asset.volatility]);

  // Real-time ticking interval (every 1 second)
  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const time = Date.now();
        
        // Slightly random walk, biased to mean-revert or drift according to volatility
        const change = (Math.random() - 0.495) * asset.volatility * 0.45;
        const open = last.close;
        const close = last.close + change;
        const high = Math.max(open, close) + Math.random() * asset.volatility * 0.2;
        const low = Math.min(open, close) - Math.random() * asset.volatility * 0.2;
        
        const nextPoint: ChartPoint = { time, open, high, low, close };
        
        // Notify parent about the new price tick on the next tick loop to avoid React render side effects
        setTimeout(() => {
          onTickRef.current(close);
        }, 0);
        
        // Limit to 60 visible points
        const updated = [...prev, nextPoint];
        if (updated.length > 50) {
          updated.shift();
        }
        return updated;
      });
    }, 1600);

    return () => clearInterval(interval);
  }, [asset.id, asset.volatility]);

  if (points.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-[#0b0e11]/60 rounded-xl border border-[#1e222d]">
        <div className="flex flex-col items-center gap-2">
          <Activity className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-gray-400 font-mono text-sm">Synchronizing TraderPro254 Live Feed...</span>
        </div>
      </div>
    );
  }

  const lastPrice = points[points.length - 1].close;
  const isUp = lastPrice >= points[points.length > 1 ? points.length - 2 : 0].close;

  // Render variables
  const padding = 30;
  const chartHeight = 320;
  const chartWidth = 720; // responsive scaling

  const prices = points.map((p) => p.close);
  const highs = points.map((p) => p.high);
  const lows = points.map((p) => p.low);
  const minPrice = Math.min(...lows) * 0.9995;
  const maxPrice = Math.max(...highs) * 1.0005;
  const priceRange = maxPrice - minPrice;

  // Convert price coordinate to pixel height
  const getX = (index: number) => {
    return padding + (index * (chartWidth - padding * 2)) / (points.length - 1);
  };

  const getY = (price: number) => {
    return chartHeight - padding - ((price - minPrice) * (chartHeight - padding * 2)) / priceRange;
  };

  // SVG Line path string
  let linePath = "";
  let areaPath = "";
  if (points.length > 0) {
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.close);
      if (idx === 0) {
        linePath += `M ${x} ${y}`;
        areaPath += `M ${x} ${chartHeight - padding} L ${x} ${y}`;
      } else {
        linePath += ` L ${x} ${y}`;
        areaPath += ` L ${x} ${y}`;
      }
    });
    areaPath += ` L ${getX(points.length - 1)} ${chartHeight - padding} Z`;
  }

  // Calculate Simple Moving Average (SMA 10)
  const smaPoints: { x: number; y: number }[] = [];
  if (showSma && points.length >= 10) {
    for (let i = 9; i < points.length; i++) {
      const subset = points.slice(i - 9, i + 1);
      const sum = subset.reduce((acc, p) => acc + p.close, 0);
      const avg = sum / 10;
      smaPoints.push({ x: getX(i), y: getY(avg) });
    }
  }

  // Calculate simple Simulated Bollinger Bands
  const upperBandPoints: { x: number; y: number }[] = [];
  const lowerBandPoints: { x: number; y: number }[] = [];
  if (showBands && points.length >= 10) {
    for (let i = 9; i < points.length; i++) {
      const subset = points.slice(i - 9, i + 1);
      const sum = subset.reduce((acc, p) => acc + p.close, 0);
      const avg = sum / 10;
      
      // simulated deviation
      const dev = asset.volatility * 1.5;
      upperBandPoints.push({ x: getX(i), y: getY(avg + dev) });
      lowerBandPoints.push({ x: getX(i), y: getY(avg - dev) });
    }
  }

  // Filter trade levels on the current asset
  const relevantContracts = activeContracts.filter((c) => c.assetId === asset.id && !c.settled);

  return (
    <div className="bg-[#131722] border border-[#1e222d] rounded-xl shadow-xl overflow-hidden" id="tagoption-main-chart">
      {/* Chart Top Controller Bar */}
      <div className="px-5 py-3.5 bg-[#0b0e11]/80 border-b border-[#1e222d] flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[rgba(0,181,156,0.1)] border border-[rgba(0,181,156,0.2)]">
            <Activity className="w-5 h-5 text-[#00b59c] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{asset.name}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#1e222d] text-purple-400 border border-[#2a2e39]">
                STABLE
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-lg font-mono font-bold tracking-tight text-white">
                {lastPrice.toFixed(4)}
              </span>
              <span className={`text-xs font-mono flex items-center ${isUp ? "text-[#00b59c]" : "text-rose-400"}`}>
                {isUp ? <TrendingUp className="w-3.5 h-3.5 mr-0.5 text-[#00b59c]" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                {asset.change24h > 0 ? "+" : ""}
                {asset.change24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Configurations controls */}
        <div className="flex items-center gap-2.5">
          {/* Chart selector type */}
          <div className="bg-[#131722] border border-[#1e222d] p-0.5 rounded-lg flex">
            <button
              onClick={() => setChartMode("line")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                chartMode === "line"
                  ? "bg-[#1e222d] text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LineChart className="w-3.5 h-3.5 inline mr-1" />
              Mountain
            </button>
            <button
              onClick={() => setChartMode("candles")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                chartMode === "candles"
                  ? "bg-[#1e222d] text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
              Candlesticks
            </button>
          </div>

          {/* Indicators controller */}
          <div className="bg-[#131722] border border-[#1e222d] p-0.5 rounded-lg flex text-xs gap-1">
            <button
              onClick={() => setShowSma(!showSma)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                showSma ? "bg-[rgba(0,181,156,0.1)] text-[#00b59c] border border-[rgba(0,181,156,0.2)]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              SMA(10)
            </button>
            <button
              onClick={() => setShowBands(!showBands)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                showBands ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Bollinger Bands
            </button>
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative p-2 bg-[#0b0e11]/20">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto select-none"
          id="tagoption-svg-viewport"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "#00b59c" : "#f43f5e"} stopOpacity="0.22" />
              <stop offset="100%" stopColor={isUp ? "#00b59c" : "#f43f5e"} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="bollingerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => {
            const y = padding + ratio * (chartHeight - padding * 2);
            const gridPrice = maxPrice - ratio * priceRange;
            return (
              <g key={idx}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#1e222d"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={chartWidth - padding + 5}
                  y={y + 3}
                  className="font-mono text-[9px] fill-slate-500 text-right"
                  alignmentBaseline="middle"
                >
                  {gridPrice.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Bollinger Band Shading & borders */}
          {showBands && upperBandPoints.length > 0 && (
            <>
              <path
                d={`M ${upperBandPoints[0].x} ${upperBandPoints[0].y} ` +
                  upperBandPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ") +
                  ` L ${lowerBandPoints[lowerBandPoints.length - 1].x} ${lowerBandPoints[lowerBandPoints.length - 1].y} ` +
                  lowerBandPoints.slice().reverse().slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ") +
                  " Z"}
                fill="url(#bollingerGradient)"
              />
              <path
                d={upperBandPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.75"
                strokeOpacity="0.5"
                strokeDasharray="2 2"
              />
              <path
                d={lowerBandPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.75"
                strokeOpacity="0.5"
                strokeDasharray="2 2"
              />
            </>
          )}

          {/* Mountain Line view */}
          {chartMode === "line" && (
            <>
              {/* Shaded Area */}
              <path d={areaPath} fill="url(#areaGradient)" />
              {/* Stroke path */}
              <path
                d={linePath}
                fill="none"
                stroke={isUp ? "#00b59c" : "#f43f5e"}
                strokeWidth="1.75"
              />
            </>
          )}

          {/* Candlestick rendering */}
          {chartMode === "candles" &&
            points.map((p, idx) => {
              const x = getX(idx);
              const candleW = Math.max(2, (chartWidth - padding * 2) / points.length * 0.65);
              const oY = getY(p.open);
              const cY = getY(p.close);
              const hY = getY(p.high);
              const lY = getY(p.low);
              const isGreen = p.close >= p.open;
              const color = isGreen ? "#00b59c" : "#f43f5e";

              return (
                <g key={idx}>
                  {/* Shadow Wick (high/low) */}
                  <line x1={x} y1={hY} x2={x} y2={lY} stroke={color} strokeWidth="1" />
                  {/* Candle Body */}
                  <rect
                    x={x - candleW / 2}
                    y={Math.min(oY, cY)}
                    width={candleW}
                    height={Math.max(1, Math.abs(oY - cY))}
                    fill={color}
                  />
                </g>
              );
            })}

          {/* SMA Line */}
          {showSma && smaPoints.length > 0 && (
            <path
              d={smaPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.25"
              strokeOpacity="0.8"
            />
          )}

          {/* ACTIVE TRADES LIVE OVERLAYS */}
          {relevantContracts.map((contract) => {
            const y = getY(contract.entryPrice);
            const isPurchaseHigher = contract.type === "Higher";
            const borderCol = isPurchaseHigher ? "#00b59c" : "#f43f5e";
            return (
              <g key={contract.id}>
                {/* Horizontal reference price line */}
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke={borderCol}
                  strokeWidth="1"
                  strokeDasharray="5 3"
                />
                
                {/* Little directional flag on left */}
                <rect
                  x={padding}
                  y={y - 8}
                  width="130"
                  height="16"
                  rx="3"
                  fill="#0b0e11"
                  stroke={borderCol}
                  strokeWidth="1"
                />
                <text
                  x={padding + 6}
                  y={y + 1}
                  className="font-sans font-bold text-[8px] fill-slate-200"
                  alignmentBaseline="middle"
                >
                  {isPurchaseHigher ? "▲ Rise Contract" : "▼ Fall Contract"} | KSh{contract.stake}
                </text>

                {/* Draw actual entry dot */}
                <circle cx={chartWidth / 2} cy={y} r="4" fill={borderCol} />
              </g>
            );
          })}

          {/* Live Price Pulsing Indicator Dot on horizontal axis */}
          {points.length > 0 && (
            <g>
              <line
                x1={padding}
                y1={getY(lastPrice)}
                x2={chartWidth - padding}
                y2={getY(lastPrice)}
                stroke={isUp ? "#00b59c" : "#f43f5e"}
                strokeWidth="0.5"
                strokeOpacity="0.7"
              />
              <circle
                cx={getX(points.length - 1)}
                cy={getY(lastPrice)}
                r="6"
                fill={isUp ? "#00b59c" : "#f43f5e"}
                className="animate-ping"
                style={{ transformOrigin: "center" }}
                opacity="0.4"
              />
              <circle
                cx={getX(points.length - 1)}
                cy={getY(lastPrice)}
                r="3.5"
                fill={isUp ? "#00b59c" : "#f43f5e"}
              />
              {/* Label background */}
              <rect
                x={chartWidth - padding - 62}
                y={getY(lastPrice) - 7}
                width="62"
                height="14"
                rx="2"
                fill={isUp ? "#00b59c" : "#f43f5e"}
              />
              <text
                x={chartWidth - padding - 31}
                y={getY(lastPrice)}
                className="font-mono font-bold text-[8px] fill-white text-center"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {lastPrice.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Mini technical state summary */}
      <div className="px-5 py-3 bg-[#0b0e11]/40 border-t border-[#1e222d] flex justify-between items-center text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b59c]"></span>
            Volatility: <strong className="text-slate-200 font-mono">{(asset.volatility * 100).toFixed(0)} Hz</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Spread: <strong className="text-slate-200 font-mono">0.02 KES</strong>
          </span>
        </div>
        <div>
          <span className="text-slate-500 mr-1 font-mono">Precision:</span>
          <span className="font-mono bg-[#1e222d] text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
            Tick walk 1.0s
          </span>
        </div>
      </div>
    </div>
  );
}
