import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { normalizePostBody } from "@/lib/posts-helpers";
import { mediaExists } from "@/lib/media-storage";
import path from "path";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

export async function GET() {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const posts = await (prisma as any).post.findMany({
    where: { userId: session.userId },
    include: {
      job: { select: { id: true, title: true } },
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  const postsWithStatus = await Promise.all(posts.map(async (post: any) => {
    const media = await Promise.all((post.media || []).map(async (m: any) => {
      if (m.mediaType !== "video") return { ...m, processingStatus: "ready" as const };
      const absPath = path.join(process.cwd(), "public", "uploads", `${m.filename}.thumb.webp`);
      const hasThumb = await mediaExists({ relPath: `${m.filename}.thumb.webp`, absPath });
      return { ...m, processingStatus: hasThumb ? "ready" as const : "processing" as const };
    }));
    return { ...post, media };
  }));

  return NextResponse.json({ posts: postsWithStatus });
}

export async function POST(req: NextRequest) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const normalized = normalizePostBody(body);
  const post = await (prisma as any).post.create({
    data: {
      userId: session.userId,
      ...normalized,
    },
  });
  void trackServerMatomoEvent({ category: "Community", action: "post_published", userId: session.userId, path: "/social" });
  return NextResponse.json({ post });
}
