import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ScheduleClient from "./ScheduleClient";

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id },
    select: { id: true, year: true, make: true, model: true, trim: true, mileage: true },
  });
  if (!car) redirect("/dashboard");

  const items = await (prisma as any).maintenanceScheduleItem.findMany({
    where: { carId: id },
    orderBy: [{ intervalMiles: "asc" }, { sortOrder: "asc" }],
  });

  const carName = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;

  return (
    <ScheduleClient
      carId={id}
      carName={carName}
      currentMileage={car.mileage}
      initialItems={items.map((i: any) => ({
        ...i,
        lastDoneDate: i.lastDoneDate?.toISOString() ?? null,
      }))}
    />
  );
}
