import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReceiptDetailClient from "./ReceiptDetailClient";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { id, userId: session.userId },
    include: {
      lineItems: { include: { task: { select: { id: true, title: true } } } },
      job: { select: { id: true, title: true } },
      serviceRecord: { select: { id: true, title: true } },
    },
  });

  if (!receipt) notFound();

  const cars = await prisma.car.findMany({
    where: { userId: session.userId },
    select: { id: true, year: true, make: true, model: true },
    orderBy: { year: "desc" },
  });

  const jobs = await prisma.job.findMany({
    where: { userId: session.userId, status: { not: "archived" } },
    select: { id: true, title: true, carId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Get tasks from linked job if any
  let tasks: { id: string; title: string }[] = [];
  if (receipt.jobId) {
    const phases = await prisma.phase.findMany({
      where: { jobId: receipt.jobId },
      include: { tasks: { select: { id: true, title: true } } },
    });
    tasks = phases.flatMap((p) => p.tasks);
  }

  const serviceRecords = await prisma.serviceRecord.findMany({
    where: { car: { userId: session.userId } },
    select: { id: true, title: true, serviceDate: true, carId: true },
    orderBy: { serviceDate: "desc" },
    take: 200,
  });

  return (
    <ReceiptDetailClient
      receipt={{
        ...receipt,
        receiptDate: receipt.receiptDate?.toISOString() ?? null,
        lineItems: receipt.lineItems.map((li) => ({
          ...li,
          createdAt: li.createdAt.toISOString(),
        })),
      }}
      cars={cars}
      jobs={jobs.map(j => ({ ...j, createdAt: j.createdAt.toISOString() }))}
      tasks={tasks}
      serviceRecords={serviceRecords.map((sr) => ({
        ...sr,
        serviceDate: sr.serviceDate.toISOString(),
      }))}
    />
  );
}
