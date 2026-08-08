import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json();
  if (!action?.type) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  try {
    await trackServerMatomoEvent({
      category: "AI API",
      action: "execute_start",
      name: action.type,
      userId: session.userId,
      path: "/api/ai/execute",
    });

    switch (action.type) {

      case "create_car": {
        const car = await prisma.car.create({
          data: {
            userId: session.userId,
            relationshipToUser: "owned",
            year: Number(action.year),
            make: String(action.make),
            model: String(action.model),
            trim: action.trim ?? null,
            color: action.color ?? null,
            mileage: action.mileage ? Number(action.mileage) : null,
          } as any,
        });
        await trackServerMatomoEvent({ category: "AI API", action: "execute_success", name: "create_car", userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ ok: true, carId: car.id, label: `${car.year} ${car.make} ${car.model}` });
      }

      case "create_project":
      case "create_job": {
        // Validate carId belongs to user
        let validCarId: string | null = null;
        if (action.carId) {
          const car = await prisma.car.findFirst({ where: { id: action.carId, userId: session.userId } });
          validCarId = car?.id ?? null;
        }
        const project = await prisma.job.create({
          data: {
            userId: session.userId,
            title: String(action.title),
            notes: action.notes ?? null,
            carId: validCarId,
            status: "active",
            toolsJson: action.toolsJson?.length ? JSON.stringify(action.toolsJson) : null,
          } as any,
        });
        const phases = Array.isArray(action.phases) ? action.phases : [];
        for (let i = 0; i < phases.length; i++) {
          const ph = phases[i];
          const phase = await prisma.phase.create({
            data: {
              jobId: project.id,
              title: ph.title ?? "Phase",
              emoji: ph.emoji ?? null,
              sortOrder: ph.sortOrder ?? i + 1,
              status: "todo",
              toolsJson: ph.toolsJson?.length ? JSON.stringify(ph.toolsJson) : null,
            } as any,
          });
          for (let j = 0; j < (ph.tasks ?? []).length; j++) {
            const t = ph.tasks[j];
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
              } as any,
            });
          }
        }
        await trackServerMatomoEvent({ category: "AI API", action: "execute_success", name: "create_job", userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ ok: true, jobId: project.id });
      }

      case "add_phases": {
        // Verify project belongs to user
        const project = await prisma.job.findFirst({
          where: { id: action.jobId, userId: session.userId },
          include: { phases: { orderBy: { sortOrder: "asc" } } },
        });
        if (!project) return NextResponse.json({ error: "Job not found" }, { status: 404 });

        const insertAfter = action.insertAfterSortOrder ?? project.phases.length;
        const newPhases = Array.isArray(action.phases) ? action.phases : [];

        // Shift existing phases that come after insertion point
        const phasesToShift = project.phases.filter((p) => p.sortOrder > insertAfter);
        for (const p of phasesToShift) {
          await prisma.phase.update({
            where: { id: p.id },
            data: { sortOrder: p.sortOrder + newPhases.length },
          });
        }

        // Insert new phases
        for (let i = 0; i < newPhases.length; i++) {
          const ph = newPhases[i];
          const phase = await prisma.phase.create({
            data: {
              jobId: project.id,
              title: ph.title ?? "Phase",
              emoji: ph.emoji ?? null,
              sortOrder: insertAfter + i + 1,
              status: "todo",
              toolsJson: ph.toolsJson?.length ? JSON.stringify(ph.toolsJson) : null,
            } as any,
          });
          for (let j = 0; j < (ph.tasks ?? []).length; j++) {
            const t = ph.tasks[j];
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
              } as any,
            });
          }
        }
        await trackServerMatomoEvent({ category: "AI API", action: "execute_success", name: "add_phases", userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ ok: true, phasesAdded: newPhases.length });
      }

      case "add_tasks": {
        // Verify phase's project belongs to user
        const phase = await prisma.phase.findFirst({
          where: { id: action.phaseId },
          include: { job: true, tasks: true },
        });
        if (!phase || phase.job.userId !== session.userId) {
          return NextResponse.json({ error: "Phase not found" }, { status: 404 });
        }
        const startOrder = phase.tasks.length + 1;
        const newTasks = Array.isArray(action.tasks) ? action.tasks : [];
        for (let j = 0; j < newTasks.length; j++) {
          const t = newTasks[j];
          await prisma.task.create({
            data: {
              phaseId: phase.id,
              title: t.title ?? "Task",
              warning: t.warning ?? null,
              tip: t.tip ?? null,
              torqueValue: typeof t.torqueValue === "number" ? t.torqueValue : null,
              torqueUnit: t.torqueUnit ?? null,
              sortOrder: startOrder + j,
              done: false,
            } as any,
          });
        }
        await trackServerMatomoEvent({ category: "AI API", action: "execute_success", name: "add_tasks", userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ ok: true, tasksAdded: newTasks.length });
      }

      case "update_tools": {
        const tools = JSON.stringify(action.tools ?? []);
        if (action.jobId) {
          const p = await prisma.job.findFirst({ where: { id: action.jobId, userId: session.userId } });
          if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
          await prisma.job.update({ where: { id: p.id }, data: { toolsJson: tools } as any });
        } else if (action.phaseId) {
          const ph = await prisma.phase.findFirst({ where: { id: action.phaseId }, include: { job: true } });
          if (!ph || ph.job.userId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
          await prisma.phase.update({ where: { id: ph.id }, data: { toolsJson: tools } as any });
        }
        await trackServerMatomoEvent({ category: "AI API", action: "execute_success", name: "update_tools", userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ ok: true });
      }

      case "delete_phases": {
        // Verify job belongs to user
        const project = await prisma.job.findFirst({
          where: { id: action.jobId, userId: session.userId },
          include: { phases: true },
        });
        if (!project) return NextResponse.json({ error: "Job not found" }, { status: 404 });

        const phaseIds: string[] = Array.isArray(action.phaseIds) ? action.phaseIds : [];
        // Safety check: only delete phases that belong to this job
        const validIds = project.phases.filter((p) => phaseIds.includes(p.id)).map((p) => p.id);
        if (validIds.length === 0) return NextResponse.json({ error: "No valid phase IDs" }, { status: 400 });

        // Delete tasks first (cascade not guaranteed), then phases
        await prisma.task.deleteMany({ where: { phaseId: { in: validIds } } });
        await prisma.phase.deleteMany({ where: { id: { in: validIds } } });

        // Re-number remaining phases by sortOrder
        const remaining = await prisma.phase.findMany({
          where: { jobId: project.id },
          orderBy: { sortOrder: "asc" },
        });
        for (let i = 0; i < remaining.length; i++) {
          await prisma.phase.update({ where: { id: remaining[i].id }, data: { sortOrder: i + 1 } });
        }

        await trackServerMatomoEvent({ category: "AI API", action: "execute_success", name: "delete_phases", userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ ok: true, deletedCount: validIds.length });
      }

      default:
        await trackServerMatomoEvent({ category: "AI API", action: "execute_error", name: `unknown:${String(action.type)}`, userId: session.userId, path: "/api/ai/execute" });
        return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("AI execute error:", err);
    await trackServerMatomoEvent({ category: "AI API", action: "execute_error", name: err?.message?.slice?.(0, 120) ?? "unknown", userId: session.userId, path: "/api/ai/execute" });
    return NextResponse.json({ error: err.message ?? "Execute error" }, { status: 500 });
  }
}
