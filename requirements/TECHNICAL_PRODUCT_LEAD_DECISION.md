# Technical Product Lead — Decision Memo

**App:** `workspace/apps/personal/car-maintenance` (Garage Work Manager)
**Decision owner:** Cline (acting Technical Product Lead)
**Date:** 2026-05-01
**Inputs reviewed:**
- `workspace/requirements/media-upload-pipeline-requirements.md`
- `SENIOR_LEAD_DEVELOPER_REVIEW.md`
- `SENIOR_QA_ANALYST_REVIEW.md`
- `DEV_CHALLENGER_REVIEW.md`

---

## Final Assessment

**Status: ❌ Needs refinement — NOT ready for development as a single epic.**

But the *first slice* (Phase 0 — security + correctness) **IS** ready and should start in parallel with the refinement work. Treating the requirements doc as one ticket is the wrong move; treating it as nothing-until-fully-spec'd is also the wrong move.

The four documents agree on the **diagnosis** and disagree on **scope and sequencing**. The senior review and QA plan describe the right destination; the dev challenger correctly argues that destination is too far for one trip and a few of the requirements are over-scoped for a personal-app context. The PRD↔requirements contradiction (PRD §17 says S3/video out of scope; requirements doc mandates them) is a governance defect that must be resolved on paper before the larger phases begin.

**My call:** ship Phase 0 now (1 sprint, security/correctness, no architectural change), block Phase 1+ behind 5 specific clarifications from the owner, then proceed in 4 staged slices.

---

## Required Changes (must be fixed before dev starts)

### Blocking — must be resolved this week

1. **Owner-signed scope reconciliation.** Pick one:
   - **(a) Adopt** the requirements doc as the contract for this app → update `PRD.md §17` to remove "S3, video, cloud sync — out of scope".
   - **(b) Reduce** the requirements doc to what's actually in scope for a personal/small-team app and re-scope as `media-upload-pipeline-v1-requirements.md`.
   - Without this decision, every subsequent ticket has ambiguous acceptance.
   - **Owner:** product. **Effort:** XS. **Output:** 1-page decision doc + PRD update.

2. **Answer the 5 unblocking questions** (a subset of the dev challenger's 10):
   - **Q1. Deployment model:** single Docker host (current) or moving to ECS/serverless? → drives queue tech (cron vs SQS) and `req.formData()` viability.
   - **Q2. True media scope v1:** receipts/docs/photos + short videos (≤ ~500 MB), OR long-form video (≥ 1 GB)? → drives whether multipart is mandatory vs nice-to-have.
   - **Q3. Sharing model:** authenticated-only, or do public share links exist now? → drives whether `/uploads` lockdown needs a token-based exception path.
   - **Q4. Compliance posture for receipts (PII):** SSE-S3 sufficient, or SSE-KMS required? Retention/deletion policy? → drives encryption + lifecycle config.
   - **Q5. SLA target:** "first-playable" within how many seconds for what file size? → drives whether HLS ladder is needed in v1 or single-MP4 is acceptable.
   - Document answers in the same decision doc as #1.

3. **Update spec doc to fill the ambiguities** the dev challenger correctly flagged:
   - Concrete per-route hard limits (current code is inconsistent: 20 MB / 250 MB / 2 GB).
   - Definition of "playable" (raw MP4 ready vs HLS ready vs first frame ready).
   - Concrete SLA numbers in §15 ("within defined processing SLA" → fill in the blank).

### Required *during* Phase 0 (does not block start, but must land before Phase 0 ships)

4. **Phase-0 fixes are non-negotiable, regardless of scope decision** (these are bugs, not features):
   - Default `ACL: public-read` → private (Patch A).
   - `/uploads/[...path]` auth + ownership check.
   - S3↔local read asymmetry in receipt processing (the OCR-breaks-when-S3-on bug).
   - `cars/documents` route bypassing `persistMedia`.
   - FFmpeg pulled out of HTTP request path behind a feature flag (Patch B).
   - These four/five items are independent of the larger pipeline question and should ship within 5 working days.

### Required *before* Phase 2 (multipart) starts

5. **Migration strategy doc** for the filename → `assetId` transition. The senior review proposes adding `Asset` and `UploadSession` and backfilling 6 tables. The dev challenger is correct that this is high regression risk. Need an explicit dual-write / compatibility plan: nullable FK, backfill script, period of dual-read, then cutover. This is its own Ticket #7a before the model lands.

6. **API contract definitions** (OpenAPI or equivalent) for `/init`, `/part-url`, `/complete`, `/abort`, `/status` — including idempotency keys for `/complete` and error response shapes mapped to the §12 taxonomy. Without this, FE and BE will drift.

7. **Test environment for multipart**: localstack or MinIO container in CI. The QA plan assumes this exists; it doesn't yet.

---

## Ticket Breakdown (suggested implementation tickets)

Numbering aligns with senior-lead review §6 and QA review §4 to avoid renumbering. Phasing applies the dev challenger's staged-slice argument.

### Phase 0 — Safety & correctness (1 sprint, 5 working days)
> Goal: stop the bleeding. No architectural change. No DB schema change beyond a single nullable column on photo tables. Reversible.

| # | Ticket | Effort | Owner | Risk closes |
|---|---|---|---|---|
| 0.0 | **Scope reconciliation memo + PRD update + answers to Q1–Q5** | XS (0.5 d) | Product | R-18 |
| 1 | **S3 ACL → private + signed read URLs + SSE-AES256** | S (≈3 h) | Backend | R-01, R-10, R-11 |
| 2 | **Auth-gate `/uploads/[...path]` + ownership check (with share-token exception path)** | S (≈4 h) | Backend | R-02 |
| 3 | **Fix S3/local read asymmetry (`readMedia`/`deleteMedia` helpers)** | S (≈3 h) | Backend | R-03 |
| 5 | **Route `cars/[carId]/documents` through `persistMedia`** | S (≈1.5 h) | Backend | R-05 |
| 4-lite | **Stop request-path FFmpeg for files > 50 MB (feature-flagged)** + add `processingStatus` column + tiny cron worker | M (≈1 d) | Backend | R-04 |

**Phase 0 exit:** R-01..R-05 closed. All P0 security tests pass on staging-with-S3. No new client/server APIs introduced. Rollback = revert flag + 6 files.

### Phase 1 — Stabilize existing architecture (1 sprint)
> Goal: harden the single-shot uploader without yet adopting multipart.

| # | Ticket | Effort | Owner | Notes |
|---|---|---|---|---|
| 6 | Centralize media size/type config (`media-limits.ts`) | S | Backend | Eliminates 20/250 MB drift |
| 11 | Magic-byte MIME sniffing | S | Backend | Closes mime-spoof gap |
| 12 | Duration validation (client + ffprobe in worker) | S | Full-stack | Spec §3.1 |
| 13 | Backup includes S3 contents (`aws s3 sync`) | S | Ops | Closes split-brain backup risk |
| 14 | Structured logging + error taxonomy | S–M | Backend | Foundation for observability |
| 15 | sortOrder transactional fix on photo inserts | S | Backend | Closes race in posts/job photos |

**Phase 1 exit:** TC-UPL-NEG-001..006, TC-SEC-007, TC-OBS-006, TC-REG-009 pass. App is "v0 done well" — would be acceptable to release as final state if scope answer is "personal app, no big videos".

### Phase 2 — Multipart, resume, async pipeline (2–3 sprints, gated)
> Goal: the architectural rebuild. **Only proceed if the scope answer is "yes, big videos / public sharing in v1".**

| # | Ticket | Effort | Owner |
|---|---|---|---|
| 7a | **Migration strategy doc + dual-read/dual-write plan** for `Asset`/`UploadSession` | S (design) | Lead |
| 7 | Add `Asset` + `UploadSession` Prisma models + backfill | M | Backend |
| 8a | **OpenAPI contract** for `/init`, `/part-url`, `/complete`, `/abort`, `/status` + idempotency | S | Backend |
| 8 | Implement the 4 multipart routes against localstack | M (3 d) | Backend |
| 9 | Resumable client uploader (chunk + retry + IndexedDB resume + iOS PWA Service Worker) | L (5 d) | Frontend |
| 10 | Asset state machine + status endpoint + UI badges | M | Full-stack |

**Phase 2 exit:** All P0 reliability tests (TC-RES-001..010) pass. Phase-1 acceptance per spec §15 met for files ≤ 500 MB.

### Phase 3 — Scale features (deferred, optional)
> Goal: only if scope answer requires it.

- HLS ladder + MediaConvert + CloudFront.
- SQS / BullMQ replacing the cron worker.
- Metrics emitter, dashboards, alerting.
- ClamAV malware scanning sidecar.

**Default position:** **defer all of Phase 3** unless scope answer says public/multi-user video sharing. The senior review and dev challenger both call this out.

---

## Risk Level

### Overall: **Medium** (was High before staging; staging brings it down)

| Phase | Risk | Reasoning |
|---|---|---|
| Phase 0 (5 days) | **Low** | Bug fixes only, all reversible, narrow surface area, no schema change. The two phase-0 risks are: (a) someone forgets to flip bucket Block-Public-Access on, and (b) the auth-gate breaks an unknown share link. Both mitigated with QA tickets TC-SEC-001..009 + TC-REG-001..010. |
| Phase 1 (1 sprint) | **Low** | Refactors and centralization. No new architecture. |
| Phase 2 (2–3 sprints) | **High** | Schema migration touching 6 tables with existing data + new client uploader + iOS PWA Service Worker quirks (R-16). The dev challenger's concern here is correct: a single-shot release of all of Phase 2 will regress something. **Mitigations required:** dual-read/dual-write (#7a), localstack CI, Playwright iOS matrix, feature-flag the new uploader behind a per-route toggle so we can roll back per entry point. |
| Phase 3 (deferred) | n/a | Don't take this on without scope authority. |

### Hard release-blocker risks (must be 0 before any external user touches staging)
- R-01 (public-read receipts) — closed by Phase 0 #1.
- R-02 (cross-tenant /uploads) — closed by Phase 0 #2.
- R-03 (OCR breaks on S3) — closed by Phase 0 #3.
- R-04 (dead-spinner inline FFmpeg) — closed by Phase 0 #4-lite.

If Phase 0 lands, the **app moves from "active security defect" to "feature-incomplete but safe"**, which is the correct first milestone.

### Confidence in the plan
- **High** that Phase 0 is correctly scoped and ships on time.
- **Medium** that Phase 1 is sufficient — depends on Q2 (true media scope).
- **Low until owner answers Q1–Q5** that Phase 2 is needed at all in this app.

---

## Bottom line

- **Start Phase 0 immediately** (Tickets #1, #2, #3, #5, #4-lite, plus 0.0 product memo). It's bug-fix work, not roadmap work.
- **Do not start Phase 2** until owner answers Q1–Q5 and signs the scope reconciliation. Otherwise we'll build for an audience the app doesn't have.
- **Phase 1 fills the gap** — useful regardless of scope answer.
- **Phase 3 stays deferred** by default.

The dev challenger's framing is right: implement in **slices**, not as a single epic. The senior review's destination is right; the staircase to it is what was missing. This memo is the staircase.
