# CHG-006b — Legacy Upload Path Ownership Enforcement

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
CHG-002 secured `users/<userId>/...` paths, but legacy filenames that do not follow that prefix could bypass ownership checks.

## Files touched
- `app/app/uploads/[...path]/route.ts`

## Change summary
1. Added DB-backed owner resolution for legacy filenames:
   - `CarDocument` -> `car.userId`
   - `CarPhoto` -> `car.userId`
   - `Receipt` -> `userId`
   - `JobAttachment` -> `user.id`
   - `JobPhoto` -> `job.userId`
   - `PostMedia` -> `post.userId`
   - `Photo` (task photo) -> `task.phase.job.userId`
2. Updated `/uploads` authorization flow:
   - If path matches `users/<id>/...`, enforce direct owner match
   - Else (legacy path), require successful DB owner lookup and session-owner match
   - Deny access (`403`) when owner cannot be resolved

## Risk / impact
- Legacy media with missing/invalid DB references will become inaccessible (intentional fail-closed behavior).
- Query fanout added for legacy path access checks.

## Validation checklist
- [ ] Owner can access own legacy path media
- [ ] Other authenticated users get 403 for legacy path media
- [ ] Unknown legacy path returns 403
- [ ] New `users/<id>/...` paths still work

## Rollback
- Revert `app/app/uploads/[...path]/route.ts` to previous CHG-002-only ownership logic.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
