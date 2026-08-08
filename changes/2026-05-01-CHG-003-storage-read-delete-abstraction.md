# CHG-003 — Storage Read/Delete Abstraction (Fix S3/local asymmetry)

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
Fix path asymmetry where uploads may be stored in S3 but later code reads/deletes only from local disk.

## Files touched
- `app/lib/media-storage.ts`
- `app/app/api/receipts/[id]/process/route.ts`
- `app/app/api/receipts/[id]/attach-photo/route.ts`

## Change summary
1. Added `readMedia({ relPath, absPath })`:
   - Reads from S3 when enabled (GetObject)
   - Reads from local FS otherwise
2. Added `deleteMedia({ relPath, absPath })`:
   - Deletes from S3 when enabled (DeleteObject)
   - Deletes local file otherwise
3. Updated receipt process route to use `readMedia` instead of direct `readFile`.
4. Updated receipt attach-photo replacement flow to use `deleteMedia` instead of local-only unlink.

## Risk / impact
- S3 IAM permissions must include `s3:GetObject` and `s3:DeleteObject` for target prefixes.
- Any silent assumptions that local file always exists are removed.

## Validation checklist
- [ ] Receipt processing works when S3 is enabled
- [ ] Replacing receipt attachment deletes prior object in active backend
- [ ] Local mode still works unchanged

## Rollback
- Revert the three files above and restore previous local-only behavior.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
