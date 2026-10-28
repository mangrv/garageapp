import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job: project, carId } = await req.json();

  if (!project?.title || !Array.isArray(project.phases)) {
    return NextResponse.json({ error: "Invalid job data" }, { status: 400 });
  }

  await trackServerMatomoEvent({
    category: "AI API",
    action: "job_create_start",
    name: project.title,
    userId: session.userId,
    path: "/api/jobs/ai-create",
  });

  // Validate carId belongs to user
  let validCarId: string | null = null;
  if (carId) {
    const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
    validCarId = car?.id ?? null;
  }

  const created = await prisma.job.create({
    data: {
      title: project.title,
      notes: project.notes ?? null,
      userId: session.userId,
      carId: validCarId,
      status: "active",
      toolsJson: project.toolsJson?.length ? JSON.stringify(project.toolsJson) : null,
    },
  });
  void trackServerMatomoEvent({ category: "Garage", action: "job_created", name: "ai", userId: session.userId, path: "/jobs/new" });

  // Create phases + tasks
  for (let i = 0; i < project.phases.length; i++) {
    const ph = project.phases[i];
    const phase = await prisma.phase.create({
      data: {
        jobId: created.id,
        title: ph.title ?? "Phase",
        emoji: ph.emoji ?? null,
        sortOrder: i + 1,
        status: "todo",
        toolsJson: ph.toolsJson?.length ? JSON.stringify(ph.toolsJson) : null,
      },
    });

    const tasks = Array.isArray(ph.tasks) ? ph.tasks : [];
    for (let j = 0; j < tasks.length; j++) {
      const t = tasks[j];
      await prisma.task.create({
        data: {
          phaseId: phase.id,
          title: t.title ?? "Task",
          warning: t.warning ?? null,
          tip: t.tip ?? null,
          torqueValue: typeof t.torqueValue === "number" ? t.torqueValue : null,
          torqueUnit: t.torqueUnit ?? null,
          sortOrder: j + 1,
          done: false,
        },
      });
    }
  }

  await trackServerMatomoEvent({
    category: "AI API",
    action: "job_create_success",
    name: created.id,
    userId: session.userId,
    path: "/api/jobs/ai-create",
  });

  return NextResponse.json({ jobId: created.id });
}
