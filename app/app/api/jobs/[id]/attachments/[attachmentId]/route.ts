import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, attachmentId } = await params;

  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachment = await (prisma as any).jobAttachment.findFirst({
    where: { id: attachmentId, jobId: id },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete the file
  try {
    await unlink(path.join(process.cwd(), "public", "uploads", attachment.filename));
  } catch {}

  await (prisma as any).jobAttachment.delete({ where: { id: attachmentId } });

  return NextResponse.json({ ok: true });
}
