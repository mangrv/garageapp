import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { randomBytes } from "crypto";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = body.email?.trim() || null;

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await (prisma as any).invite.create({
    data: {
      id: randomUUID(),
      token,
      email,
      accessLevel: "view",
      createdById: session.userId,
      expiresAt,
    },
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://garagemeet.com";
  const url = `${base}/register/${invite.token}`;

  return NextResponse.json({ url, token: invite.token });
}
