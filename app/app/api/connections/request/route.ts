import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { addresseeId } = body;

  if (!addresseeId || addresseeId === session.userId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Check if connection already exists
  const existing = await (prisma as any).connection.findUnique({
    where: { requesterId_addresseeId: { requesterId: session.userId, addresseeId } },
  });

  if (existing) {
    return NextResponse.json({ error: "Connection already exists" }, { status: 409 });
  }

  const connection = await (prisma as any).connection.create({
    data: {
      id: randomUUID(),
      requesterId: session.userId,
      addresseeId,
      status: "pending",
      accessLevel: "view",
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ connection });
}
