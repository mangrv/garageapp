import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unlink } from "fs/promises";
import path from "path";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string; photoId: string }> }
) {
  try {
    const session = await requireSession();
    const { carId, photoId } = await params;
    const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
    if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const photo = await prisma.carPhoto.update({
      where: { id: photoId },
      data: { isPrivate: body.isPrivate },
    });
    return NextResponse.json({ ok: true, isPrivate: photo.isPrivate });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string; photoId: string }> }
) {
  try {
    const session = await requireSession();
    const { carId, photoId } = await params;

    // Verify car belongs to user
    const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
    if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const photo = await prisma.carPhoto.findFirst({ where: { id: photoId, carId } });
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    // Delete DB record
    await prisma.carPhoto.delete({ where: { id: photoId } });

    // If it was featured, promote the next photo
    if (photo.isFeatured) {
      const next = await prisma.carPhoto.findFirst({ where: { carId }, orderBy: { createdAt: "desc" } });
      if (next) await prisma.carPhoto.update({ where: { id: next.id }, data: { isFeatured: true } });
    }

    // Delete file from disk (non-fatal if missing)
    try {
      const filePath = path.join(process.cwd(), "public", "uploads", photo.filename);
      await unlink(filePath);
    } catch { /* file already gone */ }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
