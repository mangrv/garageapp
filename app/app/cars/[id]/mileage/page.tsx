import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cookies } from "next/headers";
import { translations } from "@/lib/i18n";
import { redirect } from "next/navigation";
import MileageSection from "../MileageSection";

export default async function MileagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id },
    select: { id: true, year: true, make: true, model: true, mileage: true },
  });
  if (!car) redirect("/dashboard");

  const cookieStore = await cookies();
  const lang = (cookieStore.get("garage-lang")?.value ?? "en") as "en" | "es";
  const tr = translations[lang];

  const logs = await prisma.mileageLog.findMany({
    where: { carId: id },
    orderBy: { recordedAt: "desc" },
  });

  // Resolve service/job names from sourceId
  const serviceSourceIds = logs
    .filter((l) => l.sourceId && (l.source === "service" || l.source === "job"))
    .map((l) => l.sourceId as string);

  const serviceRecords = serviceSourceIds.length > 0
    ? await prisma.serviceRecord.findMany({
        where: { id: { in: serviceSourceIds } },
        select: { id: true, title: true },
      })
    : [];

  const serviceNameMap: Record<string, string> = {};
  for (const r of serviceRecords) serviceNameMap[r.id] = r.title;

  const formattedLogs = logs.map(l => ({
    ...l,
    recordedAt: l.recordedAt.toISOString(),
    createdAt: l.createdAt.toISOString(),
    sourceName: l.sourceId ? (serviceNameMap[l.sourceId] ?? null) : null,
    sourceId: l.sourceId ?? null,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">{tr.mileageHistory}</h1>
        <p className="text-xs text-gray-500">{car.year} {car.make} {car.model} · {lang === "es" ? "Actual" : "Current"}: {car.mileage?.toLocaleString() ?? "—"} {lang === "es" ? "mi" : "mi"}</p>
      </div>
      <MileageSection carId={id} logs={formattedLogs} currentMileage={car.mileage} assetType="vehicle" />
    </div>
  );
}
