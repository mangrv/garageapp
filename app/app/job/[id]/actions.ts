"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import path from "path";
import { requireSession } from "@/lib/session";
import { buildUserMediaPath, persistMedia } from "@/lib/media-storage";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function createServiceRecordFromJob(data: {
  carId: string;
  jobId: string;
  title: string;
  notes: string;
  mileage: string;
  serviceDate: string;
}) {
  if (!data.title.trim() || !data.serviceDate || !data.carId) return;

  // Calculate total cost from job receipts + task parts/labor costs
  const [receipts, tasks] = await Promise.all([
    prisma.receipt.findMany({ where: { jobId: data.jobId }, select: { totalAmount: true } }),
    prisma.task.findMany({
      where: { phase: { jobId: data.jobId } },
      select: { partsCost: true, laborCost: true },
    }),
  ]);
  const receiptTotal = receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const taskTotal = tasks.reduce((s, t) => s + ((t as any).partsCost ?? 0) + ((t as any).laborCost ?? 0), 0);
  const totalCost = receiptTotal + taskTotal;

  const parsedMileage = parseInt(data.mileage) || null;
  const parsedDate = new Date(data.serviceDate);

  const record = await prisma.serviceRecord.create({
    data: {
      id: randomUUID(),
      carId: data.carId,
      jobId: data.jobId,
      title: data.title.trim(),
      notes: data.notes.trim() || null,
      mileage: parsedMileage,
      serviceDate: parsedDate,
      cost: totalCost > 0 ? totalCost : null,
    } as any,
  });
  void requireSession().then((sess) => trackServerMatomoEvent({ category: "Garage", action: "service_logged", name: "from_job", userId: sess.userId, path: "/job/:id" })).catch(() => {});

  // Log mileage to history
  if (parsedMileage) {
    await prisma.mileageLog.create({
      data: {
        id: randomUUID(),
        carId: data.carId,
        mileage: parsedMileage,
        recordedAt: parsedDate,
        source: "service",
        sourceId: record.id,
      },
    });
    const car = await prisma.car.findUnique({ where: { id: data.carId }, select: { mileage: true } });
    if (!car?.mileage || parsedMileage > car.mileage) {
      await prisma.car.update({ where: { id: data.carId }, data: { mileage: parsedMileage } });
    }
  }

  revalidatePath(`/cars/${data.carId}/service-history`);
  revalidatePath(`/cars/${data.carId}`);
}

// ── Task ────────────────────────────────────────────────────────

export async function toggleTask(taskId: string, done: boolean, jobId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { done, completedAt: done ? new Date() : null },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { phase: { include: { tasks: true } } },
  });

  if (task) {
    const allTasks = task.phase.tasks;
    const doneTasks = allTasks.filter((t) => t.done).length;
    let status = "todo";
    if (doneTasks > 0 && doneTasks < allTasks.length) status = "in_progress";
    if (doneTasks === allTasks.length) status = "done";
    await prisma.phase.update({ where: { id: task.phase.id }, data: { status } });
  }

  revalidatePath(`/job/${jobId}`);
}

export async function addTask(
  phaseId: string,
  jobId: string,
  title: string,
  warning: string,
  tip: string,
  dueDate: string,
  torqueValue?: number | null,
  torqueUnit?: string | null
) {
  if (!title.trim()) return;
  const count = await prisma.task.count({ where: { phaseId } });
  await prisma.task.create({
    data: {
      id: randomUUID(),
      phaseId,
      title: title.trim(),
      warning: warning.trim() || null,
      tip: tip.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      sortOrder: count + 1,
      torqueValue: torqueValue ?? null,
      torqueUnit: torqueUnit ?? null,
    } as any,
  });
  revalidatePath(`/job/${jobId}`);
}

export async function updateTask(
  taskId: string,
  jobId: string,
  title: string,
  warning: string,
  tip: string,
  dueDate: string,
  torqueValue?: number | null,
  torqueUnit?: string | null,
  partsCost?: number | null,
  laborCost?: number | null,
  partsNote?: string | null,
) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: title.trim() || undefined,
      warning: warning.trim() || null,
      tip: tip.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      torqueValue: torqueValue ?? null,
      torqueUnit: torqueUnit ?? null,
      partsCost: partsCost ?? null,
      laborCost: laborCost ?? null,
      partsNote: partsNote ?? null,
    } as any,
  });
  revalidatePath(`/job/${jobId}`);
}

export async function updateJobTools(jobId: string, toolsJson: string | null) {
  await prisma.job.update({
    where: { id: jobId },
    data: { toolsJson } as any,
  });
  revalidatePath(`/job/${jobId}`);
}

export async function updatePhaseTools(phaseId: string, toolsJson: string | null, jobId: string) {
  await prisma.phase.update({
    where: { id: phaseId },
    data: { toolsJson } as any,
  });
  revalidatePath(`/job/${jobId}`);
}

export async function saveAsTemplate(jobId: string, name: string) {
  if (!name.trim()) return;
  const project = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" },
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!project) return;

  const phasesJson = JSON.stringify(project.phases.map((ph) => ({
    title: ph.title,
    emoji: ph.emoji,
    sortOrder: ph.sortOrder,
    tasks: ph.tasks.map((t) => ({
      title: t.title,
      warning: t.warning,
      tip: t.tip,
      sortOrder: t.sortOrder,
    })),
  })));

  await prisma.userTemplate.create({
    data: { id: randomUUID(), name: name.trim(), phasesJson },
  });
}

export async function deleteTask(taskId: string, jobId: string) {
  // delete associated photo files
  const photos = await prisma.photo.findMany({ where: { taskId } });
  for (const p of photos) {
    try {
      await unlink(path.join(process.cwd(), "public", "uploads", p.filename));
    } catch {}
  }
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/job/${jobId}`);
}

export async function moveTask(taskId: string, direction: "up" | "down", jobId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { sortOrder: true, phaseId: true } });
  if (!task) return;

  const siblings = await prisma.task.findMany({
    where: { phaseId: task.phaseId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const idx = siblings.findIndex((t) => t.id === taskId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;

  const swapTask = siblings[swapIdx];
  await prisma.task.update({ where: { id: taskId }, data: { sortOrder: swapTask.sortOrder } });
  await prisma.task.update({ where: { id: swapTask.id }, data: { sortOrder: task.sortOrder } });
  revalidatePath(`/job/${jobId}`);
}

// ── Phase ────────────────────────────────────────────────────────

export async function addPhase(jobId: string, title: string, emoji: string) {
  if (!title.trim()) return;
  const count = await prisma.phase.count({ where: { jobId } });
  await prisma.phase.create({
    data: {
      id: randomUUID(),
      jobId,
      title: title.trim(),
      emoji: emoji.trim() || null,
      sortOrder: count + 1,
      status: "todo",
    },
  });
  revalidatePath(`/job/${jobId}`);
}

export async function updatePhase(phaseId: string, jobId: string, title: string, emoji: string) {
  await prisma.phase.update({
    where: { id: phaseId },
    data: {
      title: title.trim() || undefined,
      emoji: emoji.trim() || null,
    },
  });
  revalidatePath(`/job/${jobId}`);
}

export async function deletePhase(phaseId: string, jobId: string) {
  // delete all task photo files
  const tasks = await prisma.task.findMany({ where: { phaseId }, include: { photos: true } });
  for (const t of tasks) {
    for (const p of t.photos) {
      try {
        await unlink(path.join(process.cwd(), "public", "uploads", p.filename));
      } catch {}
    }
  }
  await prisma.phase.delete({ where: { id: phaseId } });
  revalidatePath(`/job/${jobId}`);
}

export async function movePhase(phaseId: string, status: string, jobId: string) {
  await prisma.phase.update({ where: { id: phaseId }, data: { status } });
  revalidatePath(`/job/${jobId}`);
}

// ── Comments ─────────────────────────────────────────────────────

export async function addComment(taskId: string, text: string, jobId: string) {
  if (!text.trim()) return;
  await prisma.comment.create({
    data: { id: randomUUID(), taskId, text: text.trim() },
  });
  revalidatePath(`/job/${jobId}`);
}

export async function editComment(commentId: string, text: string, jobId: string) {
  if (!text.trim()) return;
  await prisma.comment.update({ where: { id: commentId }, data: { text: text.trim() } });
  revalidatePath(`/job/${jobId}`);
}

export async function deleteComment(commentId: string, jobId: string) {
  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(`/job/${jobId}`);
}

// ── Photos ───────────────────────────────────────────────────────

export async function uploadPhoto(taskId: string, jobId: string, formData: FormData) {
  const session = await requireSession();
  const file = formData.get("photo") as File | null;
  const caption = String(formData.get("caption") || "").trim() || null;
  if (!file || file.size === 0) return;

  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: "jobs/task-photos",
    entityId: jobId,
    originalName: file.name,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  await persistMedia({ relPath: filename, absPath, buffer, contentType: file.type || "image/jpeg" });

  await prisma.photo.create({
    data: { id: randomUUID(), taskId, filename, caption },
  });

  revalidatePath(`/job/${jobId}`);
}

export async function updatePhotoCaption(photoId: string, caption: string, jobId: string) {
  await prisma.photo.update({
    where: { id: photoId },
    data: { caption: caption.trim() || null },
  });
  revalidatePath(`/job/${jobId}`);
}

export async function deletePhoto(photoId: string, jobId: string) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (photo) {
    try {
      await unlink(path.join(process.cwd(), "public", "uploads", photo.filename));
    } catch {}
  }
  await prisma.photo.delete({ where: { id: photoId } });
  revalidatePath(`/job/${jobId}`);
}

// ── Job ──────────────────────────────────────────────────────

export async function updateJob(
  jobId: string,
  title: string,
  notes: string,
  carId: string,
  status: string,
  startedAt: string,
  completedAt: string,
) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      title: title.trim() || undefined,
      notes: notes.trim() || null,
      carId: carId || null,
      status,
      startedAt: startedAt ? new Date(startedAt) : null,
      completedAt: completedAt ? new Date(completedAt) : null,
    } as any,
  });
  revalidatePath(`/job/${jobId}`);
  revalidatePath("/");
}

export async function setJobStatus(jobId: string, status: string, carId?: string | null) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status } as any,
  });
  revalidatePath(`/job/${jobId}`);
  revalidatePath("/");
  if (carId) revalidatePath(`/cars/${carId}/jobs`);
}

export async function reorderJob(jobId: string, direction: "up" | "down", carId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { sortOrder: true, status: true, carId: true },
  }) as any;
  if (!job) return;

  const siblings = await (prisma.job as any).findMany({
    where: { carId: job.carId ?? carId, status: job.status },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const idx = siblings.findIndex((j: any) => j.id === jobId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;

  const swap = siblings[swapIdx];

  // Assign clean sequential sortOrders to avoid ties
  const updated = [...siblings];
  [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
  await Promise.all(
    updated.map((j: any, i: number) =>
      (prisma.job as any).update({ where: { id: j.id }, data: { sortOrder: i } })
    )
  );

  revalidatePath("/");
  if (job.carId) revalidatePath(`/cars/${job.carId}/jobs`);
}

export async function deleteJob(jobId: string) {
  // delete all task photo files first
  const phases = await prisma.phase.findMany({
    where: { jobId },
    include: { tasks: { include: { photos: true } } },
  });
  for (const phase of phases) {
    for (const task of phase.tasks) {
      for (const p of task.photos) {
        try {
          await unlink(path.join(process.cwd(), "public", "uploads", p.filename));
        } catch {}
      }
    }
  }
  await prisma.job.delete({ where: { id: jobId } });
  redirect("/dashboard");
}
