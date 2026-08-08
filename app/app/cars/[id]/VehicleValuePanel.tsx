"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, Star, RefreshCw, Info,
  ChevronDown, ChevronUp, DollarSign, Edit3, Check, X,
} from "lucide-react";

interface LineItem {
  label: string;
  description: string;
  dollarAmount: number;
  pctOfBaseline: number | null;
  icon: string;
  category: "maintenance" | "repair" | "condition" | "mileage" | "recall" | "mod";
}

interface EstimateResult {
  marketBaseline: number | null;
  garageEstimate: number | null;
  totalAdjustment: number;
  maintenanceAdjustment: number;
  repairAdjustment: number;
  conditionAdjustment: number;
  mileageAdjustment: number;
  recallAdjustment: number;
  modAdjustment: number;
  lineItems: LineItem[];
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  confidenceReason: string;
}

interface Snapshot {
  garageEstimate: number | null;
  marketBaseline: number | null;
  confidence: string | null;
  generatedAt: string;
  triggerSource: string;
}

interface Props {
  carId: string;
  initialEstimate: EstimateResult | null;
  initialSnapshots: Snapshot[];
  initialMarketLow: number | null;
  initialMarketHigh: number | null;
}

function fmt(n: number) { return "$" + Math.round(Math.abs(n)).toLocaleString("en-US"); }
function fmtSigned(n: number) { return (n >= 0 ? "+" : "−") + fmt(n); }

const categoryLabels: Record<string, string> = {
  maintenance: "Maintenance",
  repair: "Repairs",
  condition: "Condition",
  mileage: "Mileage",
  recall: "Recalls",
  mod: "Modifications",
};

const confidenceColors = {
  high: { bg: "bg-emerald-900/30", text: "text-emerald-400", border: "border-emerald-700/40" },
  medium: { bg: "bg-amber-900/30", text: "text-amber-400", border: "border-amber-700/40" },
  low: { bg: "bg-gray-800", text: "text-gray-500", border: "border-gray-700" },
};

function ConfidenceBadge({ level, score }: { level: "high" | "medium" | "low"; score: number }) {
  const c = confidenceColors[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${c.bg} ${c.text} ${c.border}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence · {score}%
    </span>
  );
}

function StarRating({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => !disabled && onChange(s)}
          onMouseEnter={() => !disabled && setHover(s)}
          onMouseLeave={() => setHover(0)}
          disabled={disabled}
          className={`transition-colors disabled:cursor-default ${s <= (hover || value || 0) ? "text-amber-400" : "text-gray-700"}`}
        >
          <Star size={20} fill={s <= (hover || value || 0) ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function CategoryRow({ label, amount }: { label: string; amount: number }) {
  if (amount === 0) return null;
  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>{label}</span>
      <span className={amount > 0 ? "text-emerald-400" : "text-red-400"}>{fmtSigned(amount)}</span>
    </div>
  );
}

export default function VehicleValuePanel({
  carId,
  initialEstimate,
  initialSnapshots,
  initialMarketLow,
  initialMarketHigh,
}: Props) {
  const [estimate, setEstimate] = useState<EstimateResult | null>(initialEstimate);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots);
  const [conditionScore, setConditionScore] = useState<number | null>(initialEstimate?.marketBaseline ? null : null);
  const [conditionNotes, setConditionNotes] = useState("");
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [baselineInput, setBaselineInput] = useState(
    initialEstimate?.marketBaseline ? String(Math.round(initialEstimate.marketBaseline)) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const runEstimate = async (overrides?: { marketBaseline?: number; conditionScore?: number; conditionNotes?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, any> = {};
      if (overrides?.marketBaseline != null) body.marketBaseline = overrides.marketBaseline;
      else if (baselineInput && !editingBaseline) body.marketBaseline = parseFloat(baselineInput.replace(/,/g, ""));
      if (overrides?.conditionScore != null) body.conditionScore = overrides.conditionScore;
      else if (conditionScore) body.conditionScore = conditionScore;
      if (overrides?.conditionNotes != null) body.conditionNotes = overrides.conditionNotes;
      else if (conditionNotes) body.conditionNotes = conditionNotes;

      const res = await fetch(`/api/cars/${carId}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setEstimate(data.result);

      // Reload snapshots
      const r2 = await fetch(`/api/cars/${carId}/estimate`);
      const d2 = await r2.json();
      if (d2.snapshots) setSnapshots(d2.snapshots);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleBaselineSave = () => {
    const val = parseFloat(baselineInput.replace(/,/g, ""));
    if (isNaN(val) || val <= 0) { setError("Enter a valid market value"); return; }
    setEditingBaseline(false);
    runEstimate({ marketBaseline: val });
  };

  const handleConditionChange = (score: number) => {
    setConditionScore(score);
    runEstimate({ conditionScore: score });
  };

  const delta = estimate?.totalAdjustment ?? null;
  const hasBaseline = !!estimate?.marketBaseline;

  // Group line items by category for the breakdown
  const groupedItems = estimate?.lineItems?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>) ?? {};

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-gray-400" />
          <h2 className="font-bold text-sm text-white">Estimated Value</h2>
          {estimate && <ConfidenceBadge level={estimate.confidence} score={estimate.confidenceScore} />}
        </div>
        <button
          onClick={() => runEstimate()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors active:scale-95"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Calculating…" : estimate ? "Recalculate" : "Calculate"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-700/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="divide-y divide-gray-800">

        {/* ── No baseline yet: prominent onboarding state ── */}
        {!hasBaseline && (
          <div className="px-4 py-5">
            <p className="text-sm font-semibold text-white mb-1">Set a market baseline to generate your estimate</p>
            <p className="text-xs text-gray-500 mb-3">
              Look up your vehicle's current market value on{" "}
              <a href="https://www.kbb.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">KBB</a>,{" "}
              <a href="https://www.cargurus.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">CarGurus</a>, or{" "}
              <a href="https://www.edmunds.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Edmunds</a>{" "}
              and enter it below. The app will factor in your service history, mileage, recalls, and condition to produce a garage-adjusted estimate.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-bold">$</span>
              <input
                type="number"
                value={baselineInput}
                onChange={(e) => setBaselineInput(e.target.value)}
                placeholder="e.g. 12400"
                className="flex-1 bg-gray-800 border border-gray-700 focus:border-blue-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleBaselineSave()}
              />
              <button
                onClick={handleBaselineSave}
                disabled={loading || !baselineInput}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors active:scale-95"
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                {loading ? "Calculating…" : "Calculate"}
              </button>
            </div>
          </div>
        )}

        {/* ── Has baseline: results view ── */}
        {hasBaseline && (
        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            {/* Market baseline (editable) */}
            <div className="min-w-0">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Market Baseline</div>
              {editingBaseline ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={baselineInput}
                    onChange={(e) => setBaselineInput(e.target.value)}
                    placeholder="e.g. 12400"
                    className="w-32 bg-gray-800 border border-blue-500/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleBaselineSave()}
                  />
                  <button onClick={handleBaselineSave} className="text-emerald-400"><Check size={16} /></button>
                  <button onClick={() => setEditingBaseline(false)} className="text-gray-500"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">{fmt(estimate!.marketBaseline!)}</span>
                  <button onClick={() => { setEditingBaseline(true); setBaselineInput(String(Math.round(estimate!.marketBaseline!))); }} className="text-gray-600 hover:text-gray-400">
                    <Edit3 size={13} />
                  </button>
                </div>
              )}
              {(initialMarketLow || initialMarketHigh) && (
                <p className="text-xs text-gray-600 mt-1">
                  Range: {initialMarketLow ? fmt(initialMarketLow) : "—"} – {initialMarketHigh ? fmt(initialMarketHigh) : "—"}
                </p>
              )}
            </div>

            {/* Garage estimate */}
            {estimate?.garageEstimate != null && (
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Garage Estimate</div>
                <div className="text-2xl font-bold text-white">{fmt(estimate.garageEstimate)}</div>
                <div className={`flex items-center justify-end gap-1 text-sm font-bold mt-0.5 ${
                  delta! > 0 ? "text-emerald-400" : delta! < 0 ? "text-red-400" : "text-gray-500"
                }`}>
                  {delta! > 0 ? <TrendingUp size={14} /> : delta! < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {fmtSigned(delta!)}
                </div>
              </div>
            )}
          </div>

          {estimate?.confidenceReason && (
            <p className="text-[11px] text-gray-600 mt-2.5 flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 flex-shrink-0" />
              {estimate.confidenceReason}
            </p>
          )}
        </div>
        )}

        {/* ── Adjustment breakdown ── */}
        {hasBaseline && estimate?.lineItems && estimate.lineItems.some(i => i.dollarAmount !== 0) && (
          <div className="px-4 py-3">
            <button
              onClick={() => setShowBreakdown((o) => !o)}
              className="w-full flex items-center justify-between mb-3"
            >
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Adjustment Breakdown</span>
              {showBreakdown ? <ChevronUp size={13} className="text-gray-600" /> : <ChevronDown size={13} className="text-gray-600" />}
            </button>

            {showBreakdown && (
              <div className="space-y-1">
                {/* Starting value */}
                <div className="flex items-center justify-between py-2 border-b border-gray-800 mb-2">
                  <span className="text-xs text-gray-400 font-medium">Base market value</span>
                  <span className="text-sm font-bold text-white">{fmt(estimate.marketBaseline!)}</span>
                </div>

                {/* Category summary rows */}
                <CategoryRow label="Maintenance" amount={estimate.maintenanceAdjustment} />
                <CategoryRow label="Repairs" amount={estimate.repairAdjustment} />
                <CategoryRow label="Condition" amount={estimate.conditionAdjustment} />
                <CategoryRow label="Mileage" amount={estimate.mileageAdjustment} />
                <CategoryRow label="Open recalls" amount={estimate.recallAdjustment} />
                {estimate.modAdjustment !== 0 && <CategoryRow label="Modifications" amount={estimate.modAdjustment} />}

                {/* Line item details (expandable) */}
                {estimate.lineItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800 space-y-2.5">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Detail</div>
                    {estimate.lineItems.filter(item => item.dollarAmount !== 0).map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0 mt-0.5">{item.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs text-gray-200">{item.label}</div>
                            <div className="text-[11px] text-gray-500 leading-tight">{item.description}</div>
                          </div>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 tabular-nums ${
                          item.dollarAmount > 0 ? "text-emerald-400" : item.dollarAmount < 0 ? "text-red-400" : "text-gray-500"
                        }`}>
                          {fmtSigned(item.dollarAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final line */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700 mt-3">
                  <span className="text-sm font-bold text-white">Garage estimate</span>
                  <span className="text-sm font-bold text-white">{fmt(estimate.garageEstimate!)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Condition rating ── */}
        <div className="px-4 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2">Condition Rating</div>
          <StarRating value={conditionScore} onChange={handleConditionChange} disabled={loading} />
          {conditionScore && (
            <p className="text-xs text-gray-500 mt-1">
              {["", "Poor — significant issues", "Fair — some wear", "Good — normal wear", "Very good", "Excellent — like new"][conditionScore]}
            </p>
          )}
          {!conditionScore && (
            <p className="text-xs text-gray-600 mt-1">Rate condition to improve estimate accuracy</p>
          )}
          {conditionScore && (
            <input
              type="text"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              onBlur={() => conditionNotes && runEstimate({ conditionNotes })}
              placeholder="Optional notes (e.g. minor scratch on door, fresh paint)…"
              className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/40"
            />
          )}
        </div>

        {/* ── Value history ── */}
        {snapshots.length > 0 && (
          <div className="px-4 py-3">
            <button
              onClick={() => setShowHistory((o) => !o)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                Value History ({snapshots.length})
              </span>
              {showHistory ? <ChevronUp size={13} className="text-gray-600" /> : <ChevronDown size={13} className="text-gray-600" />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-1.5">
                {snapshots.slice(0, 12).map((snap, i) => {
                  const prev = snapshots[i + 1];
                  const change = prev?.garageEstimate && snap.garageEstimate
                    ? snap.garageEstimate - prev.garageEstimate : null;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 w-24 flex-shrink-0">
                          {new Date(snap.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="text-[10px] text-gray-700 capitalize">{snap.triggerSource}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {snap.marketBaseline && <span className="text-gray-600">{fmt(snap.marketBaseline)}</span>}
                        <span className="text-gray-300 font-medium">{snap.garageEstimate ? fmt(snap.garageEstimate) : "—"}</span>
                        {change != null && (
                          <span className={`text-[10px] font-semibold ${change > 0 ? "text-emerald-500" : change < 0 ? "text-red-500" : "text-gray-600"}`}>
                            {change > 0 ? "▲" : "▼"} {fmt(Math.abs(change))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="px-4 py-2.5">
          <p className="text-[11px] text-gray-700">
            Garage estimate is app-computed — not a professional appraisal or dealer quote. Based on your service history, condition, and market baseline.
          </p>
        </div>
      </div>
    </section>
  );
}
