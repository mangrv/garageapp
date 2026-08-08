import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// GET conversation history
export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = new URL(req.url).searchParams.get("jobId") ?? null;
  const conv = await prisma.aIConversation.findFirst({
    where: { userId: session.userId, jobId },
  });
  const messages = conv ? JSON.parse(conv.messages) : [];
  return NextResponse.json({ messages });
}

// POST save conversation
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { messages, jobId = null } = await req.json();
  const existing = await prisma.aIConversation.findFirst({
    where: { userId: session.userId, jobId },
  });
  if (existing) {
    await prisma.aIConversation.update({
      where: { id: existing.id },
      data: { messages: JSON.stringify(messages), updatedAt: new Date() },
    });
  } else {
    await prisma.aIConversation.create({
      data: { userId: session.userId, jobId, messages: JSON.stringify(messages) },
    });
  }
  return NextResponse.json({ ok: true });
}

// DELETE clear conversation
export async function DELETE(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = new URL(req.url).searchParams.get("jobId") ?? null;
  await prisma.aIConversation.deleteMany({ where: { userId: session.userId, jobId } });
  return NextResponse.json({ ok: true });
}
