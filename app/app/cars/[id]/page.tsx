import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getCarAccessLevel } from "@/lib/sharedAccess";
import CarDetailClient from "./CarDetailClient";

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await requireSession();

  // Resolve actual owner — needed to check shared access
  const carOwner = await prisma.car.findUnique({ where: { id }, select: { userId: true } });
  if (!carOwner) redirect("/dashboard");
  const ownerId = carOwner.userId!;
  const accessLevel = await getCarAccessLevel(session.userId, ownerId);
  if (accessLevel === "none") redirect("/dashboard");

  const [car, allJobs, serviceCount, mileageLogs, allServiceCosts, jobReceipts, warrantyItems] = await Promise.all([
    prisma.car.findFirst({
      where: { id },   // no userId filter — shared access already checked above
      include: {
        photos: { orderBy: { takenAt: "desc" } },
        jobs: {
          where: { status: { not: "archived" } },
          orderBy: { createdAt: "desc" },
          include: { phases: { include: { tasks: true } } },
        },
        serviceRecords: {
          orderBy: { serviceDate: "desc" },
          take: 3,
        },
        documents: { orderBy: { createdAt: "desc" } },
        vinEnrichment: true,
      },
    }),
    prisma.job.findMany({ where: { carId: id }, select: { status: true } }),
    prisma.serviceRecord.count({ where: { carId: id } }),
    prisma.mileageLog.findMany({
      where: { carId: id },
      orderBy: { recordedAt: "desc" },
      take: 20,
    }),
    prisma.serviceRecord.findMany({
      where: { carId: id },
      select: { cost: true, serviceDate: true, serviceType: true, title: true },
    }),
    prisma.receipt.findMany({
      where: { job: { carId: id }, totalAmount: { not: null } },
      select: { totalAmount: true, job: { select: { serviceType: true } } },
    }),
    prisma.receiptLineItem.findMany({
      where: {
        receipt: { serviceRecord: { carId: id } },
        OR: [
          { warrantyProvider: { not: null } },
          { warrantyStart: { not: null } },
          { warrantyEnd: { not: null } },
          { warrantyNotes: { not: null } },
        ],
      },
      orderBy: { warrantyEnd: "asc" },
      select: {
        id: true,
        name: true,
        warrantyProvider: true,
        warrantyStart: true,
        warrantyEnd: true,
        warrantyNotes: true,
        receipt: { select: { id: true, serviceRecordId: true } },
      },
    }),
  ]);

  if (!car) redirect("/dashboard");

  // Cost of ownership calculations
  const purchasePrice = (car as any).purchasePrice as number | null;
  const acquiredDate = (car as any).acquiredDate as Date | null;
  const serviceCosts = allServiceCosts
    .filter((r) => (r as any).cost != null)
    .map((r) => ({ cost: (r as any).cost as number, serviceDate: r.serviceDate, title: r.title, serviceType: (r as any).serviceType as string | null }));
  const totalServiceCost = serviceCosts.reduce((s, r) => s + r.cost, 0);
  // Also count receipts linked to jobs (parts/supplies not yet in a service record)
  const jobReceiptTotal = (jobReceipts as any[]).reduce((s: number, r: any) => s + (r.totalAmount ?? 0), 0);
  const totalInvested = (purchasePrice ?? 0) + totalServiceCost + jobReceiptTotal;
  const yearsOwned = acquiredDate
    ? (Date.now() - acquiredDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    : null;
  const costPerYear = yearsOwned && yearsOwned > 0 && totalInvested > 0
    ? totalInvested / yearsOwned : null;
  const costPerMile = car.mileage && totalInvested > 0 ? totalInvested / car.mileage : null;

  const monthsOwned = acquiredDate
    ? (Date.now() - acquiredDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    : null;

  const costData = {
    purchasePrice,
    totalServiceCost: Math.round(totalServiceCost * 100) / 100,
    jobReceiptTotal: Math.round(jobReceiptTotal * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    costPerYear: costPerYear ? Math.round(costPerYear) : null,
    costPerMile: costPerMile ? Math.round(costPerMile * 100) / 100 : null,
    monthsOwned: monthsOwned ? Math.round(monthsOwned * 10) / 10 : null,
    serviceCount: serviceCosts.length,
    // Top cost categories (service records + job receipts)
    byCategory: Object.entries(
      [...serviceCosts.map(r => ({ cost: r.cost, serviceType: r.serviceType })),
       ...(jobReceipts as any[]).map((r: any) => ({ cost: r.totalAmount ?? 0, serviceType: r.job?.serviceType ?? "parts" }))
      ].reduce((acc, r) => {
        const cat = r.serviceType ?? "other";
        acc[cat] = (acc[cat] ?? 0) + r.cost;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, total]) => ({ cat, total: Math.round(total * 100) / 100 })),
  };

  const stats = {
    total: allJobs.length,
    active: allJobs.filter((p) => p.status === "active").length,
    done: allJobs.filter((p) => p.status === "done").length,
    archived: allJobs.filter((p) => p.status === "archived").length,
    serviceCount,
  };

  const projects = car.jobs.map((p) => {
    const total = p.phases.reduce((s, ph) => s + ph.tasks.length, 0);
    const done = p.phases.reduce((s, ph) => s + ph.tasks.filter((t) => t.done).length, 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { id: p.id, title: p.title, pct };
  });

  // Load estimate + enrichment from new normalized tables
  const [vehicleEstimate, estimateSnapshots, vehicleRecalls, vinEnrichment] = await Promise.all([
    (prisma as any).vehicleEstimate.findUnique({ where: { carId: id } }),
    (prisma as any).vehicleEstimateSnapshot.findMany({
      where: { carId: id }, orderBy: { generatedAt: "desc" }, take: 24,
    }),
    (prisma as any).vehicleRecall.findMany({ where: { carId: id }, orderBy: { isOpen: "desc" } }),
    (prisma as any).vinEnrichment.findUnique({
      where: { carId: id },
      select: {
        engine: true, displacement: true, drivetrain: true, bodyStyle: true,
        plant: true, fuelType: true, doors: true, series: true, trim: true,
        hasOpenRecalls: true, recallCount: true, recallsSummary: true,
        enrichedAt: true, blurb: true, blurbGeneratedAt: true,
      },
    }),
  ]);

  const ve = vinEnrichment;
  const enrichmentData = ve ? {
    engine: ve.engine, displacement: ve.displacement, drivetrain: ve.drivetrain,
    bodyStyle: ve.bodyStyle, plant: ve.plant, fuelType: ve.fuelType, doors: ve.doors,
    series: ve.series, hasOpenRecalls: ve.hasOpenRecalls, recallCount: ve.recallCount,
    recallsSummary: ve.recallsSummary ? JSON.parse(ve.recallsSummary) : null,
    enrichedAt: ve.enrichedAt?.toISOString() ?? null,
    blurb: ve.blurb ?? null,
    blurbGeneratedAt: ve.blurbGeneratedAt?.toISOString() ?? null,
  } : null;

  const est = vehicleEstimate;
  const latestMarket = await (prisma as any).vehicleMarketValue.findFirst({
    where: { carId: id }, orderBy: { fetchedAt: "desc" },
  });
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
    <CarDetailClient
      car={{
        id: car.id,
        assetType: (car as any).assetType ?? "vehicle",
        relationshipToUser: (car as any).relationshipToUser ?? "owned",
        managedOwnerName: (car as any).managedOwnerName ?? null,
        managedOwnerContact: (car as any).managedOwnerContact ?? null,
        managedOwnerNotes: (car as any).managedOwnerNotes ?? null,
        year: car.year,
        make: car.make,
        model: car.model,
        trim: car.trim,
        color: car.color,
        mileage: car.mileage,
        vin: car.vin,
        transmission: (car as any).transmission ?? null,
        notes: car.notes,
        acquiredDate: (car as any).acquiredDate?.toISOString() ?? null,
        purchasePrice: (car as any).purchasePrice ?? null,
        bikeType: (car as any).bikeType ?? null,
        frameSize: (car as any).frameSize ?? null,
        wheelSize: (car as any).wheelSize ?? null,
      }}
      photos={car.photos.map((p) => ({
        ...p,
        takenAt: p.takenAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      }))}
      projects={projects}
      stats={stats}
      mileageLogs={await (async () => {
        const sIds = mileageLogs.filter(l => l.sourceId && (l.source === "service" || l.source === "job")).map(l => l.sourceId as string);
        const sRecs = sIds.length > 0 ? await prisma.serviceRecord.findMany({ where: { id: { in: sIds } }, select: { id: true, title: true } }) : [];
        const sMap: Record<string, string> = {};
        for (const r of sRecs) sMap[r.id] = r.title;
        return mileageLogs.map((l) => ({
          id: l.id,
          mileage: l.mileage,
          recordedAt: l.recordedAt.toISOString(),
          source: l.source,
          notes: l.notes,
          sourceName: l.sourceId ? (sMap[l.sourceId] ?? null) : null,
          sourceId: l.sourceId ?? null,
        }));
      })()}
      recentService={car.serviceRecords.map((r) => ({
        id: r.id,
        title: r.title,
        mileage: r.mileage,
        serviceDate: r.serviceDate.toISOString(),
      }))}
      costData={costData}
      documents={car.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        type: d.type,
        label: d.label,
        expiresAt: d.expiresAt?.toISOString() ?? null,
        notes: d.notes,
        createdAt: d.createdAt.toISOString(),
      }))}
      warranties={warrantyItems.map((w) => ({
        id: w.id,
        name: w.name,
        warrantyProvider: w.warrantyProvider,
        warrantyStart: w.warrantyStart?.toISOString() ?? null,
        warrantyEnd: w.warrantyEnd?.toISOString() ?? null,
        warrantyNotes: w.warrantyNotes,
        receiptId: w.receipt.id,
        serviceRecordId: w.receipt.serviceRecordId,
      }))}
      accessLevel={accessLevel}
      enrichment={enrichmentData}
      vehicleEstimate={estimateData}
      estimateSnapshots={estimateSnapshots.map((s: any) => ({
        garageEstimate: s.garageEstimate, marketBaseline: s.marketBaseline,
        confidence: s.confidence, generatedAt: s.generatedAt?.toISOString(), triggerSource: s.triggerSource,
      }))}
      marketLow={latestMarket?.valueLow ?? null}
      marketHigh={latestMarket?.valueHigh ?? null}
      isPublic={(car as any).isPublic ?? false}
      publicNotes={(car as any).publicNotes ?? ""}
      vehicleBlurb={enrichmentData?.blurb ?? null}
      vehicleBlurbGeneratedAt={enrichmentData?.blurbGeneratedAt ?? null}
    />
  );
}
