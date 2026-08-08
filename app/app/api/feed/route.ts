import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(_req: NextRequest) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const posts = await (prisma as any).post.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      job: { include: { car: { select: { id: true, year: true, make: true, model: true } } } },
      user: { select: { id: true, name: true, displayName: true, username: true } },
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] },
    },
  });

  return NextResponse.json({ posts });
}
