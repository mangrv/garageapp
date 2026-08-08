import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

// PATCH — mark done or update an item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string; itemId: string }> }
) {
  const session = await requireSession();
  const { carId, itemId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { lastDoneMiles, lastDoneDate, createServiceRecord } = body;

  const item = await (prisma as any).maintenanceScheduleItem.update({
    where: { id: itemId },
    data: {
      lastDoneMiles: lastDoneMiles ?? null,
      lastDoneDate: lastDoneDate ? new Date(lastDoneDate) : null,
    },
  });

  // Optionally create a service record
  if (createServiceRecord) {
    await prisma.serviceRecord.create({
      data: {
        id: randomUUID(),
        carId,
        title: item.task,
        notes: item.notes ?? null,
        mileage: lastDoneMiles ?? null,
        serviceDate: lastDoneDate ? new Date(lastDoneDate) : new Date(),
        serviceType: item.category,
      },
    });
  }

  return NextResponse.json({ item });
}

// DELETE — remove a custom item
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ carId: string; itemId: string }> }
) {
  const session = await requireSession();
  const { carId, itemId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).maintenanceScheduleItem.deleteMany({
    where: { id: itemId, carId, isCustom: true },
  });

  return NextResponse.json({ ok: true });
}
