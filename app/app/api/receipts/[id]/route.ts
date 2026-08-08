import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { id, userId: session.userId },
    include: {
      lineItems: { include: { task: true } },
      job: { select: { id: true, title: true } },
      serviceRecord: { select: { id: true, title: true } },
    },
  });

  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ receipt });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({ where: { id, userId: session.userId } });
    if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { jobId, serviceRecordId, vendor, totalAmount, receiptDate, notes } = body;

    const newJobId = "jobId" in body ? (body.jobId ?? null) : receipt.jobId;
    const newSrId = "serviceRecordId" in body ? (body.serviceRecordId ?? null) : receipt.serviceRecordId;
    const status = newJobId || newSrId ? "linked" : "inbox";

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        ...(vendor !== undefined && { vendor: vendor || null }),
        ...(totalAmount !== undefined && { totalAmount: totalAmount ?? null }),
        ...(receiptDate !== undefined && { receiptDate: receiptDate ? new Date(receiptDate) : null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...("jobId" in body && { jobId: jobId ?? null }),
        ...("serviceRecordId" in body && { serviceRecordId: serviceRecordId ?? null }),
        status,
      },
      include: {
        lineItems: { include: { task: true } },
        job: { select: { id: true, title: true } },
        serviceRecord: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ receipt: updated });
  } catch (err: any) {
    console.error("Receipt PATCH error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update receipt" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({ where: { id, userId: session.userId } });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (receipt.filename) {
    try {
      await unlink(path.join(process.cwd(), "public", "uploads", receipt.filename));
    } catch { /* file may not exist */ }
  }

  await prisma.receipt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
