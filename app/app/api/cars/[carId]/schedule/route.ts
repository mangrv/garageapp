import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";
import { callGarageAIJsonArray } from "@/lib/ai-provider";

// GET — fetch all schedule items for a car
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const session = await requireSession();
  const { carId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await (prisma as any).maintenanceScheduleItem.findMany({
    where: { carId },
    orderBy: [{ intervalMiles: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ items });
}

// POST — generate schedule via AI (clears old AI-generated, keeps custom)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const session = await requireSession();
  const { carId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vehicleLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;

  const prompt = `You are an automotive maintenance expert. Generate the complete factory maintenance schedule for a ${vehicleLabel}.

Return ONLY a valid JSON array. Each item must have these exact fields:
{
  "task": "Short task name",
  "category": one of: "engine"|"brakes"|"fluids"|"tires"|"electrical"|"filters"|"cooling"|"inspection",
  "notes": "Specific details, part numbers, fluid specs — null if none",
  "intervalMiles": number or null,
  "intervalMonths": number or null,
  "sortOrder": number (0-based within same interval group)
}

Cover ALL these interval groups (include every item from the factory service schedule):
- Weekly / every 250 miles (visual checks)
- Every 5,000 miles or 12 months
- Every 7,500 miles or 6 months  
- Every 15,000 miles or 12 months
- Every 30,000 miles or 24 months
- Every 60,000 miles
- Every 90,000 miles
- Every 105,000 miles (or equivalent)
- Every 120,000 miles (or equivalent)

Be specific. For example, don't just say "Check fluids" — list each fluid separately.
Include torque specs or part specs in notes where relevant.
If an interval doesn't apply (e.g. timing belt on chain engine), skip it or add a note.
Return 30-50 items total covering the full factory schedule.`;

  try {
    const aiItems = await callGarageAIJsonArray<any>({ prompt, temperature: 0.1, maxTokens: 4096 });

    // Delete old AI-generated items (keep isCustom = true)
    await (prisma as any).maintenanceScheduleItem.deleteMany({
      where: { carId, isCustom: false },
    });

    // Insert new items
    const now = new Date();
    const created = await Promise.all(
      aiItems.map((item: any, idx: number) =>
        (prisma as any).maintenanceScheduleItem.create({
          data: {
            id: randomUUID(),
            carId,
            task: item.task ?? "Unknown task",
            category: item.category ?? "general",
            notes: item.notes ?? null,
            intervalMiles: item.intervalMiles ?? null,
            intervalMonths: item.intervalMonths ?? null,
            sortOrder: item.sortOrder ?? idx,
            isCustom: false,
            updatedAt: now,
          },
        })
      )
    );

    return NextResponse.json({ items: created, generated: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "AI generation failed" }, { status: 500 });
  }
}
