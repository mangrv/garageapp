"use client";

declare global {
  interface Window { _paq?: any[] }
}

export function trackMatomoEvent(category: string, action: string, name?: string, value?: number) {
  if (typeof window === "undefined") return;
  const q = window._paq;
  if (!Array.isArray(q)) return;
  const payload: any[] = ["trackEvent", category, action];
  if (name !== undefined) payload.push(name);
  if (value !== undefined) payload.push(value);
  q.push(payload);
}
