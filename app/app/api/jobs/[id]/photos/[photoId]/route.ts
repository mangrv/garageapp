import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unlink } from "fs/promises";
import path from "path";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, photoId } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: any = {};
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;
  if (typeof body.isPrimary === "boolean") updates.isPrimary = body.isPrimary;
  if (typeof body.caption === "string") updates.caption = body.caption.trim() || null;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  // If setting isPrimary, clear others first
  if (updates.isPrimary === true) {
    await (prisma as any).jobPhoto.updateMany({
      where: { jobId: id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const photo = await (prisma as any).jobPhoto.update({
    where: { id: photoId },
    data: updates,
  });

  // Update job feedUpdatedAt if toggling isPublic on
  if (updates.isPublic === true) {
    const anyPublic = await (prisma as any).jobPhoto.count({ where: { jobId: id, isPublic: true } });
    if (anyPublic > 0) {
      await (prisma.job as any).update({
        where: { id },
        data: { feedUpdatedAt: new Date() },
      });
    }
  } else if (updates.isPublic === false) {
    // If no more public photos, clear feedUpdatedAt
    const anyPublic = await (prisma as any).jobPhoto.count({ where: { jobId: id, isPublic: true } });
    if (anyPublic === 0) {
      await (prisma.job as any).update({ where: { id }, data: { feedUpdatedAt: null } });
    }
  }

  return NextResponse.json({ photo });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, photoId } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photo = await (prisma as any).jobPhoto.findUnique({ where: { id: photoId } });
  if (photo) {
    try {
      await unlink(path.join(process.cwd(), "public", "uploads", photo.filename));
    } catch {}
    await (prisma as any).jobPhoto.delete({ where: { id: photoId } });

    // Recheck feed status
    const anyPublic = await (prisma as any).jobPhoto.count({ where: { jobId: id, isPublic: true } });
    if (anyPublic === 0) {
      await (prisma.job as any).update({ where: { id }, data: { feedUpdatedAt: null } });
    }
  }

  return NextResponse.json({ ok: true });
}
