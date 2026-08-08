import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SpecsClient from "./SpecsClient";

export default async function SpecsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, year: true, make: true, model: true, trim: true, vin: true },
  });
  if (!car) redirect("/dashboard");

  const [specs, vinEnrichment] = await Promise.all([
    (prisma as any).vehicleSpecs.findUnique({ where: { carId: id } }),
    (prisma as any).vinEnrichment.findUnique({ where: { carId: id } }),
  ]);
  const carName = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
  const enrichment = vinEnrichment ? {
    engine: vinEnrichment.engine,
    displacement: vinEnrichment.displacement,
    drivetrain: vinEnrichment.drivetrain,
    bodyStyle: vinEnrichment.bodyStyle,
    plant: vinEnrichment.plant,
    fuelType: vinEnrichment.fuelType,
    doors: vinEnrichment.doors,
    series: vinEnrichment.series,
    trim: vinEnrichment.trim,
    hasOpenRecalls: vinEnrichment.hasOpenRecalls,
    recallCount: vinEnrichment.recallCount,
    enrichedAt: vinEnrichment.enrichedAt?.toISOString() ?? null,
    blurb: vinEnrichment.blurb,
    blurbGeneratedAt: vinEnrichment.blurbGeneratedAt?.toISOString() ?? null,
  } : null;

  return (
    <SpecsClient
      carId={id}
      carName={carName}
      vin={car.vin}
      initialEnrichment={enrichment}
      initialSpecs={specs}
    />
  );
}
