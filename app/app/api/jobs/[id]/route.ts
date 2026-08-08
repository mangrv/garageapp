import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.feedCaption === "string") updates.feedCaption = body.feedCaption.trim() || null;
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
  if (typeof body.status === "string") updates.status = body.status;

  const updated = await prisma.job.update({ where: { id }, data: updates });
  return NextResponse.json({ job: updated });
}
