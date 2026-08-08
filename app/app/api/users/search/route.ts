import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  // Privacy: only return users the current user already has a connection with (accepted or pending).
  // Strangers are not discoverable via search — use invite links or public profile URLs to connect.
  const myConnections = await prisma.connection.findMany({
    where: {
      OR: [
        { requesterId: session.userId },
        { addresseeId: session.userId },
      ],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const connectedIds = new Set<string>();
  for (const c of myConnections) {
    if (c.requesterId !== session.userId) connectedIds.add(c.requesterId);
    if (c.addresseeId !== session.userId) connectedIds.add(c.addresseeId);
  }

  if (connectedIds.size === 0) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: [...connectedIds], not: session.userId },
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  });

  // Partial-mask email for privacy
  const masked = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
  }));

  return NextResponse.json({ users: masked });
}
