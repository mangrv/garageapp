import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostBody, reorderIds, normalizeDisplayName } from "./posts-helpers.ts";

test("normalizePostBody create basics", () => {
  const out = normalizePostBody({ title: "  Hi ", caption: "  cap ", isPublished: true, jobId: "j1" });
  assert.equal(out.title, "Hi");
  assert.equal(out.caption, "cap");
  assert.equal(out.isPublished, true);
  assert.ok(out.publishedAt instanceof Date);
  assert.equal(out.jobId, "j1");
});

test("reorderIds moves media and preserves sequence", () => {
  assert.deepEqual(reorderIds(["a","b","c"], 2, 0), ["c","a","b"]);
});

test("normalizeDisplayName validation path", () => {
  assert.deepEqual(normalizeDisplayName("  "), { ok: true, value: null });
  const bad = normalizeDisplayName("x".repeat(41));
  assert.equal(bad.ok, false);
});
