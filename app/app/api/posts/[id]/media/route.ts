import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { buildUserMediaPath, mediaExists, persistMedia } from "@/lib/media-storage";
import path from "path";
import { ALLOWED_MEDIA, INLINE_VIDEO_TRANSCODE, MAX_INLINE_VIDEO_BYTES, MAX_MEDIA_SIZE, optimizeImage, optimizeVideo } from "@/lib/post-media";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const media = await (prisma as any).postMedia.findMany({
    where: { postId: id },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const mediaWithStatus = await Promise.all(media.map(async (m: any) => {
    if (m.mediaType !== "video") return { ...m, processingStatus: "ready" as const };
    const absPath = path.join(process.cwd(), "public", "uploads", `${m.filename}.thumb.webp`);
    const hasThumb = await mediaExists({ relPath: `${m.filename}.thumb.webp`, absPath });
    return { ...m, processingStatus: hasThumb ? "ready" as const : "processing" as const };
  }));

  return NextResponse.json({ media: mediaWithStatus });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("media") as File[];
  const count = await (prisma as any).postMedia.count({ where: { postId: id } });
  const created = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || file.size === 0 || file.size > MAX_MEDIA_SIZE || !ALLOWED_MEDIA.has(file.type)) continue;
    const isVideo = file.type.startsWith("video/");
    const ext = isVideo ? "mp4" : "webp";
    const { relPath: filename, absPath } = await buildUserMediaPath({ userId: session.userId, area: "posts/media", entityId: id, originalName: file.name, forceExt: ext });
    const raw = Buffer.from(await file.arrayBuffer());
    if (isVideo) {
      const shouldInlineTranscode = INLINE_VIDEO_TRANSCODE && raw.length <= MAX_INLINE_VIDEO_BYTES;
      if (shouldInlineTranscode) {
        const optimized = await optimizeVideo(raw);
        await persistMedia({ relPath: `${filename}.thumb.webp`, absPath: `${absPath}.thumb.webp`, buffer: optimized.thumbnail, contentType: "image/webp" });
        await persistMedia({ relPath: filename, absPath, buffer: optimized.video, contentType: "video/mp4" });
      } else {
        await persistMedia({ relPath: filename, absPath, buffer: raw, contentType: file.type || "video/mp4" });
      }
    } else {
      const optimized = await optimizeImage(raw);
      await persistMedia({ relPath: filename, absPath, buffer: optimized, contentType: "image/webp" });
    }

    const media = await (prisma as any).postMedia.create({ data: { postId: id, filename, mediaType: isVideo ? "video" : "image", sortOrder: count + i } });
    const processingStatus = isVideo && (!INLINE_VIDEO_TRANSCODE || raw.length > MAX_INLINE_VIDEO_BYTES)
      ? "processing"
      : "ready";
    created.push({ ...media, processingStatus });
  }
  return NextResponse.json({ media: created });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const post = await (prisma as any).post.findFirst({ where: { id, userId: session.userId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (Array.isArray(body.order)) {
    await Promise.all(body.order.map((mediaId: string, i: number) => (prisma as any).postMedia.updateMany({ where: { id: mediaId, postId: id }, data: { sortOrder: i } })));
  }
  return NextResponse.json({ ok: true });
}
