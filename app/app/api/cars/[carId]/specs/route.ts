import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { callGarageAIJsonObject } from "@/lib/ai-provider";

// GET — fetch stored specs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const session = await requireSession();
  const { carId } = await params;

  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const specs = await (prisma as any).vehicleSpecs.findUnique({ where: { carId } });
  return NextResponse.json({ specs });
}

// POST — generate specs via AI (or update manually)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const session = await requireSession();
  const { carId } = await params;

  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Manual update — PATCH-style via POST with `data` key
  if (body.data) {
    const specs = await (prisma as any).vehicleSpecs.upsert({
      where: { carId },
      create: { carId, ...body.data },
      update: { ...body.data },
    });
    return NextResponse.json({ specs });
  }

  // AI generation
  const vehicleLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const vinEnrichment = await (prisma as any).vinEnrichment.findUnique({ where: { carId } });
  const vinContext = buildVinContext(vinEnrichment);

  const prompt = `You are an automotive specifications expert. Provide accurate factory specifications for a ${vehicleLabel}.
${vinContext}

Return ONLY valid JSON with exactly these keys (use null if unknown/not applicable):
{
  "engineOilType": "e.g. 0W-20 Full Synthetic",
  "engineOilCapacity": "e.g. 4.4 quarts with filter",
  "oilDrainPlugTorque": "e.g. 29 ft-lbs",
  "oilChangeInterval": "e.g. 5,000–7,500 miles",
  "transmissionFluid": "e.g. Honda ATF DW-1",
  "transmissionCapacity": "e.g. 6.9 quarts total refill",
  "transmissionService": "e.g. 30,000 miles (severe) / 90,000 miles (normal)",
  "coolantType": "e.g. Honda Blue Type 2 (OAT, pre-mixed 50/50)",
  "coolantCapacity": "e.g. 6.3 quarts",
  "thermostatTemp": "e.g. 176–183°F / 80–84°C opens",
  "coolantPressureCap": "e.g. 16 psi",
  "sparkPlugBrand": "e.g. NGK ILZKR7A-11S (iridium OEM)",
  "sparkPlugGap": "e.g. 0.044 in / 1.1 mm (pre-gapped, do not adjust)",
  "firingOrder": "e.g. 1-3-4-2",
  "ignitionCoilTorque": "e.g. 9 ft-lbs",
  "brakeFluidType": "e.g. DOT 3",
  "frontBrakeMinThick": "e.g. 1.6 mm",
  "rearBrakeMinThick": "e.g. 1.6 mm",
  "frontRotorMinThick": "e.g. 20.0 mm",
  "rearRotorMinThick": "e.g. 8.0 mm",
  "caliperBoltTorqueFront": "e.g. 53 ft-lbs (caliper bracket)",
  "caliperBoltTorqueRear": "e.g. 28 ft-lbs (caliper bracket)",
  "lugNutTorque": "e.g. 80 ft-lbs",
  "wheelSize": "e.g. 16–17 in depending on trim",
  "tireSize": "e.g. 205/60R16 or 215/55R17",
  "coldTirePressure": "e.g. 32 psi front, 30 psi rear",
  "powerSteeringFluid": "e.g. Honda PSF (electric steering — no fluid needed)",
  "acRefrigerant": "e.g. R-134a, approx. 18–20 oz",
  "diffFluid": "e.g. N/A — FWD",
  "batterySpec": "e.g. Group 51R, 410 CCA minimum",
  "airFilterInterval": "e.g. 15,000–30,000 miles",
  "timingBeltOrChain": "e.g. Timing chain — no scheduled replacement",
  "notes": "e.g. Use Honda Genuine fluids when possible. i-VTEC engine; use full synthetic oil only."
}

Be specific and accurate. Include part numbers where known. If a spec varies by sub-trim or engine variant, note both. If VIN-decoded context is provided, prioritize it over generic trim assumptions.`;

  try {
    const data = await callGarageAIJsonObject({ prompt, temperature: 0.1, maxTokens: 2048 });

    const specs = await (prisma as any).vehicleSpecs.upsert({
      where: { carId },
      create: { carId, ...data, generatedAt: new Date() },
      update: { ...data, generatedAt: new Date() },
    });

    return NextResponse.json({ specs, generated: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "AI generation failed" }, { status: 500 });
  }
}

function buildVinContext(enrichment: any) {
  if (!enrichment) {
    return "\nNo VIN-decoded context is available yet. Use the vehicle label only and note meaningful trim/engine uncertainty.";
  }

  const raw = safeJson(enrichment.nhtsaDecodeRaw) as Record<string, string> | null;
  const lines = [
    enrichment.engine && `Engine: ${enrichment.engine}`,
    enrichment.displacement && `Displacement: ${enrichment.displacement}`,
    enrichment.drivetrain && `Drivetrain: ${enrichment.drivetrain}`,
    enrichment.bodyStyle && `Body style: ${enrichment.bodyStyle}`,
    enrichment.fuelType && `Fuel type: ${enrichment.fuelType}`,
    enrichment.series && `Series: ${enrichment.series}`,
    enrichment.trim && `VIN trim: ${enrichment.trim}`,
    raw?.["Engine Model"] && `Engine model: ${raw["Engine Model"]}`,
    raw?.["Engine Manufacturer"] && `Engine manufacturer: ${raw["Engine Manufacturer"]}`,
    raw?.["Transmission Style"] && `Transmission style: ${raw["Transmission Style"]}`,
    raw?.["Drive Type"] && `NHTSA drive type: ${raw["Drive Type"]}`,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "\nVIN was scanned, but it did not provide useful specification context. Use the vehicle label and note meaningful trim/engine uncertainty.";
  }

  return `\nVIN-decoded context from NHTSA:\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function safeJson(str: string | null) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}
