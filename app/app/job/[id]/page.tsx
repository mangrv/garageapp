import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import JobPageClient from "./JobPageClient";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const [project, cars, attachments, receipts, existingServiceRecord, jobPhotos, bomItems] = await Promise.all([
    prisma.job.findFirst({
      where: { id, userId: session.userId },
      include: {
        car: true,
        phases: {
          orderBy: { sortOrder: "asc" },
          include: {
            tasks: {
              orderBy: { sortOrder: "asc" },
              include: {
                comments: { orderBy: { createdAt: "asc" } },
                photos: { orderBy: { createdAt: "asc" } },
              },
            },
          },
        },
      },
    }),
    prisma.car.findMany({ where: { userId: session.userId }, orderBy: { year: "asc" } }),
    (prisma as any).jobAttachment.findMany({ where: { jobId: id }, orderBy: { createdAt: "desc" } }),
    prisma.receipt.findMany({
      where: { jobId: id },
      include: {
        lineItems: {
          select: {
            id: true,
            name: true,
            amount: true,
            quantity: true,
            notes: true,
            warrantyProvider: true,
            warrantyEnd: true,
            taskId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceRecord.findFirst({ where: { jobId: id }, select: { id: true } }),
    (prisma as any).jobPhoto.findMany({
      where: { jobId: id },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    (prisma as any).jobBomItem.findMany({
      where: { jobId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!project) redirect("/dashboard");

  const totalTasks = project.phases.reduce((s, p) => s + p.tasks.length, 0);
  const doneTasks = project.phases.reduce((s, p) => s + p.tasks.filter((t) => t.done).length, 0);
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const carLabel = project.car
    ? [project.car.year, project.car.make, project.car.model, project.car.trim].filter(Boolean).join(" ")
    : null;

  const serializedJob = {
    id: project.id,
    title: project.title,
    notes: project.notes,
    status: project.status,
    carId: project.carId,
    carLabel,
    feedCaption: (project as any).feedCaption ?? null,
    feedUpdatedAt: (project as any).feedUpdatedAt?.toISOString() ?? null,
    shareToken: (project as any).shareToken ?? null,
    clonedFromId: (project as any).clonedFromId ?? null,
    clonedFromTitle: (project as any).clonedFromTitle ?? null,
    toolsJson: (project as any).toolsJson ?? null,
    startedAt: project.startedAt?.toISOString() ?? null,
    completedAt: project.completedAt?.toISOString() ?? null,
    phases: project.phases.map((ph) => ({
      id: ph.id,
      title: ph.title,
      emoji: ph.emoji,
      status: ph.status,
      sortOrder: ph.sortOrder,
      toolsJson: (ph as any).toolsJson ?? null,
      tasks: ph.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        warning: t.warning,
        tip: t.tip,
        torqueValue: (t as any).torqueValue ?? null,
        torqueUnit: (t as any).torqueUnit ?? null,
        partsCost: (t as any).partsCost ?? null,
        laborCost: (t as any).laborCost ?? null,
        partsNote: (t as any).partsNote ?? null,
        done: t.done,
        dueDate: (t as any).dueDate ? new Date((t as any).dueDate).toISOString() : null,
        sortOrder: t.sortOrder,
        comments: t.comments.map((c) => ({
          id: c.id,
          text: c.text,
          createdAt: c.createdAt.toISOString(),
        })),
        photos: t.photos.map((p) => ({
          id: p.id,
          filename: p.filename,
          caption: p.caption,
          createdAt: p.createdAt.toISOString(),
        })),
      })),
    })),
  };

  const serializedCars = cars.map((c) => ({
    id: c.id,
    year: c.year,
    make: c.make,
    model: c.model,
    trim: c.trim,
  }));

  const serializedAttachments = (attachments as any[]).map((a) => ({
    id: a.id,
    filename: a.filename,
    type: a.type,
    vendor: a.vendor,
    amount: a.amount,
    caption: a.caption,
    createdAt: a.createdAt.toISOString(),
  }));

  const serializedPhotos = (jobPhotos as any[]).map((p: any) => ({
    id: p.id,
    filename: p.filename,
    mediaType: p.mediaType ?? "image",
    caption: p.caption,
    isPublic: p.isPublic,
    isPrimary: p.isPrimary,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
  }));

  const serializedBomItems = (bomItems as any[]).map((b: any) => ({
    id: b.id,
    name: b.name,
    partNumber: b.partNumber,
    vendor: b.vendor,
    quantity: b.quantity,
    unitCost: b.unitCost,
    status: b.status,
    notes: b.notes,
  }));

  // Receipt line items flattened with parent vendor for BOM display
  const receiptLineItems = receipts.flatMap((r) =>
    r.lineItems.map((li) => ({
      id: li.id,
      name: li.name,
      amount: li.amount,
      quantity: li.quantity,
      notes: li.notes ?? null,
      warrantyProvider: (li as any).warrantyProvider ?? null,
      warrantyEnd: (li as any).warrantyEnd
        ? new Date((li as any).warrantyEnd).toISOString()
        : null,
      vendor: r.vendor ?? null,
    }))
  );

  // Task parts notes for BOM
  const taskPartsNotes = project.phases.flatMap((ph) =>
    ph.tasks
      .filter((t: any) => t.partsNote || t.partsCost)
      .map((t: any) => ({
        taskId: t.id,
        taskTitle: t.title,
        phaseTitle: ph.title,
        partsNote: t.partsNote ?? "",
        partsCost: t.partsCost ?? null,
      }))
  );

  const laborTotal = project.phases
    .flatMap((ph) => ph.tasks)
    .reduce((s: number, t: any) => s + (t.laborCost ?? 0), 0);

  const receiptTotal = receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const attachmentTotal = (attachments as any[]).reduce(
    (s: number, a: any) => s + (a.amount ?? 0),
    0
  );

  const serializedReceipts = receipts.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    totalAmount: r.totalAmount,
    receiptDate: r.receiptDate?.toISOString() ?? null,
    status: r.status,
    filename: r.filename,
    lineItems: r.lineItems.map((li) => ({ id: li.id })),
  }));

  return (
    <JobPageClient
      project={serializedJob}
      cars={serializedCars}
      totalTasks={totalTasks}
      doneTasks={doneTasks}
      pct={pct}
      receiptTotal={receiptTotal}
      attachmentTotal={attachmentTotal}
      hasServiceRecord={!!existingServiceRecord}
      jobId={id}
      serializedPhotos={serializedPhotos}
      serializedBomItems={serializedBomItems}
      receiptLineItems={receiptLineItems}
      taskPartsNotes={taskPartsNotes}
      laborTotal={laborTotal}
      serializedAttachments={serializedAttachments}
      serializedReceipts={serializedReceipts}
    />
  );
}
