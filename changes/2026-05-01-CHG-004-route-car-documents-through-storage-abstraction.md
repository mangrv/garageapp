# CHG-004 — Route Car Documents Through Storage Abstraction

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
Eliminate special-case local disk writes for car documents and ensure storage backend consistency.

## Files touched
- `app/app/api/cars/[carId]/documents/route.ts`
- `app/lib/media-storage.ts`

## Change summary
1. Replaced direct `writeFile` path in car documents upload route.
2. Route now uses:
   - `buildUserMediaPath(...)`
   - `persistMedia(...)`
3. Added media area type: `cars/documents` in `MediaArea` union.

## Risk / impact
- Existing downstream path assumptions expecting `cars/<id>/docs/<file>` may change.
- Any code parsing old filename pattern should be reviewed.

## Validation checklist
- [ ] Upload car document in local mode (file stored and metadata saved)
- [ ] Upload car document in S3 mode (object exists in S3 key path)
- [ ] Existing document listing still returns correct filename values

## Rollback
- Revert route back to local `writeFile` implementation and remove `cars/documents` media area.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
