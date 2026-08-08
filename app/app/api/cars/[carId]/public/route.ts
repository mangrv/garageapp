import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { carId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { isPublic, publicNotes } = await req.json();
  await (prisma.car as any).update({
    where: { id: carId },
    data: {
      ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      ...(publicNotes !== undefined && { publicNotes: publicNotes || null }),
    },
  });
  return NextResponse.json({ ok: true });
}
