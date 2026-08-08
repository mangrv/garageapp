# Senior QA Analyst Review — Media Upload Pipeline

**App under review:** `workspace/apps/personal/car-maintenance` (Garage Work Manager)
**Source documents:**
- `workspace/requirements/media-upload-pipeline-requirements.md`
- `workspace/apps/personal/car-maintenance/SENIOR_LEAD_DEVELOPER_REVIEW.md`
**Reviewer:** Cline (acting Senior QA Analyst)
**Date:** 2026-05-01
**Status:** Draft v1 — test plan, risk register, ticket breakdowns

---

## 0. Scope & method

This document follows directly from the senior-lead review and assumes its findings (S3 ACL public-read default, S3↔local asymmetry, no multipart/no resume/no async pipeline, etc.). The QA scope is **what we must verify in test before release**, not what we want to build.

It is split into four parts:
1. **Test strategy & environments** (§1)
2. **Test case catalogue** (§2) — ~80 cases, traceable to requirements
3. **Release risk register** (§3) — what can blow up in prod, ranked
4. **Ticket breakdowns** (§4) — fixes mapped to acceptance + test cases

Test ID convention: `TC-<area>-<NNN>` where area ∈ `{SEC, UPL, RES, PROC, UX, OBS, REG, PERF, COMPAT, A11Y}`.

---

## 1. Test strategy & environments

### 1.1 Test environments
| Env | Purpose | Notes |
|---|---|---|
| **Local-dev** | Devs run `npm run dev` | SQLite at `app/prisma/dev.db`; uploads to local FS. **No S3.** |
| **Local-S3** | Manual S3 enabled via `.env.docker` | Dev's own bucket; required for any S3-path test |
| **Staging** | `docker-compose.staging.yml` | Mirror of prod; wired to staging bucket; **must** flip to private-by-default before any external user touches it |
| **Prod** | `192.168.1.198:3011` | Single-tenant personal PWA today; expanding to multi-user per `MULTIUSER_SHARING_PLAN.md` |

### 1.2 Test data / fixtures (must be prepared)
- 12 fixture files: `1B`, `100KB`, `1MB`, `19MB`, `20MB+1B`, `100MB`, `250MB`, `500MB`, `1GB`, `2GB`
- Mixed types: `.jpg`, `.png`, `.heic`, `.webp`, `.gif`, `.pdf`, `.mp4` (H.264/AAC), `.mov`, `.webm`, `.mkv`
- Adversarial: `.jpg` extension w/ EXE magic bytes; `.pdf` w/ embedded JS; PDF declared as `image/jpeg`; 11-min H.264; 30-min H.264; HEIF from iPhone
- Two test users (`userA`, `userB`) with separate sessions for cross-tenant tests
- Network shaping profiles: `4G-good`, `4G-poor (200ms RTT, 1% loss)`, `flaky (kills 1 in 5 chunks)`, `offline-then-online`

### 1.3 Tooling
- **Backend integration**: `node --test` (already wired) + `supertest` + `prisma migrate reset` per suite
- **Browser/E2E**: Playwright (recommend adding) — Chrome + Mobile Safari emulation (iOS PWA matters per PRD §14)
- **Network shaping**: Chrome DevTools or `tc qdisc netem` in container
- **S3 mock/test**: localstack or MinIO container in CI; real bucket for staging
- **Visual regression**: optional Percy/Chromatic for upload UI states

### 1.4 Entry / exit criteria

**Entry to QA cycle:**
- All Patch A and Patch B fixes from senior-lead review are merged.
- Migrations applied to staging.
- Test data fixtures uploaded to a known location.

**Exit (release) gates:**
- 100% of P0 tests pass (see §2).
- No open P0/P1 bugs.
- ≥ 95% of P1/P2 tests pass.
- Security tests TC-SEC-001 through TC-SEC-008 pass on a *real* S3 bucket (not mock).
- Manual smoke test of all 9 upload entry points on iOS Safari PWA.

---

## 2. Test case catalogue

Each row: ID · Title · Priority (P0/P1/P2) · Type (Func/Sec/Perf/Reg/Compat/Neg) · Preconditions · Steps · Expected · Traces to.

### 2.1 Security & access control (TC-SEC) — must all pass before any external user

| ID | Title | P | Type | Preconditions | Steps | Expected | Traces |
|---|---|---|---|---|---|---|---|
| TC-SEC-001 | S3 object not world-readable after upload | P0 | Sec | Staging w/ S3 + Patch A | 1) Upload receipt as `userA`. 2) Note S3 key. 3) Hit `https://<bucket>.s3...amazonaws.com/<key>` from anonymous client. | 403 AccessDenied. | Spec §13, Lead §3.4 |
| TC-SEC-002 | `/uploads/<path>` requires session | P0 | Sec | Patch A | 1) Upload as `userA`. 2) Capture URL. 3) `curl` w/o cookie. | 401/redirect to /login. | Lead §3.3 |
| TC-SEC-003 | `/uploads/<path>` cross-tenant denied | P0 | Sec | 2 users seeded | 1) `userA` uploads. 2) `userB` GETs `userA`'s URL using `userB` cookie. | 403. No bytes leaked. | Lead §3.3 |
| TC-SEC-004 | Signed playback URL expires | P1 | Sec | Patch A signed-URL impl | 1) Get signed URL via `/uploads/...`. 2) Wait 16 min. 3) Fetch. | 403 SignatureExpired (or per `AWS_SIGNED_URL_EXPIRES`). | Spec §13 |
| TC-SEC-005 | New uploads have SSE-AES256 | P0 | Sec | Patch A | 1) Upload. 2) `aws s3api head-object`. | `ServerSideEncryption: AES256` header present. | Spec §13 |
| TC-SEC-006 | Path traversal blocked | P0 | Sec | — | `GET /uploads/../../etc/passwd` and URL-encoded variants. | 403. | Existing `uploads/[...path]:36-42` |
| TC-SEC-007 | Mime spoof rejected | P1 | Sec | — | Upload `evil.exe` renamed to `.jpg` w/ `Content-Type: image/jpeg`. | Server validates magic bytes → 400. **NOTE: currently passes — bug.** | Spec §13, Lead §3 (mime trusted) |
| TC-SEC-008 | Receipts (PII) never logged in plain | P1 | Sec | — | Tail container logs while uploading; assert no full filename, no card-last-4 lines, no OCR vendor names. | Logs are key/size only. | OWASP A09 |
| TC-SEC-009 | Bucket public-write denied | P1 | Sec | — | `aws s3 cp` from credentials w/o write perms to bucket root. | 403. | Spec §13 "Buckets deny public write" |
| TC-SEC-010 | TLS enforced on /uploads | P2 | Sec | — | `curl -v http://...` (no S). | Redirect to https or 426. | Spec §13 |
| TC-SEC-011 | Auth removed from PUBLIC list bypass attempt | P1 | Sec | — | `GET /uploads/foo` with `Origin: /share/abc` header trick. | Still 401. | Lead §3.3 |
| TC-SEC-012 | Signed URL not reusable across users | P1 | Sec | — | `userA` gets signed URL; sends to `userB`. | URL works (signature is bearer) — **document this** in user-facing docs as expected; advise short expiry. | Spec §13 risk |

### 2.2 Upload happy paths (TC-UPL)

| ID | Title | P | Type | Steps | Expected | Traces |
|---|---|---|---|---|---|---|
| TC-UPL-001 | Image JPEG ≤ 1 MB to receipts | P0 | Func | Upload via `ReceiptUploadButton`. | 200; `Receipt` row created; file readable via `/uploads/...`. | §3.2 |
| TC-UPL-002 | HEIC iPhone photo | P0 | Func | Upload `.heic` to car photos. | Persisted; thumbnail generated (auto-fallback path). | §3.1 |
| TC-UPL-003 | PNG to job/photos | P0 | Func | | Stored as `.webp` after sharp optimize. | `post-media.ts:15-21` |
| TC-UPL-004 | PDF to receipts | P0 | Func | | Stored as PDF; OCR skipped, AI used. | `process/route.ts:288-306` |
| TC-UPL-005 | MP4 video ≤ 50 MB to job/photos | P0 | Func | | Inline transcode runs; thumbnail generated; row created with both files in S3. | §9 |
| TC-UPL-006 | MP4 video > 50 MB to job/photos (post Patch B) | P0 | Func | Feature flag on. | Returns 202; row has `processingStatus: pending`; cron later marks `ready`. | Lead Patch B |
| TC-UPL-007 | Multi-file batch upload (5 receipts) | P1 | Func | `ReceiptUploadButton` multi-select 5 files. | All 5 process in parallel; UI shows 5 ready states. | `ReceiptUploadButton.tsx:142` |
| TC-UPL-008 | Camera capture (mobile) | P0 | Func | iOS Safari PWA; tap "Take photo". | Capture works; HEIC accepted; preview rendered. | `ReceiptScanFlow.tsx:267` |
| TC-UPL-009 | Cars/documents PDF | P1 | Func | Upload registration PDF to a car. | Stored to S3 (post-fix #5); 201 returned. | Lead §3.2 |
| TC-UPL-010 | All 9 upload entry points reachable | P0 | Func | Smoke each route once. | All 200/201. | Lead §1 table |

### 2.3 Upload validation / negative paths (TC-UPL-NEG)

| ID | Title | P | Type | Steps | Expected | Traces |
|---|---|---|---|---|---|---|
| TC-UPL-NEG-001 | Reject 20 MB+1 to receipts | P0 | Neg | Upload 21 MB JPG to `/api/receipts`. | 400 "File too large". | `receipts/route.ts:71-72` |
| TC-UPL-NEG-002 | Reject .exe | P0 | Neg | | 400 "Unsupported file type". | `receipts/route.ts:74-76` |
| TC-UPL-NEG-003 | Reject 0-byte | P1 | Neg | Empty file. | 400 (or skipped silently in batch). Verify *not* persisted. | `receipts/route.ts:70` |
| TC-UPL-NEG-004 | Reject 251 MB video to posts | P0 | Neg | 260 MB MP4. | 400. | `post-media.ts:9` |
| TC-UPL-NEG-005 | Reject 2.1 GB to posts | P0 | Neg | 2.1 GB MP4. | 400 (or 413). Test we don't crash Node w/ OOM during `formData()` parse. | Lead §3 |
| TC-UPL-NEG-006 | Reject 11-min video | P0 | Neg | (Post duration validation) 11-min MP4. | 400 "Duration exceeds limit". **Currently passes** — bug. | Spec §3.1 |
| TC-UPL-NEG-007 | Unauthenticated upload | P0 | Neg | No cookie. | 401. | Each route's `requireSession()` |
| TC-UPL-NEG-008 | Cross-user attempt | P0 | Neg | `userB` POSTs to `/api/cars/<userA-carId>/photos`. | 404. | `cars/[carId]/photos/route.ts:21` |
| TC-UPL-NEG-009 | Empty multipart body | P1 | Neg | `POST /api/receipts` with no `file` field. | 200, but `Receipt.filename = null` (current behavior). Document in API spec. | `receipts/route.ts:70` |
| TC-UPL-NEG-010 | Mid-upload connection drop | P0 | Neg | Drop TCP at 50%. | Server returns error; **current**: failed file may sit half-written; **expected post-multipart**: client resumes. | §3.3 |
| TC-UPL-NEG-011 | Concurrent batch reorder collision | P1 | Neg | Two users adding photos to same job at same time. | No 5xx; sortOrder may collide (known bug per Lead §4). Track. | `posts/[id]/media:34` |

### 2.4 Reliability / resume / retry (TC-RES) — **most are NEW post-Phase 1**

| ID | Title | P | Type | Steps | Expected | Traces |
|---|---|---|---|---|---|---|
| TC-RES-001 | Single chunk 5xx → retry succeeds | P0 | Func | (Post #8) Force S3 to 503 on part 3. | Client retries with backoff; upload succeeds w/in 5 attempts. | Spec §8 |
| TC-RES-002 | All retries exhausted → user-facing error | P0 | Func | Force 503 indefinitely on part 3. | UI shows `UPLOAD_PART_FAILED`, actionable retry button. | Spec §8, §11, §12 |
| TC-RES-003 | 429 backoff respects `Retry-After` | P1 | Func | S3 returns 429 + Retry-After: 5. | Client honors header before next attempt. | Spec §8 |
| TC-RES-004 | Resume after refresh | P0 | Func | Upload 200 MB, refresh at 50%. | UI shows resume option; remaining parts upload; final asset is byte-identical to original. | Spec §3.3, §8 |
| TC-RES-005 | Resume after browser quit | P0 | Func | Same as 004 but kill tab. | IndexedDB-persisted session resumes on next open. | Spec §3.3 |
| TC-RES-006 | Cancel mid-upload aborts S3 multipart | P0 | Func | Click Cancel at 30%. | `POST /api/uploads/<id>/abort` called; S3 multipart aborted (verify `aws s3api list-multipart-uploads` is empty after 1 min). | Spec §7.4 |
| TC-RES-007 | Stale session (24h+) rejected | P1 | Func | Manipulate DB `expires_at` < now. | `/part-url` returns 410; client shows "Re-init upload". | Spec §8 |
| TC-RES-008 | Network flap during 3 parallel parts | P0 | Func | Toggle offline/online for 10s during parts 5-7. | All 3 retry independently; final upload OK. | Spec §8 |
| TC-RES-009 | Throttled to 256 kb/s — no timeout | P1 | Perf | 8 MB part on 256 kbps = ~4 min. | Part timeout configurable to 300s; succeeds. | Spec §8 timeout 60-120s |
| TC-RES-010 | iPhone Safari PWA backgrounded mid-upload | P0 | Compat | Start upload, swipe to home, return at 60s. | Upload resumes (Service Worker / persisted state). | PRD §14 |

### 2.5 Async processing (TC-PROC)

| ID | Title | P | Type | Steps | Expected | Traces |
|---|---|---|---|---|---|---|
| TC-PROC-001 | After upload, asset → uploaded → processing → ready | P0 | Func | Poll `/api/assets/<id>/status` every 2s. | State transitions visible in DB and UI. | Spec §10 |
| TC-PROC-002 | Processing failure → asset.status=failed w/ errorCode | P0 | Func | Force ffmpeg to fail (corrupt input). | `errorCode = PROCESS_TRANSCODE_FAILED`; UI offers requeue. | Spec §12 taxonomy |
| TC-PROC-003 | Worker requeue brings failed asset to ready | P1 | Func | Operator hits requeue. | New transcode run; `status → ready`. | Spec §10 |
| TC-PROC-004 | Receipt OCR with S3-only storage works | P0 | Func | Enable S3, upload receipt, hit `/process`. | Returns extracted JSON; **currently fails** with ENOENT. | Lead §3.1 |
| TC-PROC-005 | Receipt OCR fallback chain (Tesseract → Anthropic → OpenAI) | P1 | Func | Force Tesseract low confidence; force Anthropic 500. | OpenAI fallback used; `method: openai` in response. | `process/route.ts:288-306` |
| TC-PROC-006 | Thumbnail generated for video | P0 | Func | Upload MP4. | `<key>.thumb.webp` exists in S3 / disk. | `post-media.ts:31` |
| TC-PROC-007 | Thumbnail self-heal on miss | P1 | Func | Delete thumb from S3, GET it. | Re-generated on demand. | `uploads/[...path]:50-85` (currently local-only — needs S3-aware) |
| TC-PROC-008 | Idempotent processor (re-run safe) | P1 | Func | Run worker twice on same pending asset. | Second run is no-op or overwrite; no duplicate thumbs. | Spec §10 |
| TC-PROC-009 | Processor crash recovery | P1 | Func | Kill worker mid-transcode. | Asset stays `processing`; next poll picks it up. | Spec §10 |
| TC-PROC-010 | Concurrent worker safety | P1 | Func | Two workers poll same `pending` row. | DB lock or `claim` field prevents double-work. | Spec §5 |

### 2.6 UX / state machine (TC-UX)

| ID | Title | P | Type | Steps | Expected | Traces |
|---|---|---|---|---|---|---|
| TC-UX-001 | Real % progress on chunked upload | P0 | Func | Upload 200 MB w/ throttling. | UI bar moves smoothly; % matches bytes sent. | Spec §11 |
| TC-UX-002 | Distinct "Uploading" vs "Processing" states | P0 | Func | Upload + observe. | Two clear UI labels with timestamp. | Spec §1, §11 |
| TC-UX-003 | No indefinite spinner | P0 | Func | Force 30-min ffmpeg job. | Pre-Patch B: regression we are fixing. Post: UI says "Processing — ETA ~5 min", never frozen. | Spec §1, §11 |
| TC-UX-004 | Connectivity error message distinct | P1 | Func | Disconnect Wi-Fi. | "Connection lost — will retry" (not generic alert). | Spec §11 |
| TC-UX-005 | Validation error message distinct | P1 | Func | Upload .exe. | "File type not supported" inline; not alert(). | Spec §11 |
| TC-UX-006 | Server/transcoding error distinct | P1 | Func | Force 500 from /init. | "Server error — try again" with errorCode visible to support. | Spec §11 |
| TC-UX-007 | iOS PWA — file picker works | P0 | Compat | Add to home screen; tap upload. | File picker opens; camera capture works. | PRD §14 |
| TC-UX-008 | Drag-and-drop (desktop) | P2 | Func | DnD a file onto upload zone. | Same flow as picker. | Optional |
| TC-UX-009 | Receipt: AI-filled fields editable post-scan | P1 | Func | Scan receipt → fields populate → edit total → save. | DB updated to manual value. | `ReceiptScanFlow.tsx:124-168` |
| TC-UX-010 | "Saved" toast disappears 3s | P2 | Func | | UX consistency. | — |

### 2.7 Observability & error taxonomy (TC-OBS)

| ID | Title | P | Type | Steps | Expected | Traces |
|---|---|---|---|---|---|---|
| TC-OBS-001 | Upload success increments metric | P1 | Func | Upload, query metrics endpoint. | Counter +1 by size bucket. | Spec §12 |
| TC-OBS-002 | Upload P95 duration recorded | P2 | Func | 100 uploads. | Histogram populated. | Spec §12 |
| TC-OBS-003 | Failure emits `UPLOAD_PART_FAILED` | P0 | Func | Force part failure. | Metric tag includes errorCode. | Spec §12 taxonomy |
| TC-OBS-004 | Alert fires when failure rate > 5%/15m | P1 | Func | Inject 6 failures over 15m. | Alert delivered (Slack/email/etc.). | Spec §12 |
| TC-OBS-005 | Worker queue lag metric | P2 | Func | Pause worker; queue grows. | `processing_queue_lag_ms` reflects oldest pending. | Spec §12 |
| TC-OBS-006 | Logs are structured JSON | P1 | Func | `docker logs` during upload. | Each line is JSON with `event`, `userId` (hashed), `assetId`, `errorCode?`. | Spec §4 |

### 2.8 Regression — existing happy paths must still work (TC-REG)

| ID | Title | P | Type | Why |
|---|---|---|---|---|
| TC-REG-001 | Existing receipts can still be viewed | P0 | Reg | Don't break inbox after migration. |
| TC-REG-002 | Existing job photos still display | P0 | Reg | Same. |
| TC-REG-003 | Existing video thumbnails self-heal still works | P1 | Reg | `uploads/[...path]:50-85`. |
| TC-REG-004 | Range requests on video unchanged | P0 | Reg | iOS scrubbing depends on it (`uploads/[...path]:87-124`). |
| TC-REG-005 | Service-record attachments listing | P1 | Reg | `service-records/[id]/attachments` GET. |
| TC-REG-006 | Receipt → service-record linking | P1 | Reg | `ReceiptScanFlow` "apply" path. |
| TC-REG-007 | Photo reorder PATCH | P1 | Reg | `posts/[id]/media:39-49`. |
| TC-REG-008 | Set-public bulk visibility on job photos | P1 | Reg | `jobs/[id]/photos:190-201`. |
| TC-REG-009 | Backup/restore round-trip | P1 | Reg | `backups/uploads.20260428-154218.tgz`. After migration, restore must still work. |
| TC-REG-010 | Existing local-only files still served | P0 | Reg | Pre-migration files in `staging/uploads/` continue to work. |

### 2.9 Performance (TC-PERF)

| ID | Title | P | Type | Target | Tool |
|---|---|---|---|---|---|
| TC-PERF-001 | 100 MB upload P95 < 2× theoretical at 50 Mbps | P1 | Perf | < 35 s on 50 Mbps | Playwright + tc netem |
| TC-PERF-002 | 3 concurrent 100 MB uploads don't OOM container | P0 | Perf | RSS < 1 GB | Container `docker stats` |
| TC-PERF-003 | Receipt OCR latency P95 < 8 s | P1 | Perf | per `process/route.ts` chain | k6 |
| TC-PERF-004 | Cold-start: first upload after deploy | P2 | Perf | < 3 s overhead | — |
| TC-PERF-005 | Inline ffmpeg 50 MB → < 60 s | P1 | Perf | guarded by Patch B | — |
| TC-PERF-006 | DB query: receipts list with 10k rows | P2 | Perf | < 200 ms | Re-run after adding `(userId, createdAt)` index |

### 2.10 Compatibility (TC-COMPAT)

| ID | Browser/Device | P | Cases |
|---|---|---|---|
| TC-COMPAT-001 | iOS Safari 17 PWA | P0 | TC-UX-007, TC-RES-010, TC-UPL-008 |
| TC-COMPAT-002 | Chrome 120 desktop | P0 | All UX |
| TC-COMPAT-003 | Android Chrome | P1 | All UX |
| TC-COMPAT-004 | macOS Safari 17 | P1 | All UX |
| TC-COMPAT-005 | Firefox 120 | P2 | Smoke |
| TC-COMPAT-006 | Slow CPU throttle 4× | P1 | Compress timeout `compressImage.ts:10` |

### 2.11 Accessibility (TC-A11Y)

| ID | Title | P | Notes |
|---|---|---|---|
| TC-A11Y-001 | Upload button keyboard-reachable | P1 | tab + enter |
| TC-A11Y-002 | Progress announced to screen readers | P2 | aria-live region |
| TC-A11Y-003 | Error messages have `role="alert"` | P1 | replaces `alert()` |

---

## 3. Release risk register

Ranked by `(impact × likelihood)`. Impact: 1 = cosmetic, 5 = data loss / security breach. Likelihood: 1 = rare, 5 = certain.

| ID | Risk | Impact | Likelihood | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | **Receipts uploaded with `ACL: public-read`** — vendor names, totals, addresses world-readable | 5 | 5 (default in compose) | 25 | Patch A; TC-SEC-001/005/009 must pass | Backend |
| R-02 | **`/uploads/[...path]` allows cross-tenant reads** — any user can fetch any other user's filename if guessed/leaked | 5 | 4 | 20 | Ticket #2; TC-SEC-002/003 | Backend |
| R-03 | **Receipt OCR breaks the moment S3 is enabled** (ENOENT in `process` route) | 4 | 5 (env-dependent) | 20 | Ticket #3; TC-PROC-004 | Backend |
| R-04 | **Inline ffmpeg → request timeout / dead spinner on first big video** | 4 | 5 | 20 | Patch B; TC-UX-003, TC-PERF-005 | Backend |
| R-05 | **`car/documents` not mirrored to S3** — host migration silently loses titles/registrations | 5 | 3 | 15 | Ticket #5; TC-UPL-009 + restore drill | Backend / Ops |
| R-06 | **No retry on flaky networks** — failure rate dominated by single TCP blip | 3 | 5 | 15 | Ticket #9; TC-RES-001/002/008 | Frontend |
| R-07 | **No resume** — user loses 200 MB upload to a phone reboot | 3 | 4 | 12 | Ticket #9; TC-RES-004/005/010 | Frontend |
| R-08 | **`req.formData()` OOMs on >1 GB uploads** — entire container dies, takes other users with it | 5 | 2 (only if user tries) | 10 | Ticket #8 — multipart removes the buffering; cap at limits.ts | Backend |
| R-09 | **Mime trusted from client** — adversary uploads disguised executable to PDF route | 4 | 2 | 8 | Add magic-byte sniff; TC-SEC-007 | Backend |
| R-10 | **No SSE-AES256** — depending on bucket policy, data could be unencrypted at rest | 4 | 2 | 8 | Patch A step 5; TC-SEC-005 | Backend |
| R-11 | **`AWS_SIGNED_URL_EXPIRES` env exists but is dead** — false sense of security | 3 | 3 | 9 | Patch A step 3 (actually use it) | Backend |
| R-12 | **Inconsistent size caps** — users get "20 MB" error on receipts but "250 MB" on posts | 2 | 4 | 8 | Ticket #6 (centralize) | Backend |
| R-13 | **`requireSession()` swallows non-auth errors** as 401 | 3 | 2 | 6 | Refactor to explicit `getSession()`; tests stay green | Backend |
| R-14 | **sortOrder collisions** in posts/job photos under concurrent uploads | 2 | 3 | 6 | Wrap in transaction; recalc max(sortOrder) under lock | Backend |
| R-15 | **No malware scanning** — PDFs with embedded JS get served back to other users | 4 | 1 | 4 | Phase-2; ClamAV sidecar | Ops |
| R-16 | **iOS Safari Service Worker / IndexedDB quirks** — resumable uploads may not survive long backgrounding | 3 | 3 | 9 | TC-RES-010, TC-COMPAT-001; require manual device test | QA / Frontend |
| R-17 | **Backup tarball doesn't include S3 contents** — restore drill drops cloud data | 5 | 2 | 10 | Update `backups/` strategy; document | Ops |
| R-18 | **PRD says S3 is out of scope but code uses S3** — governance/documentation drift | 2 | 5 | 10 | Update `PRD.md §17` or scope decision in writing | Owner |

**Release blockers (must be 0):** R-01, R-02, R-03, R-04 (any one of these in prod is a release-stop event).

---

## 4. Ticket breakdowns

Ticket IDs match Senior Lead doc §6 to avoid duplicate numbering. Each ticket lists: scope, dev acceptance criteria, **QA acceptance criteria** (test IDs), exit criteria, dependencies.

### Ticket #1 — Default S3 ACL → private + signed read URLs
- **Scope:** Patch A in lead doc. New dep `@aws-sdk/s3-request-presigner`. Add `getSignedReadUrl(relPath, expiresInSec)`. Replace public redirect in `uploads/[...path]:134`. Add `ServerSideEncryption: AES256`.
- **Dev acceptance:** unit test on `getSignedReadUrl` returns URL containing `X-Amz-Signature`.
- **QA acceptance (must pass):** TC-SEC-001, TC-SEC-004, TC-SEC-005, TC-SEC-009, TC-REG-001, TC-REG-002, TC-REG-004.
- **Exit:** R-01, R-10, R-11 closed.
- **Effort:** S (≈2h dev + 1h QA).
- **Deps:** none. **Block:** all subsequent S3 work.

### Ticket #2 — Auth-gate `/uploads/[...path]` and enforce ownership
- **Scope:** Remove `uploads` from middleware matcher. Inside route, parse `users/<sessionUserId>/...` from filename and assert. For shared/public assets, look up sharing table. Replace 307 to public S3 with signed URL (uses #1).
- **Dev acceptance:** unit test for cross-user 403; integration test for legit owner 200; integration test for public-share-token 200.
- **QA acceptance:** TC-SEC-002, TC-SEC-003, TC-SEC-006, TC-SEC-011, TC-REG-003, TC-REG-004, TC-REG-010.
- **Exit:** R-02 closed.
- **Effort:** S–M (≈4h dev + 2h QA).
- **Deps:** #1.

### Ticket #3 — Fix S3/local read asymmetry
- **Scope:** Add `readMedia(relPath): Promise<Buffer>` and `deleteMedia(relPath): Promise<void>` in `media-storage.ts` that branch on `isS3Enabled()`. Replace direct `fs.readFile(path.join(public, uploads, …))` calls in `receipts/[id]/process`, `receipts/[id]/attach-photo`, `media/thumb`, and `uploads/[...path]` thumbnail self-heal. Make thumbnail self-heal S3-aware.
- **Dev acceptance:** unit test of `readMedia` returns same bytes for local + S3 mock. Integration test: upload with S3 on → process → 200.
- **QA acceptance:** TC-PROC-004, TC-PROC-007, TC-UPL-002, TC-REG-003, TC-REG-005.
- **Exit:** R-03 closed.
- **Effort:** S (≈3h dev + 2h QA).
- **Deps:** none.

### Ticket #4 — Move ffmpeg out of request path (feature flagged)
- **Scope:** Patch B in lead doc. Add `processingStatus` to `JobPhoto` and `PostMedia`. Add `INLINE_VIDEO_TRANSCODE` flag and `MAX_INLINE_VIDEO_BYTES`. Add `app/scripts/process-pending-media.ts` (cron-runnable). UI shows "Processing" badge.
- **Dev acceptance:** unit test of routing logic; cron script produces transcode + thumb; idempotent.
- **QA acceptance:** TC-UPL-005, TC-UPL-006, TC-PROC-001, TC-PROC-006, TC-PROC-008, TC-PROC-009, TC-UX-002, TC-UX-003, TC-PERF-005, TC-REG-007, TC-REG-008.
- **Exit:** R-04 closed.
- **Effort:** M (≈1d dev + 0.5d QA).
- **Deps:** #3 (so worker can read from S3).

### Ticket #5 — Route `cars/[carId]/documents` through `persistMedia`
- **Scope:** Replace `writeFile` with `buildUserMediaPath` + `persistMedia`. Adjust path layout to match other routes (`users/<userId>/cars/documents/<carId>/...`).
- **Dev acceptance:** integration test confirms S3 PUT is invoked when enabled.
- **QA acceptance:** TC-UPL-009, TC-REG-009 (backup/restore), TC-REG-010.
- **Exit:** R-05 closed.
- **Effort:** S (≈1.5h dev + 1h QA).
- **Deps:** none.

### Ticket #6 — Centralize media size/type config
- **Scope:** New `app/lib/media-limits.ts` exporting `LIMITS = { receipts: { maxBytes, mime }, jobPhoto: …, … }`. Refactor 9 routes to import. Add a `validateMedia(file, areaName)` helper.
- **Dev acceptance:** all 9 routes import from one place; lint rule prevents inline `MAX_*` constants.
- **QA acceptance:** TC-UPL-NEG-001..006, TC-UX-005.
- **Exit:** R-12 closed.
- **Effort:** S (≈2h dev + 1h QA).
- **Deps:** none.

### Ticket #7 — Asset + UploadSession Prisma models
- **Scope:** New models per spec §6. Migration adds nullable `assetId` FK to `JobPhoto`, `PostMedia`, `CarPhoto`, `CarDocument`, `JobAttachment`, `Receipt`. Backfill script to lift existing rows into `Asset`.
- **Dev acceptance:** migration runs forward + rollback on staging snapshot. Backfill produces 1 Asset per existing media row.
- **QA acceptance:** TC-REG-001..010 (all existing flows still work after migration); plus dedicated migration smoke (`prisma migrate reset && db:seed && app starts && legacy file is reachable`).
- **Exit:** unblocks #8/#10.
- **Effort:** M (≈1.5d dev + 1d QA — migration risk).
- **Deps:** #4 (don't touch schema twice).

### Ticket #8 — Implement `/api/uploads/{init,part-url,complete,abort}`
- **Scope:** 4 new routes using `CreateMultipartUploadCommand`, `UploadPartCommand` presign, `CompleteMultipartUploadCommand`, `AbortMultipartUploadCommand`. Persist `UploadSession`. Limit part size 8 MB default, configurable. Idempotent `complete`.
- **Dev acceptance:** node-test integration with localstack: 200 MB file in 25 parts succeeds; abort halfway leaves no S3 multipart.
- **QA acceptance:** TC-RES-001..009 (most), TC-PERF-002, TC-SEC-001, TC-OBS-003, TC-UPL-NEG-005.
- **Exit:** R-08 closed.
- **Effort:** M (≈3d dev + 1.5d QA).
- **Deps:** #7.

### Ticket #9 — Resumable client uploader
- **Scope:** New `app/app/lib/uploader.ts` (≈250 LOC). Chunk file → 8 MB. 3 concurrent. XHR for progress. Retry x5 with exp + jitter. Persist `{sessionId, parts}` in IndexedDB. Refactor `ReceiptUploadButton`, `ReceiptScanFlow`, plus job-photo and post-media UIs to use it. Wire iOS Service Worker for backgrounding.
- **Dev acceptance:** unit tests on retry/backoff; Playwright tests for happy + drop + resume.
- **QA acceptance:** TC-UX-001..006, TC-RES-001..010, TC-COMPAT-001, TC-COMPAT-006, TC-A11Y-002.
- **Exit:** R-06, R-07, R-16 closed.
- **Effort:** L (≈5d dev + 2d QA).
- **Deps:** #8.

### Ticket #10 — Asset state machine + status endpoint + UI
- **Scope:** State transitions via `lib/assets.ts::transition()`. New `GET /api/assets/[id]/status`. UI badges everywhere assets are listed. Error taxonomy from spec §12.
- **Dev acceptance:** state machine table-driven test enumerates all valid + invalid transitions.
- **QA acceptance:** TC-PROC-001..003, TC-UX-002, TC-UX-006, TC-OBS-003.
- **Exit:** completes Phase-1 acceptance per spec §15.
- **Effort:** M (≈2d dev + 1d QA).
- **Deps:** #4, #7.

### Ticket #11 (new) — Magic-byte MIME sniffing
- **Scope:** Add `file-type` (or similar) to validate first 4–12 bytes match the declared `Content-Type`.
- **Dev acceptance:** unit test on disguised .exe → rejected.
- **QA acceptance:** TC-SEC-007.
- **Exit:** R-09 closed.
- **Effort:** S.
- **Deps:** #6.

### Ticket #12 (new) — Duration validation
- **Scope:** Client-side: `<video>` metadata via `URL.createObjectURL`. Server-side: derive from ffprobe in worker. Reject > 10 min (configurable).
- **Dev acceptance:** unit test rejects 11-min sample.
- **QA acceptance:** TC-UPL-NEG-006.
- **Exit:** spec §3.1 satisfied.
- **Effort:** S.
- **Deps:** #4.

### Ticket #13 (new) — Backup includes S3 contents
- **Scope:** `backups/` script does `aws s3 sync` alongside DB tarball. Document restore.
- **Dev acceptance:** restore drill on staging.
- **QA acceptance:** TC-REG-009.
- **Exit:** R-17 closed.
- **Effort:** S.
- **Deps:** #1.

### Ticket #14 (new) — Structured logging + error taxonomy
- **Scope:** Replace `console.log("[upload] …", obj)` with `logger.info({event, ...})`. Map all upload/process errors to taxonomy codes from spec §12.
- **Dev acceptance:** all `console.log` in upload paths replaced; eslint rule enforces.
- **QA acceptance:** TC-OBS-003, TC-OBS-006, TC-SEC-008.
- **Exit:** observability baseline.
- **Effort:** S–M.
- **Deps:** none.

### Ticket #15 (new) — sortOrder transactional fix
- **Scope:** Wrap reorder + insert in a Prisma `$transaction` with explicit `MAX(sortOrder)` query.
- **Dev acceptance:** concurrency test with two parallel inserts → no duplicate sortOrder.
- **QA acceptance:** TC-UPL-NEG-011.
- **Exit:** R-14 closed.
- **Effort:** S.
- **Deps:** none.

### Ticket #16 (new) — PRD/requirements scope reconciliation
- **Scope:** Owner-led decision document. Update `PRD.md §17` accordingly. No code change.
- **Dev acceptance:** N/A.
- **QA acceptance:** N/A.
- **Exit:** R-18 closed.
- **Effort:** XS.
- **Deps:** none.

---

## 5. Suggested sprint shape (for the implementation sprint, not QA-only)

| Sprint day | Tickets | QA action |
|---|---|---|
| 1 | #1, #5, #16 | Spin up localstack; write TC-SEC-001..009, TC-UPL-009 |
| 2 | #3, #6, #11 | TC-PROC-004, TC-UPL-NEG-001..006, TC-SEC-007 |
| 3-4 | #4, #14 | TC-UPL-005/006, TC-UX-002/003, TC-PROC-001/006/008/009 |
| 5-6 | #7 | Migration smoke; full TC-REG-001..010 |
| 7-9 | #8 | Localstack multipart matrix; TC-RES-001..009 |
| 10-12 | #9 | Playwright matrix; TC-UX-001..006; iOS PWA day |
| 13 | #10, #12, #13, #15 | TC-PROC-001..003, TC-UPL-NEG-006, TC-REG-009 |
| 14 | Hardening + regression sweep | All P0 must pass |

---

## 6. QA sign-off checklist (release gate)

```
[ ] All P0 test cases pass on staging-with-S3
[ ] No open P0/P1 bugs
[ ] Manual iOS Safari PWA smoke complete (install → upload image → upload video → resume after kill)
[ ] Cross-tenant test (TC-SEC-003) passes with two real users
[ ] Backup-restore drill (TC-REG-009) passes
[ ] Risks R-01..R-04 verified closed by name
[ ] Docs updated: PRD §17, STAGING_SETUP.md (env vars), API spec for /api/uploads/*
[ ] Rollback plan documented (per-ticket rollback notes captured)
[ ] Owner signs the scope-reconciliation doc (Ticket #16)
```
