# CHG-008 — Thumb API Auth + S3 Alignment

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending review)

## Why
`/api/media/thumb` had separate unauthenticated/local-only logic that could diverge from hardened `/uploads` behavior.

## Files touched
- `app/app/api/media/thumb/route.ts`

## Change summary
- Replaced local thumbnail generation logic in `/api/media/thumb` with a redirect to:
  - `/uploads/<video>.thumb.webp`
- This delegates all enforcement and backend handling to the already hardened uploads route:
  - auth/session checks
  - ownership enforcement (new + legacy)
  - local/S3 handling
  - thumbnail self-heal behavior

## Impact
- Single source of truth for thumbnail access policy.
- Eliminates duplicate logic path and reduces security drift risk.

## Validation checklist
- [ ] Authenticated owner can request `/api/media/thumb?video=<path>` and receive thumbnail
- [ ] Non-owner/non-auth user is denied through `/uploads` policy
- [ ] S3 mode still works (redirect chain resolves)
- [ ] Legacy thumbnail paths still enforce owner checks

## Rollback
- Revert `app/app/api/media/thumb/route.ts` to previous standalone generator implementation.
