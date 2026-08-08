# CHG-005 — Reduce Request-Path FFmpeg Blast Radius

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
Reduce timeout/stall risk from doing video transcoding inline in HTTP request handlers.

## Files touched
- `app/lib/post-media.ts`
- `app/app/api/posts/[id]/media/route.ts`
- `app/app/api/jobs/[id]/photos/route.ts`

## Change summary
1. Added feature controls in `post-media.ts`:
   - `INLINE_VIDEO_TRANSCODE` (default true unless env `false`)
   - `MAX_INLINE_VIDEO_BYTES` (default 50MB, env-overridable)
2. Updated posts media upload route:
   - If video is above threshold OR inline transcode disabled, persist raw video directly (skip ffmpeg in request path).
   - If within threshold and enabled, continue current optimize+thumbnail behavior.
3. Updated job photos upload route with same gating behavior.

## Current behavior
- Small videos (<= threshold, flag enabled): inline transcode + thumbnail unchanged.
- Large videos (> threshold) or feature flag disabled: no inline ffmpeg transcode in request path; raw upload saved.

## Risk / impact
- For videos skipping inline transcode, thumbnail may not exist immediately.
- Some clients may depend on `.thumb.webp`; follow-up async processing worker is still needed for full parity.

## Validation checklist
- [ ] Upload large video (>50MB): request no longer spends minutes transcoding
- [ ] Upload small video (<50MB): transcode + thumbnail still works
- [ ] Set `INLINE_VIDEO_TRANSCODE=false`: all videos skip inline transcode

## Env vars
- `INLINE_VIDEO_TRANSCODE=false` (optional)
- `MAX_INLINE_VIDEO_BYTES=52428800` (optional)

## Rollback
- Revert the three files above.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
