"use client";

import { useState } from "react";
import { Search, RefreshCw, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from "lucide-react";

interface Recall {
  campaignId: string;
  component: string;
  date: string;
  summary: string;
  consequence: string | null;
  remedy: string | null;
  isOpen: boolean;
}

interface EnrichmentData {
  engine: string | null;
  displacement: string | null;
  drivetrain: string | null;
  bodyStyle: string | null;
  plant: string | null;
  fuelType: string | null;
  doors: number | null;
  series: string | null;
  hasOpenRecalls: boolean;
  recallCount: number;
  recallsSummary: Recall[] | null;
  enrichedAt: string | null;
}

interface Props {
  carId: string;
  vin: string | null;
  initialEnrichment: EnrichmentData | null;
}

export default function VinEnrichmentPanel({ carId, vin, initialEnrichment }: Props) {
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(initialEnrichment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecalls, setShowRecalls] = useState(false);

  const runEnrichment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/enrich`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Enrichment failed"); return; }

      // Reload enrichment data from estimate GET
      const r2 = await fetch(`/api/cars/${carId}/estimate`);
      const d2 = await r2.json();
      const ve = d2.vinEnrichment;
      if (ve) {
        setEnrichment({
          engine: ve.engine,
          displacement: ve.displacement,
          drivetrain: ve.drivetrain,
          bodyStyle: ve.bodyStyle,
          plant: ve.plant,
          fuelType: ve.fuelType,
          doors: ve.doors,
          series: ve.series,
          hasOpenRecalls: ve.hasOpenRecalls,
          recallCount: ve.recallCount,
          recallsSummary: ve.recallsSummary ?? null,
          enrichedAt: ve.enrichedAt ?? null,
        });
      }

      // Refresh recalls from normalized table too
      if (d2.recalls?.length) {
        setEnrichment((prev) => prev ? {
          ...prev,
          hasOpenRecalls: d2.recalls.some((r: any) => r.isOpen),
          recallCount: d2.recalls.filter((r: any) => r.isOpen).length,
          recallsSummary: d2.recalls.map((r: any) => ({
            campaignId: r.campaignNumber,
            component: r.component,
            date: r.recallDate ?? "",
            summary: r.summary ?? "",
            consequence: r.consequence ?? null,
            remedy: r.remedy ?? null,
            isOpen: r.isOpen,
          })),
        } : prev);
      }
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const specs = [
    enrichment?.engine && { label: "Engine", value: enrichment.engine },
    enrichment?.drivetrain && { label: "Drivetrain", value: enrichment.drivetrain },
    enrichment?.bodyStyle && { label: "Body", value: enrichment.bodyStyle },
    enrichment?.fuelType && { label: "Fuel", value: enrichment.fuelType },
    enrichment?.doors && { label: "Doors", value: String(enrichment.doors) },
    enrichment?.plant && { label: "Plant", value: enrichment.plant },
    enrichment?.series && { label: "Series", value: enrichment.series },
  ].filter(Boolean) as { label: string; value: string }[];

  const recalls: Recall[] = enrichment?.recallsSummary ?? [];
  const openRecalls = recalls.filter((r) => r.isOpen);
  const closedRecalls = recalls.filter((r) => !r.isOpen);

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <Search size={15} className="text-gray-400" />
            VIN Lookup
          </h2>
          {vin ? (
            <p className="text-xs text-gray-500 font-mono mt-0.5">{vin}</p>
          ) : (
            <p className="text-xs text-amber-500 mt-0.5">No VIN on file — edit the car to add one</p>
          )}
        </div>
        <button
          onClick={runEnrichment}
          disabled={loading || !vin}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors active:scale-95"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Fetching…" : enrichment ? "Refresh" : "Decode VIN"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-900/20 border-b border-red-700/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {!enrichment && !loading && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-500">
            {vin ? "Run VIN lookup to pull NHTSA vehicle data and recall status." : "Add a VIN to this vehicle to enable lookup."}
          </p>
        </div>
      )}

      {enrichment && (
        <div className="divide-y divide-gray-800">
          {/* Specs grid */}
          {specs.length > 0 && (
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {specs.map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</div>
                    <div className="text-sm text-gray-200 font-medium">{value}</div>
                  </div>
                ))}
              </div>
              {enrichment.enrichedAt && (
                <p className="text-[11px] text-gray-700 mt-3">
                  Source: NHTSA · Updated {new Date(enrichment.enrichedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          )}

          {/* Recalls */}
          <div className="px-4 py-3">
            <button
              onClick={() => setShowRecalls((o) => !o)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {openRecalls.length > 0 ? (
                  <AlertTriangle size={15} className="text-amber-400" />
                ) : (
                  <CheckCircle size={15} className="text-emerald-400" />
                )}
                <span className="text-sm font-semibold text-white">
                  Recalls
                </span>
                {openRecalls.length > 0 && (
                  <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full font-semibold">
                    {openRecalls.length} open
                  </span>
                )}
                {closedRecalls.length > 0 && (
                  <span className="text-xs text-gray-600">
                    + {closedRecalls.length} remedied
                  </span>
                )}
                {recalls.length === 0 && (
                  <span className="text-xs text-emerald-400">No recalls found</span>
                )}
              </div>
              {recalls.length > 0 && (
                showRecalls ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />
              )}
            </button>

            {showRecalls && recalls.length > 0 && (
              <div className="mt-3 space-y-2">
                {recalls.map((recall) => (
                  <div
                    key={recall.campaignId}
                    className={`rounded-xl border p-3 ${
                      recall.isOpen
                        ? "bg-amber-900/10 border-amber-700/30"
                        : "bg-gray-800/60 border-gray-700/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${recall.isOpen ? "text-amber-300" : "text-gray-400"}`}>
                            {recall.component || "General"}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${recall.isOpen ? "bg-amber-900/40 text-amber-400" : "bg-emerald-900/30 text-emerald-400"}`}>
                            {recall.isOpen ? "Open" : "Remedied"}
                          </span>
                        </div>
                        {recall.summary && (
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{recall.summary}</p>
                        )}
                        {recall.remedy && !recall.isOpen && (
                          <p className="text-xs text-emerald-600 mt-1">Remedy: {recall.remedy}</p>
                        )}
                        <p className="text-[11px] text-gray-600 mt-1">
                          Campaign {recall.campaignId} · {recall.date ? new Date(recall.date).getFullYear() : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
