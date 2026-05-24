import { useEffect, useState, useRef, useCallback } from "react";
import { Asset, TradeContract } from "../types";
import { TrendingUp, TrendingDown, Activity, BarChart3, LineChart } from "lucide-react";

interface TradingChartProps {
  asset: Asset;
  activeContracts: TradeContract[];
  onTick: (price: number) => void;
}

interface Tick {
  time: number;
  price: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Box-Muller transform: uniform → standard normal ──
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Realistic forex price generator state ──
interface PriceState {
  price: number;
  vol: number;       // current volatility (GARCH-like)
  momentum: number;  // recent directional bias
  meanPrice: number; // rolling mean for reversion
}

function nextPrice(state: PriceState, baseVol: number): { price: number; newState: PriceState } {
  const { price, vol, momentum, meanPrice } = state;

  // GARCH-like volatility clustering: vol reverts toward base, spikes persist
  const newVol = Math.max(
    baseVol * 0.3,
    Math.min(baseVol * 4, vol * 0.92 + baseVol * 0.08 + baseVol * 0.15 * Math.abs(gaussianRandom()))
  );

  // Geometric Brownian Motion log-return
  const drift = 0.0;
  const randomReturn = gaussianRandom() * newVol;

  // Momentum: slight bias in direction of recent move (trend following)
  const momentumBias = momentum * 0.18;

  // Mean reversion: gentle pull toward rolling mean (prevents runaway)
  const reversionStrength = 0.012;
  const reversionBias = (meanPrice - price) / meanPrice * reversionStrength;

  // Combined log-return
  const logReturn = drift + randomReturn + momentumBias + reversionBias;

  const newPrice = price * Math.exp(logReturn);

  // Update momentum as weighted average of recent return
  const newMomentum = momentum * 0.75 + logReturn * 0.25;

  // Update rolling mean slowly
  const newMean = meanPrice * 0.998 + newPrice * 0.002;

  return {
    price: newPrice,
    newState: { price: newPrice, vol: newVol, momentum: newMomentum, meanPrice: newMean },
  };
}

// ── Build initial history using the realistic generator ──
function buildHistory(assetPrice: number, baseVol: number, count: number, ticksPerCandle: number): {
  candles: Candle[];
  ticks: Tick[];
  finalState: PriceState;
} {
  let state: PriceState = {
    price: assetPrice,
    vol: baseVol,
    momentum: 0,
    meanPrice: assetPrice,
  };

  const ticks: Tick[] = [];
  const candles: Candle[] = [];
  const now = Date.now();
  const totalTicks = count * ticksPerCandle;
  const tickIntervalMs = 400;

  let candleOpen = assetPrice;
  let candleHigh = assetPrice;
  let candleLow = assetPrice;
  let candleVolume = 0;
  let candleStartTime = now - totalTicks * tickIntervalMs;

  for (let i = 0; i < totalTicks; i++) {
    const tickTime = now - (totalTicks - i) * tickIntervalMs;
    const { price: newPrice, newState } = nextPrice(state, baseVol);
    state = newState;

    ticks.push({ time: tickTime, price: newPrice });

    const posInCandle = i % ticksPerCandle;
    if (posInCandle === 0) {
      candleOpen = newPrice;
      candleHigh = newPrice;
      candleLow = newPrice;
      candleVolume = 0;
      candleStartTime = tickTime;
    }
    candleHigh = Math.max(candleHigh, newPrice);
    candleLow = Math.min(candleLow, newPrice);
    candleVolume += Math.random() * 50 + 20;

    if (posInCandle === ticksPerCandle - 1) {
      candles.push({
        time: candleStartTime,
        open: candleOpen,
        high: candleHigh,
        low: candleLow,
        close: newPrice,
        volume: candleVolume,
      });
    }
  }

  return { candles, ticks, finalState: state };
}

const TICKS_PER_CANDLE = 6;
const MAX_CANDLES = 60;
const MAX_TICKS = MAX_CANDLES * TICKS_PER_CANDLE;
const TICK_INTERVAL_MS = 400;

export default function TradingChart({ asset, activeContracts, onTick }: TradingChartProps) {
  const [chartMode, setChartMode] = useState<"line" | "candles">("line");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [showSma, setShowSma] = useState(true);
  const [showBands, setShowBands] = useState(false);

  const priceStateRef = useRef<PriceState>({
    price: asset.currentPrice,
    vol: asset.volatility * 0.008,
    momentum: 0,
    meanPrice: asset.currentPrice,
  });
  const tickBufferRef = useRef<Tick[]>([]);
  const candleInProgressRef = useRef<{ open: number; high: number; low: number; tickCount: number } | null>(null);
  const onTickRef = useRef(onTick);

  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  // Build initial history when asset changes
  useEffect(() => {
    const baseVol = asset.volatility * 0.008;
    const { candles: hist, ticks: histTicks, finalState } = buildHistory(
      asset.currentPrice,
      baseVol,
      MAX_CANDLES,
      TICKS_PER_CANDLE
    );
    priceStateRef.current = finalState;
    candleInProgressRef.current = null;
    tickBufferRef.current = [];
    setCandles(hist);
    setTicks(histTicks);
  }, [asset.id]);

  // Live tick loop
  useEffect(() => {
    const baseVol = asset.volatility * 0.008;

    const interval = setInterval(() => {
      const { price: newPrice, newState } = nextPrice(priceStateRef.current, baseVol);
      priceStateRef.current = newState;

      const now = Date.now();
      const newTick: Tick = { time: now, price: newPrice };

      // Notify parent
      setTimeout(() => onTickRef.current(newPrice), 0);

      setTicks(prev => {
        const updated = [...prev, newTick];
        return updated.length > MAX_TICKS ? updated.slice(updated.length - MAX_TICKS) : updated;
      });

      // Build candle from tick buffer
      const buf = tickBufferRef.current;
      buf.push(newTick);

      if (!candleInProgressRef.current) {
        candleInProgressRef.current = { open: newPrice, high: newPrice, low: newPrice, tickCount: 1 };
      } else {
        candleInProgressRef.current.high = Math.max(candleInProgressRef.current.high, newPrice);
        candleInProgressRef.current.low = Math.min(candleInProgressRef.current.low, newPrice);
        candleInProgressRef.current.tickCount++;
      }

      if (buf.length >= TICKS_PER_CANDLE) {
        const cip = candleInProgressRef.current!;
        const finishedCandle: Candle = {
          time: buf[0].time,
          open: cip.open,
          high: cip.high,
          low: cip.low,
          close: newPrice,
          volume: Math.random() * 200 + 50,
        };
        tickBufferRef.current = [];
        candleInProgressRef.current = null;
        setCandles(prev => {
          const updated = [...prev, finishedCandle];
          return updated.length > MAX_CANDLES ? updated.slice(updated.length - MAX_CANDLES) : updated;
        });
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [asset.id, asset.volatility]);

  // ─── Rendering ───────────────────────────────────────────────────────────────
  const dataPoints = chartMode === "line" ? ticks : candles;
  if (dataPoints.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-[#0b0e11]/60 rounded-xl border border-[#1e222d]">
        <div className="flex flex-col items-center gap-2">
          <Activity className="w-8 h-8 text-[#00b59c] animate-spin" />
          <span className="text-slate-400 font-mono text-sm">Synchronizing live feed...</span>
        </div>
      </div>
    );
  }

  const lastTick = ticks[ticks.length - 1];
  const prevTick = ticks.length > 1 ? ticks[ticks.length - 2] : ticks[0];
  const lastPrice = lastTick?.price ?? asset.currentPrice;
  const isUp = lastPrice >= prevTick.price;

  const padding = { top: 20, right: 70, bottom: 40, left: 10 };
  const chartW = 800;
  const chartH = 300;
  const plotW = chartW - padding.left - padding.right;
  const plotH = chartH - padding.top - padding.bottom;

  // Price range from visible data
  let minP: number, maxP: number;
  if (chartMode === "candles") {
    minP = Math.min(...candles.map(c => c.low));
    maxP = Math.max(...candles.map(c => c.high));
  } else {
    const visiblePrices = ticks.map(t => t.price);
    minP = Math.min(...visiblePrices);
    maxP = Math.max(...visiblePrices);
  }
  // Add 10% padding to price range so candles don't touch edges
  const rangePad = (maxP - minP) * 0.12 || lastPrice * 0.002;
  minP -= rangePad;
  maxP += rangePad;
  const priceRange = maxP - minP || 1;

  const px = (i: number, total: number) =>
    padding.left + (i / Math.max(total - 1, 1)) * plotW;
  const py = (price: number) =>
    padding.top + plotH - ((price - minP) / priceRange) * plotH;

  // ── Smooth bezier line path from ticks ──
  const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx} ${p0.y} ${cpx} ${p1.y} ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const tickXYs = ticks.map((t, i) => ({ x: px(i, ticks.length), y: py(t.price) }));
  const linePath = buildSmoothPath(tickXYs);
  const areaPath = linePath
    ? `${linePath} L ${tickXYs[tickXYs.length - 1].x} ${py(minP)} L ${tickXYs[0].x} ${py(minP)} Z`
    : "";

  // ── SMA on whichever series we have ──
  const smaSource = chartMode === "candles" ? candles.map(c => c.close) : ticks.map(t => t.price);
  const smaPeriod = 14;
  const smaXYs: { x: number; y: number }[] = [];
  if (showSma && smaSource.length >= smaPeriod) {
    for (let i = smaPeriod - 1; i < smaSource.length; i++) {
      const avg = smaSource.slice(i - smaPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / smaPeriod;
      const xVal = chartMode === "candles"
        ? px(i, candles.length)
        : px(i, ticks.length);
      smaXYs.push({ x: xVal, y: py(avg) });
    }
  }
  const smaPath = buildSmoothPath(smaXYs);

  // ── Bollinger Bands ──
  const bbUpper: { x: number; y: number }[] = [];
  const bbLower: { x: number; y: number }[] = [];
  const bbMid: { x: number; y: number }[] = [];
  const bbPeriod = 20;
  if (showBands && smaSource.length >= bbPeriod) {
    for (let i = bbPeriod - 1; i < smaSource.length; i++) {
      const slice = smaSource.slice(i - bbPeriod + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / bbPeriod;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / bbPeriod;
      const stddev = Math.sqrt(variance);
      const xVal = chartMode === "candles" ? px(i, candles.length) : px(i, ticks.length);
      bbUpper.push({ x: xVal, y: py(mean + 2 * stddev) });
      bbMid.push({ x: xVal, y: py(mean) });
      bbLower.push({ x: xVal, y: py(mean - 2 * stddev) });
    }
  }

  // ── Price grid labels ──
  const gridLevels = 5;
  const gridLines = Array.from({ length: gridLevels }, (_, i) => {
    const ratio = i / (gridLevels - 1);
    const price = maxP - ratio * priceRange;
    const y = padding.top + ratio * plotH;
    return { y, price };
  });

  // ── Time axis labels ──
  const timeLabels: { x: number; label: string }[] = [];
  if (chartMode === "candles" && candles.length > 0) {
    const step = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += step) {
      const d = new Date(candles[i].time);
      const label = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      timeLabels.push({ x: px(i, candles.length), label });
    }
  } else if (chartMode === "line" && ticks.length > 0) {
    const step = Math.max(1, Math.floor(ticks.length / 6));
    for (let i = 0; i < ticks.length; i += step) {
      const d = new Date(ticks[i].time);
      const label = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
      timeLabels.push({ x: px(i, ticks.length), label });
    }
  }

  // ── Candle body width ──
  const candleW = Math.max(2, Math.min(12, plotW / candles.length * 0.6));

  // ── Volume bars ──
  const maxVol = Math.max(...candles.map(c => c.volume), 1);

  // Active contracts relevant to this asset
  const relevantContracts = activeContracts.filter(c => c.assetId === asset.id && !c.settled);

  // Price change since first visible tick
  const firstPrice = ticks[0]?.price ?? lastPrice;
  const changePct = ((lastPrice - firstPrice) / firstPrice * 100);

  return (
    <div className="bg-[#0d1117] border border-[#1e222d] rounded-xl shadow-2xl overflow-hidden" id="tagoption-main-chart">

      {/* ── Chart header ── */}
      <div className="px-4 py-3 bg-[#0d1117] border-b border-[#1e222d] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[#00b59c]/10 border border-[#00b59c]/20">
            <Activity className="w-4 h-4 text-[#00b59c] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{asset.name}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1e222d] text-purple-400 border border-[#2a2e39] uppercase tracking-wider">
                Live
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-black font-mono text-white tracking-tighter">
                {lastPrice.toFixed(4)}
              </span>
              <span className={`text-xs font-bold flex items-center gap-0.5 ${isUp ? "text-[#00b59c]" : "text-[#e95e4b]"}`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isUp ? "+" : ""}{changePct.toFixed(3)}%
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Chart type */}
          <div className="flex bg-[#11152b] border border-[#1e222d] rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setChartMode("line")}
              className={`px-2.5 py-1.5 text-[10px] rounded-md font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                chartMode === "line" ? "bg-[#1e222d] text-white" : "text-[#6c737f] hover:text-white"
              }`}
            >
              <LineChart className="w-3 h-3" /> Line
            </button>
            <button
              onClick={() => setChartMode("candles")}
              className={`px-2.5 py-1.5 text-[10px] rounded-md font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                chartMode === "candles" ? "bg-[#1e222d] text-white" : "text-[#6c737f] hover:text-white"
              }`}
            >
              <BarChart3 className="w-3 h-3" /> Candles
            </button>
          </div>

          {/* Indicators */}
          <div className="flex bg-[#11152b] border border-[#1e222d] rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setShowSma(s => !s)}
              className={`px-2.5 py-1.5 text-[10px] rounded-md font-semibold cursor-pointer transition-all ${
                showSma ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "text-[#6c737f] hover:text-white"
              }`}
            >SMA(14)</button>
            <button
              onClick={() => setShowBands(s => !s)}
              className={`px-2.5 py-1.5 text-[10px] rounded-md font-semibold cursor-pointer transition-all ${
                showBands ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "text-[#6c737f] hover:text-white"
              }`}
            >BB(20)</button>
          </div>
        </div>
      </div>

      {/* ── SVG chart ── */}
      <div className="relative bg-[#0b0e11] p-1">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto select-none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="greenArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00b59c" stopOpacity="0.18" />
              <stop offset="85%" stopColor="#00b59c" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#00b59c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="redArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e95e4b" stopOpacity="0.18" />
              <stop offset="85%" stopColor="#e95e4b" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#e95e4b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="volGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00b59c" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#00b59c" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="volRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e95e4b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e95e4b" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Background */}
          <rect x="0" y="0" width={chartW} height={chartH} fill="#0b0e11" />

          {/* ── Grid lines ── */}
          {gridLines.map((gl, i) => (
            <g key={i}>
              <line
                x1={padding.left} y1={gl.y}
                x2={chartW - padding.right} y2={gl.y}
                stroke="#1a1f2e" strokeWidth="0.75"
              />
              <text
                x={chartW - padding.right + 5} y={gl.y}
                fontSize="8" fill="#4a5568"
                dominantBaseline="middle" fontFamily="monospace"
              >
                {gl.price.toFixed(2)}
              </text>
            </g>
          ))}

          {/* ── Vertical time grid ── */}
          {timeLabels.map((tl, i) => (
            <g key={i}>
              <line
                x1={tl.x} y1={padding.top}
                x2={tl.x} y2={padding.top + plotH}
                stroke="#1a1f2e" strokeWidth="0.5"
              />
              <text
                x={tl.x} y={padding.top + plotH + 14}
                fontSize="7" fill="#374151"
                textAnchor="middle" fontFamily="monospace"
              >
                {tl.label}
              </text>
            </g>
          ))}

          {/* ── Bollinger Bands ── */}
          {showBands && bbUpper.length > 1 && (
            <>
              <path
                d={`${buildSmoothPath(bbUpper)} L ${bbLower[bbLower.length-1].x} ${bbLower[bbLower.length-1].y} ${buildSmoothPath(bbLower.slice().reverse()).replace("M", "L")} Z`}
                fill="#3b82f6" fillOpacity="0.05"
              />
              <path d={buildSmoothPath(bbUpper)} fill="none" stroke="#3b82f6" strokeWidth="0.75" strokeOpacity="0.5" strokeDasharray="3 2" />
              <path d={buildSmoothPath(bbLower)} fill="none" stroke="#3b82f6" strokeWidth="0.75" strokeOpacity="0.5" strokeDasharray="3 2" />
              <path d={buildSmoothPath(bbMid)} fill="none" stroke="#6366f1" strokeWidth="0.5" strokeOpacity="0.4" />
            </>
          )}

          {/* ── Line/Area chart ── */}
          {chartMode === "line" && ticks.length > 1 && (
            <>
              <path d={areaPath} fill={`url(#${isUp ? "greenArea" : "redArea"})`} />
              <path
                d={linePath}
                fill="none"
                stroke={isUp ? "#00b59c" : "#e95e4b"}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}

          {/* ── Candlesticks ── */}
          {chartMode === "candles" && candles.map((c, i) => {
            const x = px(i, candles.length);
            const oY = py(c.open);
            const cY = py(c.close);
            const hY = py(c.high);
            const lY = py(c.low);
            const green = c.close >= c.open;
            const col = green ? "#00c9ad" : "#e95e4b";
            const bodyTop = Math.min(oY, cY);
            const bodyH = Math.max(1, Math.abs(oY - cY));

            // Volume bar at bottom (20% of plot height)
            const volBarH = (c.volume / maxVol) * plotH * 0.15;
            const volBarY = padding.top + plotH - volBarH;

            return (
              <g key={i}>
                {/* Volume bar */}
                <rect
                  x={x - candleW / 2} y={volBarY}
                  width={candleW} height={volBarH}
                  fill={`url(#${green ? "volGreen" : "volRed"})`}
                  opacity="0.6"
                />
                {/* Wick */}
                <line x1={x} y1={hY} x2={x} y2={bodyTop} stroke={col} strokeWidth="1" />
                <line x1={x} y1={bodyTop + bodyH} x2={x} y2={lY} stroke={col} strokeWidth="1" />
                {/* Body */}
                <rect
                  x={x - candleW / 2} y={bodyTop}
                  width={candleW} height={bodyH}
                  fill={green ? col : "transparent"}
                  stroke={col}
                  strokeWidth={green ? 0 : 1}
                />
              </g>
            );
          })}

          {/* ── SMA overlay ── */}
          {showSma && smaPath && (
            <path
              d={smaPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeOpacity="0.85"
              strokeLinejoin="round"
            />
          )}

          {/* ── Active trade entry lines ── */}
          {relevantContracts.map(contract => {
            const y = py(contract.entryPrice);
            const col = contract.type === "Higher" ? "#00b59c" : "#e95e4b";
            return (
              <g key={contract.id}>
                <line
                  x1={padding.left} y1={y}
                  x2={chartW - padding.right} y2={y}
                  stroke={col} strokeWidth="1" strokeDasharray="6 3" strokeOpacity="0.7"
                />
                <rect x={padding.left} y={y - 8} width="120" height="16" rx="3" fill="#0d1117" stroke={col} strokeWidth="0.75" />
                <text x={padding.left + 6} y={y + 1} fontSize="8" fill="#e2e8f0" dominantBaseline="middle" fontFamily="monospace">
                  {contract.type === "Higher" ? "▲ Rise" : "▼ Fall"} | KSh {contract.stake}
                </text>
              </g>
            );
          })}

          {/* ── Live price line + label ── */}
          {lastPrice > 0 && (
            <g>
              <line
                x1={padding.left} y1={py(lastPrice)}
                x2={chartW - padding.right} y2={py(lastPrice)}
                stroke={isUp ? "#00b59c" : "#e95e4b"}
                strokeWidth="0.75" strokeDasharray="2 3" strokeOpacity="0.6"
              />
              {/* Pulsing dot at latest price */}
              <circle
                cx={chartMode === "line" ? px(ticks.length - 1, ticks.length) : px(candles.length - 1, candles.length)}
                cy={py(lastPrice)}
                r="5" fill={isUp ? "#00b59c" : "#e95e4b"} opacity="0.25"
                className="animate-ping"
              />
              <circle
                cx={chartMode === "line" ? px(ticks.length - 1, ticks.length) : px(candles.length - 1, candles.length)}
                cy={py(lastPrice)}
                r="3" fill={isUp ? "#00b59c" : "#e95e4b"}
              />
              {/* Price label on right axis */}
              <rect
                x={chartW - padding.right + 2} y={py(lastPrice) - 8}
                width={padding.right - 4} height="16" rx="3"
                fill={isUp ? "#00b59c" : "#e95e4b"}
              />
              <text
                x={chartW - padding.right + (padding.right / 2)}
                y={py(lastPrice)}
                fontSize="8" fill="white" textAnchor="middle"
                dominantBaseline="middle" fontFamily="monospace" fontWeight="bold"
              >
                {lastPrice.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── Stats bar ── */}
      <div className="px-4 py-2.5 bg-[#0d1117] border-t border-[#1e222d] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-[#6c737f]">
            <span className="w-2 h-2 rounded-full" style={{ background: "#00b59c" }}></span>
            O: <span className="text-white font-mono">{candles[candles.length-1]?.open.toFixed(4) ?? "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#6c737f]">
            H: <span className="text-[#00b59c] font-mono">{candles[candles.length-1]?.high.toFixed(4) ?? "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#6c737f]">
            L: <span className="text-[#e95e4b] font-mono">{candles[candles.length-1]?.low.toFixed(4) ?? "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#6c737f]">
            C: <span className="text-white font-mono">{candles[candles.length-1]?.close.toFixed(4) ?? "—"}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#6c737f]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            SMA(14)
          </span>
          <span className="font-mono text-[9px] bg-[#1e222d] text-slate-400 px-2 py-0.5 rounded">
            {TICK_INTERVAL_MS}ms tick
          </span>
          <span className={`font-mono text-[9px] px-2 py-0.5 rounded font-bold ${isUp ? "bg-[#00b59c]/10 text-[#00b59c]" : "bg-[#e95e4b]/10 text-[#e95e4b]"}`}>
            {isUp ? "▲ BULLISH" : "▼ BEARISH"}
          </span>
        </div>
      </div>
    </div>
  );
}
