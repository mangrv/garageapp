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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const record = await prisma.serviceRecord.findFirst({
    where: { id, car: { userId: session.userId } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachments = await (prisma as any).jobAttachment.findMany({
    where: { serviceRecordId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ attachments });
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
  const record = await prisma.serviceRecord.findFirst({
    where: { id, car: { userId: session.userId } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "Unsupported file type. Use image or PDF." }, { status: 400 });

  const type = (fd.get("type") as string) || "other";
  const vendor = (fd.get("vendor") as string) || null;
  const amount = fd.get("amount") ? parseFloat(fd.get("amount") as string) : null;
  const caption = (fd.get("caption") as string) || null;

  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: "service-records/attachments",
    entityId: id,
    originalName: file.name,
  });
  await persistMedia({ relPath: filename, absPath, buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type });

  const attachment = await (prisma as any).jobAttachment.create({
    data: {
      id: randomUUID(),
      filename,
      type,
      vendor: vendor || null,
      amount: amount && !isNaN(amount) ? amount : null,
      caption: caption || null,
      serviceRecordId: id,
      jobId: null,
      userId: session.userId,
    },
  });

  return NextResponse.json({ attachment });
}
