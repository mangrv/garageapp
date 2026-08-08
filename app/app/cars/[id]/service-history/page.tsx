import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ServiceHistoryClient from "./ServiceHistoryClient";

export default async function ServiceHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    include: {
      serviceRecords: {
        orderBy: { serviceDate: "desc" },
        include: {
          receipts: {
            select: {
              id: true,
              filename: true,
              vendor: true,
              totalAmount: true,
              lineItems: {
                select: { id: true, name: true, quantity: true, amount: true, notes: true, warrantyProvider: true, warrantyStart: true, warrantyEnd: true, warrantyNotes: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!car) redirect("/dashboard");

  const carName = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;

  return (
    <ServiceHistoryClient
      carId={id}
      carName={carName}
      records={car.serviceRecords.map((r) => ({
        id: r.id,
        carId: r.carId,
        jobId: r.jobId ?? null,
        title: r.title,
        serviceType: (r as any).serviceType ?? null,
        notes: r.notes ?? null,
        details: (r as any).details ?? null,
        partsUsed: (r as any).partsUsed ?? null,
        cost: (r as any).cost ?? null,
        nextServiceDue: (r as any).nextServiceDue ?? null,
        duration: (r as any).duration ?? null,
        partsSource: (r as any).partsSource ?? null,
        mileage: r.mileage ?? null,
        serviceDate: r.serviceDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        receipts: (r as any).receipts?.map((rc: any) => ({
          id: rc.id,
          filename: rc.filename ?? null,
          vendor: rc.vendor ?? null,
          totalAmount: rc.totalAmount ?? null,
          lineItems: rc.lineItems?.map((li: any) => ({
            id: li.id,
            name: li.name,
            quantity: li.quantity,
            amount: li.amount ?? null,
            notes: li.notes ?? null,
            warrantyProvider: li.warrantyProvider ?? null,
            warrantyStart: li.warrantyStart?.toISOString() ?? null,
            warrantyEnd: li.warrantyEnd?.toISOString() ?? null,
            warrantyNotes: li.warrantyNotes ?? null,
          })) ?? [],
        })) ?? [],
      }))}
    />
  );
}
