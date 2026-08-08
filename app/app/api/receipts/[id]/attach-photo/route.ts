import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import path from "path";
import { buildUserMediaPath, deleteMedia, persistMedia } from "@/lib/media-storage";

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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "Unsupported file type. Use image or PDF." }, { status: 400 });

  // Delete old file if exists
  if (receipt.filename) {
    try {
      await deleteMedia({
        relPath: receipt.filename,
        absPath: path.join(process.cwd(), "public", "uploads", receipt.filename),
      });
    } catch {}
  }

  // Save new file
  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: "receipts",
    entityId: id,
    originalName: file.name,
  });
  await persistMedia({ relPath: filename, absPath, buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type });

  await prisma.receipt.update({ where: { id }, data: { filename } });

  return NextResponse.json({ filename });
}
