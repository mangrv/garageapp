/**
 * NHTSA VIN & Recall APIs — free, no key required
 * Docs: https://vpic.nhtsa.dot.gov/api/  |  https://api.nhtsa.gov/
 */

export interface NhtsaVinResult {
  raw: Record<string, string>;
  engine: string | null;
  displacement: string | null;
  drivetrain: string | null;
  bodyStyle: string | null;
  plant: string | null;
  fuelType: string | null;
  doors: number | null;
  series: string | null;
  trim: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  errors: string[];
}

export interface NhtsaRecall {
  campaignId: string;
  component: string;
  date: string;
  summary: string;
  consequence: string | null;
  remedy: string | null;
  isOpen: boolean;
}

/** Decode a VIN using NHTSA vPIC */
export async function decodeVin(vin: string): Promise<NhtsaVinResult> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`NHTSA vPIC error: ${res.status}`);
  const data = await res.json();

  const raw: Record<string, string> = {};
  for (const item of data.Results ?? []) {
    if (item.Value && item.Value.trim()) raw[item.Variable] = item.Value;
  }

  const get = (key: string) => raw[key] ?? null;
  const errors = (data.Results ?? [])
    .filter((r: any) => r.Variable?.startsWith("Error") && r.Value && r.Value !== "0")
    .map((r: any) => r.Value as string);

  return {
    raw,
    make: get("Make"),
    model: get("Model"),
    year: get("Model Year") ? parseInt(get("Model Year")!) : null,
    engine: formatEngine(raw),
    displacement: get("Displacement (L)") ? `${parseFloat(get("Displacement (L)")!).toFixed(1)}L` : null,
    drivetrain: normalizeDrivetrain(get("Drive Type")),
    bodyStyle: get("Body Class"),
    plant: formatPlant(raw),
    fuelType: get("Fuel Type - Primary"),
    doors: get("Doors") ? parseInt(get("Doors")!) : null,
    series: get("Series"),
    trim: get("Trim"),
    errors,
  };
}

/** Lookup recalls by VIN (NHTSA Recall API v1) */
export async function lookupRecalls(vin: string): Promise<NhtsaRecall[]> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVin?vin=${encodeURIComponent(vin)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      campaignId: r.NHTSACampaignNumber ?? r.campaignId ?? "",
      component: r.Component ?? "",
      date: r.ReportReceivedDate ?? r.date ?? "",
      summary: r.Summary ?? "",
      consequence: r.Consequence ?? null,
      remedy: r.Remedy ?? null,
      isOpen: isOpenRecall(r),
    }));
  } catch {
    return [];
  }
}

/** Fallback: recalls by make/model/year when VIN recall lookup returns empty */
export async function lookupRecallsByVehicle(
  make: string,
  model: string,
  year: number
): Promise<NhtsaRecall[]> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      campaignId: r.NHTSACampaignNumber ?? "",
      component: r.Component ?? "",
      date: r.ReportReceivedDate ?? "",
      summary: r.Summary ?? "",
      consequence: r.Consequence ?? null,
      remedy: r.Remedy ?? null,
      isOpen: isOpenRecall(r),
    }));
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEngine(raw: Record<string, string>): string | null {
  const parts: string[] = [];
  if (raw["Displacement (L)"]) parts.push(`${parseFloat(raw["Displacement (L)"]).toFixed(1)}L`);
  if (raw["Engine Number of Cylinders"]) parts.push(`V${raw["Engine Number of Cylinders"]}`);
  if (raw["Engine Configuration"]) parts.push(raw["Engine Configuration"]);
  return parts.length ? parts.join(" ") : null;
}

function normalizeDrivetrain(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("4wd") || lower.includes("4x4")) return "4WD";
  if (lower.includes("awd") || lower.includes("all wheel")) return "AWD";
  if (lower.includes("fwd") || lower.includes("front")) return "FWD";
  if (lower.includes("rwd") || lower.includes("rear")) return "RWD";
  return raw;
}

function formatPlant(raw: Record<string, string>): string | null {
  const parts = [raw["Plant City"], raw["Plant State"], raw["Plant Country"]].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function isOpenRecall(r: any): boolean {
  const remedy = (r.Remedy ?? "").toLowerCase();
  const notes = (r.Notes ?? "").toLowerCase();
  // If remedy mentions "owner notification" or is empty, treat as open
  if (!remedy || remedy.includes("owner notification scheduled")) return true;
  if (notes.includes("remedy not yet available")) return true;
  return false;
}
