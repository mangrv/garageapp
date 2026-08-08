# CHG-001 — Secure S3 Defaults (Private-by-default + Signed Read URLs)

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
Address critical security risks:
- Remove implicit public-read object exposure
- Ensure encrypted writes
- Replace public S3 redirect behavior with signed URL access

## Files touched
- `app/package.json`
- `app/lib/media-storage.ts`
- `app/app/uploads/[...path]/route.ts`
- `docker-compose.yml`

## Change summary
1. Added `@aws-sdk/s3-request-presigner` dependency.
2. Added `getSignedReadUrl(key, expiresInSeconds?)` helper in `media-storage.ts`.
3. Changed S3 upload behavior:
   - Removed default ACL fallback to `public-read`
   - Added `ServerSideEncryption: "AES256"`
4. Changed `/uploads/[...path]` S3 fallback:
   - from public URL redirect
   - to signed URL redirect (`307` to presigned GET)
5. Changed docker ACL default from `public-read` to empty.

## Risk / impact
- Existing assumptions of publicly accessible S3 URLs may break.
- Signed URL expiry now controls access window.
- If IAM lacks `s3:GetObject` for presigner principal, fallback reads will fail.

## Validation checklist
- [ ] `npm install` in `app/` succeeds and lockfile updates
- [ ] Anonymous direct S3 object URL returns `403` (or inaccessible)
- [ ] `/uploads/<path>` returns `307` to signed URL when local file missing and S3 enabled
- [ ] Signed URL contains `X-Amz-Signature`
- [ ] Uploaded object shows SSE AES256 via `head-object`

## Suggested validation commands
```bash
cd /home/ji/.openclaw/workspace/apps/personal/car-maintenance/app
npm install
npm run build
```

```bash
# confirm docker default changed
cd /home/ji/.openclaw/workspace/apps/personal/car-maintenance
grep -n "AWS_ACL" docker-compose.yml
```

## Rollback
- Revert the four files above to previous revision.
- Remove `@aws-sdk/s3-request-presigner` from dependencies.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
