import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import VinEnrichmentPanel from "../VinEnrichmentPanel";
import VehicleValuePanel from "../VehicleValuePanel";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id },
    select: { id: true, year: true, make: true, model: true, vin: true },
  });
  if (!car) redirect("/dashboard");

  const [vehicleEstimate, estimateSnapshots, vinEnrichment, latestMarket] = await Promise.all([
    (prisma as any).vehicleEstimate.findUnique({ where: { carId: id } }),
    (prisma as any).vehicleEstimateSnapshot.findMany({
      where: { carId: id }, orderBy: { generatedAt: "desc" }, take: 24,
    }),
    (prisma as any).vinEnrichment.findUnique({ where: { carId: id } }),
    (prisma as any).vehicleMarketValue.findFirst({
      where: { carId: id }, orderBy: { fetchedAt: "desc" },
    }),
  ]);

  const ve = vinEnrichment;
  const enrichmentData = ve ? {
    engine: ve.engine, displacement: ve.displacement, drivetrain: ve.drivetrain,
    bodyStyle: ve.bodyStyle, plant: ve.plant, fuelType: ve.fuelType, doors: ve.doors,
    series: ve.series, hasOpenRecalls: ve.hasOpenRecalls, recallCount: ve.recallCount,
    recallsSummary: ve.recallsSummary ? (() => { try { return JSON.parse(ve.recallsSummary); } catch { return null; } })() : null,
    enrichedAt: ve.enrichedAt?.toISOString() ?? null,
  } : null;

  const est = vehicleEstimate;
  const estimateData = est ? {
    marketBaseline: est.marketBaseline,
    garageEstimate: est.garageEstimate,
    totalAdjustment: (est.maintenanceAdjustment ?? 0) + (est.repairAdjustment ?? 0) +
      (est.conditionAdjustment ?? 0) + (est.mileageAdjustment ?? 0) +
      (est.recallAdjustment ?? 0) + (est.modAdjustment ?? 0),
    maintenanceAdjustment: est.maintenanceAdjustment ?? 0,
    repairAdjustment: est.repairAdjustment ?? 0,
    conditionAdjustment: est.conditionAdjustment ?? 0,
    mileageAdjustment: est.mileageAdjustment ?? 0,
    recallAdjustment: est.recallAdjustment ?? 0,
    modAdjustment: est.modAdjustment ?? 0,
    lineItems: est.adjustmentDetailJson ? (() => { try { return JSON.parse(est.adjustmentDetailJson); } catch { return []; } })() : [],
    confidence: est.confidence ?? "low",
    confidenceScore: est.confidenceScore ?? 0,
    confidenceReason: est.confidenceReason ?? "",
  } : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">{car.year} {car.make} {car.model}</h1>
        <p className="text-xs text-gray-500 mt-0.5">Vehicle data, recalls & estimated value</p>
      </div>

      <VinEnrichmentPanel
        carId={id}
        vin={car.vin ?? null}
        initialEnrichment={enrichmentData}
      />

      <VehicleValuePanel
        carId={id}
        initialEstimate={estimateData}
        initialSnapshots={estimateSnapshots.map((s: any) => ({
          garageEstimate: s.garageEstimate,
          marketBaseline: s.marketBaseline,
          confidence: s.confidence,
          generatedAt: s.generatedAt?.toISOString(),
          triggerSource: s.triggerSource,
        }))}
        initialMarketLow={latestMarket?.valueLow ?? null}
        initialMarketHigh={latestMarket?.valueHigh ?? null}
      />
    </div>
  );
}
