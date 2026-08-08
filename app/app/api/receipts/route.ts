import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";
import { buildUserMediaPath, persistMedia } from "@/lib/media-storage";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const jobId = searchParams.get("jobId");
  const serviceRecordId = searchParams.get("serviceRecordId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { userId: session.userId };
  if (status !== "all") where.status = status;
  if (jobId) where.jobId = jobId;
  if (serviceRecordId) where.serviceRecordId = serviceRecordId;

  const receipts = await prisma.receipt.findMany({
    where,
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ receipts });
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let vendor: string | null = null;
  let totalAmount: number | null = null;
  let receiptDate: Date | null = null;
  let notes: string | null = null;
  let jobId: string | null = null;
  let serviceRecordId: string | null = null;
  let filename: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    vendor = String(formData.get("vendor") || "").trim() || null;
    totalAmount = parseFloat(String(formData.get("totalAmount") || "")) || null;
    const dateStr = String(formData.get("receiptDate") || "").trim();
    receiptDate = dateStr ? new Date(dateStr) : null;
    notes = String(formData.get("notes") || "").trim() || null;
    jobId = String(formData.get("jobId") || "").trim() || null;
    serviceRecordId = String(formData.get("serviceRecordId") || "").trim() || null;

    if (file && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
      }
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json({ error: "Unsupported file type. Use image or PDF." }, { status: 400 });
      }
      const { relPath, absPath } = await buildUserMediaPath({
        userId: session.userId,
        area: "receipts",
        entityId: "inbox",
        originalName: file.name,
      });
      const buffer = Buffer.from(await file.arrayBuffer());
      await persistMedia({ relPath, absPath, buffer, contentType: file.type });
      filename = relPath;
    }
  } else {
    const body = await req.json();
    vendor = body.vendor ?? null;
    totalAmount = body.totalAmount ?? null;
    receiptDate = body.receiptDate ? new Date(body.receiptDate) : null;
    notes = body.notes ?? null;
    jobId = body.jobId ?? null;
    serviceRecordId = body.serviceRecordId ?? null;
  }

  const status = jobId || serviceRecordId ? "linked" : "inbox";

  const receipt = await prisma.receipt.create({
    data: {
      id: randomUUID(),
      userId: session.userId,
      filename,
      vendor,
      totalAmount,
      receiptDate,
      notes,
      status,
      jobId,
      serviceRecordId,
    },
    include: { lineItems: true },
  });

  return NextResponse.json({ receipt });
}
