# CHG-010 — Post Media Processing Status (Parity with Job Media)

**Status:** Implementation-ready spec
**Owner:** Bobby (implementation)
**Reviewer:** Cline (spec author)
**Created:** 2026-05-04

---

## Goal

Close remaining R-04 gap for post media by adding computed `processingStatus` for videos and a UI "Processing" indicator that clears when thumbnails exist.

---

## Scope

### 1) API: `posts/[id]/media` GET

**Implementation:**
- For each media item:
  - If `mediaType !== "video"` → `processingStatus: "ready"`.
  - If video:
    - Check `<filename>.thumb.webp` existence via existing `mediaExists` helper.
    - Exists → `"ready"`, missing → `"processing"`.
- Return field alongside existing media payload (no schema changes).

**Acceptance:**
- Existing fields unchanged.
- Added field is backward-compatible.

---

### 2) API: `posts/[id]/media` POST (upload response)

**Implementation:**
- Mirror CHG-009 logic:
  - If inline transcode executed and completed → `"ready"`.
  - If deferred path (disabled inline transcode or too large) → `"processing"`.
- Include `processingStatus` in created items returned to client.

**Acceptance:**
- Large/deferred video returns `"processing"` immediately.
- Small inline video returns `"ready"`.

---

### 3) UI: Post media gallery/component

**Implementation:**
- Extend local media type:
  ```ts
  processingStatus?: "processing" | "ready";
  ```
- Add badge visible only when:
  - `mediaType === "video"` and `processingStatus === "processing"`.
- Place with existing status chips/badges for visual consistency.
- Ensure image-only items never show it.

**Acceptance:**
- Upload deferred video → badge appears immediately (from POST response).
- After worker creates thumb and user refreshes/reloads → badge disappears.

---

## Non-goals (Phase 0)

- No DB migration for status fields.
- No "failed" terminal state yet.
- No post-worker realtime push; refresh-based recompute is fine.

---

## Test matrix (must pass)

| # | Scenario | Expected |
|---|---|---|
| 1 | Small video + inline transcode on | Upload returns `ready`. No processing badge. Thumbnail visible. |
| 2 | Large video (or inline disabled) | Upload returns `processing`. Badge visible. After `media:process-pending` + refresh: `ready`, badge gone, thumb visible. |
| 3 | Image upload | Always `ready`. No processing badge. |
| 4 | Previously processed video (existing thumb) | GET returns `ready` immediately. No badge. |
| 5 | Mixed media list | Only deferred videos show badge. |

---

## Suggested hardening (optional but quick)

- If worker writes thumbnails, use atomic write (temp + rename) to reduce false-ready from partial files.

---

## Definition of done

- Post media now matches job media behavior for processing visibility.
- User never sees silent/broken "unknown state" during deferred video processing.
- **R-04 is fully closed across both job and post media paths.**

---

## Implementation reference

Use CHG-009 as the template:
- `app/app/api/jobs/[id]/photos/route.ts` (L92-97 for GET, L171-175 for POST)
- `app/app/job/[id]/JobPhotoGallery.tsx` (L756-760 for badge)

Apply the same pattern to:
- `app/app/api/posts/[id]/media/route.ts` (GET + POST)
- Post media UI component (locate via grep for PostMedia usage)
