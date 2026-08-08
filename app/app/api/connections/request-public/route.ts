import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { randomUUID } from "crypto";

// POST /api/connections/request-public  { username }
// Sends a connection request from the current user to the target username.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = body?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const target = await (prisma.user as any).findFirst({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === session.userId) return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });

  // Check existing connection
  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: session.userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: session.userId },
      ],
    },
  });
  if (existing) return NextResponse.json({ error: "Already connected or pending", status: existing.status }, { status: 409 });

  const conn = await prisma.connection.create({
    data: {
      id: randomUUID(),
      requesterId: session.userId,
      addresseeId: target.id,
      status: "pending",
      accessLevel: "view",
    } as any,
  });

  return NextResponse.json({ ok: true, connectionId: conn.id });
}
