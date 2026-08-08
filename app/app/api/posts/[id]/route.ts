import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await (prisma as any).post.update({
    where: { id },
    data: {
      title: typeof body.title === "string" ? body.title.trim() || null : undefined,
      caption: typeof body.caption === "string" ? body.caption.trim() || null : undefined,
      isPublished: typeof body.isPublished === "boolean" ? body.isPublished : undefined,
      publishedAt: typeof body.isPublished === "boolean" ? (body.isPublished ? new Date() : null) : undefined,
    },
  });

  return NextResponse.json({ post: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await (prisma as any).post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
