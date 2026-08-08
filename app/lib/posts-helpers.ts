export type PostBody = {
  title?: unknown;
  caption?: unknown;
  isPublished?: unknown;
  jobId?: unknown;
};

export function normalizePostBody(body: PostBody) {
  const isPublished = typeof body.isPublished === "boolean" ? body.isPublished : false;
  return {
    title: typeof body.title === "string" ? body.title.trim() || null : null,
    caption: typeof body.caption === "string" ? body.caption.trim() || null : null,
    isPublished,
    publishedAt: isPublished ? new Date() : null,
    jobId: typeof body.jobId === "string" && body.jobId.trim() ? body.jobId : null,
  };
}

export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  const copy = [...ids];
  const [item] = copy.splice(fromIndex, 1);
  if (!item) return ids;
  copy.splice(toIndex, 0, item);
  return copy;
}

export function normalizeDisplayName(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: true, value: null };
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > 40) return { ok: false, error: "Display name must be 40 characters or fewer" };
  if (/[^\P{C}\n\t]/u.test(trimmed)) return { ok: false, error: "Display name contains invalid characters" };
  return { ok: true, value: trimmed };
}
