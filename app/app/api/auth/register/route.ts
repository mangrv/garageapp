import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { token, name, email, password } = body;

  if (!token || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Validate invite
  const invite = await (prisma as any).invite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Invalid invite token" }, { status: 400 });
  if (invite.usedById) return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  if (new Date(invite.expiresAt) < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Email does not match invite restriction" }, { status: 400 });
  }

  // Check if email already in use
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = randomUUID();

  await prisma.user.create({
    data: {
      id: userId,
      email: email.toLowerCase(),
      name: name?.trim() || null,
      passwordHash,
    } as any,
  });

  // Mark invite as used
  await (prisma as any).invite.update({
    where: { token },
    data: { usedById: userId, usedAt: new Date() },
  });

  // Auto-connect new user with inviter (accepted connection, carrying invite access level)
  const inviteRecord = await (prisma as any).invite.findUnique({
    where: { token },
    select: { createdById: true, accessLevel: true },
  });
  if (inviteRecord?.createdById && inviteRecord.createdById !== userId) {
    try {
      await prisma.connection.create({
        data: {
          id: randomUUID(),
          requesterId: inviteRecord.createdById,
          addresseeId: userId,
          status: "accepted",
          accessLevel: inviteRecord.accessLevel ?? "view",
        } as any,
      });
    } catch {
      // If connection already exists, ignore duplicate
    }
  }

  // Auto-login: create session and redirect to onboarding
  const sessionToken = await signToken({
    userId,
    email: email.toLowerCase(),
    name: name?.trim() || null,
    role: "user",
  });

  const res = NextResponse.json({ ok: true, redirect: "/onboarding" });
  res.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
