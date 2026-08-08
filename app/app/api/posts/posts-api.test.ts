import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostBody } from "../../../lib/posts-helpers.ts";

test("posts create/update/delete basics: body normalization", () => {
  const created = normalizePostBody({ title: "  T  ", caption: "  C  ", isPublished: false });
  assert.equal(created.title, "T");
  assert.equal(created.caption, "C");
  assert.equal(created.isPublished, false);
  assert.equal(created.publishedAt, null);
});
