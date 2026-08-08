# Phase 0 Hardening Change Set — Senior Review

**Reviewer:** Cline (acting Senior Lead Developer)
**Date:** 2026-05-01
**Inputs reviewed:**
- `changes/README.md`
- `changes/2026-05-01-CHG-001-secure-s3-defaults.md`
- `changes/2026-05-01-CHG-002-protect-uploads-route.md`
- `changes/2026-05-01-CHG-003-storage-read-delete-abstraction.md`
- `changes/2026-05-01-CHG-004-route-car-documents-through-storage-abstraction.md`
- `changes/2026-05-01-CHG-005-reduce-inline-ffmpeg-blast-radius.md`
- 11 modified source files (verified line-by-line)

---

## TL;DR

**Verdict: ✅ Approved with required follow-ups before staging exposure.**

The Phase 0 changes are correctly scoped to the four release-blocker risks (R-01..R-04 in the QA risk register) and they substantively close three of them. **R-04 (inline FFmpeg) is partially closed**, not fully — the feature flag exists but the asynchronous fallback worker promised in `4-lite` was not implemented, leaving a UX gap (no thumbnail) on the large-video path. Two **new residual issues** surface from inspection: a cross-tenant exposure on legacy upload paths that don't match the `users/<id>/...` ownership regex, and three local-only code paths in delivery that bypass the new `readMedia` abstraction. None of these block merge to `main`, but they must be tracked before flipping S3 in staging or running QA's `TC-SEC-*` matrix.

The change docs themselves are well-structured (why / files / risks / validation / rollback / sign-off) and the validation checklists are appropriately scoped.

---

## Per-change verdict

### CHG-001 — Secure S3 Defaults · ✅ Approved
**What was claimed:** signed-URL helper, SSE-AES256 on PUT, no public-read default.
**What I verified in the code:**
- `media-storage.ts:33-45` — `getSignedReadUrl(key, expiresInSeconds?)` correctly uses `getSignedUrl` with `GetObjectCommand`. Env override `AWS_SIGNED_URL_EXPIRES` is honored, default 600 s. **Correct.**
- `media-storage.ts:99` — `ServerSideEncryption: "AES256"` present on `PutObjectCommand`. **Correct.**
- `media-storage.ts:98` — `ACL: process.env.AWS_ACL as ...` is now `undefined` by default. **Correct.**
- `docker-compose.yml:24` — `AWS_ACL: ${AWS_ACL:-}` (was `:-public-read`). **Correct.**
- `uploads/[...path]/route.ts:146-149` — fallback now redirects to a signed URL. **Correct.**
- `package.json:15` — `@aws-sdk/s3-request-presigner` added at matching version. **Correct.**

**Issues found (non-blocking):**
- `getS3PublicUrl()` (`media-storage.ts:26-31`) is still exported and is now dead code. **Recommend deleting** to prevent regression — a future contributor will reach for it. Add `@deprecated` minimum.
- `media-storage.ts:98` accepts whatever `AWS_ACL` env says. If a future operator sets `AWS_ACL=public-read` thinking it's harmless, R-01 reopens silently. **Recommend** narrowing the cast to a whitelist (`"private" | undefined`) and logging a warning if `AWS_ACL` is anything else.
- The bucket-side guarantee is not in the change set: even with `ACL: undefined`, an S3 bucket policy / ACL that grants public-read at bucket level still wins. The change doc says "ensure block-public-access is on (operational task)" — confirm this is captured in `STAGING_SETUP.md` (not part of this PR but must land before staging).

**Sign-off:** ✅ Approved, with three follow-up TODOs above.

---

### CHG-002 — Protect `/uploads` Route · 🟡 Approved with caveats
**What was claimed:** middleware no longer excludes `/uploads`; route checks session + ownership.
**What I verified:**
- `middleware.ts:30-33` — matcher is now `"/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|apple-touch-icon).*)"`. The previous explicit `uploads` exclusion is gone. **Correct.**
- `uploads/[...path]/route.ts:36-39` — `getSession()` + 401. **Correct.**
- `uploads/[...path]/route.ts:45-48` — `users/<userId>/` regex ownership check. **Correct.**
- `uploads/[...path]/route.ts:147` — signed S3 fallback runs only after auth/ownership has passed. **Correct ordering.**

**Issues found (must address before staging):**

1. **🔴 Legacy paths bypass ownership.** The regex `^users\/([^/]+)\//` only matches paths under the current `users/<id>/...` schema. Pre-migration files (e.g. `cars/<carId>/docs/<file>.pdf` from before CHG-004) **do not match** and therefore skip the ownership check entirely. A user can fetch any other user's legacy car document by guessing or finding the filename. The directory-traversal and 401 checks still apply, but **cross-tenant read of legacy data is open**. This is a regression from the original spirit of CHG-002.
   - **Mitigation options:**
     - (a) Inverse rule: require `users/<sessionUserId>/...` and 403 anything else. Will break legacy reads — needs a one-shot migration script to relocate them.
     - (b) Add a fallback owner lookup: when path doesn't match the new schema, query DB to find which user owns the row referencing this filename, then enforce. Adds a hit per request but is bulletproof.
     - (c) Run a backfill script to move legacy files into `users/<id>/legacy/...` and update their DB rows. Safest if the legacy file count is small.
   - **Recommendation:** option (c) before staging exposure, or option (a) with explicit `STAGING_SETUP.md` step listing the broken files.

2. **🟡 Two parallel delivery paths skipped this PR.**
   - `app/app/api/media/thumb/route.ts` is **not modified**. It has no auth, only directory-traversal checks, and reads/writes only local disk. It must (a) be subjected to `getSession()` + ownership check identical to `/uploads`, and (b) be made S3-aware by Ticket CHG-003 (see below).
   - The thumbnail self-heal block inside `uploads/[...path]/route.ts:62-97` still uses raw `fs.readFile` / `execFile ffmpeg` / writes to local disk only. In S3 mode this whole branch silently falls through to the catch → signed S3 URL — but if the thumb is missing in S3, there is no on-demand regeneration. The user sees a broken image. Acceptable for Phase 0 if videos in S3 mode are rare, but document it.

3. **🟡 Browser UX of 307 to /login on missing cookie.** The middleware redirects unauthenticated `<img src="/uploads/...">` requests to `/login` (HTML). Most browsers will silently render a broken image. This is correct from a security standpoint, but if the user has been logged out unexpectedly and viewing a cached page, every image breaks with no indication. Consider returning 401 JSON for paths under `/uploads/` and `/api/` and reserving the redirect for top-level pages. Future polish, not blocking.

4. **🟢 Share-token path was deferred per `TECHNICAL_PRODUCT_LEAD_DECISION.md` Q3.** Acceptable — middleware's `PUBLIC` list already exposes `/share` and `/u/`, but those routes don't currently hit `/uploads`. Confirm with product before any future share feature.

**Sign-off:** 🟡 Approved for merge; **issue 1 must be resolved before flipping S3 in staging.**

---

### CHG-003 — Storage Read/Delete Abstraction · ✅ Approved with one gap
**What was claimed:** `readMedia` / `deleteMedia` helpers, used in receipt process + attach-photo.
**What I verified:**
- `media-storage.ts:130-142` — `readMedia` branches on `isS3Enabled()`, uses `transformToByteArray()`. **Correct.**
- `media-storage.ts:144-153` — `deleteMedia` likewise. **Correct.**
- `receipts/[id]/process/route.ts:182` — replaces direct `readFile`. **Correct.** Closes R-03 (the deployment-blocking ENOENT).
- `receipts/[id]/attach-photo/route.ts:38-45` — uses `deleteMedia` instead of local `unlink`. **Correct.**

**Gap not addressed:**
- Two more local-only sites that the senior review (§3.1) listed:
  - `app/app/api/media/thumb/route.ts:34` (`stat(videoPath)` + local `writeFile`).
  - `app/app/uploads/[...path]/route.ts:62-97` (thumbnail self-heal — local-only `readFile` + ffmpeg + `writeFile`).
- Without these, **on-demand thumbnail generation silently no-ops in S3 mode**. Track as **CHG-006** (suggested below). Not blocking R-03 closure, but the abstraction is incomplete until both delivery paths use it.

**Risk note:** S3 IAM policy must include `s3:DeleteObject` for the configured prefix. Confirm in `STAGING_SETUP.md`. Currently the change doc lists this; verify operator has applied it before exercising attach-photo replace flow.

**Sign-off:** ✅ Approved for merge; CHG-006 follow-up tracked.

---

### CHG-004 — Route Car Documents Through Storage Abstraction · 🟡 Approved with data note
**What was claimed:** `cars/[carId]/documents` POST now uses `persistMedia`; `cars/documents` added to `MediaArea` union.
**What I verified:**
- `cars/[carId]/documents/route.ts:65-78` — uses `buildUserMediaPath` + `persistMedia` correctly.
- `media-storage.ts:7-15` — `MediaArea` includes `"cars/documents"`. **Correct.**

**Data-shape concern (must be acknowledged, not blocking):**

- **Pre-existing bug, not introduced by CHG-004**, but now made visible:
  Before CHG-004, the route wrote files to `public/uploads/cars/<carId>/docs/<uuid>.<ext>` but stored only the basename `<uuid>.<ext>` in `CarDocument.filename`. That row, served via `/uploads/<filename>`, joins UPLOADS_DIR + basename → 404 (because the actual file is one directory deeper). The original author worked around this somehow (likely UI fetches the doc via a different path I haven't seen, or it was always broken and nobody noticed).
  - **Recommended action:** check on staging what `CarDocument.filename` rows look like and whether the docs UI actually loads them today. If yes, the old serving code path needs preservation or migration. If no, the change is a strict improvement.
- **New rows from CHG-004** correctly store the full `users/<userId>/cars/documents/<carId>/<uuid>.<ext>` relPath, which works with `/uploads/<filename>` and the new ownership check. ✅

- **Validation checklist item "Existing document listing still returns correct filename values"** in the CHG doc is correct to call out. Add an explicit migration ticket if pre-existing rows are broken.

**Sign-off:** 🟡 Approved for merge; product/QA to verify the legacy-doc display question on staging before closing the ticket.

---

### CHG-005 — Reduce Inline FFmpeg Blast Radius · 🟡 Approved as stop-gap
**What was claimed:** feature flag + 50 MB threshold; large videos / disabled flag → skip inline transcode.
**What I verified:**
- `post-media.ts:10-11` — `INLINE_VIDEO_TRANSCODE` and `MAX_INLINE_VIDEO_BYTES` exported correctly with sensible defaults.
- `posts/[id]/media/route.ts:26-33` — gating logic correct: large or disabled → persist raw, no thumb.
- `jobs/[id]/photos/route.ts:133-143` — same logic, also correct.
- Falls back to `file.type || "video/mp4"` for content-type, which is fine.

**This closes the dead-spinner risk (R-04) for the request lifecycle.** The user's HTTP request will now return promptly even for a 500 MB MP4.

**However, the change is a stop-gap, not the full Phase 0 #4-lite spec.** What was promised vs delivered:

| Sub-item from `TECHNICAL_PRODUCT_LEAD_DECISION.md` #4-lite | Delivered? |
|---|---|
| Feature flag `INLINE_VIDEO_TRANSCODE` | ✅ |
| `MAX_INLINE_VIDEO_BYTES` config | ✅ |
| **`processingStatus` column on `JobPhoto` / `PostMedia`** | ❌ Not added |
| **Tiny cron worker (`scripts/process-pending-media.ts`)** | ❌ Not added |
| **UI badge "Processing..."** | ❌ Not added |

**Consequence:** when a user uploads a > 50 MB video today, the row is created, the raw video is stored, and there is **no thumbnail and no signal that one is missing**. Listing UIs that expect `<video>.thumb.webp` will render broken. The on-demand thumb generator in `/uploads/[...path]:62-97` will *try* to fix this on first GET, but only in local-disk mode and only if ffmpeg is available — in S3 mode it falls through to a 307 to the (also missing) thumb.

**Required follow-up before declaring R-04 closed:** track CHG-007 (cron worker) and CHG-008 (`processingStatus` column + UI badge). Until then, R-04 is **mitigated** (no dead spinner) but not **closed** (broken thumbs).

**Cleanup nits:**
- `jobs/[id]/photos/route.ts:30-77` still locally redefines `optimizeVideo`. Senior review §3.6 already flagged this as DRY drift; this PR was an opportunity to delete the duplicate and import from `lib/post-media.ts`. Recommend a small CHG-009 follow-up.
- `jobs/[id]/photos/route.ts:5-8` — `writeFile`, `tmpdir`, `path` imports may now be partially unused once the duplicate is removed. Lint should flag.

**Sign-off:** 🟡 Approved as stop-gap; **R-04 cannot be marked closed in the risk register** until CHG-007/008 land.

---

## Closure status against release-blocker risks

| Risk | Phase 0 mapping | Status after this PR |
|---|---|---|
| R-01 — public-read receipts | CHG-001 | ✅ **Closed at app level.** Bucket policy must also be confirmed (operational task). |
| R-02 — cross-tenant `/uploads` reads | CHG-002 | 🟡 **Closed for new uploads.** ⚠️ **Open for legacy paths** that don't match `users/<id>/...` regex (issue #1 above). Track CHG-006a or backfill script before staging. |
| R-03 — receipt OCR ENOENT in S3 mode | CHG-003 | ✅ **Closed for the OCR path.** ⚠️ Three other delivery sites still local-only (track CHG-006). |
| R-04 — dead-spinner inline FFmpeg | CHG-005 | 🟡 **Mitigated, not closed.** No more multi-minute requests, but no async worker → broken thumbs on > 50 MB videos. Track CHG-007 + CHG-008. |
| R-05 — `cars/documents` bypasses S3 | CHG-004 | ✅ **Closed for new uploads.** Legacy data-shape question to confirm on staging. |

**Net effect:** the app moves from "active critical defect" to "feature-incomplete but fundamentally safe", which was the Phase 0 milestone target.

---

## Required follow-ups (recommend creating tickets now)

| ID | Title | Why | Effort |
|---|---|---|---|
| **CHG-006** | Make `/api/media/thumb` and `/uploads` thumbnail self-heal use `readMedia`/`persistMedia` | Completes CHG-003; removes silent local-only failure on S3 thumbs | S |
| **CHG-006a** | Auth + ownership on `/api/media/thumb` | Mirror CHG-002 protections; currently world-readable inside the app | XS |
| **CHG-006b** | Legacy `/uploads/...` ownership decision: backfill or DB-lookup fallback | Closes R-02 fully | S |
| **CHG-007** | `scripts/process-pending-media.ts` cron worker | Completes Phase 0 #4-lite; restores thumbnails for large videos | M |
| **CHG-008** | `processingStatus` column + UI badge on `JobPhoto` / `PostMedia` | Surfaces "still processing" state to user | S |
| **CHG-009** | Delete duplicate `optimizeVideo` in `jobs/[id]/photos`; import from `lib/post-media.ts` | DRY; prevents future drift | XS |
| **CHG-010** | Delete or `@deprecated` `getS3PublicUrl` in `media-storage.ts` | Prevents accidental regression | XS |
| **CHG-011** | Whitelist `AWS_ACL` env values; warn-and-default on unexpected | Defense-in-depth against misconfig that re-opens R-01 | XS |
| **CHG-012** | `STAGING_SETUP.md` updates: bucket Block-Public-Access on, `s3:Delete*` IAM, env-var checklist | Operator documentation | XS |

---

## Tests required before declaring Phase 0 complete

Map to QA suite IDs from `SENIOR_QA_ANALYST_REVIEW.md`:

**Must pass on staging-with-S3 to mark Phase 0 done:**
- TC-SEC-001 (S3 not world-readable)
- TC-SEC-002, TC-SEC-003 (auth + cross-tenant on `/uploads`)
- TC-SEC-005 (SSE-AES256 on uploads)
- TC-SEC-006 (path traversal — already covered)
- **TC-SEC-NEW-LEGACY** (new): unauthenticated user attempts to fetch a legacy `cars/<carId>/docs/<file>` path — should 403 once issue #1 is resolved
- TC-PROC-004 (receipt OCR works with S3 enabled)
- TC-UPL-005, TC-UPL-006 (small video transcodes inline; large video persists raw with no spinner)
- TC-REG-001..010 (no regressions on listing, range requests, reorder, etc.)

**Must pass on staging without S3 (regression):**
- All TC-UPL happy paths, TC-PROC-005 receipt OCR fallback chain, TC-REG-001..010.

---

## Process feedback on the change-doc format

Genuinely good. Two small enhancements suggested for future change docs:

1. Include a **diff stat** summary (e.g. `+147 / -34 across 11 files`) so reviewers can size the change at a glance.
2. Add a **"verified by reviewer"** column under the validation checklist — currently the boxes are owner-only; reviewers need their own checkbox.

---

## Final sign-off

- **Lead Dev (this review):** ✅ **Approve all five CHG-001..CHG-005 for merge to `main`.** Block staging S3 exposure on resolution of CHG-006a + CHG-006b. Treat R-04 as mitigated-not-closed until CHG-007/008.
- **Recommended next action for Bobby:** create CHG-006 through CHG-012 as separate tickets; pick CHG-006b (legacy ownership) and CHG-007 (cron worker) for the next iteration since they unblock the Phase 0 risk-register closure.
- **Recommended next action for Product/QA:** run the test list in §"Tests required" on staging before any external user exposure.

Good work. The discipline of one-CHG-per-file with rollback notes is exactly the right pattern for this kind of cross-cutting hardening.
