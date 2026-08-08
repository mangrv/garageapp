import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

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

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const lineItem = await prisma.receiptLineItem.create({
    data: {
      id: randomUUID(),
      receiptId: id,
      name,
      amount: amount ?? null,
      quantity: quantity ?? 1,
      taskId: taskId ?? null,
      notes: notes ?? null,
      warrantyProvider: warrantyProvider ?? null,
      warrantyStart: warrantyStart ? new Date(warrantyStart) : null,
      warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
      warrantyNotes: warrantyNotes ?? null,
    },
    include: { task: true },
  });

  return NextResponse.json({ lineItem });
}
