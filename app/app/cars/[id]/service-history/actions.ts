"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

async function logMileageFromService(carId: string, mileage: number, recordedAt: Date, sourceId: string) {
  await prisma.mileageLog.create({
    data: {
      id: randomUUID(),
      carId,
      mileage,
      recordedAt,
      source: "service",
      sourceId,
    },
  });
  const car = await prisma.car.findUnique({ where: { id: carId }, select: { mileage: true } });
  if (!car?.mileage || mileage > car.mileage) {
    await prisma.car.update({ where: { id: carId }, data: { mileage } });
  }
}

export async function createServiceRecord(data: {
  carId: string;
  jobId?: string | null;
  title: string;
  notes?: string;
  mileage?: number | null;
  serviceDate: string;
}) {
  if (!data.title.trim() || !data.serviceDate) return { error: "Title and date required" };

  const record = await prisma.serviceRecord.create({
    data: {
      id: randomUUID(),
      carId: data.carId,
      jobId: data.jobId ?? null,
      title: data.title.trim(),
      notes: data.notes?.trim() || null,
      mileage: data.mileage ?? null,
      serviceDate: new Date(data.serviceDate),
    },
  });

  if (data.mileage) {
    await logMileageFromService(data.carId, data.mileage, new Date(data.serviceDate), record.id);
  }

  revalidatePath(`/cars/${data.carId}`);
  revalidatePath(`/cars/${data.carId}/service-history`);
}

export async function updateServiceRecord(
  id: string, carId: string,
  title: string, notes: string, mileage: string, serviceDate: string
) {
  const parsedMileage = parseInt(mileage) || null;
  const parsedDate = serviceDate ? new Date(serviceDate) : undefined;

  await prisma.serviceRecord.update({
    where: { id },
    data: {
      title: title.trim() || undefined,
      notes: notes.trim() || null,
      mileage: parsedMileage,
      serviceDate: parsedDate,
      updatedAt: new Date(),
    },
  });

  // Sync mileage log — upsert the "service"-sourced entry for this record
  const existing = await prisma.mileageLog.findFirst({ where: { sourceId: id, source: "service" } });
  if (parsedMileage && parsedDate) {
    if (existing) {
      await prisma.mileageLog.update({
        where: { id: existing.id },
        data: { mileage: parsedMileage, recordedAt: parsedDate },
      });
    } else {
      await logMileageFromService(carId, parsedMileage, parsedDate, id);
    }
  } else if (existing) {
    // mileage was cleared — remove the log entry
    await prisma.mileageLog.delete({ where: { id: existing.id } });
  }

  // Recalculate car's current mileage from latest log
  const latest = await prisma.mileageLog.findFirst({
    where: { carId },
    orderBy: { recordedAt: "desc" },
    select: { mileage: true },
  });
  if (latest) {
    await prisma.car.update({ where: { id: carId }, data: { mileage: latest.mileage } });
  }

  revalidatePath(`/cars/${carId}/service-history`);
  revalidatePath(`/cars/${carId}`);
}

export async function deleteServiceRecord(id: string, carId: string) {
  // Remove associated mileage log entry first
  await prisma.mileageLog.deleteMany({ where: { sourceId: id, source: "service" } });

  await prisma.serviceRecord.delete({ where: { id } });

  // Recalculate car's current mileage from remaining logs
  const latest = await prisma.mileageLog.findFirst({
    where: { carId },
    orderBy: { recordedAt: "desc" },
    select: { mileage: true },
  });
  await prisma.car.update({ where: { id: carId }, data: { mileage: latest?.mileage ?? null } });

  revalidatePath(`/cars/${carId}/service-history`);
  revalidatePath(`/cars/${carId}`);
}
