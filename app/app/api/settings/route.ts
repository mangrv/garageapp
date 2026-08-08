import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normalizeDisplayName } from "@/lib/posts-helpers";

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return "••••••••••••" + key.slice(-4);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, displayName: true, email: true, aiModel: true, aiApiKey: true } as any,
  }) as any;

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: user.name,
    email: user.email,
    displayName: user.displayName ?? null,
    aiModel: (user.aiModel as string) ?? "default",
    aiApiKeySet: !!user.aiApiKey,
    aiApiKeyMasked: user.aiApiKey ? maskKey(user.aiApiKey as string) : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const updateData: Record<string, any> = {};

  if (typeof body.aiModel === "string") updateData.aiModel = body.aiModel;
  if (typeof body.displayName !== "undefined") {
    const displayName = normalizeDisplayName(body.displayName);
    if (!displayName.ok) return NextResponse.json({ error: displayName.error }, { status: 400 });
    updateData.displayName = displayName.value;
  }

  // Only update key if explicitly provided (non-null string)
  if (typeof body.aiApiKey === "string") {
    updateData.aiApiKey = body.aiApiKey.trim() || null; // empty string = clear key
  }

  // Clear key explicitly
  if (body.clearApiKey === true) {
    updateData.aiApiKey = null;
  }

  await (prisma.user as any).update({
    where: { id: session.userId },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
