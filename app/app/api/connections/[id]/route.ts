import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const conn = await prisma.connection.findUnique({ where: { id } } as any);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } as any });
  const isAdmin = (user as any)?.role === "admin";
  const isRequester = (conn as any).requesterId === session.userId;
  const isAddressee = (conn as any).addresseeId === session.userId;

  if (!isAdmin && !isRequester && !isAddressee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, string> = {};

  // Only requester or admin can change access level
  if (body.accessLevel === "view" || body.accessLevel === "full") {
    if (!isAdmin && !isRequester) {
      return NextResponse.json({ error: "Only the sender can change access level" }, { status: 403 });
    }
    updates.accessLevel = body.accessLevel;
  }

  // Addressee (or admin) can accept or block; requester cannot self-accept
  if (body.status === "accepted" || body.status === "blocked" || body.status === "declined") {
    if (!isAdmin && !isAddressee) {
      return NextResponse.json({ error: "Only the recipient can accept or decline" }, { status: 403 });
    }
    updates.status = body.status === "declined" ? "blocked" : body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await (prisma.connection as any).update({ where: { id }, data: updates });
  return NextResponse.json({ connection: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conn = await prisma.connection.findUnique({ where: { id } } as any);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } as any });
  const isAdmin = (user as any)?.role === "admin";
  const isOwner = (conn as any).requesterId === session.userId || (conn as any).addresseeId === session.userId;

  if (!isAdmin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.connection.delete({ where: { id } } as any);
  return NextResponse.json({ ok: true });
}
