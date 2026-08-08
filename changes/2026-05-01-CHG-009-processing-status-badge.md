# CHG-009 — Processing Status Signal + UI Badge (Job Media)

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending review)

## Why
After CHG-005/007, large videos may upload before thumbnail/transcode completes. Users need an explicit in-UI state instead of silent missing thumbs.

## Files touched
- `app/app/api/jobs/[id]/photos/route.ts`
- `app/app/job/[id]/JobPhotoGallery.tsx`

## Change summary
1. Added computed `processingStatus` in jobs photos API response:
   - `ready` for images
   - for videos: `ready` if `<filename>.thumb.webp` exists, else `processing`
2. On upload create response:
   - videos skipping inline transcode are returned as `processing`
   - inline-processed videos returned as `ready`
3. Added UI badge in `JobPhotoGallery` selected-media status row:
   - shows `⏳ Processing` for video items with `processingStatus === "processing"`.

## Notes
- This is a lightweight signal derived from thumbnail presence (no DB migration).
- Post/media surface still needs equivalent status display in a follow-up.

## Validation checklist
- [ ] Upload large video (>inline threshold) → newly returned photo has `processingStatus: "processing"`
- [ ] Job photo detail shows `⏳ Processing` badge
- [ ] Run `npm run media:process-pending` and refresh → badge disappears (`ready`)
- [ ] Images continue to show `ready` behavior (no processing badge)

## Rollback
- Revert the two files above.
