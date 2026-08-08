import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

export async function POST(
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

  const { forecastItemId, title, mileage, serviceDate } = await req.json();
  if (!title || !serviceDate) return NextResponse.json({ error: "title and serviceDate required" }, { status: 400 });

  const parsedMileage = mileage ? parseInt(mileage) : null;

  // Create service record
  const record = await prisma.serviceRecord.create({
    data: {
      id: randomUUID(),
      carId,
      title: title.trim(),
      mileage: parsedMileage,
      serviceDate: new Date(serviceDate),
      notes: "Logged from maintenance forecast",
    },
  });

  // Update car mileage + log if higher
  if (parsedMileage && parsedMileage > (car.mileage ?? 0)) {
    await prisma.car.update({ where: { id: carId }, data: { mileage: parsedMileage } });
    await (prisma as any).mileageLog.create({
      data: {
        id: randomUUID(),
        carId,
        mileage: parsedMileage,
        recordedAt: new Date(serviceDate),
        source: "service",
        sourceId: record.id,
      },
    });
  }

  // Mark forecast item as done
  const forecast = await (prisma as any).maintenanceForecast.findUnique({ where: { carId } });
  if (!forecast) return NextResponse.json({ ok: true });

  const items = JSON.parse(forecast.items);
  const updatedItems = items.map((item: any) =>
    item.id === forecastItemId
      ? { ...item, doneAt: new Date(serviceDate).toISOString().slice(0, 10), doneMileage: parsedMileage, priority: "ok" }
      : item
  );

  await (prisma as any).maintenanceForecast.update({
    where: { carId },
    data: { items: JSON.stringify(updatedItems), updatedAt: new Date() },
  });

  return NextResponse.json({ items: updatedItems });
}
