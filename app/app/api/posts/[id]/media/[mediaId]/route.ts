import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, mediaId } = await params;
  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (body.isPrimary === true) {
    await (prisma as any).postMedia.updateMany({ where: { postId: id, isPrimary: true }, data: { isPrimary: false } });
  }
  const media = await (prisma as any).postMedia.update({ where: { id: mediaId }, data: { isPrimary: typeof body.isPrimary === 'boolean' ? body.isPrimary : undefined, caption: typeof body.caption === 'string' ? body.caption.trim() || null : undefined } });
  return NextResponse.json({ media });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, mediaId } = await params;
  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await (prisma as any).postMedia.deleteMany({ where: { id: mediaId, postId: id } });
  return NextResponse.json({ ok: true });
}
