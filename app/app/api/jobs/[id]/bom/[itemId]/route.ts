import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.partNumber !== undefined) updates.partNumber = body.partNumber?.trim() || null;
  if (body.vendor !== undefined) updates.vendor = body.vendor?.trim() || null;
  if (body.quantity !== undefined) updates.quantity = parseInt(body.quantity) || 1;
  if (body.unitCost !== undefined) updates.unitCost = parseFloat(body.unitCost) || null;
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  updates.updatedAt = new Date();

  const item = await (prisma as any).jobBomItem.update({ where: { id: itemId }, data: updates });
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, itemId } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).jobBomItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
