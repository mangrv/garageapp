import path from "path";
import { prisma } from "../lib/prisma";
import { mediaExists, persistMedia, readMedia } from "../lib/media-storage";
import { optimizeVideo } from "../lib/post-media";

type VideoRow = { id: string; filename: string };

async function processVideo(row: VideoRow, area: string) {
  const absPath = path.join(process.cwd(), "public", "uploads", row.filename);
  const thumbRel = `${row.filename}.thumb.webp`;
  const thumbAbs = `${absPath}.thumb.webp`;

  const hasThumb = await mediaExists({ relPath: thumbRel, absPath: thumbAbs });
  if (hasThumb) return { skipped: true };

  const raw = await readMedia({ relPath: row.filename, absPath });
  const optimized = await optimizeVideo(raw);

  await persistMedia({ relPath: row.filename, absPath, buffer: optimized.video, contentType: "video/mp4" });
  await persistMedia({ relPath: thumbRel, absPath: thumbAbs, buffer: optimized.thumbnail, contentType: "image/webp" });

  console.log("[pending-media] processed", { area, id: row.id, filename: row.filename, videoBytes: optimized.video.length, thumbBytes: optimized.thumbnail.length });
  return { skipped: false };
}

async function main() {
  const [jobVideos, postVideos] = await Promise.all([
    (prisma as any).jobPhoto.findMany({ where: { mediaType: "video" }, select: { id: true, filename: true } }),
    (prisma as any).postMedia.findMany({ where: { mediaType: "video" }, select: { id: true, filename: true } }),
  ]);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of jobVideos as VideoRow[]) {
    try {
      const result = await processVideo(row, "jobs/photos");
      if (result.skipped) skipped++; else processed++;
    } catch (err) {
      failed++;
      console.error("[pending-media] failed", { area: "jobs/photos", id: row.id, filename: row.filename, error: err });
    }
  }

  for (const row of postVideos as VideoRow[]) {
    try {
      const result = await processVideo(row, "posts/media");
      if (result.skipped) skipped++; else processed++;
    } catch (err) {
      failed++;
      console.error("[pending-media] failed", { area: "posts/media", id: row.id, filename: row.filename, error: err });
    }
  }

  console.log("[pending-media] summary", {
    total: jobVideos.length + postVideos.length,
    processed,
    skipped,
    failed,
  });
}

main()
  .catch((err) => {
    console.error("[pending-media] fatal", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
