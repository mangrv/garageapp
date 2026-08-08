import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decodeVin, lookupRecalls, lookupRecallsByVehicle } from "@/lib/vin-api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ carId: string }> }) {
  const { carId: id } = await params;
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const forceRefresh = body.refresh === true;

  const car = await prisma.car.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, vin: true, make: true, model: true, year: true },
  });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vin = car.vin?.trim().toUpperCase();
  if (!vin) return NextResponse.json({ error: "No VIN on this vehicle. Edit the car and add a VIN first." }, { status: 400 });

  try {
    const existing = await (prisma as any).vinEnrichment.findUnique({ where: { carId: id } });
    if (existing?.enrichedAt && !forceRefresh) {
      return NextResponse.json({
        ok: true,
        cached: true,
        totalRecalls: safeJson(existing.recallsRaw)?.length ?? 0,
        openRecallCount: existing.recallCount ?? 0,
        errors: [],
        enrichment: serializeEnrichment(existing),
        recalls: safeJson(existing.recallsSummary) ?? [],
      });
    }

    // 1. Decode VIN
    const decoded = await decodeVin(vin);

    // 2. Recall lookup
    let recalls = await lookupRecalls(vin);
    if (recalls.length === 0) {
      recalls = await lookupRecallsByVehicle(car.make, car.model, car.year);
    }

    // 3. Store raw VIN decode response
    await (prisma as any).vehicleExternalData.create({
      data: {
        carId: id,
        provider: "nhtsa_vin",
        recordType: "vin_decode",
        rawJson: JSON.stringify(decoded.raw),
        normalizedStatus: decoded.errors.length ? "partial" : "ok",
        fetchedAt: new Date(),
        createdAt: new Date(),
      },
    });

    // 4. Store raw recalls response
    if (recalls.length > 0) {
      await (prisma as any).vehicleExternalData.create({
        data: {
          carId: id,
          provider: "nhtsa_recall",
          recordType: "recall_list",
          rawJson: JSON.stringify(recalls),
          normalizedStatus: "ok",
          fetchedAt: new Date(),
          createdAt: new Date(),
        },
      });
    }

    // 5. Upsert normalized recall records
    for (const r of recalls) {
      await (prisma as any).vehicleRecall.upsert({
        where: { carId_campaignNumber: { carId: id, campaignNumber: r.campaignId } },
        update: {
          component: r.component,
          summary: r.summary,
          recallDate: r.date,
          isOpen: r.isOpen,
          consequence: r.consequence,
          remedy: r.remedy,
          lastCheckedAt: new Date(),
        },
        create: {
          carId: id,
          campaignNumber: r.campaignId,
          component: r.component,
          summary: r.summary,
          recallDate: r.date,
          isOpen: r.isOpen,
          consequence: r.consequence,
          remedy: r.remedy,
          sourceProvider: "nhtsa",
          lastCheckedAt: new Date(),
          createdAt: new Date(),
        },
      });
    }

    // 6. Update VinEnrichment with decoded specs
    const openRecalls = recalls.filter((r) => r.isOpen);
    const now = new Date();
    const vinData = {
      carId: id,
      nhtsaDecodeRaw: JSON.stringify(decoded.raw),
      recallsRaw: JSON.stringify(recalls),
      engine: decoded.engine,
      displacement: decoded.displacement,
      drivetrain: decoded.drivetrain,
      bodyStyle: decoded.bodyStyle,
      plant: decoded.plant,
      fuelType: decoded.fuelType,
      doors: decoded.doors,
      series: decoded.series,
      trim: decoded.trim,
      hasOpenRecalls: openRecalls.length > 0,
      recallCount: openRecalls.length,
      recallsSummary: JSON.stringify(recalls.slice(0, 20)),
      enrichedAt: now,
      updatedAt: now,
    };
    if (existing) {
      await (prisma as any).vinEnrichment.update({ where: { carId: id }, data: vinData });
    } else {
      await (prisma as any).vinEnrichment.create({ data: { ...vinData, createdAt: new Date() } });
    }

    return NextResponse.json({
      ok: true,
      engine: decoded.engine,
      drivetrain: decoded.drivetrain,
      bodyStyle: decoded.bodyStyle,
      plant: decoded.plant,
      fuelType: decoded.fuelType,
      totalRecalls: recalls.length,
      openRecallCount: openRecalls.length,
      errors: decoded.errors,
      enrichment: {
        engine: decoded.engine,
        displacement: decoded.displacement,
        drivetrain: decoded.drivetrain,
        bodyStyle: decoded.bodyStyle,
        plant: decoded.plant,
        fuelType: decoded.fuelType,
        doors: decoded.doors,
        series: decoded.series,
        trim: decoded.trim,
        hasOpenRecalls: openRecalls.length > 0,
        recallCount: openRecalls.length,
        enrichedAt: now.toISOString(),
      },
      recalls: recalls.slice(0, 20),
    });
  } catch (err: any) {
    console.error("VIN enrich error:", err);
    return NextResponse.json({ error: err.message ?? "Enrichment failed" }, { status: 500 });
  }
}

function serializeEnrichment(enrichment: any) {
  return {
    engine: enrichment.engine,
    displacement: enrichment.displacement,
    drivetrain: enrichment.drivetrain,
    bodyStyle: enrichment.bodyStyle,
    plant: enrichment.plant,
    fuelType: enrichment.fuelType,
    doors: enrichment.doors,
    series: enrichment.series,
    trim: enrichment.trim,
    hasOpenRecalls: enrichment.hasOpenRecalls,
    recallCount: enrichment.recallCount,
    enrichedAt: enrichment.enrichedAt?.toISOString?.() ?? enrichment.enrichedAt ?? null,
  };
}

function safeJson(str: string | null) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}
