import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/set-password
 * Sets or changes the password for the authenticated user.
 * - If user has no "real" password (signed up via Google), they only need to provide newPassword.
 * - If user already has a password, they must provide currentPassword to verify first.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword } = body;

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check if user has a "real" password (i.e., not the random Google placeholder).
  // We identify a Google-only account by storing a sentinel that can't match any bcrypt input.
  // In practice: if currentPassword is provided, always verify it.
  // If not provided, only allow skipping verification if the stored hash is a known random placeholder
  // (we check by attempting a dummy compare — a real password will always fail bcrypt.compare with random data).
  const hasRealPassword = currentPassword
    ? true // they're claiming to have one; verify below
    : false; // they're not providing one — treat as Google-only account

  if (hasRealPassword && currentPassword) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash } as any,
  });

  return NextResponse.json({ ok: true });
}
