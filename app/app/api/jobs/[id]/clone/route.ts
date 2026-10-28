import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;

  // Fetch the original job with all phases and tasks
  const original = await prisma.job.findFirst({
    where: { id, userId: session.userId },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          tasks: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Deep-clone: reset all completion state
  const cloned = await prisma.job.create({
    data: {
      userId: session.userId,
      title: original.title,
      carId: original.carId,
      notes: original.notes,
      status: "active",
      serviceType: original.serviceType,
      toolsJson: (original as any).toolsJson ?? null,
      // No startedAt, completedAt
      clonedFromId: original.id,
      clonedFromTitle: original.title,
      phases: {
        create: original.phases.map((phase) => ({
          title: phase.title,
          emoji: phase.emoji,
          notes: phase.notes,
          sortOrder: phase.sortOrder,
          status: "todo",
          toolsJson: (phase as any).toolsJson ?? null,
          tasks: {
            create: phase.tasks.map((task) => ({
              title: task.title,
              warning: task.warning,
              tip: task.tip,
              torqueValue: (task as any).torqueValue ?? null,
              torqueUnit: (task as any).torqueUnit ?? null,
              partsCost: (task as any).partsCost ?? null,
              laborCost: (task as any).laborCost ?? null,
              partsNote: (task as any).partsNote ?? null,
              sortOrder: task.sortOrder,
              // done=false, completedAt=null (defaults)
            })),
          },
        })),
      },
    },
  });
  void trackServerMatomoEvent({ category: "Garage", action: "job_created", name: "clone", userId: session.userId, path: "/job/:id" });

  return NextResponse.json({ id: cloned.id });
}
