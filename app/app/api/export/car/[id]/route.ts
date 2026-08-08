import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    include: {
      serviceRecords: { orderBy: { serviceDate: "desc" } },
      jobs: {
        orderBy: { createdAt: "desc" },
        include: {
          phases: {
            orderBy: { sortOrder: "asc" },
            include: { tasks: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = `${car.year}_${car.make}_${car.model}_history.json`
    .replace(/[^a-z0-9_.]/gi, "_")
    .toLowerCase();

  return new NextResponse(JSON.stringify(car, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
