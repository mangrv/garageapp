import { prisma } from "../lib/prisma";

async function main() {
  const jobs = await (prisma as any).job.findMany({ where: { photos: { some: { isPublic: true } } }, include: { photos: { where: { isPublic: true }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] } } });
  let created = 0;
  for (const job of jobs) {
    const existing = await (prisma as any).post.findFirst({ where: { jobId: job.id } });
    if (existing) continue;
    const post = await (prisma as any).post.create({ data: { userId: job.userId, jobId: job.id, title: job.title, caption: job.feedCaption ?? job.notes, isPublished: true, publishedAt: job.feedUpdatedAt ?? job.updatedAt } });
    for (let i = 0; i < job.photos.length; i++) {
      const p = job.photos[i];
      await (prisma as any).postMedia.create({ data: { postId: post.id, filename: p.filename, mediaType: p.mediaType ?? 'image', caption: p.caption, isPrimary: p.isPrimary, sortOrder: p.sortOrder ?? i } });
    }
    created++;
  }
  console.log(`Created ${created} posts`);
}

main().finally(async()=>prisma.$disconnect());
