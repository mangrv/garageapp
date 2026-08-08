import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.serviceRecord.findFirst({
    where: { id, car: { userId: session.userId } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = String(body.title || "").trim() || "Service";
  if (body.notes !== undefined) data.notes = String(body.notes || "").trim() || null;
  if (body.mileage !== undefined) {
    const n = body.mileage === null || body.mileage === "" ? null : Number(body.mileage);
    data.mileage = Number.isFinite(n as number) ? n : null;
  }
  if (body.serviceDate !== undefined) {
    data.serviceDate = body.serviceDate ? new Date(body.serviceDate) : new Date();
  }

  const updated = await prisma.serviceRecord.update({
    where: { id },
    data,
    select: { id: true, title: true, notes: true, mileage: true, serviceDate: true },
  });

  return NextResponse.json({
    record: {
      ...updated,
      serviceDate: updated.serviceDate.toISOString(),
    },
  });
}
