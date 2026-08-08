import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

import { callGarageAIText } from "@/lib/ai-provider";

function extractJSON(text: string): unknown[] {
  const codeMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (codeMatch) { try { return JSON.parse(codeMatch[1]); } catch {} }
  const rawMatch = text.match(/\[[\s\S]*\]/);
  if (rawMatch) { try { return JSON.parse(rawMatch[0]); } catch {} }
  throw new Error("No valid JSON array in response");
}

/** Match a forecast item against service records using keyword similarity */
function matchServiceRecord(
  itemName: string,
  itemCategory: string,
  intervalMiles: number | null,
  records: { title: string; serviceType: string | null; serviceDate: Date; mileage: number | null }[],
  currentMileage: number | null
): { doneAt: string; doneMileage: number | null } | null {
  const needle = (itemName + " " + itemCategory).toLowerCase();
  const keywords = needle.split(/\s+/).filter(w => w.length > 3);

  for (const rec of records) {
    const haystack = ((rec.serviceType ?? "") + " " + rec.title).toLowerCase();
    const matches = keywords.filter(kw => haystack.includes(kw)).length;
    if (matches >= 1 && (
      haystack.includes("oil") && needle.includes("oil") ||
      haystack.includes("transmission") && needle.includes("transmission") ||
      haystack.includes("tire") && needle.includes("tire") ||
      haystack.includes("brake") && needle.includes("brake") ||
      haystack.includes("filter") && needle.includes("filter") ||
      haystack.includes("coolant") && needle.includes("coolant") ||
      haystack.includes("spark") && needle.includes("spark") ||
      haystack.includes("battery") && needle.includes("battery") ||
      haystack.includes("fluid") && needle.includes("fluid") ||
      haystack.includes("wiper") && needle.includes("wiper") ||
      haystack.includes("belt") && needle.includes("belt") ||
      haystack.includes("rotate") && needle.includes("rotat") ||
      matches >= 2
    )) {
      // Found a match — check if it's still within interval
      const doneMileage = rec.mileage ?? null;
      if (intervalMiles && currentMileage && doneMileage) {
        if (currentMileage - doneMileage < intervalMiles) {
          return { doneAt: rec.serviceDate.toISOString().slice(0, 10), doneMileage };
        }
      } else {
        // No mileage data — just mark as done
        return { doneAt: rec.serviceDate.toISOString().slice(0, 10), doneMileage };
      }
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { carId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const forecast = await (prisma as any).maintenanceForecast.findUnique({ where: { carId } });
  if (!forecast) return NextResponse.json({ items: null });
  return NextResponse.json({ items: JSON.parse(forecast.items), generatedAt: forecast.generatedAt });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { carId } = await params;

  const car = await prisma.car.findFirst({
    where: { id: carId, userId: session.userId },
    include: {
      serviceRecords: {
        orderBy: { serviceDate: "desc" },
        select: { title: true, serviceType: true, serviceDate: true, mileage: true },
      },
    },
  });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const carName = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const mileage = car.mileage;

  // Ask AI ONLY for maintenance schedule — no done tracking
  const prompt = `You are an expert automotive technician. Return ONLY a raw JSON array with no markdown, no code blocks, no explanation text.

Vehicle: ${carName}
Current mileage: ${mileage ? mileage.toLocaleString() : "unknown"} miles

Generate the standard recurring maintenance schedule for this vehicle based on manufacturer recommendations. Include only recurring services (oil, filters, brakes, fluids, belts, spark plugs, tires, battery, wipers, etc.). Do NOT include one-time mods, bodywork, or cosmetic items.

For each item, calculate priority based ONLY on current mileage vs when it's due:
- "overdue": already past the due mileage
- "due-now": within 1,000 miles of due
- "upcoming": within 5,000 miles of due
- "ok": not due for more than 5,000 miles

JSON array, each object — do NOT include doneAt or doneMileage fields, the app will determine that:
{"id":"unique-slug","name":"short name","category":"Engine|Fluids|Brakes|Tires|Electrical|Suspension|Filters|Belts & Hoses","interval":"every X miles","intervalMiles":number_or_null,"dueMileage":number_or_null,"estimatedCostDIY":number,"estimatedCostShop":number,"priority":"overdue|due-now|upcoming|ok","notes":"one sentence specific to this car"}`;

  try {
    const text = await callGarageAIText({ prompt, temperature: 0.1, maxTokens: 4096, signal: AbortSignal.timeout(120_000) });
    const rawItems = extractJSON(text) as Array<{
      id: string; name: string; category: string; interval: string;
      intervalMiles: number | null; dueMileage: number | null;
      estimatedCostDIY: number; estimatedCostShop: number;
      priority: string; notes: string;
    }>;

    // App-side: match against real service records
    const records = car.serviceRecords.map(r => ({
      title: r.title,
      serviceType: r.serviceType as string | null,
      serviceDate: r.serviceDate,
      mileage: r.mileage,
    }));

    const items = rawItems.map(item => {
      const match = matchServiceRecord(
        item.name, item.category, item.intervalMiles,
        records, mileage
      );
      // If item is done and not yet due again, override priority to "ok"
      const priority = match ? "ok" : item.priority;
      return { ...item, doneAt: match?.doneAt ?? null, doneMileage: match?.doneMileage ?? null, priority };
    });

    await (prisma as any).maintenanceForecast.upsert({
      where: { carId },
      create: { id: `${carId}-forecast`, carId, items: JSON.stringify(items), updatedAt: new Date() },
      update: { items: JSON.stringify(items), updatedAt: new Date(), generatedAt: new Date() },
    });

    return NextResponse.json({ items, generatedAt: new Date() });
  } catch (e) {
    console.error("Forecast error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
