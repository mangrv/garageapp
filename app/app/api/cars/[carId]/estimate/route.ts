import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGarageEstimate } from "@/lib/estimator";

/** POST — generate or update the estimate */
export async function POST(req: NextRequest, { params }: { params: Promise<{ carId: string }> }) {
  const { carId: id } = await params;
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));

  const car = await prisma.car.findFirst({
    where: { id, userId: session.userId },
    include: {
      serviceRecords: {
        select: { serviceDate: true, title: true, cost: true, details: true, serviceType: true },
        orderBy: { serviceDate: "desc" },
      },
      jobs: {
        select: { title: true, notes: true, status: true },
      },
    },
  });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load current estimate + recall data
  const [existingEstimate, recalls, latestMarket] = await Promise.all([
    (prisma as any).vehicleEstimate.findUnique({ where: { carId: id } }),
    (prisma as any).vehicleRecall.findMany({ where: { carId: id, isOpen: true } }),
    (prisma as any).vehicleMarketValue.findFirst({
      where: { carId: id },
      orderBy: { fetchedAt: "desc" },
    }),
  ]);

  // Determine market baseline (priority: request > latest market value > existing estimate > null)
  let marketBaseline: number | null = null;
  let marketSource = "manual";

  if (body.marketBaseline != null) {
    marketBaseline = parseFloat(body.marketBaseline);
    marketSource = "manual";

    // Store as a new market value record
    await (prisma as any).vehicleMarketValue.create({
      data: {
        carId: id,
        sourceProvider: "manual",
        valueAvg: marketBaseline,
        mileageUsed: car.mileage,
        fetchedAt: new Date(),
        createdAt: new Date(),
      },
    });
  } else if (latestMarket) {
    marketBaseline = latestMarket.valueAvg ?? latestMarket.valueLow ?? null;
    marketSource = latestMarket.sourceProvider;
  } else if (existingEstimate?.marketBaseline) {
    marketBaseline = existingEstimate.marketBaseline;
    marketSource = existingEstimate.marketSource ?? "manual";
  }

  const conditionScore: number | null =
    body.conditionScore != null ? parseInt(body.conditionScore) :
    existingEstimate?.conditionScore ?? null;

  const conditionNotes: string | null =
    body.conditionNotes ?? existingEstimate?.conditionNotes ?? null;

  // Run estimator
  const result = computeGarageEstimate({
    year: car.year,
    mileage: car.mileage,
    acquiredDate: (car as any).acquiredDate?.toISOString() ?? null,
    marketBaseline,
    serviceRecords: car.serviceRecords.map((r) => ({
      serviceDate: r.serviceDate.toISOString(),
      title: r.title,
      cost: r.cost,
      details: r.details,
      serviceType: r.serviceType,
    })),
    activeJobs: car.jobs.map((j) => ({
      title: j.title,
      notes: j.notes,
      status: j.status,
    })),
    recallCount: recalls.length,
    openRecalls: recalls.map((r: any) => ({ campaignNumber: r.campaignNumber, component: r.component })),
    conditionScore,
    conditionNotes,
  });

  // Upsert VehicleEstimate
  const estimateData = {
    marketBaseline: result.marketBaseline,
    marketSource,
    garageEstimate: result.garageEstimate,
    maintenanceAdjustment: result.maintenanceAdjustment,
    repairAdjustment: result.repairAdjustment,
    conditionAdjustment: result.conditionAdjustment,
    mileageAdjustment: result.mileageAdjustment,
    recallAdjustment: result.recallAdjustment,
    modAdjustment: result.modAdjustment,
    adjustmentDetailJson: JSON.stringify(result.lineItems),
    confidenceScore: result.confidenceScore,
    confidence: result.confidence,
    confidenceReason: result.confidenceReason,
    conditionScore,
    conditionNotes,
    version: (existingEstimate?.version ?? 0) + 1,
    generatedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existingEstimate) {
    await (prisma as any).vehicleEstimate.update({ where: { carId: id }, data: estimateData });
  } else {
    await (prisma as any).vehicleEstimate.create({
      data: { carId: id, ...estimateData, createdAt: new Date() },
    });
  }

  // Create snapshot if value changed or first time
  const triggerSource = body.triggerSource ?? "manual";
  const lastSnap = await (prisma as any).vehicleEstimateSnapshot.findFirst({
    where: { carId: id },
    orderBy: { generatedAt: "desc" },
  });
  const valueChanged = !lastSnap ||
    Math.abs((lastSnap.garageEstimate ?? 0) - (result.garageEstimate ?? 0)) > 50;

  if (valueChanged && result.garageEstimate) {
    await (prisma as any).vehicleEstimateSnapshot.create({
      data: {
        carId: id,
        garageEstimate: result.garageEstimate,
        marketBaseline: result.marketBaseline,
        confidence: result.confidence,
        triggerSource,
        generatedAt: new Date(),
        createdAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, result });
}

/** GET — return current estimate + history */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ carId: string }> }) {
  const { carId: id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [estimate, snapshots, recalls, marketValues, vinEnrichment] = await Promise.all([
    (prisma as any).vehicleEstimate.findUnique({ where: { carId: id } }),
    (prisma as any).vehicleEstimateSnapshot.findMany({
      where: { carId: id },
      orderBy: { generatedAt: "desc" },
      take: 24,
    }),
    (prisma as any).vehicleRecall.findMany({ where: { carId: id }, orderBy: { isOpen: "desc" } }),
    (prisma as any).vehicleMarketValue.findMany({
      where: { carId: id },
      orderBy: { fetchedAt: "desc" },
      take: 5,
    }),
    (prisma as any).vinEnrichment.findUnique({ where: { carId: id } }),
  ]);

  return NextResponse.json({
    estimate: estimate ? {
      ...estimate,
      adjustmentDetails: safeJson(estimate.adjustmentDetailJson),
    } : null,
    snapshots,
    recalls,
    marketValues,
    vinEnrichment: vinEnrichment ? {
      ...vinEnrichment,
      recallsSummary: safeJson(vinEnrichment.recallsSummary),
    } : null,
  });
}

function safeJson(str: string | null) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}
