import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { buildUserMediaPath, persistMedia } from '@/lib/media-storage';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

async function verifyCarOwnership(carId: string, userId: string) {
  const car = await prisma.car.findFirst({ where: { id: carId, userId } });
  return !!car;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const { carId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const owned = await verifyCarOwnership(carId, session.userId);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const documents = await prisma.carDocument.findMany({
    where: { carId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(documents);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  const { carId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const owned = await verifyCarOwnership(carId, session.userId);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

  const type = (formData.get('type') as string) || 'other';
  const label = (formData.get('label') as string) || null;
  const expiresAtStr = formData.get('expiresAt') as string | null;
  const notes = (formData.get('notes') as string) || null;

  const { relPath: filename, absPath } = await buildUserMediaPath({
    userId: session.userId,
    area: 'cars/documents',
    entityId: carId,
    originalName: file.name,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  await persistMedia({
    relPath: filename,
    absPath,
    buffer,
    contentType: file.type,
  });

  const doc = await prisma.carDocument.create({
    data: {
      carId,
      filename,
      type,
      label,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
      notes,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
