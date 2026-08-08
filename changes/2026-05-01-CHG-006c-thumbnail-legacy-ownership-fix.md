# CHG-006c — Legacy Thumbnail Ownership Lookup Fix

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
CHG-006b introduced legacy owner enforcement, but legacy thumbnail requests (`*.thumb.webp`) were being checked against the derivative filename, not the base media filename stored in DB.

## Files touched
- `app/app/uploads/[...path]/route.ts`

## Change summary
1. Added `lookupFilename` for legacy ownership resolution:
   - if request ends with `.thumb.webp`, strip suffix before DB lookup
   - else use original filename
2. Wrapped legacy resolver call in `try/catch`:
   - logs resolver failures
   - returns `403` fail-closed on errors

## Risk / impact
- Restores owner access to legacy video thumbnails.
- Preserves cross-tenant blocking.
- Improves observability on resolver failures.

## Validation checklist
- [ ] Owner can load legacy `video.mp4.thumb.webp`
- [ ] Non-owner gets 403 for same thumbnail
- [ ] Unknown legacy thumbnail path returns 403
- [ ] Resolver error path returns 403 (not 200)

## Rollback
- Revert `app/app/uploads/[...path]/route.ts` to CHG-006b version.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
