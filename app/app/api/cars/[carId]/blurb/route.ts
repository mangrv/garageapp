import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { callGarageAIText } from "@/lib/ai-provider";

/** GET — return the saved blurb (if any) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ carId: string }> }) {
  const { carId } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id: carId, userId: session.userId },
    select: { id: true },
  });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrichment = await (prisma as any).vinEnrichment.findUnique({
    where: { carId },
    select: { blurb: true, blurbGeneratedAt: true },
  });

  return NextResponse.json({
    blurb: enrichment?.blurb ?? null,
    blurbGeneratedAt: enrichment?.blurbGeneratedAt ?? null,
  });
}

/** PATCH — save a user-edited blurb */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ carId: string }> }) {
  const { carId } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id: carId, userId: session.userId },
    select: { id: true },
  });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { blurb } = await req.json();
  if (typeof blurb !== "string") return NextResponse.json({ error: "Invalid blurb" }, { status: 400 });

  await (prisma as any).vinEnrichment.upsert({
    where: { carId },
    update: { blurb, blurbGeneratedAt: new Date() },
    create: { carId, blurb, blurbGeneratedAt: new Date() },
  });

  return NextResponse.json({ ok: true, blurb });
}

/** POST — generate (or re-generate) the vehicle history blurb */
export async function POST(req: NextRequest, { params }: { params: Promise<{ carId: string }> }) {
  const { carId } = await params;
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const forceRefresh = body.refresh === true;

  const car = await prisma.car.findFirst({
    where: { id: carId, userId: session.userId },
    select: {
      id: true, year: true, make: true, model: true, trim: true,
      vin: true, mileage: true,
    },
  });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Grab any enrichment data we already have
  const enrichment = await (prisma as any).vinEnrichment.findUnique({
    where: { carId },
    select: {
      engine: true, displacement: true, drivetrain: true, bodyStyle: true,
      fuelType: true, doors: true, series: true, plant: true,
      hasOpenRecalls: true, recallCount: true,
      blurb: true, blurbGeneratedAt: true,
    },
  });

  if (enrichment?.blurb && !forceRefresh) {
    return NextResponse.json({
      cached: true,
      blurb: enrichment.blurb,
      blurbGeneratedAt: enrichment.blurbGeneratedAt?.toISOString?.() ?? enrichment.blurbGeneratedAt,
    });
  }

  const vehicleLabel = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");

  // Build context from known data
  const specLines: string[] = [];
  if (enrichment?.engine) specLines.push(`Engine: ${enrichment.engine}`);
  if (enrichment?.displacement) specLines.push(`Displacement: ${enrichment.displacement}`);
  if (enrichment?.drivetrain) specLines.push(`Drivetrain: ${enrichment.drivetrain}`);
  if (enrichment?.bodyStyle) specLines.push(`Body style: ${enrichment.bodyStyle}`);
  if (enrichment?.fuelType) specLines.push(`Fuel type: ${enrichment.fuelType}`);
  if (enrichment?.doors) specLines.push(`Doors: ${enrichment.doors}`);
  if (enrichment?.series) specLines.push(`Series/trim: ${enrichment.series}`);
  if (enrichment?.plant) specLines.push(`Assembly plant: ${enrichment.plant}`);
  if (car.vin) specLines.push(`VIN: ${car.vin}`);
  if (car.mileage) specLines.push(`Current mileage on record: ${car.mileage.toLocaleString()} miles`);

  const specContext = specLines.length > 0
    ? `\n\nKnown specs from VIN decode:\n${specLines.map((l) => `- ${l}`).join("\n")}`
    : "";

  const prompt = `You are an automotive historian and expert. Write a rich, factual vehicle history blurb for a ${vehicleLabel}.${specContext}

The blurb should cover the following aspects (use markdown with section headers):

## Overview
A 2–3 sentence summary of what this vehicle is and what generation/platform it represents.

## Heritage & Legacy
The model's history, lineage, what market segment it competed in, and what it's remembered for.

## This Generation (${car.year})
Specific to the model year: what changed for ${car.year}, any mid-cycle updates, production context, how it was received by press and buyers.

## Powertrain & Performance
Engine options available for this year, horsepower/torque figures, transmission choices, 0-60 benchmarks if notable. If VIN specs are provided, emphasize the specific engine in this car.

## Known Strengths
3–4 bullet points on what owners and mechanics praise about this generation.

## Common Issues
3–4 bullet points on the most frequently reported mechanical or reliability issues for this model year. Be honest and factual — this helps owners know what to watch for.

## Collector & Enthusiast Notes
Notably special trims, limited editions, or packages from this year. Aftermarket support, community, resale trends.

Tone: knowledgeable but approachable, like a great Car & Driver feature. No fluff. No ownership commentary (don't mention "your car" or "you"). Focus entirely on the vehicle's place in history and what makes it tick. Aim for ~400–550 words total.`;

  const blurb = await callGarageAIText({ prompt, temperature: 0.2, maxTokens: 1536 });
  const now = new Date();

  // Upsert VinEnrichment with the new blurb
  await (prisma as any).vinEnrichment.upsert({
    where: { carId },
    update: { blurb, blurbGeneratedAt: now },
    create: { carId, blurb, blurbGeneratedAt: now },
  });

  return NextResponse.json({ blurb, blurbGeneratedAt: now.toISOString() });
}
