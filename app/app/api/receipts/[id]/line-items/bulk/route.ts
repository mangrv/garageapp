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

  const { lineItems } = await req.json();
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ error: "lineItems array required" }, { status: 400 });
  }

  // Replace existing line items
  await prisma.receiptLineItem.deleteMany({ where: { receiptId: id } });
  await prisma.receiptLineItem.createMany({
    data: lineItems.map((li: { name: string; quantity?: number; amount?: number }) => ({
      id: randomUUID(),
      receiptId: id,
      name: li.name,
      amount: li.amount ?? null,
      quantity: li.quantity ?? 1,
    })),
  });

  return NextResponse.json({ ok: true, count: lineItems.length });
}
