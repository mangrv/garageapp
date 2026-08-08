import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { buildUserMediaPath, persistMedia } from "@/lib/media-storage";

async function verifyCarOwnership(carId: string, userId: string) {
  const car = await prisma.car.findFirst({ where: { id: carId, userId } });
  return !!car;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const { carId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await verifyCarOwnership(carId, session.userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  console.log("[upload] cars/photos:request:start", { carId, userId: session.userId });

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const caption = String(formData.get("caption") || "").trim() || null;
  const takenAtRaw = String(formData.get("takenAt") || "").trim();
  const takenAt = takenAtRaw ? new Date(takenAtRaw) : null;

  if (!file || file.size === 0) {
    console.warn("[upload] cars/photos:request:no-file", { carId });
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  console.log("[upload] cars/photos:file", { name: file.name, type: file.type, size: file.size, carId });

  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: "cars/gallery",
    entityId: carId,
    originalName: file.name,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  await persistMedia({ relPath: filename, absPath, buffer, contentType: file.type || "application/octet-stream" });

  const count = await prisma.carPhoto.count({ where: { carId } });
  const created = await prisma.carPhoto.create({
    data: {
      id: randomUUID(),
      carId,
      filename,
      caption,
      takenAt,
      isFeatured: count === 0,
    },
  });

  console.log("[upload] cars/photos:request:success", { carId, photoId: created.id, filename });
  return NextResponse.json(created, { status: 201 });
}
