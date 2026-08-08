import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

export async function POST(
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

  const { title } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const jobId = randomUUID();
  const phaseId = randomUUID();

  await prisma.job.create({
    data: {
      id: jobId,
      userId: session.userId,
      carId,
      title: title.trim(),
      status: "active",
      phases: {
        create: {
          id: phaseId,
          title: "To Do",
          emoji: "📋",
          sortOrder: 1,
          status: "todo",
        },
      },
    },
  });

  const project = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, emoji: true, sortOrder: true },
      },
    },
  });

  return NextResponse.json({ job: project });
}

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

  const projects = await (prisma.job as any).findMany({
    where: { carId, userId: session.userId, status: { not: "archived" } },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, emoji: true, sortOrder: true },
      },
    },
  });

  return NextResponse.json({ jobs: projects });
}
