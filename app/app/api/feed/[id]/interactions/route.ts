import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { action?: "like" | "bookmark" };
  if (!body.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const job = await (prisma.job as any).findFirst({
    where: { id, feedUpdatedAt: { not: null }, photos: { some: { isPublic: true } } },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "like") {
    const existing = await (prisma as any).jobLike.findUnique({
      where: { jobId_userId: { jobId: id, userId: session.userId } },
    });
    if (existing) {
      await (prisma as any).jobLike.delete({ where: { id: existing.id } });
    } else {
      await (prisma as any).jobLike.create({ data: { jobId: id, userId: session.userId } });
    }
  }

  if (body.action === "bookmark") {
    const existing = await (prisma as any).jobBookmark.findUnique({
      where: { jobId_userId: { jobId: id, userId: session.userId } },
    });
    if (existing) {
      await (prisma as any).jobBookmark.delete({ where: { id: existing.id } });
    } else {
      await (prisma as any).jobBookmark.create({ data: { jobId: id, userId: session.userId } });
    }
  }

  const [likesCount, bookmarksCount, liked, bookmarked] = await Promise.all([
    (prisma as any).jobLike.count({ where: { jobId: id } }),
    (prisma as any).jobBookmark.count({ where: { jobId: id } }),
    (prisma as any).jobLike.findUnique({ where: { jobId_userId: { jobId: id, userId: session.userId } } }),
    (prisma as any).jobBookmark.findUnique({ where: { jobId_userId: { jobId: id, userId: session.userId } } }),
  ]);

  return NextResponse.json({
    ok: true,
    liked: !!liked,
    bookmarked: !!bookmarked,
    likesCount,
    bookmarksCount,
  });
}
