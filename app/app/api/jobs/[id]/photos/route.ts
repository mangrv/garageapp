import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { buildUserMediaPath, mediaExists, persistMedia } from "@/lib/media-storage";
import { INLINE_VIDEO_TRANSCODE, MAX_INLINE_VIDEO_BYTES } from "@/lib/post-media";

const execFileAsync = promisify(execFile);

const MAX_SIZE = 250 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm", "video/x-matroska",
]);

async function optimizeImage(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
}

async function optimizeVideo(buffer: Buffer): Promise<{ video: Buffer; thumbnail: Buffer }> {
  const inPath = `/tmp/gm-in-${randomUUID()}.tmp`;
  const outPath = `/tmp/gm-out-${randomUUID()}.mp4`;
  const thumbPath = `/tmp/gm-thumb-${randomUUID()}.webp`;
  await writeFile(inPath, buffer);

  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", [
      "-y",
      "-i", inPath,
      "-vf", "scale='min(1280,iw)':-2,fps=30",
      "-c:v", "libx264",
      "-profile:v", "main",
      "-level", "3.1",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-crf", "28",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ar", "44100",
      "-movflags", "+faststart",
      outPath,
    ], { maxBuffer: 256 * 1024 * 1024 }).catch((err) => {
      console.error("[ffmpeg] transcode failed:", err.stderr ?? err.message);
      throw err;
    });
    void stdout; void stderr;

    await execFileAsync("ffmpeg", [
      "-y",
      "-ss", "00:00:01",
      "-i", outPath,
      "-frames:v", "1",
      "-vf", "scale='min(960,iw)':-2",
      "-c:v", "libwebp",
      "-quality", "75",
      thumbPath,
    ], { maxBuffer: 64 * 1024 * 1024 }).catch((err) => {
      console.error("[ffmpeg] thumbnail failed:", err.stderr ?? err.message);
      throw err;
    });

    const { readFile } = await import("fs/promises");
    return { video: await readFile(outPath), thumbnail: await readFile(thumbPath) };
  } finally {
    await Promise.allSettled([unlink(inPath), unlink(outPath), unlink(thumbPath)]);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photos = await (prisma as any).jobPhoto.findMany({
    where: { jobId: id },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const photosWithStatus = await Promise.all(photos.map(async (p: any) => {
    if (p.mediaType !== "video") return { ...p, processingStatus: "ready" as const };
    const absPath = path.join(process.cwd(), "public", "uploads", `${p.filename}.thumb.webp`);
    const hasThumb = await mediaExists({ relPath: `${p.filename}.thumb.webp`, absPath });
    return { ...p, processingStatus: hasThumb ? "ready" as const : "processing" as const };
  }));

  return NextResponse.json({ photos: photosWithStatus });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("photos") as File[];
  const caption = String(formData.get("caption") || "").trim() || null;

  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });


  const count = await (prisma as any).jobPhoto.count({ where: { jobId: id } });
  const created = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size === 0) continue;
    if (file.size > MAX_SIZE) continue;
    if (!ALLOWED.has(file.type)) continue;

    const isVideo = file.type.startsWith("video/");
    const ext = isVideo ? "mp4" : "webp";
    const { relPath: filename, absPath } = await buildUserMediaPath({
      userId: session.userId,
      area: "jobs/photos",
      entityId: id,
      originalName: file.name,
      forceExt: ext,
    });
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    let optimized: Buffer;
    try {
      if (isVideo) {
        const shouldInlineTranscode = INLINE_VIDEO_TRANSCODE && rawBuffer.length <= MAX_INLINE_VIDEO_BYTES;
        if (shouldInlineTranscode) {
          const out = await optimizeVideo(rawBuffer);
          optimized = out.video;
          const thumbRel = `${filename}.thumb.webp`;
          const thumbAbs = `${absPath}.thumb.webp`;
          await persistMedia({ relPath: thumbRel, absPath: thumbAbs, buffer: out.thumbnail, contentType: "image/webp" });
          console.log(`[media] stored video thumbnail: ${thumbRel} (${out.thumbnail.length} bytes)`);
        } else {
          optimized = rawBuffer;
        }
      } else {
        optimized = await optimizeImage(rawBuffer);
      }
    } catch (err) {
      console.error("[media] optimization failed for", file.name, err);
      return NextResponse.json({ error: `Media optimization failed: ${(err as Error).message}` }, { status: 422 });
    }
    await persistMedia({ relPath: filename, absPath, buffer: optimized, contentType: isVideo ? (file.type || "video/mp4") : "image/webp" });
    console.log(`[media] stored ${isVideo ? "video" : "image"}: ${filename} (${optimized.length} bytes)`);

    const photo = await (prisma as any).jobPhoto.create({
      data: {
        id: randomUUID(),
        jobId: id,
        filename,
        mediaType: isVideo ? "video" : "image",
        caption: i === 0 ? caption : null,
        sortOrder: count + i,
      },
    });
    const processingStatus = isVideo && (!INLINE_VIDEO_TRANSCODE || rawBuffer.length > MAX_INLINE_VIDEO_BYTES)
      ? "processing"
      : "ready";

    created.push({ ...photo, processingStatus });
  }

  return NextResponse.json({ photos: created });
}

// PATCH /api/jobs/[id]/photos
// - bulk reorder: { order: ["photoId1","photoId2",...] }
// - bulk publish/private all: { setPublic: true|false }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, userId: session.userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { order?: string[]; setPublic?: boolean };

  if (Array.isArray(body.order)) {
    await Promise.all(
      body.order.map((photoId, i) =>
        (prisma as any).jobPhoto.updateMany({
          where: { id: photoId, jobId: id },
          data: { sortOrder: i },
        })
      )
    );
    return NextResponse.json({ ok: true, mode: "reorder" });
  }

  if (typeof body.setPublic === "boolean") {
    const result = await (prisma as any).jobPhoto.updateMany({
      where: { jobId: id },
      data: { isPublic: body.setPublic },
    });

    await (prisma.job as any).update({
      where: { id },
      data: { feedUpdatedAt: body.setPublic ? new Date() : null },
    });

    return NextResponse.json({ ok: true, mode: "visibility", updated: result.count });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}
