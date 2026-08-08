import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.job.findFirst({
    where: { id, userId: session.userId },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reuse existing token or generate a new one
  const token = project.shareToken ?? randomBytes(16).toString("hex");

  await prisma.job.update({
    where: { id },
    data: { shareToken: token },
  });

  return NextResponse.json({ token });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.job.findFirst({
    where: { id, userId: session.userId },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.job.update({
    where: { id },
    data: { shareToken: null },
  });

  return NextResponse.json({ ok: true });
}
