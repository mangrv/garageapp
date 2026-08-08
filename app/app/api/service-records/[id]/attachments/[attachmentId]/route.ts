import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

async function getOwnedAttachment(id: string, attachmentId: string, userId: string) {
  return (prisma as any).jobAttachment.findFirst({
    where: { id: attachmentId, serviceRecordId: id, userId },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, attachmentId } = await params;

  const att = await getOwnedAttachment(id, attachmentId, session.userId);
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.caption === "string") data.caption = body.caption.trim() || null;
  if (typeof body.type === "string") data.type = body.type.trim() || "other";
  if (typeof body.vendor === "string") data.vendor = body.vendor.trim() || null;
  if (body.amount === null || body.amount === "") data.amount = null;
  else if (typeof body.amount === "number") data.amount = Number.isFinite(body.amount) ? body.amount : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const attachment = await (prisma as any).jobAttachment.update({
    where: { id: attachmentId },
    data,
  });

  return NextResponse.json({ attachment });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, attachmentId } = await params;

  const att = await getOwnedAttachment(id, attachmentId, session.userId);
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).jobAttachment.delete({ where: { id: attachmentId } });
  return NextResponse.json({ success: true });
}
