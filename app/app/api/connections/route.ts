import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await (prisma as any).connection.findMany({
    where: {
      OR: [
        { requesterId: session.userId },
        { addresseeId: session.userId },
      ],
      status: { not: "blocked" },
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      addressee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Annotate each connection with the "other" user's info so the client
  // never has to guess which side is "me" — avoids stale myId race conditions.
  const annotated = connections.map((c: any) => {
    const isRequester = c.requesterId === session.userId;
    const friend = isRequester ? c.addressee : c.requester;
    return { ...c, friendId: friend.id, friendName: friend.name, friendEmail: friend.email };
  });

  return NextResponse.json({ connections: annotated, myId: session.userId });
}
