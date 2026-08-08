import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await (prisma as any).jobBomItem.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, partNumber, vendor, quantity, unitCost, status, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const item = await (prisma as any).jobBomItem.create({
    data: {
      id: randomUUID(),
      jobId: id,
      name: name.trim(),
      partNumber: partNumber?.trim() || null,
      vendor: vendor?.trim() || null,
      quantity: parseInt(quantity) || 1,
      unitCost: parseFloat(unitCost) || null,
      status: status || "needed",
      notes: notes?.trim() || null,
    },
  });
  return NextResponse.json({ item });
}
