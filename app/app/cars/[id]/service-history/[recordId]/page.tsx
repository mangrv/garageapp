import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import ServiceRecordDetailClient from "./ServiceRecordDetailClient";

export default async function ServiceRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const session = await requireSession();
  const { id: carId, recordId } = await params;

  const record = await prisma.serviceRecord.findFirst({
    where: { id: recordId, carId },
    include: {
      receipts: {
        select: {
          id: true,
          filename: true,
          vendor: true,
          totalAmount: true,
          receiptDate: true,
          notes: true,
          status: true,
          lineItems: {
            select: {
              id: true,
              name: true,
              quantity: true,
              amount: true,
              notes: true,
              warrantyProvider: true,
              warrantyStart: true,
              warrantyEnd: true,
              warrantyNotes: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const attachments = await (prisma as any).jobAttachment.findMany({
    where: { serviceRecordId: recordId },
    orderBy: { createdAt: "asc" },
  });

  if (!record) notFound();

  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) redirect("/dashboard");

  const carName = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");

  return (
    <ServiceRecordDetailClient
      carId={carId}
      carName={carName}
      initialAttachments={attachments.map((a: any) => ({
        id: a.id,
        filename: a.filename,
        type: a.type,
        vendor: a.vendor ?? null,
        amount: a.amount ?? null,
        caption: a.caption ?? null,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      }))}
      record={{
        id: record.id,
        title: record.title,
        serviceType: (record as any).serviceType ?? null,
        serviceDate: record.serviceDate.toISOString(),
        mileage: record.mileage ?? null,
        cost: (record as any).cost ?? null,
        notes: record.notes ?? null,
        details: (record as any).details ?? null,
        partsUsed: (record as any).partsUsed ?? null,
        partsSource: (record as any).partsSource ?? null,
        duration: (record as any).duration ?? null,
        nextServiceDue: (record as any).nextServiceDue ?? null,
        receipts: record.receipts.map((r) => ({
          id: r.id,
          filename: r.filename ?? null,
          vendor: r.vendor ?? null,
          totalAmount: r.totalAmount ?? null,
          receiptDate: r.receiptDate?.toISOString() ?? null,
          notes: r.notes ?? null,
          status: r.status,
          lineItems: r.lineItems,
        })),
      }}
    />
  );
}
