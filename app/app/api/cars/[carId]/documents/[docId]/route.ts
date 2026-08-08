import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string; docId: string }> }
) {
  const { carId, docId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const owned = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const doc = await prisma.carDocument.update({
    where: { id: docId },
    data: { isPrivate: body.isPrivate },
  });
  return NextResponse.json({ ok: true, isPrivate: doc.isPrivate });
}

async function verifyCarOwnership(carId: string, userId: string) {
  const car = await prisma.car.findFirst({ where: { id: carId, userId } });
  return !!car;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string; docId: string }> }
) {
  const { carId, docId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const owned = await verifyCarOwnership(carId, session.userId);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doc = await prisma.carDocument.findFirst({
    where: { id: docId, carId },
  });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  try {
    const filePath = join(
      process.cwd(),
      'public',
      'uploads',
      'cars',
      carId,
      'docs',
      doc.filename
    );
    await unlink(filePath);
  } catch {
    // File may not exist, continue
  }

  await prisma.carDocument.delete({ where: { id: docId } });

  return NextResponse.json({ success: true });
}
