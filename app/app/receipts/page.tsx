import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ReceiptInboxClient from "./ReceiptInboxClient";

export default async function ReceiptInboxPage({ searchParams }: { searchParams: Promise<{ scan?: string }> }) {
  const session = await requireSession();
  const { scan } = await searchParams;

  const receipts = await prisma.receipt.findMany({
    where: { userId: session.userId },
    include: {
      lineItems: true,
      job: { select: { id: true, title: true } },
      serviceRecord: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const jobs = await prisma.job.findMany({
    where: { userId: session.userId, status: { not: "archived" } },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  const serviceRecords = await prisma.serviceRecord.findMany({
    where: { car: { userId: session.userId } },
    select: { id: true, title: true, serviceDate: true },
    orderBy: { serviceDate: "desc" },
    take: 50,
  });

  const cars = await prisma.car.findMany({
    where: { userId: session.userId },
    select: { id: true, year: true, make: true, model: true, trim: true },
    orderBy: { year: "asc" },
  });

  return (
    <ReceiptInboxClient
      initialReceipts={receipts as Parameters<typeof ReceiptInboxClient>[0]["initialReceipts"]}
      jobs={jobs}
      serviceRecords={serviceRecords.map((sr) => ({
        ...sr,
        serviceDate: sr.serviceDate.toISOString(),
      }))}
      cars={cars}
      autoScan={scan === "1"}
    />
  );
}
