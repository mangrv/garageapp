import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { carId } = await params;

  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serviceRecords = await prisma.serviceRecord.findMany({
    where: { carId },
    select: { id: true, title: true, serviceDate: true, serviceType: true },
    orderBy: { serviceDate: "desc" },
  });

  return NextResponse.json({
    serviceRecords: serviceRecords.map((sr) => ({
      ...sr,
      serviceDate: sr.serviceDate.toISOString(),
    })),
  });
}
