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

  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachments = await (prisma as any).jobAttachment.findMany({
    where: { jobId: id },
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

  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = String(formData.get("type") || "other");
  const vendor = String(formData.get("vendor") || "").trim() || null;
  const amount = parseFloat(String(formData.get("amount") || "")) || null;
  const caption = String(formData.get("caption") || "").trim() || null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use image or PDF." }, { status: 400 });
  }

  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: "jobs/attachments",
    entityId: id,
    originalName: file.name,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  await persistMedia({ relPath: filename, absPath, buffer, contentType: file.type });

  const attachment = await (prisma as any).jobAttachment.create({
    data: {
      id: randomUUID(),
      jobId: id,
      userId: session.userId,
      filename,
      type,
      vendor,
      amount,
      caption,
    },
  });

  return NextResponse.json({ attachment });
}
