import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// POST /api/settings/ai-key  { aiModel, aiApiKey }
// Used during onboarding to save (or skip) an AI key.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { aiModel, aiApiKey } = body;

  await (prisma.user as any).update({
    where: { id: session.userId },
    data: {
      aiModel: typeof aiModel === "string" ? aiModel : "default",
      aiApiKey: typeof aiApiKey === "string" && aiApiKey.trim() ? aiApiKey.trim() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
