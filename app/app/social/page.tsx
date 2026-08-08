import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import FeedCard from "../feed/FeedCard";
import SocialTabs from "./SocialTabs";

export default async function SocialPage() {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login?next=/social");

  const posts = await (prisma as any).post.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      job: { include: { car: true, likes: { where: { userId: session.userId }, select: { id: true } }, bookmarks: { where: { userId: session.userId }, select: { id: true } }, _count: { select: { likes: true, bookmarks: true } } } },
      user: { select: { id: true, name: true, displayName: true, username: true } },
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] },
    },
  });

  const serialized = posts.map((p: any) => ({
    id: p.jobId || p.id,
    title: p.title || p.job?.title || "Garage Post",
    notes: p.caption || p.job?.notes || null,
    status: p.job?.status || "done",
    feedUpdatedAt: (p.publishedAt || p.createdAt)?.toISOString() ?? null,
    car: p.job?.car ? { year: p.job.car.year, make: p.job.car.make, model: p.job.car.model } : null,
    feedCaption: p.caption ?? p.job?.feedCaption ?? null,
    user: p.user ? { id: p.user.id, name: p.user.displayName || p.user.name, username: p.user.username } : null,
    liked: (p.job?.likes?.length ?? 0) > 0,
    bookmarked: (p.job?.bookmarks?.length ?? 0) > 0,
    likesCount: p.job?._count?.likes ?? 0,
    bookmarksCount: p.job?._count?.bookmarks ?? 0,
    photos: p.media.map((m: any) => ({ id: m.id, filename: m.filename, mediaType: m.mediaType ?? "image", caption: m.caption, isPrimary: m.isPrimary })),
  })).filter((p: any) => p.photos.length > 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <SocialTabs active="community" />
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {serialized.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">🏁</div>
            <h2 className="text-lg font-bold text-white">No community posts yet</h2>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">Share a project when you are ready. Private garage records stay private unless you publish them.</p>
            <Link href="/dashboard" className="inline-block bg-amber-500 text-gray-950 font-bold px-6 py-3 rounded-xl text-sm">Go to my garage</Link>
          </div>
        ) : (
          serialized.map((job: any) => <FeedCard key={job.id + job.feedUpdatedAt} job={job} isOwner={job.user?.id === session.userId} />)
        )}
      </main>
    </div>
  );
}
