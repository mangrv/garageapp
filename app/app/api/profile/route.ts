import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, publicBio, isPublic } = await req.json();

  if (username !== undefined) {
    const slug = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (slug.length > 0 && slug.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }
    if (slug.length > 30) {
      return NextResponse.json({ error: "Username max 30 characters" }, { status: 400 });
    }
    // Check uniqueness
    if (slug) {
      const existing = await (prisma.user as any).findFirst({
        where: { username: slug, NOT: { id: session.userId } },
      });
      if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    await (prisma.user as any).update({
      where: { id: session.userId },
      data: {
        username: slug || null,
        ...(publicBio !== undefined && { publicBio: publicBio || null }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      },
    });
  } else {
    await (prisma.user as any).update({
      where: { id: session.userId },
      data: {
        ...(publicBio !== undefined && { publicBio: publicBio || null }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      },
    });
  }

  if (isPublic !== undefined) {
    void trackServerMatomoEvent({ category: "Community", action: "public_profile", name: Boolean(isPublic) ? "on" : "off", userId: session.userId, path: "/settings" });
  }

  return NextResponse.json({ ok: true });
}
