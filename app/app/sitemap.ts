import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://garagemeet.com";

// Built per request: public profiles change as owners toggle sharing.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const users = await (prisma.user as any).findMany({
      where: { isPublic: true, username: { not: null } },
      select: {
        username: true,
        cars: { where: { isPublic: true }, select: { id: true, updatedAt: true } },
      },
    });
    for (const u of users) {
      const latest = u.cars.reduce((d: Date | undefined, c: any) => (!d || c.updatedAt > d ? c.updatedAt : d), undefined);
      pages.push({ url: `${SITE}/u/${u.username}`, lastModified: latest, changeFrequency: "weekly", priority: 0.6 });
      for (const c of u.cars) {
        pages.push({ url: `${SITE}/u/${u.username}/car/${c.id}`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 0.5 });
      }
    }
  } catch {
    // Database unavailable: still serve the static pages.
  }
  return pages;
}
