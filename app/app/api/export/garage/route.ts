import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  const [cars, jobs, serviceRecords, templates] = await Promise.all([
    prisma.car.findMany({
      where: { userId: session.userId },
      orderBy: { year: "asc" },
      include: { photos: true },
    }),
    prisma.job.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        phases: {
          orderBy: { sortOrder: "asc" },
          include: {
            tasks: {
              orderBy: { sortOrder: "asc" },
              include: {
                comments: { orderBy: { createdAt: "asc" } },
                photos: true,
              },
            },
          },
        },
      },
    }),
    prisma.serviceRecord.findMany({ orderBy: { serviceDate: "desc" } }),
    prisma.userTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    cars,
    jobs,
    serviceRecords,
    templates,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="garage_backup_${date}.json"`,
    },
  });
}
