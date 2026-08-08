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

  const { phaseId, jobId, title, notes } = await req.json();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!phaseId && !jobId) return NextResponse.json({ error: "phaseId or jobId required" }, { status: 400 });

  let resolvedPhaseId = phaseId;
  let jobRecord: { id: string; title: string } | null = null;

  if (phaseId) {
    // Verify the phase belongs to a project for this car/user
    const phase = await prisma.phase.findFirst({
      where: { id: phaseId, job: { carId, userId: session.userId } },
      include: { job: { select: { id: true, title: true } }, tasks: { select: { id: true } } },
    });
    if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    jobRecord = phase.job;

    await prisma.task.create({
      data: {
        id: randomUUID(),
        phaseId,
        title: title.trim(),
        tip: notes?.trim() || null,
        sortOrder: phase.tasks.length + 1,
      } as any,
    });
  } else {
    // No phase provided — verify job belongs to user, auto-create a "To Do" phase if none exist
    const job = await prisma.job.findFirst({
      where: { id: jobId, carId, userId: session.userId },
      include: { phases: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    jobRecord = { id: job.id, title: job.title };

    if (job.phases.length > 0) {
      resolvedPhaseId = job.phases[0].id;
    } else {
      // Auto-create a default phase
      const newPhase = await prisma.phase.create({
        data: {
          id: randomUUID(),
          jobId: job.id,
          title: "To Do",
          emoji: "📋",
          sortOrder: 1,
          status: "todo",
        } as any,
      });
      resolvedPhaseId = newPhase.id;
    }

    const taskCount = await prisma.task.count({ where: { phaseId: resolvedPhaseId } });
    await prisma.task.create({
      data: {
        id: randomUUID(),
        phaseId: resolvedPhaseId,
        title: title.trim(),
        tip: notes?.trim() || null,
        sortOrder: taskCount + 1,
      } as any,
    });
  }

  return NextResponse.json({ ok: true, jobId: jobRecord.id, jobTitle: jobRecord.title });
}
