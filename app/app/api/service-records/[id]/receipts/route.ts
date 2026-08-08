import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id: serviceRecordId } = await params;

  // Verify the service record belongs to this user
  const sr = await prisma.serviceRecord.findFirst({
    where: { id: serviceRecordId, car: { userId: session.userId } },
    select: { id: true, carId: true },
  });
  if (!sr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { vendor, receiptDate, totalAmount, status, lineItems } = body;

  // Create the receipt (no filename — manual entry)
  const receipt = await prisma.receipt.create({
    data: {
      id: randomUUID(),
      userId: session.userId,
      serviceRecordId,
      vendor: vendor ?? null,
      receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      totalAmount: totalAmount ?? null,
      status: status ?? "manual",
      filename: null,
    },
  });

  // Create line items
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    await prisma.receiptLineItem.createMany({
      data: lineItems.map((li: any) => ({
        id: randomUUID(),
        receiptId: receipt.id,
        name: li.name,
        amount: li.amount ?? null,
        quantity: li.quantity ?? 1,
        notes: li.notes ?? null,
      })),
    });
  }

  // Re-fetch with line items to return the full receipt
  const fullReceipt = await prisma.receipt.findUnique({
    where: { id: receipt.id },
    include: {
      lineItems: {
        select: { id: true, name: true, amount: true, quantity: true, notes: true,
          warrantyProvider: true, warrantyStart: true, warrantyEnd: true, warrantyNotes: true,
          task: { select: { id: true, title: true } },
        },
      },
    },
  });

  return NextResponse.json({
    receipt: {
      ...fullReceipt,
      receiptDate: fullReceipt?.receiptDate?.toISOString() ?? null,
      lineItems: fullReceipt?.lineItems ?? [],
    },
  });
}
