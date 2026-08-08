import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const { carId } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id: carId, userId: session.userId },
  });

  if (!car) {
    return new NextResponse("Not found", { status: 404 });
  }

  const carName = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, "-");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  // Fetch all files
  const [photos, serviceReceipts, jobReceipts, documents] = await Promise.all([
    prisma.carPhoto.findMany({ where: { carId } }),
    prisma.receipt.findMany({
      where: { serviceRecord: { carId }, filename: { not: null } },
      select: { id: true, filename: true, vendor: true, receiptDate: true },
    }),
    prisma.receipt.findMany({
      where: { job: { carId }, filename: { not: null } },
      select: { id: true, filename: true, vendor: true, receiptDate: true },
    }),
    prisma.carDocument.findMany({ where: { carId } }),
  ]);

  // Deduplicate receipts
  const seenIds = new Set<string>();
  const receipts = [...serviceReceipts, ...jobReceipts].filter((r) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  const zip = new JSZip();

  // Add car photos
  const photosFolder = zip.folder("car-photos")!;
  for (const photo of photos) {
    try {
      const filePath = path.join(uploadsDir, photo.filename);
      const data = await readFile(filePath);
      const ext = photo.filename.split(".").pop() ?? "jpg";
      photosFolder.file(`photo-${photo.id}.${ext}`, data);
    } catch {
      // skip missing files
    }
  }

  // Add receipts
  const receiptsFolder = zip.folder("receipts")!;
  for (const receipt of receipts) {
    if (!receipt.filename) continue;
    try {
      const filePath = path.join(uploadsDir, receipt.filename);
      const data = await readFile(filePath);
      const ext = receipt.filename.split(".").pop() ?? "jpg";
      const vendor = receipt.vendor ? receipt.vendor.replace(/[^a-zA-Z0-9-_]/g, "-") : "receipt";
      const date = receipt.receiptDate ? receipt.receiptDate.toISOString().split("T")[0] : receipt.id.slice(0, 8);
      receiptsFolder.file(`${vendor}-${date}.${ext}`, data);
    } catch {
      // skip missing
    }
  }

  // Add documents
  const docsFolder = zip.folder("documents")!;
  for (const doc of documents) {
    try {
      const filePath = path.join(uploadsDir, doc.filename);
      const data = await readFile(filePath);
      const ext = doc.filename.split(".").pop() ?? "pdf";
      const label = ((doc as any).label ?? doc.type ?? "doc").replace(/[^a-zA-Z0-9-_]/g, "-");
      docsFolder.file(`${label}-${doc.id.slice(0, 6)}.${ext}`, data);
    } catch {
      // skip missing
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${carName}-files.zip"`,
    },
  });
}
