# Senior Lead Developer Review — Media Upload Pipeline

**App under review:** `workspace/apps/personal/car-maintenance` (Garage Work Manager)
**Requirements doc:** `workspace/requirements/media-upload-pipeline-requirements.md`
**Reviewer:** Cline (acting Senior Lead)
**Date:** 2026-05-01
**Status:** Draft v2 — full requirement-to-code trace + deep dive

---

## 0. TL;DR

The current car-maintenance app implements a **single-shot multipart/form-data uploader** with optional S3 mirroring and FFmpeg/Tesseract running **inside the HTTP request handler**. The requirements doc describes a **presigned-multipart-direct-to-S3 + queue + worker + state-machine** pipeline.

These are different architectures, not different tunings of the same one.

- **0 of 5** API endpoints from the spec exist.
- **0 of 2** required Prisma models (`assets`, `upload_sessions`) exist.
- **2 hard security defects** are independent of the spec debate (`ACL: public-read` default + unauthenticated `/uploads/[...path]` route).
- **2 hard reliability defects** equally so (FFmpeg in request lifecycle + S3/local code paths asymmetric, breaking processing when S3 is enabled).
- The PRD (`PRD.md §17`) explicitly lists **S3, video, cloud sync as out of scope** — meaning the requirements doc may be aspirational, not a contract. **Confirm scope intent before committing to the rebuild.**

---

## 1. Files reviewed

### Configuration / infra
- `Dockerfile` — base image Alpine, includes `ffmpeg tesseract-ocr`.
- `docker-compose.yml` — confirms `AWS_ACL` default `public-read` (line 24). `AWS_SIGNED_URL_EXPIRES=900` env exists but **no code reads it** (verified by grep).
- `app/middleware.ts` — JWT cookie auth; matcher excludes `uploads` prefix (line 32).
- `app/package.json` — has `@aws-sdk/client-s3` and `sharp`; **no** `s3-request-presigner`, `client-sqs`, `bullmq`, `pg-boss`, `hls.js`, `mediaconvert` SDK.
- `app/prisma/schema.prisma` (650 lines) — no `Asset` / `UploadSession` / `Rendition` / `ProcessingJob` models.

### Storage / helpers
- `app/lib/media-storage.ts` — `buildUserMediaPath`, `persistMedia`, `isS3Enabled`, `getS3PublicUrl`.
- `app/lib/post-media.ts` — `optimizeImage` (sharp), `optimizeVideo` (in-process FFmpeg).
- `app/lib/session.ts` — `getSession`, `requireSession` (redirects to `/login`).
- `app/app/lib/compressImage.ts` — client-side canvas JPEG compression (images only).

### Upload-handling routes (all 9 found)
| # | Route | File | Backend used |
|---|---|---|---|
| 1 | `POST /api/receipts` | `app/app/api/receipts/route.ts` | `persistMedia` (S3-aware) |
| 2 | `POST /api/receipts/[id]/process` | `app/app/api/receipts/[id]/process/route.ts` | local-only `readFile`, then OCR/AI inline |
| 3 | `POST /api/receipts/[id]/attach-photo` | `app/app/api/receipts/[id]/attach-photo/route.ts` | `persistMedia` |
| 4 | `POST /api/cars/[carId]/photos` | `app/app/api/cars/[carId]/photos/route.ts` | `persistMedia` |
| 5 | `POST /api/cars/[carId]/documents` | `app/app/api/cars/[carId]/documents/route.ts` | **raw `writeFile`** — bypasses S3 ⚠️ |
| 6 | `POST /api/jobs/[id]/photos` | `app/app/api/jobs/[id]/photos/route.ts` | `persistMedia` + inline FFmpeg |
| 7 | `POST /api/jobs/[id]/attachments` | `app/app/api/jobs/[id]/attachments/route.ts` | `persistMedia` |
| 8 | `POST /api/posts/[id]/media` | `app/app/api/posts/[id]/media/route.ts` | `persistMedia` + inline FFmpeg |
| 9 | `POST /api/service-records/[id]/attachments` | `app/app/api/service-records/[id]/attachments/route.ts` | `persistMedia` |

### Delivery routes
- `GET /uploads/[...path]` (`app/app/uploads/[...path]/route.ts`) — local disk read with on-the-fly FFmpeg thumbnail; falls back to **307 redirect to public S3 URL**.
- `GET /api/media/thumb` (`app/app/api/media/thumb/route.ts`) — local-disk-only FFmpeg thumbnailer.

### Components / clients
- `app/app/components/ReceiptUploadButton.tsx` — single `fetch()` upload + alert() error UX.
- `app/app/components/ReceiptScanFlow.tsx` — has finite state UX but no resume/progress.

### Other
- `PRD.md §17` — declares "Out of scope: ... S3, ... video, ...".

---

## 2. Full requirement-to-code trace

Legend: ✅ **FULLY IMPLEMENTED** · 🟡 **PARTIAL** · ❌ **NOT IMPLEMENTED** · ⚠️ **CONTRADICTS**

### §3 Functional requirements

| Req | Status | Where (file:line) | Notes |
|---|---|---|---|
| 3.1 Accept `.mp4`, `.mov` ≤ 2 GB | ❌ | `post-media.ts:9` (`MAX_MEDIA_SIZE = 250 MB`); `receipts/route.ts:7` (`20 MB`) | Multiple inconsistent caps (20 MB / 250 MB). 2 GB infeasible on `req.formData()` transport. |
| 3.1 Max duration 10 min | ❌ | nowhere | No duration validation client- or server-side. |
| 3.2.1 User selects file | ✅ | `ReceiptUploadButton.tsx:240-256`, `ReceiptScanFlow.tsx:267-270` | |
| 3.2.2 Client validates type/size/duration | 🟡 | `compressImage.ts` (image-only); server validates in each route | Duration **not** validated. Mime sniffing trusts client `file.type` (spoofable). |
| 3.2.3 Client optionally optimizes | 🟡 | `compressImage.ts` for images; **none for video** | Spec calls for client video downscale to 1080p. |
| 3.2.4 Client requests upload session | ❌ | nowhere | No init endpoint; no session concept. |
| 3.2.5 Direct multipart to S3 | ❌ | `media-storage.ts:75-95` | Server uses single `PutObjectCommand`. |
| 3.2.6 Complete multipart | ❌ | nowhere | |
| 3.2.7 Backend marks `uploaded` + enqueues | ❌ | nowhere | Receipt has `status: inbox\|linked` (`schema.prisma:312`) — unrelated domain. |
| 3.2.8 Processor generates renditions/thumb/meta | 🟡 | `post-media.ts:23-37`, `jobs/[id]/photos/route.ts:29-76` | Inline (in-request); single rendition; no metadata extraction beyond what FFmpeg implicitly does. |
| 3.2.9 Asset becomes `ready` and playable | ❌ | nowhere | No state machine. Photo/video rows are created `INSERT`-completed; there's no "not yet ready" state. |
| 3.3 Survive transient network failures | ❌ | nowhere | Single fetch, no retry. |
| 3.3 Retry per failed chunk | ❌ | nowhere | No chunks. |
| 3.3 Resume after restart | ❌ | nowhere | Nothing persisted to localStorage/IDB. |
| 3.3 User cancel/restart | 🟡 | UI cancel buttons only | No upload session to abort. |
| 3.3 Stale sessions expire | ❌ N/A | — | No sessions exist. |

### §4 Non-functional

| Req | Status | Where | Notes |
|---|---|---|---|
| Availability / SLO | ❌ | none | No health/SLO instrumentation. |
| No UI dead-spinners | 🟡 | `ReceiptScanFlow.tsx:36` finite state | But `ReceiptUploadButton.tsx:197` uses `alert()`; FFmpeg-in-request causes real dead spinners on video. |
| Scalability via async queue | ❌ | none | All processing inline in HTTP handler. |
| Observability | ❌ | `console.log("[upload]…")` only | No metrics, no taxonomy codes, no traces. |
| Security: signed URLs | ❌ | `getS3PublicUrl()` (`media-storage.ts:24-29`) | Returns plain `https://<bucket>.s3.<region>.amazonaws.com/<key>` — never signed. |
| Security: short expirations | ❌ | env var `AWS_SIGNED_URL_EXPIRES` defined in `docker-compose.yml:25` but **never read by code** | Dead config. |
| Security: server-side validation | 🟡 | per-route mime + size only | No magic-number sniffing, no duration. |

### §5 Architecture overview

| Component | Status | Where | Notes |
|---|---|---|---|
| Client w/ chunking + resume | ❌ | none | |
| API service for sessions | ❌ | none | |
| `media-raw` + `media-processed` buckets | ❌ | single `AWS_BUCKET` env (`docker-compose.yml:23`) | |
| SQS + workers | ❌ | none | No SDK installed. |
| MediaConvert / FFmpeg pipeline | 🟡 | inline FFmpeg in-process (`post-media.ts`, `jobs/[id]/photos/route.ts`) | Wrong place for it. |
| CloudFront | ❌ | none | |
| DB: assets/sessions/processing | ❌ | nowhere in `schema.prisma` | |

### §6 Data model

| Model | Status | Where | Notes |
|---|---|---|---|
| `assets` table | ❌ | not in `schema.prisma` | Closest are `JobPhoto`, `PostMedia`, `CarPhoto`, `CarDocument`, `JobAttachment`, `Receipt.filename` — six independent rows-with-a-string-filename. |
| `upload_sessions` table | ❌ | not in `schema.prisma` | |
| `status` enum (`created\|uploading\|uploaded\|processing\|ready\|failed`) | ❌ | nowhere | `Receipt.status` is `inbox\|linked` (`schema.prisma:312`) — different domain. `Job.status` (`:167`) is project workflow, not asset workflow. |
| `s3_upload_id`, `part_size_bytes`, `uploaded_parts` (JSON) | ❌ | nowhere | |

### §7 API requirements

| Endpoint | Status | Where |
|---|---|---|
| `POST /v1/uploads/init` | ❌ | none. Closest is `POST /api/receipts` (legacy form post). |
| `POST /v1/uploads/{id}/part-url` | ❌ | none |
| `POST /v1/uploads/{id}/complete` | ❌ | none |
| `POST /v1/uploads/{id}/abort` | ❌ | none |
| `GET /v1/assets/{id}/status` | ❌ | none |

### §8 Client behavior

| Req | Status | Where | Notes |
|---|---|---|---|
| 8 MB chunks, 3–5 parallel | ❌ | none | |
| Retry x5 + backoff + jitter | ❌ | none | |
| Persist upload state locally | ❌ | none | |
| Part timeout 60–120 s | ❌ | none | Browser `fetch` default. |
| Session 24 h | ❌ N/A | — | |

### §9 Optimization

| Req | Status | Where | Notes |
|---|---|---|---|
| Client downscale to 1080p | 🟡 (images only) | `compressImage.ts:7,38-41` | Image-only; max width 1920 not strictly 1080p. |
| Client H.264+AAC | ❌ | none | |
| Client cap FPS 30 | ❌ | none | Server caps to 30 fps in `post-media.ts:30`. |
| Server 1080p ladder | ❌ | `post-media.ts:30` produces single 1280-wide CRF-28 MP4 | |
| Server 720p, 480p | ❌ | none | |
| HLS master + variants | ❌ | none | Single MP4 + webp thumbnail only. |
| Thumbnail | ✅ | `post-media.ts:31`, `jobs/[id]/photos/route.ts:57-69`, plus on-demand `media/thumb` and `uploads/[...path]:65-74` | (Three different code paths do roughly the same thing.) |
| Metadata extraction (duration/dim/codec) | ❌ | none | Only `mediaType: image\|video` string is recorded. |

### §10 State machine

| Transition | Status | Where | Notes |
|---|---|---|---|
| `created → uploading → uploaded → processing → ready` | ❌ | nowhere | No status field on photo/media tables. |
| Failure paths (`uploading→failed`, `processing→failed`) | ❌ | nowhere | Failure = HTTP 4xx/5xx returned to client; row not created. |
| Recovery: re-init upload | ❌ | none | |
| Recovery: requeue processing | ❌ | none | |

### §11 UX

| Req | Status | Where | Notes |
|---|---|---|---|
| Real progress % | ❌ | nowhere | `fetch` does not expose upload progress; code does not use `XMLHttpRequest` or streams. |
| Distinct processing phase | 🟡 | `ReceiptScanFlow.tsx:36` (`uploading\|processing`) | Receipt-only; not generalized. |
| Actionable errors | 🟡 | `ReceiptScanFlow.tsx:225-227` shows error block | `ReceiptUploadButton.tsx:197` uses `alert()`. |
| No indefinite spinner | ⚠️ | violated by inline FFmpeg | A 200 MB video transcode with `preset=veryfast crf=28` will spin the request for minutes. |
| Distinct connectivity / validation / server messages | ❌ | not differentiated | Generic `"Error: " + e.message`. |

### §12 Observability

| Req | Status | Where | Notes |
|---|---|---|---|
| Upload success rate by size bucket | ❌ | none | |
| P50/P95 duration | ❌ | none | |
| Chunk retry rate | ❌ N/A | — | No chunks. |
| Processing success/fail rate | ❌ | none | |
| Time per state | ❌ | none | |
| Error taxonomy (`UPLOAD_NETWORK_TIMEOUT` etc.) | ❌ | error strings are free-form | |
| Alerts | ❌ | none | |

### §13 Security & compliance

| Req | Status | Where | Notes |
|---|---|---|---|
| Presigned URLs 10–15 min | ❌ | env var defined, no code uses it | |
| Server-side type/size validation | 🟡 | each route | Mime trusted from client. |
| Buckets deny public write | ⚠️ **violated** | `media-storage.ts:82` defaults `ACL: "public-read"`; `docker-compose.yml:24` defaults the env var to `public-read` | Receipts (PII) are uploaded with this. |
| Encryption at rest | ❌ | `PutObjectCommand` has no `ServerSideEncryption` | Only present if bucket default policy enforces it. |
| TLS in transit | ✅ | implicit | |
| Malware scanning | ❌ | none | |
| Signed playback URLs | ❌ | `getS3PublicUrl` returns unsigned URL; `uploads/[...path]:135` 307-redirects to it | |

### §14 Rollout — Phase 1 MVP

| Item | Status |
|---|---|
| S3 multipart direct upload | ❌ |
| Retry + resume | ❌ |
| Async processing + thumbnail + 1 rendition | 🟡 (sync, not async) |
| Status endpoint + UI states | ❌ / 🟡 |

### §15 Acceptance criteria

| Criterion | Status | Reasoning |
|---|---|---|
| ≥98% successful uploads <500 MB | ❓ | No metrics. Probable miss given no retry. |
| Zero indefinite UI states | ❌ | Inline FFmpeg + alert() error path. |
| Resume after restart | ❌ | Not implemented. |
| 95% first-playable within SLA | ❓ | No SLA, no instrumentation. |

### §17 Jira/EPIC mapping

| EPIC | Status |
|---|---|
| EPIC-1 Reliable Upload Transport | ❌ 0% |
| EPIC-2 Media Processing Pipeline | 🟡 ~10% (inline FFmpeg exists) |
| EPIC-3 UX/State Machine | 🟡 ~15% (one component has finite state) |
| EPIC-4 Observability & Ops | ❌ 0% |
| EPIC-5 Security Hardening | ⚠️ negative — currently violates §13 |

---

## 3. Incorrect mappings / data inconsistencies

These are bugs *independent* of the spec debate.

### 3.1 ⚠️ S3 / local code paths are asymmetric — breaks processing when S3 is on

`receipts/[id]/process/route.ts:180-181` reads from local disk:
```ts
const filePath = path.join(process.cwd(), "public", "uploads", receipt.filename);
const fileBuffer = await readFile(filePath);
```
But when `isS3Enabled()` is true, `persistMedia` writes **only to S3** (`media-storage.ts:75-95`) — never to local disk. Result: when AWS env vars are set, every receipt scan throws `ENOENT`. **This is a deployment-blocking bug if S3 is enabled.**

Same defect: `media/thumb/route.ts:34` and `receipts/[id]/attach-photo/route.ts:41` both `unlink(path.join(process.cwd(), "public", "uploads", ...))` without checking S3.

**Fix:** add `readMedia(relPath)` and `deleteMedia(relPath)` helpers in `media-storage.ts` that branch on `isS3Enabled()`.

### 3.2 ⚠️ `cars/[carId]/documents` bypasses `persistMedia` entirely

`cars/[carId]/documents/route.ts:74-75` writes raw to disk via `fs/promises.writeFile`. When `AWS_BUCKET` is configured, every other media route mirrors to S3 — but car documents (registrations, insurance, titles) **silently stay only on the local Docker volume**. They will be lost on a host migration / container rebuild without volume backup, and they will not be served correctly via the `uploads/[...path]` S3-fallback redirect (since the file isn't in S3 either, the redirect 307s to a 404).

**Fix:** route through `persistMedia` like every other route does.

### 3.3 ⚠️ `/uploads/[...path]` is unauthenticated AND can serve other users' files

- `middleware.ts:32` matcher excludes the `uploads` prefix → no JWT check.
- `uploads/[...path]/route.ts:36-42` only validates path traversal; it does **not** check that the path's `users/<userId>/...` prefix matches the requesting session.
- Filenames are random UUIDs so it's "URL-by-obscurity" — but receipts (PII), private car documents, and `isPrivate: true` car photos rely on this.
- Worse: when local read fails, `:134` does a 307 redirect to a *public* S3 URL.

**Fix (Phase 0):**
1. Remove `uploads` from middleware exclusion.
2. Inside the route handler, parse `users/<sessionUserId>/...` from `filename` and assert match (or sharing-table membership).
3. Replace S3 redirect with `s3-request-presigner` + signed `GetObjectCommand` URL with 10–15 min expiry per spec §13.

### 3.4 ⚠️ `ACL: "public-read"` is the deployed default

- `media-storage.ts:82`: `ACL: (process.env.AWS_ACL as ...) || "public-read"`.
- `docker-compose.yml:24`: `AWS_ACL: ${AWS_ACL:-public-read}` confirms it's the prod default.

Receipts (`POST /api/receipts`), car documents (titles/insurance), `isPrivate: true` photos — all currently world-readable when S3 is enabled. Direct violation of §13.

**Fix (Phase 0):** Change default to `"private"` (or `undefined`); rely on signed URLs.

### 3.5 ⚠️ FFmpeg / Tesseract / Anthropic / OpenAI calls inside HTTP handlers

| File | Line | Tool | Risk |
|---|---|---|---|
| `app/lib/post-media.ts` | 30 | ffmpeg transcode | Multi-minute on large videos |
| `app/lib/post-media.ts` | 31 | ffmpeg thumbnail | |
| `app/app/api/jobs/[id]/photos/route.ts` | 36-69 | ffmpeg ×2 | duplicate of `post-media.ts` (DRY violation, see §3.7) |
| `app/app/api/media/thumb/route.ts` | 36-45 | ffmpeg | |
| `app/app/uploads/[...path]/route.ts` | 65-74 | ffmpeg on GET | Generating media in a GET handler |
| `app/app/api/receipts/[id]/process/route.ts` | 144-153 | tesseract | |
| `app/app/api/receipts/[id]/process/route.ts` | 247-251 | Anthropic API | |
| `app/app/api/receipts/[id]/process/route.ts` | 23-46 | OpenAI API | |

Holds an HTTP connection open for minutes. On serverless: timeouts. On Node host: blocks event loop on stdio of child processes for the duration. This is the dead-spinner failure mode §1 names explicitly.

### 3.6 Code duplication of `optimizeVideo`

`app/lib/post-media.ts:23-37` and `app/app/api/jobs/[id]/photos/route.ts:29-76` are **two near-identical FFmpeg pipelines**. The job-photos one even re-implements `optimizeImage` (lines 21-27) instead of importing `post-media.optimizeImage`. Drift waiting to happen.

**Fix:** delete the duplicate; import from `lib/post-media.ts`.

### 3.7 Inconsistent file-size limits across routes

| Route | Limit |
|---|---|
| `cars/[carId]/documents` | 20 MB |
| `receipts` | 20 MB |
| `receipts/[id]/attach-photo` | 20 MB |
| `jobs/[id]/attachments` | 20 MB |
| `service-records/[id]/attachments` | 20 MB |
| `jobs/[id]/photos` | 250 MB |
| `posts/[id]/media` | 250 MB |
| Spec | 2 GB |

There's no central config. Adding a new route means re-deciding the limit. Spec wants this configurable per app/tier (§16).

**Fix:** single `app/lib/media-limits.ts` exporting per-area caps.

### 3.8 Polymorphic `JobAttachment` carries both `jobId` and `serviceRecordId`

`schema.prisma:192-206`: `JobAttachment` has nullable `jobId` *and* nullable `serviceRecordId`. There's no `CHECK (jobId IS NOT NULL OR serviceRecordId IS NOT NULL)` constraint. A buggy write could create an orphaned attachment with both null — visible in `service-records/[id]/attachments/route.ts:81` which explicitly sets `jobId: null`.

**Fix:** add an application-level invariant test, or refactor to `Attachment` polymorphic with a discriminator.

### 3.9 `Receipt.filename` is a string, not a foreign key

`schema.prisma:307` — `Receipt.filename String?`. Same for `JobPhoto.filename` (`:571`), `PostMedia.filename` (`:619`), `CarPhoto.filename` (`:151`), `CarDocument.filename` (`:107`), `JobAttachment.filename` (`:200`). Six tables each holding a string path with no referential integrity. If we adopt the spec's `assets` model, every one of these needs an `assetId` FK migration.

### 3.10 `requireSession()` redirects on API routes

`session.ts:31`: `if (!session) redirect("/login")`. `redirect()` in Next.js throws a `NEXT_REDIRECT` error. Routes catch it as `try/catch` and convert to 401. **It works but is fragile** — if Next.js's internal error name changes, every API route silently 500s. Should use `getSession()` and explicit 401.

### 3.11 Dead config: `AWS_SIGNED_URL_EXPIRES`

`docker-compose.yml:25` defines `AWS_SIGNED_URL_EXPIRES=900`. Grep across codebase: zero reads. The author intended signed URLs but didn't implement them.

### 3.12 PRD ↔ requirements doc contradiction

- `PRD.md §17` (March 2026): "Out of scope: ... S3, ... video, ..."
- `media-upload-pipeline-requirements.md` (May 2026): mandates S3 multipart, video transcoding ladder, CloudFront.

The team appears to have changed direction without updating the PRD. **Resolve in writing before doing the work.**

---

## 4. Search / indexing risks

The spec doesn't directly call out search, but the data model gaps will block any future search/discovery feature.

| Risk | Where | Impact |
|---|---|---|
| No unified `Asset` table → can't index "all media uploaded by user X" | `schema.prisma` overall | UNION across 6 tables every query, or de-norm later. |
| No `mime_type`, `size_bytes`, `duration_ms` columns | none of the photo/media tables | Spec §6 lists these as required asset metadata. Cannot filter "videos under 30 s" or "images > 5 MB". |
| `mediaType` is a string `"image" \| "video"` (`JobPhoto:572`, `PostMedia:620`) | no enum, no audio, no doc | Future ReceiptDocument or AudioNote will require schema changes. |
| Receipt OCR text is **never persisted** | `receipts/[id]/process/route.ts` returns text but only stores derived fields (vendor/total/items) | Free-text full-text search across receipts impossible. SQLite FTS5 is supported by Prisma — easy to add. |
| `Receipt.notes` and `ReceiptLineItem.name` are searchable but no FTS index | `schema.prisma:303-337` | LIKE-only on SQLite is fine for personal scale; flag if multi-user. |
| `sortOrder` ties on `JobPhoto`/`PostMedia` (`:577`, `:624`) | Integer with default 0 | When user uploads two photos in the same request and `count + i` collides with existing rows, duplicate `sortOrder` values appear. Already happening: `posts/[id]/media:34` uses `count + i` with no transaction. Listing order becomes nondeterministic. |
| Filename is the de-facto "URL" | scattered | If we ever rename a file (e.g., when promoting to a CDN-friendly path), every embedded reference in `ServiceRecord.notes` / `Job.notes` / etc. breaks. |
| No indexes on `userId, createdAt` for `Receipt`, `CarPhoto`, `JobAttachment` | `schema.prisma` | Inbox queries (`receipts/route.ts:35-39`) will full-scan as data grows. Posts already have it (`:610-611`). |
| No `failedReason` / `errorCode` field anywhere | per spec §12 / §6 | Failed uploads disappear; users can't diagnose. |

---

## 5. The 24-hour patch plan (urgent — security & reliability)

**Goal:** stop the two bleeding issues today, no architectural rewrite required.

### Patch A — Kill `public-read`, move to private-by-default
**Effort:** S (≈2 h)
**Owner:** backend
**Files:**
1. `app/lib/media-storage.ts:82` — change `|| "public-read"` to `|| undefined` (no ACL → bucket default).
2. `docker-compose.yml:24` — change `${AWS_ACL:-public-read}` to `${AWS_ACL:-}` and document it.
3. Add `app/lib/media-storage.ts::getSignedReadUrl(relPath, expiresInSec = 600)` using `@aws-sdk/s3-request-presigner` (new dep).
4. `app/app/uploads/[...path]/route.ts:134-136` — replace public redirect with signed redirect using `getSignedReadUrl(filename, 600)`.
5. Add `ServerSideEncryption: "AES256"` to `PutObjectCommand` (`media-storage.ts:77-83`).
6. Bucket-level: ensure block-public-access is on (operational task, document in `STAGING_SETUP.md`).

**Acceptance:**
- After deploy, `curl https://<bucket>.s3...amazonaws.com/<key>` returns 403.
- `curl -I https://<host>/uploads/<key>` returns 307 with a `?X-Amz-Signature=…` Location header.
- New uploads have `x-amz-server-side-encryption: AES256` (verify via `aws s3api head-object`).

**Rollback:** revert 6 files; no schema change.

### Patch B — Stop request-path FFmpeg for large uploads
**Effort:** S (≈3 h)
**Owner:** backend
**Files:**
1. `app/lib/media-storage.ts` — add `MAX_INLINE_VIDEO_BYTES = 50 * 1024 * 1024` (configurable).
2. `app/app/api/jobs/[id]/photos/route.ts:131-140` — if `isVideo && rawBuffer.length > MAX_INLINE_VIDEO_BYTES`, persist raw video as-is, set `mediaType: "video"`, **add a new `processingStatus: "pending"`** column on `JobPhoto` (one-line schema migration), and skip transcoding. Return 202 with status URL.
3. Same change in `app/app/api/posts/[id]/media/route.ts:25-32`.
4. Add a feature flag `INLINE_VIDEO_TRANSCODE=false` (env). When false, **all** videos skip inline transcode.
5. Add `app/scripts/process-pending-media.ts` — Node script that polls `JobPhoto`/`PostMedia` where `processingStatus = "pending"`, runs the existing `optimizeVideo`, persists thumb + transcoded MP4, sets `processingStatus = "ready"`. Wire to `cron` or systemd timer (no queue needed for v0).
6. UI: surface `processingStatus` so the user sees "Processing… (will be ready in a few minutes)" instead of a frozen request.

**Acceptance:**
- Uploading a 200 MB MP4 returns within ~30 s (raw upload + DB write only).
- A subsequent `process-pending-media.ts` run produces the transcoded output.
- Setting `INLINE_VIDEO_TRANSCODE=false` skips transcode for *all* sizes; row gets `processingStatus = "pending"`.

**Rollback:** flip env var to true; existing inline path unchanged.

---

## 6. Top 10 tickets (ordered by risk reduction)

| # | Title | Owner role | Files touched | Acceptance criteria | Effort | Blocking deps |
|---|---|---|---|---|---|---|
| 1 | **Default S3 ACL → private + signed read URLs** | Backend | `lib/media-storage.ts`, `app/uploads/[...path]/route.ts`, `docker-compose.yml`, `package.json` (+`@aws-sdk/s3-request-presigner`), `STAGING_SETUP.md` | (see Patch A above) | S | none |
| 2 | **Auth-gate `/uploads/[...path]`** | Backend | `middleware.ts`, `app/uploads/[...path]/route.ts` | `GET /uploads/...` requires session; user A cannot read user B's filename even if guessed. Add test fixture. | S | #1 (so we still have signed URLs for legit cross-user sharing later) |
| 3 | **Fix S3/local read asymmetry in receipt processing** | Backend | `lib/media-storage.ts` (add `readMedia`, `deleteMedia`), `api/receipts/[id]/process/route.ts:180`, `api/receipts/[id]/attach-photo/route.ts:41`, `api/media/thumb/route.ts:34` | Receipt scan works with `AWS_BUCKET` set. Integration test: upload → enable S3 → process → expect 200. | S | none |
| 4 | **Move FFmpeg out of request path (feature-flagged)** | Backend | `lib/post-media.ts`, `api/jobs/[id]/photos/route.ts`, `api/posts/[id]/media/route.ts`, `prisma/schema.prisma` (+ `processingStatus`), `scripts/process-pending-media.ts`, `Dockerfile` (cron) | (see Patch B above) | M | #3 |
| 5 | **Route `cars/[carId]/documents` through `persistMedia`** | Backend | `api/cars/[carId]/documents/route.ts` | Documents land in S3 when enabled; verify via `aws s3 ls`. | S | none |
| 6 | **Centralize media size/type config** | Backend | new `lib/media-limits.ts`; refactor 9 routes to import | All routes import limits; single edit point; default ≤20 MB doc, ≤500 MB video, configurable per env. | S | none |
| 7 | **Add Asset + UploadSession Prisma models** | Backend | `prisma/schema.prisma`, new migration, `lib/assets.ts` | `Asset { id, userId, type, status, mime, size, durationMs, key, thumbKey, errorCode, createdAt }` + `UploadSession { id, assetId, s3UploadId, partSize, totalParts, partsJson, expiresAt, status }`. Existing `JobPhoto` etc. get nullable `assetId` FK. | M | #4 |
| 8 | **Implement `/api/uploads/init`, `/part-url`, `/complete`, `/abort`** | Backend | new routes under `app/app/api/uploads/`, `lib/media-storage.ts` (multipart helpers using `@aws-sdk/client-s3` + `s3-request-presigner`) | E2E: client picks 200 MB file, gets session, uploads in 25× 8 MB parts, completes, sees `Asset.status=uploaded`. | M | #7 |
| 9 | **Resumable client uploader** | Frontend | new `app/app/lib/uploader.ts`, refactor `ReceiptUploadButton.tsx`, `ReceiptScanFlow.tsx`, `JobPhotosUpload`, `PostMediaUpload` | Network drop mid-upload → reconnect → upload resumes. Persist session state in IndexedDB. Real progress %. Retry x5 with jitter on 5xx/408/429. | L | #8 |
| 10 | **Asset state-machine + status endpoint + UI** | Full-stack | `lib/assets.ts`, `api/assets/[id]/status/route.ts`, components | Asset transitions `created→uploading→uploaded→processing→ready` (or `failed`). UI shows "Processing..." badge until ready. Failure surfaces error code from §12 taxonomy. | M | #4, #7 |

**Bonus / phase-2:**
- HLS ladder + MediaConvert (only if multi-user public video is in roadmap — currently `PRD.md §17` says no).
- SQS / BullMQ replacement for the `process-pending-media.ts` cron.
- Metrics emitter + dashboards.
- Magic-number MIME sniffing.
- Optional malware scanning for non-video.

---

## 7. Appendix — required env vars after Patch A

```env
# Existing
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET=...
# CHANGE
AWS_ACL=               # leave blank = use bucket default; remove "public-read"
AWS_SIGNED_URL_EXPIRES=600   # now actually read by code
# NEW
INLINE_VIDEO_TRANSCODE=false
MAX_INLINE_VIDEO_BYTES=52428800
```

---

## 8. Open questions for the owner

1. Is the requirements doc a **contract** for `car-maintenance` or general guidance? (`PRD.md §17` says S3/video are out of scope.)
2. Single-tenant personal app vs. eventual multi-user public sharing? Determines whether HLS / CloudFront / MediaConvert are warranted.
3. Acceptable hosting model: keep Docker Compose + sqlite, or move to RDS + ECS? Determines worker tech (cron vs. SQS).
4. SLA: what is "ready" within for a 5-min 1080p video? (Spec §16 leaves it open.)
5. PII handling for receipts — is GDPR / CCPA in scope? Drives encryption + retention requirements.
