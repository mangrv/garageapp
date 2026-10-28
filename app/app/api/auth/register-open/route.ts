import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { name, email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });

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

  void trackServerMatomoEvent({ category: "Account", action: "sign_up", name: "email", userId: userId, path: "/register" });
  // Auto-login: create session + redirect to onboarding
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
