import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://garagemeet.com";

/** Public pages are crawlable; the signed-in app, invites and private share links are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/register", "/login", "/u/"],
      disallow: [
        "/api/", "/dashboard", "/cars/", "/job/", "/jobs/", "/projects", "/receipts", "/settings",
        "/admin", "/social", "/feed", "/friends", "/saved", "/search", "/templates", "/onboarding",
        "/guest", "/garage/", "/posts", "/user/", "/prd", "/share/", "/register/",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
