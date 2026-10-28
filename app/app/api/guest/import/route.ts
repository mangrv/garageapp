import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { trackVehiclesAdded } from "@/lib/matomo-server";
import { randomUUID } from "crypto";
import type { GuestDraft } from "@/lib/guestDraft";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const draft = await req.json().catch(() => null) as GuestDraft | null;
  if (!draft) return NextResponse.json({ error: "Invalid draft" }, { status: 400 });

  const summary = { cars: 0, serviceRecords: 0, jobs: 0, receipts: 0 };

  try {
    // Map draft car IDs to real car IDs
    const carIdMap: Record<string, string> = {};

    for (const dc of draft.cars) {
      const carId = randomUUID();
      carIdMap[dc._draftId] = carId;
      await prisma.car.create({
        data: {
          id: carId,
          userId: session.userId,
          assetType: dc.assetType ?? "vehicle",
          relationshipToUser: dc.relationshipToUser ?? "owned",
          managedOwnerName: dc.relationshipToUser === "owned" ? null : dc.managedOwnerName ?? null,
          managedOwnerContact: dc.relationshipToUser === "owned" ? null : dc.managedOwnerContact ?? null,
          managedOwnerNotes: dc.relationshipToUser === "owned" ? null : dc.managedOwnerNotes ?? null,
          year: dc.year,
          make: dc.make,
          model: dc.model,
          trim: dc.trim ?? null,
          color: dc.color ?? null,
          mileage: dc.mileage ?? null,
          notes: dc.notes ?? null,
        } as any,
      });
      summary.cars++;
    }

    // Map draft service record IDs to real IDs
    const srIdMap: Record<string, string> = {};

    for (const sr of draft.serviceRecords) {
      const realCarId = carIdMap[sr._carDraftId];
      if (!realCarId) continue;

      const srId = randomUUID();
      srIdMap[sr._draftId] = srId;

      await prisma.serviceRecord.create({
        data: {
          id: srId,
          carId: realCarId,
          title: sr.title,
          serviceDate: sr.serviceDate ? new Date(sr.serviceDate) : new Date(),
          mileage: sr.mileage ?? null,
          notes: sr.notes ?? null,
          cost: sr.cost ?? null,
          serviceType: sr.serviceType ?? null,
        } as any,
      });
      summary.serviceRecords++;

      // Import parts as receipt line items
      if (sr.parts && sr.parts.length > 0) {
        const receiptId = randomUUID();
        await prisma.receipt.create({
          data: {
            id: receiptId,
            userId: session.userId,
            serviceRecordId: srId,
            vendor: "Guest import",
            status: "processed",
          } as any,
        });
        for (const part of sr.parts) {
          await prisma.receiptLineItem.create({
            data: {
              id: randomUUID(),
              receiptId,
              name: part.name,
              quantity: part.quantity ?? 1,
              amount: part.amount ?? null,
              warrantyProvider: part.warrantyProvider ?? null,
              warrantyStart: part.warrantyStart ? new Date(part.warrantyStart) : null,
              warrantyEnd: part.warrantyEnd ? new Date(part.warrantyEnd) : null,
              warrantyNotes: part.warrantyNotes ?? null,
            },
          });
        }
      }
    }

    for (const dj of draft.jobs) {
      const realCarId = dj._carDraftId ? carIdMap[dj._carDraftId] : undefined;
      const jobId = randomUUID();
      const phaseId = randomUUID();
      await prisma.job.create({
        data: {
          id: jobId,
          userId: session.userId,
          carId: realCarId ?? null,
          title: dj.title,
          status: dj.status ?? "active",
          phases: {
            create: {
              id: phaseId,
              title: "Imported tasks",
              status: "active",
              tasks: dj.tasks && dj.tasks.length > 0 ? {
                create: dj.tasks.map((t) => ({
                  id: randomUUID(),
                  title: t.title,
                  done: t.done ?? false,
                  notes: t.notes ?? null,
                })),
              } : undefined,
            },
          },
        } as any,
      });
      summary.jobs++;
    }

    for (const dr of draft.receipts) {
      const realSrId = dr._serviceRecordDraftId ? srIdMap[dr._serviceRecordDraftId] : undefined;
      const receiptId = randomUUID();
      await prisma.receipt.create({
        data: {
          id: receiptId,
          userId: session.userId,
          serviceRecordId: realSrId ?? null,
          vendor: dr.vendor ?? null,
          totalAmount: dr.totalAmount ?? null,
          receiptDate: dr.receiptDate ? new Date(dr.receiptDate) : null,
          notes: dr.notes ?? null,
          status: "processed",
        } as any,
      });
      summary.receipts++;
    }

    void trackVehiclesAdded({ userId: session.userId, added: summary.cars, name: "guest_import", path: "/guest" });
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    console.error("Guest import error:", e);
    return NextResponse.json({ error: e.message ?? "Import failed" }, { status: 500 });
  }
}
