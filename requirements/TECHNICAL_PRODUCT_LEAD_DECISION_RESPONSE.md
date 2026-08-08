# Response to Technical Product Lead Decision Memo

**Document reviewed:** `TECHNICAL_PRODUCT_LEAD_DECISION.md`  
**Reviewer role:** Senior Engineering Response  
**Date:** 2026-05-01

---

## Executive Summary

The decision memo is strong, actionable, and mostly correct. It improves prior outputs by introducing sequencing and gating. I agree with the central call:

- Do **Phase 0 now** (security + correctness),
- Gate larger architecture changes behind explicit scope decisions,
- Avoid implementing the full requirements as one epic.

That said, a few refinements are needed to reduce delivery risk and avoid ambiguous execution.

---

## What’s good (validated)

1. **Correct prioritization of immediate risks**
   - Public-read ACL, `/uploads` auth/ownership, S3/local asymmetry, and inline FFmpeg are correctly identified as must-fix now.

2. **Good staged execution model**
   - Phase 0 / 1 / 2 / 3 decomposition is practical and lowers regression risk.

3. **Proper governance checkpoint**
   - Requiring owner-signed scope reconciliation before Phase 2 is the right product/engineering control.

4. **Risk framing is realistic**
   - Marking Phase 2 as high risk is accurate due to migration + uploader rewrite + cross-route behavior changes.

---

## Required refinements before execution

### 1) Define hard acceptance criteria for each phase
Current memo has good direction but still leaves some acceptance criteria soft.

Add explicit measurable exits:
- **Phase 0 exit (required):**
  - TC-SEC-001/002/003/005 and TC-PROC-004 all pass in staging with S3 enabled.
  - No route writes media outside storage abstraction.
  - Video upload >50MB returns fast with non-blocking UX state.
- **Phase 1 exit:**
  - Single source of truth for media limits adopted by all upload routes.
  - Duration validation enforced server-side.
- **Phase 2 exit:**
  - Resume after browser restart proven on iOS Safari PWA and desktop Chrome.

### 2) Clarify “4-lite” schema change policy
Memo says Phase 0 has no schema change but also proposes `processingStatus` column.

Action: explicitly classify this as a **minimal additive migration allowed in Phase 0** and include rollback behavior.

### 3) Add rollback strategy per phase
Phase 0 mentions reversibility but not full operator steps.

Action: add one subsection per phase:
- feature flags,
- migration rollback plan,
- S3 policy rollback guardrails,
- user-visible impact.

### 4) Add ownership and timeline commitments
Ticket list is good but lacks accountable names/functions and deadlines.

Action: add fields per ticket:
- DRI,
- ETA,
- dependency unblock date,
- QA signoff owner.

### 5) Resolve sharing semantics before `/uploads` hard lock
Memo mentions a share-token exception but this is not defined.

Action: before Phase 0 Ticket #2 closes, decide:
- authenticated-only model, or
- signed share token model with TTL/audit.

Without this, security fixes may unintentionally break valid workflows.

---

## Technical concerns to carry forward

1. **SSE-S3 vs SSE-KMS**
   - Memo asks question but Phase 0 implementation defaults to AES256. If compliance expectations might tighten, prefer KMS-ready abstraction now.

2. **Worker design in Phase 0**
   - Cron worker is pragmatic, but ensure idempotency and lock semantics now to avoid duplicate transcodes.

3. **Multipart need threshold**
   - Tie Phase 2 activation to objective criteria (e.g., % failed uploads for >100MB, user demand for >250MB videos), not intuition.

4. **Data migration risk**
   - Require a rehearsal migration on staging snapshot before approving Ticket #7 implementation.

---

## Decision on readiness

- **Ready to execute:** Phase 0 immediately, with refinements above.
- **Conditionally ready:** Phase 1 after Phase 0 validation.
- **Not ready yet:** Phase 2+ until Q1–Q5 scope answers are signed and API contract/migration strategy are approved.

---

## Recommended next actions (48-hour window)

1. Finalize and sign scope reconciliation memo (Q1–Q5 included).
2. Update `TECHNICAL_PRODUCT_LEAD_DECISION.md` with phase acceptance criteria + rollback sections.
3. Start Phase 0 tickets (#1, #2, #3, #5, #4-lite).
4. Run mandatory staging test subset and publish pass/fail evidence.

---

## Final position

The memo is directionally correct and should be used as the controlling plan, after minor tightening on acceptance gates, migration classification, rollback procedure, and ownership mapping.
