import { randomUUID } from "crypto";
import sharp from "sharp";
import { writeFile, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Allow large uploads (1–2GB+), configurable via env.
// Default: 2GB
export const MAX_MEDIA_SIZE = Number(process.env.MAX_MEDIA_SIZE_BYTES || 2 * 1024 * 1024 * 1024);
export const INLINE_VIDEO_TRANSCODE = process.env.INLINE_VIDEO_TRANSCODE !== "false";
export const MAX_INLINE_VIDEO_BYTES = Number(process.env.MAX_INLINE_VIDEO_BYTES || 50 * 1024 * 1024);
export const ALLOWED_MEDIA = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm", "video/x-matroska",
]);

export async function optimizeImage(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
}

export async function optimizeVideo(buffer: Buffer): Promise<{ video: Buffer; thumbnail: Buffer }> {
  const inPath = `/tmp/gm-in-${randomUUID()}.tmp`;
  const outPath = `/tmp/gm-out-${randomUUID()}.mp4`;
  const thumbPath = `/tmp/gm-thumb-${randomUUID()}.webp`;
  await writeFile(inPath, buffer);

  try {
    await execFileAsync("ffmpeg", ["-y", "-i", inPath, "-vf", "scale='min(1280,iw)':-2,fps=30", "-c:v", "libx264", "-profile:v", "main", "-level", "3.1", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", outPath], { maxBuffer: 256 * 1024 * 1024 });
    await execFileAsync("ffmpeg", ["-y", "-ss", "00:00:01", "-i", outPath, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-c:v", "libwebp", "-quality", "75", thumbPath], { maxBuffer: 64 * 1024 * 1024 });

    const { readFile } = await import("fs/promises");
    return { video: await readFile(outPath), thumbnail: await readFile(thumbPath) };
  } finally {
    await Promise.allSettled([unlink(inPath), unlink(outPath), unlink(thumbPath)]);
  }
}
