import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

interface LineItem {
  name: string;
  quantity: number;
  amount: number;
}

interface ExtractedData {
  vendor?: string | null;
  receiptDate?: string | null;
  totalAmount?: number | null;
  serviceType?: string;
  serviceTitle?: string;
  notes?: string | null;
  lineItems?: LineItem[];
}

function sanitizeLineItems(items: LineItem[], totalAmount?: number | null): LineItem[] {
  const bad = /(subtotal|grand total|total before tax|\btotal\b|estimated tax|\btax\b|shipping|handling|payment|card|mastercard|visa|amex|discover|address|transaction|order #|sold by|ship to|bill to)/i;
  const seen = new Set<string>();
  return (items ?? [])
    .map((li) => ({
      name: String(li.name ?? "").replace(/\s+/g, " ").trim(),
      quantity: Number.isFinite(li.quantity) && li.quantity > 0 ? li.quantity : 1,
      amount: Number.isFinite(li.amount) ? Math.round(li.amount * 100) / 100 : 0,
    }))
    .filter((li) => li.name.length >= 2 && li.amount > 0)
    .filter((li) => !bad.test(li.name))
    .filter((li) => {
      const key = `${li.name.toLowerCase()}|${li.amount.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((li) => !totalAmount || Math.abs(li.amount - totalAmount) > 0.001);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { id, userId: session.userId },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    carId,
    extracted = {},
    serviceRecordId,
    createNew,
    serviceDate,
  }: {
    carId?: string;
    extracted?: ExtractedData;
    serviceRecordId?: string;
    createNew?: boolean;
    serviceDate?: string | null;
  } = body;

  let serviceRecord: { id: string; title: string; serviceDate: Date | string } | null = null;
  const cleanedLineItems = sanitizeLineItems(extracted.lineItems ?? [], extracted.totalAmount ?? null);

  if (serviceRecordId) {
    // Link to existing service record
    await prisma.receipt.update({
      where: { id },
      data: {
        serviceRecordId,
        status: "linked",
        vendor: extracted.vendor ?? receipt.vendor,
        totalAmount: extracted.totalAmount ?? receipt.totalAmount,
        receiptDate: extracted.receiptDate ? new Date(extracted.receiptDate) : receipt.receiptDate,
        notes: extracted.notes ?? receipt.notes,
      },
    });

    // Recalculate ServiceRecord.cost as the sum of all linked receipts for this record
    const linkedReceipts = await prisma.receipt.findMany({
      where: { serviceRecordId, totalAmount: { not: null } },
      select: { totalAmount: true },
    });
    const totalFromReceipts = linkedReceipts.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
    if (totalFromReceipts > 0) {
      await prisma.serviceRecord.update({
        where: { id: serviceRecordId },
        data: { cost: Math.round(totalFromReceipts * 100) / 100 },
      });
    }

    const sr = await prisma.serviceRecord.findUnique({
      where: { id: serviceRecordId },
      select: { id: true, title: true, serviceDate: true },
    });
    if (sr) serviceRecord = sr;
  } else if (createNew && carId) {
    // Format line items as details text
    const detailsText = cleanedLineItems.length > 0
      ? cleanedLineItems
          .map((li) => `${li.name} x${li.quantity} — $${li.amount.toFixed(2)}`)
          .join("\n")
      : null;

    const newSr = await prisma.serviceRecord.create({
      data: {
        id: randomUUID(),
        carId,
        title: extracted.serviceTitle ?? "Service",
        serviceType: extracted.serviceType ?? "other",
        notes: extracted.notes ?? null,
        cost: extracted.totalAmount ?? null,
        serviceDate: serviceDate ? new Date(serviceDate) : (extracted.receiptDate ? new Date(extracted.receiptDate) : new Date()),
        details: detailsText,
      },
    });

    await prisma.receipt.update({
      where: { id },
      data: {
        serviceRecordId: newSr.id,
        status: "linked",
        vendor: extracted.vendor ?? receipt.vendor,
        totalAmount: extracted.totalAmount ?? receipt.totalAmount,
        receiptDate: extracted.receiptDate ? new Date(extracted.receiptDate) : receipt.receiptDate,
        notes: extracted.notes ?? receipt.notes,
      },
    });

    serviceRecord = newSr;
  }

  // Update line items
  await prisma.receiptLineItem.deleteMany({ where: { receiptId: id } });
  if (cleanedLineItems.length > 0) {
    await prisma.receiptLineItem.createMany({
      data: cleanedLineItems.map((li) => ({
        id: randomUUID(),
        receiptId: id,
        name: li.name,
        amount: li.amount,
        quantity: li.quantity,
      })),
    });
  }

  return NextResponse.json({
    serviceRecord: serviceRecord
      ? {
          id: serviceRecord.id,
          title: serviceRecord.title,
          serviceDate:
            serviceRecord.serviceDate instanceof Date
              ? serviceRecord.serviceDate.toISOString()
              : serviceRecord.serviceDate,
        }
      : null,
  });
}
