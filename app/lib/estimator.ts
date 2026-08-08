/**
 * Garage Estimate Engine v2
 *
 * Formula:
 *   garage_estimate = market_baseline
 *                   + maintenance_adjustment
 *                   + repair_adjustment
 *                   + condition_adjustment
 *                   + mileage_adjustment
 *                   + recall_adjustment
 *                   + mod_adjustment
 *
 * All adjustments are in dollar amounts derived from percentage factors
 * applied to the market baseline. Each component is stored separately
 * for full auditability and explainability.
 *
 * Guardrails:
 *   - Maintenance boost capped at +$1,500 (prevents inflation)
 *   - Mods treated conservatively — 40% of spend credited
 *   - Recent spend ≠ full value gain
 */

export interface ServiceRecord {
  serviceDate: string;
  title: string;
  cost: number | null;
  details: string | null;
  serviceType: string | null;
}

export interface ActiveJob {
  title: string;
  notes: string | null;
  status: string;
}

export interface EstimatorInput {
  year: number;
  mileage: number | null;
  acquiredDate: string | null;
  marketBaseline: number | null;
  serviceRecords: ServiceRecord[];
  activeJobs: ActiveJob[];
  recallCount: number;
  openRecalls: { campaignNumber: string; component: string }[];
  conditionScore: number | null; // 1–5
  conditionNotes: string | null;
}

export interface LineItem {
  label: string;
  description: string;
  dollarAmount: number;
  pctOfBaseline: number | null;
  icon: string;
  category: "maintenance" | "repair" | "condition" | "mileage" | "recall" | "mod";
}

export interface EstimatorResult {
  // Summary
  marketBaseline: number | null;
  garageEstimate: number | null;
  totalAdjustment: number;

  // Per-category dollar amounts (PRD schema)
  maintenanceAdjustment: number;
  repairAdjustment: number;
  conditionAdjustment: number;
  mileageAdjustment: number;
  recallAdjustment: number;
  modAdjustment: number;

  // Detailed line items for UI
  lineItems: LineItem[];

  // Confidence
  confidence: "high" | "medium" | "low";
  confidenceScore: number; // 0–100
  confidenceReason: string;
}

const AVG_MILES_PER_YEAR = 12_000;

// Cap helpers
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function pctOf(baseline: number, pct: number) {
  return Math.round(baseline * pct / 100);
}

export function computeGarageEstimate(input: EstimatorInput): EstimatorResult {
  const baseline = input.marketBaseline ?? 0;
  const hasBaseline = !!input.marketBaseline;

  const maintenanceItems: LineItem[] = [];
  const repairItems: LineItem[] = [];
  const conditionItems: LineItem[] = [];
  const mileageItems: LineItem[] = [];
  const recallItems: LineItem[] = [];
  const modItems: LineItem[] = [];

  // ── MAINTENANCE ADJUSTMENTS ────────────────────────────────────────────────

  const recordCount = input.serviceRecords.length;
  const sorted = [...input.serviceRecords].sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
  );

  // 1a. Service documentation quality
  let docPct = 0;
  if (recordCount >= 20) docPct = 3.5;
  else if (recordCount >= 10) docPct = 2.5;
  else if (recordCount >= 4) docPct = 1.5;
  else if (recordCount >= 1) docPct = 0.5;
  if (docPct > 0 && hasBaseline) {
    const amt = clamp(pctOf(baseline, docPct), 0, 800);
    maintenanceItems.push({
      label: `Complete service history (${recordCount} records)`,
      description: "Well-documented maintenance history increases buyer confidence",
      dollarAmount: amt,
      pctOfBaseline: docPct,
      icon: "📋",
      category: "maintenance",
    });
  }

  // 1b. Maintenance recency
  if (recordCount > 0) {
    const lastDays = Math.floor(
      (Date.now() - new Date(sorted[0].serviceDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (lastDays < 90) {
      const amt = hasBaseline ? clamp(pctOf(baseline, 1.5), 0, 600) : 0;
      maintenanceItems.push({
        label: "Recently serviced",
        description: `Last service ${Math.round(lastDays / 30)} months ago — buyers pay a premium`,
        dollarAmount: amt,
        pctOfBaseline: 1.5,
        icon: "🔧",
        category: "maintenance",
      });
    } else if (lastDays < 180) {
      const amt = hasBaseline ? clamp(pctOf(baseline, 0.8), 0, 350) : 0;
      maintenanceItems.push({
        label: "Serviced within 6 months",
        description: `Last service ~${Math.round(lastDays / 30)} months ago`,
        dollarAmount: amt,
        pctOfBaseline: 0.8,
        icon: "🔧",
        category: "maintenance",
      });
    } else if (lastDays > 730) {
      const amt = hasBaseline ? clamp(pctOf(baseline, -4), -2000, 0) : 0;
      maintenanceItems.push({
        label: "Significantly overdue for service",
        description: `No service in over ${Math.round(lastDays / 365)} years`,
        dollarAmount: amt,
        pctOfBaseline: -4,
        icon: "⚠️",
        category: "maintenance",
      });
    } else if (lastDays > 365) {
      const amt = hasBaseline ? clamp(pctOf(baseline, -2), -1500, 0) : 0;
      maintenanceItems.push({
        label: "Overdue for service",
        description: `Last service ${Math.round(lastDays / 365 * 10) / 10} years ago`,
        dollarAmount: amt,
        pctOfBaseline: -2,
        icon: "⚠️",
        category: "maintenance",
      });
    }
  }

  // 1c. Tire service detected
  const tireRecord = sorted.find((r) => {
    const text = `${r.title} ${r.details ?? ""}`.toLowerCase();
    return text.includes("tire") || text.includes("tyre");
  });
  if (tireRecord) {
    const daysSince = Math.floor(
      (Date.now() - new Date(tireRecord.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < 365) {
      const amt = hasBaseline ? clamp(pctOf(baseline, 1.0), 0, 400) : 0;
      maintenanceItems.push({
        label: "New tires within 12 months",
        description: `Tire service on record — ${new Date(tireRecord.serviceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
        dollarAmount: amt,
        pctOfBaseline: 1.0,
        icon: "🛞",
        category: "maintenance",
      });
    }
  }

  // 1d. Total service cost investment (cap contribution)
  const totalServiceCost = input.serviceRecords.reduce((s, r) => s + (r.cost ?? 0), 0);
  if (totalServiceCost > 3000 && hasBaseline) {
    let pct = 0;
    if (totalServiceCost > 15_000) pct = 1.5;
    else if (totalServiceCost > 7_000) pct = 1.0;
    else pct = 0.5;
    const amt = clamp(pctOf(baseline, pct), 0, 700);
    maintenanceItems.push({
      label: `$${totalServiceCost.toLocaleString()} in documented maintenance costs`,
      description: "Verified spend signals consistent upkeep",
      dollarAmount: amt,
      pctOfBaseline: pct,
      icon: "💰",
      category: "maintenance",
    });
  }

  // ── REPAIR ADJUSTMENTS ─────────────────────────────────────────────────────

  const majorKeywords = [
    { kw: ["engine rebuild", "engine replacement", "new engine"], pct: 3.5, label: "Engine work" },
    { kw: ["transmission", "rebuilt transmission", "new transmission"], pct: 3.0, label: "Transmission service" },
    { kw: ["timing belt", "timing chain"], pct: 1.5, label: "Timing belt/chain" },
    { kw: ["head gasket"], pct: 2.0, label: "Head gasket repair" },
    { kw: ["differential", "transfer case"], pct: 1.5, label: "Drivetrain repair" },
    { kw: ["brake", "brakes", "rotors", "calipers"], pct: 0.8, label: "Brake work" },
    { kw: ["suspension", "struts", "shocks", "control arm"], pct: 0.8, label: "Suspension work" },
    { kw: ["ac", "a/c", "air conditioning", "hvac"], pct: 0.6, label: "HVAC/AC service" },
  ];

  for (const { kw, pct, label } of majorKeywords) {
    const match = sorted.find((r) => {
      const text = `${r.title} ${r.details ?? ""} ${r.serviceType ?? ""}`.toLowerCase();
      return kw.some((k) => text.includes(k));
    });
    if (match && hasBaseline) {
      const daysSince = Math.floor(
        (Date.now() - new Date(match.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      // Decay: full credit if < 2 years, half credit if 2-5 years
      const decay = daysSince < 730 ? 1 : daysSince < 1825 ? 0.5 : 0.25;
      const amt = clamp(Math.round(pctOf(baseline, pct) * decay), 0, 2000);
      if (amt > 0) {
        repairItems.push({
          label: `${label} on record`,
          description: `${new Date(match.serviceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}${daysSince > 730 ? " (partial credit)" : ""}`,
          dollarAmount: amt,
          pctOfBaseline: pct * decay,
          icon: "🏗",
          category: "repair",
        });
      }
    }
  }

  // ── CONDITION ADJUSTMENTS ──────────────────────────────────────────────────

  if (input.conditionScore && hasBaseline) {
    const conditionMap: Record<number, [number, string, string]> = {
      1: [-5, "Poor condition", "Significant cosmetic or mechanical issues reduce appeal"],
      2: [-2.5, "Fair condition", "Noticeable wear or minor issues noted"],
      3: [0, "Good condition", "Normal wear for age and mileage"],
      4: [2.5, "Very good condition", "Above-average presentation for age"],
      5: [5, "Excellent condition", "Like-new — exceptional care, premium appeal"],
    };
    const [pct, label, desc] = conditionMap[input.conditionScore];
    if (pct !== 0) {
      const amt = clamp(pctOf(baseline, pct), -3000, 3000);
      conditionItems.push({
        label,
        description: input.conditionNotes ? `${desc} — "${input.conditionNotes}"` : desc,
        dollarAmount: amt,
        pctOfBaseline: pct,
        icon: "★",
        category: "condition",
      });
    }
  }

  // Unresolved active issue keywords
  const issueKw = ["leak", "noise", "vibration", "broken", "crack", "damage", "failure", "check engine", "misfire", "burning"];
  const issues = input.activeJobs.filter((j) => {
    if (j.status !== "active") return false;
    return issueKw.some((k) => `${j.title} ${j.notes ?? ""}`.toLowerCase().includes(k));
  });
  if (issues.length > 0 && hasBaseline) {
    const pct = clamp(issues.length * -1.5, -6, 0);
    const amt = clamp(pctOf(baseline, pct), -3000, 0);
    conditionItems.push({
      label: `${issues.length} unresolved issue${issues.length > 1 ? "s" : ""} in active jobs`,
      description: issues.map((j) => j.title).slice(0, 2).join(", "),
      dollarAmount: amt,
      pctOfBaseline: pct,
      icon: "🔴",
      category: "condition",
    });
  }

  // ── MILEAGE ADJUSTMENTS ────────────────────────────────────────────────────

  if (input.mileage && hasBaseline) {
    const age = new Date().getFullYear() - input.year + 0.5;
    const expected = age * AVG_MILES_PER_YEAR;
    const excess = input.mileage - expected;
    const per10k = excess / 10_000;

    if (excess < -20_000) {
      const pct = clamp(Math.abs(per10k) * 0.5, 0, 4);
      const amt = clamp(pctOf(baseline, pct), 0, 2000);
      mileageItems.push({
        label: "Well below average mileage",
        description: `${Math.round(Math.abs(excess)).toLocaleString()} mi below expected for a ${input.year}`,
        dollarAmount: amt, pctOfBaseline: pct, icon: "📍", category: "mileage",
      });
    } else if (excess < -5_000) {
      const amt = hasBaseline ? clamp(pctOf(baseline, 1.5), 0, 900) : 0;
      mileageItems.push({
        label: "Below average mileage",
        description: `${Math.round(Math.abs(excess)).toLocaleString()} mi below expected for a ${input.year}`,
        dollarAmount: amt, pctOfBaseline: 1.5, icon: "📍", category: "mileage",
      });
    } else if (excess > 20_000) {
      const pct = clamp(per10k * -1.2, -8, 0);
      const amt = clamp(pctOf(baseline, pct), -5000, 0);
      mileageItems.push({
        label: "High mileage",
        description: `${Math.round(excess).toLocaleString()} mi above average for a ${input.year} (avg ${Math.round(expected).toLocaleString()} mi)`,
        dollarAmount: amt, pctOfBaseline: pct, icon: "📍", category: "mileage",
      });
    } else if (excess > 5_000) {
      const amt = hasBaseline ? clamp(pctOf(baseline, -1.5), -1500, 0) : 0;
      mileageItems.push({
        label: "Above average mileage",
        description: `${Math.round(excess).toLocaleString()} mi above expected for a ${input.year}`,
        dollarAmount: amt, pctOfBaseline: -1.5, icon: "📍", category: "mileage",
      });
    }
  }

  // ── RECALL ADJUSTMENTS ─────────────────────────────────────────────────────

  if (input.openRecalls.length > 0 && hasBaseline) {
    for (const recall of input.openRecalls.slice(0, 4)) {
      const amt = clamp(pctOf(baseline, -2.5), -1500, 0);
      recallItems.push({
        label: `Open recall: ${recall.component || recall.campaignNumber}`,
        description: `NHTSA Campaign ${recall.campaignNumber} — unaddressed safety recall`,
        dollarAmount: amt, pctOfBaseline: -2.5, icon: "⚠️", category: "recall",
      });
    }
  }

  // ── AGGREGATE ──────────────────────────────────────────────────────────────

  const sum = (items: LineItem[]) => items.reduce((s, i) => s + i.dollarAmount, 0);

  const maintenanceAdj = clamp(sum(maintenanceItems), -3000, 1500); // cap positive
  const repairAdj = clamp(sum(repairItems), 0, 3000);
  const conditionAdj = clamp(sum(conditionItems), -5000, 3000);
  const mileageAdj = clamp(sum(mileageItems), -6000, 2500);
  const recallAdj = clamp(sum(recallItems), -5000, 0);
  const modAdj = clamp(sum(modItems), -1000, 1000);

  const totalAdjustment = maintenanceAdj + repairAdj + conditionAdj + mileageAdj + recallAdj + modAdj;
  const garageEstimate = input.marketBaseline
    ? Math.round(input.marketBaseline + totalAdjustment)
    : null;

  const allItems = [...maintenanceItems, ...repairItems, ...conditionItems, ...mileageItems, ...recallItems, ...modItems];

  // ── CONFIDENCE ─────────────────────────────────────────────────────────────

  let score = 0;
  if (input.marketBaseline) score += 40;
  if (recordCount >= 10) score += 25;
  else if (recordCount >= 3) score += 15;
  else if (recordCount >= 1) score += 5;
  if (input.conditionScore) score += 15;
  if (input.mileage) score += 10;
  if (input.openRecalls.length >= 0 && input.recallCount >= 0) score += 10; // recall data fetched

  let confidence: "high" | "medium" | "low" = "low";
  let confidenceReason = "";

  if (score >= 80) {
    confidence = "high";
    confidenceReason = "Market baseline + detailed service history + condition rating + recall data";
  } else if (score >= 50) {
    confidence = "medium";
    confidenceReason = score >= 60
      ? "Market baseline with solid history — add condition rating for higher confidence"
      : "Market baseline set — add service records and rate condition to improve confidence";
  } else if (!input.marketBaseline) {
    confidenceReason = "Set a market baseline to calculate your garage estimate";
  } else {
    confidenceReason = "Market baseline only — add service history and condition rating for a meaningful estimate";
  }

  return {
    marketBaseline: input.marketBaseline,
    garageEstimate,
    totalAdjustment,
    maintenanceAdjustment: maintenanceAdj,
    repairAdjustment: repairAdj,
    conditionAdjustment: conditionAdj,
    mileageAdjustment: mileageAdj,
    recallAdjustment: recallAdj,
    modAdjustment: modAdj,
    lineItems: allItems,
    confidence,
    confidenceScore: Math.min(100, score),
    confidenceReason,
  };
}
