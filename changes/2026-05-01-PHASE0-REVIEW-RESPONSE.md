# Response to Phase 0 Hardening Review

**Source reviewed:** `changes/2026-05-01-PHASE0-REVIEW.md`  
**Date:** 2026-05-01  
**Responder:** Bobby

---

## Decision

Accepted. I agree with the headline and risk posture:
- Merge CHG-001..CHG-005 to `main`
- Treat R-02 and R-04 as **partially mitigated** until follow-ups land
- Block broad S3 staging exposure until CHG-006b + CHG-007 are complete

---

## Point-by-point response

### CHG-001 ✅
Agree. Follow-up accepted:
- Remove dead `getS3PublicUrl`
- Add explicit AWS_ACL allowlist guard (reject/ignore invalid values)

### CHG-002 🟡
Agree. Legacy path ownership gap is real for non-`users/<id>/...` paths.
- New uploads are protected
- Legacy path model still needs explicit owner resolution/backfill

### CHG-003 ✅
Agree. Core receipt read/delete asymmetry is fixed.
- Remaining local-only thumbnail paths should be handled in CHG-008

### CHG-004 🟡
Agree. New writes are consistent; legacy `CarDocument.filename` patterns need migration verification.

### CHG-005 🟡
Agree. This mitigates request timeout risk, but does not fully close UX/processing lifecycle.
- Need async processing worker + status signaling in UI

---

## Follow-up execution order (approved)

1. **CHG-006b** — legacy ownership/path backfill + strict ownership enforcement for old keys
2. **CHG-007** — async pending-media worker (`scripts/process-pending-media.ts`)
3. **CHG-008** — `/api/media/thumb` auth + S3-aware behavior
4. **CHG-009** — `processingStatus` column + "Processing" badge in UI
5. **CHG-010** — remove duplicate `optimizeVideo` implementation in jobs route
6. **CHG-011** — remove dead `getS3PublicUrl`
7. **CHG-012** — AWS_ACL validation + STAGING_SETUP operator runbook updates

---

## Merge recommendation

- **Approve merge now:** CHG-001..CHG-005
- **Release gate:** do not open S3-backed staging to broad external testing until CHG-006b and CHG-007 land

---

## Operator note

Before next staging cycle, update `STAGING_SETUP.md` with:
- required S3 IAM permissions (`GetObject`, `PutObject`, `DeleteObject`)
- `AWS_SIGNED_URL_EXPIRES`, `INLINE_VIDEO_TRANSCODE`, `MAX_INLINE_VIDEO_BYTES`
- verification steps for signed URL, SSE, ownership checks, and pending-media worker health
