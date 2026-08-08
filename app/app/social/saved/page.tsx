import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import FeedCard from "../../feed/FeedCard";
import SocialTabs from "../SocialTabs";

export default async function SocialSavedPage() {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login?next=/social/saved");

  const jobs = await (prisma.job as any).findMany({
    where: { feedUpdatedAt: { not: null }, photos: { some: { isPublic: true } }, bookmarks: { some: { userId: session.userId } } },
    orderBy: { feedUpdatedAt: "desc" },
    take: 50,
    include: {
      car: { select: { id: true, year: true, make: true, model: true } },
      user: { select: { id: true, name: true, username: true } },
      photos: { where: { isPublic: true }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] },
      likes: { where: { userId: session.userId }, select: { id: true } },
      bookmarks: { where: { userId: session.userId }, select: { id: true } },
      _count: { select: { likes: true, bookmarks: true } },
    },
  });

  const serialized = jobs.map((j: any) => ({
    id: j.id,
    title: j.title,
    notes: j.notes,
    status: j.status,
    feedUpdatedAt: j.feedUpdatedAt?.toISOString() ?? null,
    car: j.car ? { year: j.car.year, make: j.car.make, model: j.car.model } : null,
    feedCaption: j.feedCaption ?? null,
    user: j.user ? { id: j.user.id, name: j.user.name, username: j.user.username } : null,
    liked: (j.likes?.length ?? 0) > 0,
    bookmarked: (j.bookmarks?.length ?? 0) > 0,
    likesCount: j._count?.likes ?? 0,
    bookmarksCount: j._count?.bookmarks ?? 0,
    photos: j.photos.map((p: any) => ({ id: p.id, filename: p.filename, mediaType: p.mediaType ?? "image", caption: p.caption, isPrimary: p.isPrimary })),
  }));

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <SocialTabs active="saved" />
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {serialized.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="text-5xl">🔖</div>
            <h2 className="text-lg font-bold text-white">No saved posts</h2>
            <p className="text-sm text-gray-500">Save community posts you want to revisit later.</p>
          </div>
        ) : (
          serialized.map((job: any) => <FeedCard key={job.id} job={job} isOwner={job.user?.id === session.userId} />)
        )}
      </main>
    </div>
  );
}
