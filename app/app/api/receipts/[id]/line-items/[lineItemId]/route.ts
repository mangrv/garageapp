import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, lineItemId } = await params;

  const receipt = await prisma.receipt.findFirst({ where: { id, userId: session.userId } });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    name,
    amount,
    quantity,
    taskId,
    notes,
    warrantyProvider,
    warrantyStart,
    warrantyEnd,
    warrantyNotes,
  } = body;

  const updated = await prisma.receiptLineItem.update({
    where: { id: lineItemId },
    data: {
      ...(name !== undefined && { name }),
      ...(amount !== undefined && { amount: amount ?? null }),
      ...(quantity !== undefined && { quantity }),
      ...("taskId" in body && { taskId: taskId ?? null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(warrantyProvider !== undefined && { warrantyProvider: warrantyProvider || null }),
      ...("warrantyStart" in body && { warrantyStart: warrantyStart ? new Date(warrantyStart) : null }),
      ...("warrantyEnd" in body && { warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null }),
      ...(warrantyNotes !== undefined && { warrantyNotes: warrantyNotes || null }),
    },
    include: { task: true },
  });

  return NextResponse.json({ lineItem: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, lineItemId } = await params;

  const receipt = await prisma.receipt.findFirst({ where: { id, userId: session.userId } });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.receiptLineItem.delete({ where: { id: lineItemId } });
  return NextResponse.json({ success: true });
}
