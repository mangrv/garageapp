"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const KEEP_PARAMS = /^(mtm_|utm_|pk_)/;
const ID_SEGMENT = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,}|[A-Za-z0-9_-]{24,})$/;
const TOKEN_AFTER = new Set(["share", "register"]);

/** Analytics URL without record IDs, private tokens or query values (campaign tags are kept). */
export function analyticsUrl(pathname: string, search: URLSearchParams | null) {
  const parts = pathname.split("/");
  const clean = parts.map((seg, i) => {
    if (i > 0 && TOKEN_AFTER.has(parts[i - 1]) && seg) return ":token";
    return ID_SEGMENT.test(seg) ? ":id" : seg;
  });
  const kept = new URLSearchParams();
  search?.forEach((value, key) => { if (KEEP_PARAMS.test(key)) kept.set(key, value); });
  const qs = kept.toString();
  return `${window.location.origin}${clean.join("/")}${qs ? `?${qs}` : ""}`;
}

/** Sends a Matomo page view on first load and on every client-side navigation. */
export default function MatomoTracker({ userId }: { userId?: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = analyticsUrl(pathname, searchParams);
    // Let the new page's <title> settle before reading it.
    const timer = window.setTimeout(() => {
      const q = (window._paq = window._paq || []);
      if (previousUrl.current) q.push(["setReferrerUrl", previousUrl.current]);
      q.push(["setCustomUrl", url]);
      q.push(["setDocumentTitle", document.title]);
      q.push(userId ? ["setUserId", userId] : ["resetUserId"]);
      q.push(["trackPageView"]);
      q.push(["enableLinkTracking"]);
      previousUrl.current = url;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, userId]);

  return null;
}
