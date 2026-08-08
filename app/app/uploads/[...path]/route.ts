import { NextRequest, NextResponse } from "next/server";
import { readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getSignedReadUrl, isS3Enabled } from "@/lib/media-storage";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const execFileAsync = promisify(execFile);

const MIME: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".gif":  "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4":  "video/mp4",
  ".mov":  "video/quicktime",
  ".webm": "video/webm",
  ".mkv":  "video/x-matroska",
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function resolveLegacyOwnerUserId(filename: string): Promise<string | null> {
  const [carDoc, carPhoto, receipt, jobAttachment, jobPhoto, postMedia, taskPhoto] = await Promise.all([
    prisma.carDocument.findFirst({ where: { filename }, include: { car: { select: { userId: true } } } }),
    prisma.carPhoto.findFirst({ where: { filename }, include: { car: { select: { userId: true } } } }),
    prisma.receipt.findFirst({ where: { filename }, select: { userId: true } }),
    prisma.jobAttachment.findFirst({ where: { filename }, include: { user: { select: { id: true } } } }),
    (prisma as any).jobPhoto.findFirst({ where: { filename }, include: { job: { select: { userId: true } } } }),
    (prisma as any).postMedia.findFirst({ where: { filename }, include: { post: { select: { userId: true } } } }),
    prisma.photo.findFirst({ where: { filename }, include: { task: { include: { phase: { include: { job: { select: { userId: true } } } } } } } }),
  ]);

  return (
    carDoc?.car?.userId ||
    carPhoto?.car?.userId ||
    receipt?.userId ||
    jobAttachment?.user?.id ||
    jobPhoto?.job?.userId ||
    postMedia?.post?.userId ||
    taskPhoto?.task?.phase?.job?.userId ||
    null
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Security: prevent directory traversal
  const filename = segments.join("/").replace(/\.\./g, "").replace(/^\//, "");

  // Enforce ownership for user-scoped paths: users/<userId>/...
  const ownerMatch = filename.match(/^users\/([^/]+)\//);
  if (ownerMatch) {
    if (ownerMatch[1] !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // For thumbnail derivatives, resolve ownership from the source media filename
    const lookupFilename = filename.endsWith(".thumb.webp")
      ? filename.replace(/\.thumb\.webp$/, "")
      : filename;

    // Legacy paths (non users/<id>/...) must resolve to an owner from DB
    try {
      const ownerUserId = await resolveLegacyOwnerUserId(lookupFilename);
      if (!ownerUserId || ownerUserId !== session.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch (err) {
      console.error("[uploads] legacy owner resolution failed", { filename, lookupFilename, error: err });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const filePath = path.join(UPLOADS_DIR, filename);

  // Ensure file stays within uploads dir
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    const isVideo = contentType.startsWith("video/");

    // Self-heal missing video thumbnails on demand: <video>.thumb.webp
    if (filename.endsWith(".thumb.webp")) {
      try {
        const file = await readFile(filePath);
        return new NextResponse(file, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        const videoRelPath = filename.replace(/\.thumb\.webp$/, "");
        const videoPath = path.join(UPLOADS_DIR, videoRelPath);
        if (!videoPath.startsWith(UPLOADS_DIR)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await stat(videoPath);
        await execFileAsync("ffmpeg", [
          "-y",
          "-ss", "00:00:01",
          "-i", videoPath,
          "-frames:v", "1",
          "-vf", "scale='min(960,iw)':-2",
          "-c:v", "libwebp",
          "-quality", "75",
          filePath,
        ], { maxBuffer: 64 * 1024 * 1024 });

        const generated = await readFile(filePath);
        console.log("[uploads] generated thumbnail on-demand", { thumb: filename, video: videoRelPath, bytes: generated.length });
        return new NextResponse(generated, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    if (isVideo) {
      // Range request support — required for iOS video scrubbing
      const fileStat = await stat(filePath);
      const fileSize = fileStat.size;
      const rangeHeader = _req.headers.get("range");

      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const { createReadStream } = await import("fs");
        const stream = createReadStream(filePath, { start, end });
        // @ts-ignore — ReadableStream from Node fs is acceptable
        return new NextResponse(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      const file = await readFile(filePath);
      return new NextResponse(file, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Content-Length": String(fileSize),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    if (isS3Enabled()) {
      const signedUrl = await getSignedReadUrl(filename);
      return NextResponse.redirect(signedUrl, { status: 307 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
