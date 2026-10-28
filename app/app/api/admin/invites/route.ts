import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { randomBytes } from "crypto";
import { randomUUID } from "crypto";

/** Check admin status from DB directly — handles stale JWTs where role wasn't set at login time */
async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!user || (user as any).role !== "admin") return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = body.email?.trim() || null;
  const accessLevel = body.accessLevel === "full" ? "full" : "view";

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await (prisma as any).invite.create({
    data: {
      id: randomUUID(),
      token,
      email,
      accessLevel,
      createdById: session.userId,
      expiresAt,
    },
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://garagemeet.com";
  const url = `${base}/register/${token}`;

  return NextResponse.json({ invite, url, token });
}

export async function GET(_req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invites = await (prisma as any).invite.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ invites });
}
