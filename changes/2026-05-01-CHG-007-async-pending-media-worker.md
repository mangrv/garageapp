# CHG-007 — Async Pending-Media Worker

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
CHG-005 reduced request-path FFmpeg for large videos, but skipped inline processing leaves videos without thumbnails unless a background process completes transcoding.

## Files touched
- `app/scripts/process-pending-media.ts`
- `app/lib/media-storage.ts`
- `app/package.json`

## Change summary
1. Added background worker script: `scripts/process-pending-media.ts`
   - Scans `jobPhoto` and `postMedia` rows with `mediaType = "video"`
   - Checks whether `<filename>.thumb.webp` exists
   - If missing, reads source video from active backend (local/S3), runs `optimizeVideo`, writes optimized mp4 + thumbnail
2. Added `mediaExists(...)` helper in storage layer:
   - S3 mode: `HeadObject`
   - local mode: file read existence check
3. Added npm script:
   - `npm run media:process-pending`

## Operational usage
Run periodically (cron/systemd):
```bash
cd /home/ji/.openclaw/workspace/apps/personal/car-maintenance/app
npm run media:process-pending
```

## Notes / limits
- This implementation uses "missing thumbnail" as pending detection (no DB `processingStatus` yet).
- It is safe to rerun; rows with existing thumbnails are skipped.
- Future CHG should add explicit `processingStatus` for stronger UX/state tracking.

## Validation checklist
- [ ] Upload large video with inline transcode skipped
- [ ] Verify initial thumbnail missing
- [ ] Run `npm run media:process-pending`
- [ ] Verify thumbnail now exists and video is playable
- [ ] Re-run worker; previously processed item is skipped

## Rollback
- Remove `scripts/process-pending-media.ts`
- Remove `mediaExists(...)` from `lib/media-storage.ts`
- Remove `media:process-pending` script from `package.json`

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
