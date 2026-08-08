import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const carId = searchParams.get("carId");

  let job = null;
  if (jobId) {
    const p = await prisma.job.findFirst({
      where: { id: jobId, userId: session.userId },
      include: {
        car: {
          include: {
            serviceRecords: {
              orderBy: { serviceDate: "desc" },
              take: 5,
              select: { id: true, title: true, serviceDate: true, mileage: true, serviceType: true, cost: true },
            },
          },
        },
        phases: {
          orderBy: { sortOrder: "asc" },
          include: {
            tasks: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true, title: true, done: true, warning: true, tip: true,
                dueDate: true, torqueValue: true, torqueUnit: true,
                partsCost: true, laborCost: true, partsNote: true,
              },
            },
          },
        },
        receipts: {
          select: {
            id: true,
            vendor: true,
            totalAmount: true,
            receiptDate: true,
            notes: true,
            lineItems: {
              select: { name: true, quantity: true, amount: true },
            },
          },
        },
      },
    });
    if (p) {
      const car = p.car;
      job = {
        id: p.id,
        title: p.title,
        notes: p.notes,
        status: p.status,
        toolsJson: (p as any).toolsJson,
        serviceType: (p as any).serviceType ?? null,
        car: car ? `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}` : null,
        carId: p.carId,
        carDetails: car ? {
          year: car.year,
          make: car.make,
          model: car.model,
          trim: car.trim,
          mileage: car.mileage,
          color: (car as any).color,
          recentService: car.serviceRecords.map((r) => ({
            title: r.title,
            serviceDate: r.serviceDate,
            mileage: r.mileage,
            serviceType: r.serviceType,
            cost: r.cost,
          })),
        } : null,
        phases: p.phases.map((ph) => ({
          id: ph.id,
          sortOrder: ph.sortOrder,
          emoji: ph.emoji,
          title: ph.title,
          toolsJson: (ph as any).toolsJson,
          taskCount: ph.tasks.length,
          doneCount: ph.tasks.filter((t) => t.done).length,
          tasks: ph.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            done: t.done,
            warning: (t as any).warning ?? null,
            tip: (t as any).tip ?? null,
            dueDate: (t as any).dueDate ?? null,
            torqueValue: (t as any).torqueValue ?? null,
            torqueUnit: (t as any).torqueUnit ?? null,
            partsCost: (t as any).partsCost ?? null,
            laborCost: (t as any).laborCost ?? null,
            partsNote: (t as any).partsNote ?? null,
          })),
        })),
        receipts: p.receipts.map((r) => ({
          vendor: r.vendor,
          totalAmount: r.totalAmount,
          receiptDate: r.receiptDate,
          notes: r.notes,
          lineItems: r.lineItems,
        })),
      };
    }
  }

  // Only include the cars list when not scoped to a specific job
  // (job context already contains the car label)
  let cars = null;
  if (!jobId) {
    cars = await prisma.car.findMany({
      where: { userId: session.userId },
      orderBy: { year: "asc" },
      select: { id: true, year: true, make: true, model: true, trim: true, mileage: true },
    });
  }

  let focusedCar = null;
  if (carId) {
    const c = await prisma.car.findFirst({
      where: { id: carId, userId: session.userId },
      include: {
        serviceRecords: {
          orderBy: { serviceDate: "desc" },
          take: 3,
          select: { id: true, title: true, serviceDate: true, mileage: true },
        },
      },
    });
    if (c) {
      focusedCar = {
        id: c.id,
        label: `${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ""}`,
        year: c.year,
        make: c.make,
        model: c.model,
        trim: c.trim,
        mileage: c.mileage,
        color: c.color,
        notes: c.notes,
        recentService: c.serviceRecords.map((r) => ({
          id: r.id,
          title: r.title,
          serviceDate: r.serviceDate,
          mileage: r.mileage,
        })),
      };
    }
  }

  return NextResponse.json({ cars, job, focusedCar });
}
