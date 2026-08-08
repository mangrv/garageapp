import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import GalleryClient from "./GalleryClient";

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id },
  });

  if (!car) redirect("/dashboard");

  const carName = `${car.year} ${car.make} ${car.model}`;

  const [photos, serviceReceipts, jobReceipts, documents] = await Promise.all([
    prisma.carPhoto.findMany({
      where: { carId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.receipt.findMany({
      where: { serviceRecord: { carId: id }, filename: { not: null } },
      select: { id: true, filename: true, vendor: true, receiptDate: true },
    }),
    prisma.receipt.findMany({
      where: { job: { carId: id }, filename: { not: null } },
      select: { id: true, filename: true, vendor: true, receiptDate: true },
    }),
    prisma.carDocument.findMany({
      where: { carId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const seenReceiptIds = new Set<string>();
  const receipts = [...serviceReceipts, ...jobReceipts].filter((r) => {
    if (seenReceiptIds.has(r.id)) return false;
    seenReceiptIds.add(r.id);
    return true;
  });

  return (
    <GalleryClient
      carId={id}
      carName={carName}
      photos={photos.map((p) => ({
        id: p.id,
        filename: p.filename,
        caption: p.caption ?? null,
        createdAt: p.createdAt.toISOString(),
        isPrivate: p.isPrivate,
      }))}
      receipts={receipts.map((r) => ({
        id: r.id,
        filename: r.filename!,
        vendor: r.vendor ?? null,
        receiptDate: r.receiptDate?.toISOString() ?? null,
      }))}
      documents={documents.map((d) => ({
        id: d.id,
        carId: id,
        filename: d.filename,
        type: d.type,
        label: (d as any).label ?? null,
        isPrivate: d.isPrivate,
      }))}
    />
  );
}
