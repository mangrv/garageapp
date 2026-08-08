"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/session";
import { buildUserMediaPath, persistMedia } from "@/lib/media-storage";

export async function saveCar(
  id: string,
  assetType: string,
  relationshipToUser: string, managedOwnerName: string | null, managedOwnerContact: string | null, managedOwnerNotes: string | null,
  year: number, make: string, model: string,
  trim: string | null, color: string | null,
  mileage: number | null, vin: string | null, notes: string | null,
  acquiredDate?: string | null, purchasePrice?: number | null,
  transmission?: string | null,
  bikeType?: string | null,
  frameSize?: string | null,
  wheelSize?: string | null,
) {
  if (!make || !model) return;
  if (assetType !== "bicycle" && !year) return;
  const normalizedRelationship = ["owned", "family", "friend_customer", "other"].includes(relationshipToUser) ? relationshipToUser : "owned";
  const existing = await prisma.car.findUnique({ where: { id }, select: { mileage: true } });
  await (prisma.car as any).update({
    where: { id },
    data: {
      assetType: assetType || "vehicle",
      relationshipToUser: normalizedRelationship,
      managedOwnerName: normalizedRelationship === "owned" ? null : managedOwnerName,
      managedOwnerContact: normalizedRelationship === "owned" ? null : managedOwnerContact,
      managedOwnerNotes: normalizedRelationship === "owned" ? null : managedOwnerNotes,
      year, make, model, trim, color, mileage, vin, notes,
      transmission: assetType === "vehicle" ? (transmission ?? null) : null,
      acquiredDate: acquiredDate ? new Date(acquiredDate) : null,
      purchasePrice: purchasePrice ?? null,
      bikeType: assetType === "bicycle" ? (bikeType ?? null) : null,
      frameSize: assetType === "bicycle" ? (frameSize ?? null) : null,
      wheelSize: assetType === "bicycle" ? (wheelSize ?? null) : null,
    },
  });
  // log mileage change if provided and changed
  if (mileage && mileage !== existing?.mileage) {
    await prisma.mileageLog.create({
      data: {
        id: randomUUID(),
        carId: id,
        mileage,
        recordedAt: new Date(),
        source: "manual",
        notes: "Updated via car edit",
      },
    });
  }
  revalidatePath(`/cars/${id}`);
  revalidatePath("/");
}

export async function addMileageLog(carId: string, mileage: number, notes: string, recordedAt: string) {
  await prisma.mileageLog.create({
    data: {
      id: randomUUID(),
      carId,
      mileage,
      // Append T12:00:00Z (noon UTC) so date-only strings don't roll back a day in US timezones
      recordedAt: recordedAt ? new Date(recordedAt + "T12:00:00Z") : new Date(),
      source: "manual",
      notes: notes.trim() || null,
    },
  });
  // update car's current mileage if this is the highest
  const car = await prisma.car.findUnique({ where: { id: carId }, select: { mileage: true } });
  if (!car?.mileage || mileage > car.mileage) {
    await prisma.car.update({ where: { id: carId }, data: { mileage } });
  }
  revalidatePath(`/cars/${carId}`);
}

export async function updateMileageLog(logId: string, carId: string, mileage: number, recordedAt: string, notes: string) {
  await prisma.mileageLog.update({
    where: { id: logId },
    data: {
      mileage,
      recordedAt: new Date(recordedAt + "T12:00:00Z"),
      notes: notes.trim() || null,
    },
  });
  // Recalculate car mileage from latest log
  const latest = await prisma.mileageLog.findFirst({
    where: { carId },
    orderBy: { recordedAt: "desc" },
    select: { mileage: true },
  });
  await prisma.car.update({ where: { id: carId }, data: { mileage: latest?.mileage ?? null } });
  revalidatePath(`/cars/${carId}`);
}

export async function deleteMileageLog(logId: string, carId: string) {
  await prisma.mileageLog.delete({ where: { id: logId } });

  // Recalculate car's current mileage from remaining logs
  const latest = await prisma.mileageLog.findFirst({
    where: { carId },
    orderBy: { recordedAt: "desc" },
    select: { mileage: true },
  });
  await prisma.car.update({
    where: { id: carId },
    data: { mileage: latest?.mileage ?? null },
  });

  revalidatePath(`/cars/${carId}`);
}

export async function getLastMileage(carId: string): Promise<number | null> {
  const last = await prisma.mileageLog.findFirst({
    where: { carId },
    orderBy: { recordedAt: "desc" },
    select: { mileage: true },
  });
  return last?.mileage ?? null;
}

export async function deleteCar(id: string) {
  await prisma.job.updateMany({ where: { carId: id }, data: { carId: null } });
  await prisma.car.delete({ where: { id } });
  redirect("/dashboard");
}

export async function uploadCarPhoto(carId: string, formData: FormData) {
  const session = await requireSession();
  const file = formData.get("photo") as File | null;
  const caption = String(formData.get("caption") || "").trim() || null;
  const takenAtRaw = String(formData.get("takenAt") || "").trim();
  const takenAt = takenAtRaw ? new Date(takenAtRaw) : null;

  if (!file || file.size === 0) return { error: "No file" };

  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: "cars/gallery",
    entityId: carId,
    originalName: file.name,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  await persistMedia({ relPath: filename, absPath, buffer, contentType: file.type || "image/jpeg" });

  // if first photo for this car, auto-feature it
  const count = await prisma.carPhoto.count({ where: { carId } });

  await prisma.carPhoto.create({
    data: {
      id: randomUUID(),
      carId,
      filename,
      caption,
      takenAt,
      isFeatured: count === 0,
    },
  });

  revalidatePath(`/cars/${carId}`);
  revalidatePath("/");
}

export async function setFeaturedPhoto(photoId: string, carId: string) {
  // unfeature all
  await prisma.carPhoto.updateMany({ where: { carId }, data: { isFeatured: false } });
  // feature this one
  await prisma.carPhoto.update({ where: { id: photoId }, data: { isFeatured: true } });
  revalidatePath(`/cars/${carId}`);
  revalidatePath("/");
}

export async function updateCarPhoto(photoId: string, carId: string, caption: string, takenAt: string) {
  await prisma.carPhoto.update({
    where: { id: photoId },
    data: {
      caption: caption.trim() || null,
      takenAt: takenAt ? new Date(takenAt) : null,
    },
  });
  revalidatePath(`/cars/${carId}`);
}

export async function deleteCarPhoto(photoId: string, carId: string) {
  const photo = await prisma.carPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return;
  await prisma.carPhoto.delete({ where: { id: photoId } });
  // if it was featured, auto-feature the most recent remaining
  if (photo.isFeatured) {
    const next = await prisma.carPhoto.findFirst({ where: { carId }, orderBy: { createdAt: "desc" } });
    if (next) await prisma.carPhoto.update({ where: { id: next.id }, data: { isFeatured: true } });
  }
  revalidatePath(`/cars/${carId}`);
  revalidatePath("/");
}
