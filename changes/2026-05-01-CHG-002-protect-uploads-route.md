# CHG-002 — Protect `/uploads` Route (Auth + Ownership)

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending validation/review)

## Why
Address cross-tenant data exposure risk on `/uploads/[...path]`.

## Files touched
- `app/middleware.ts`
- `app/app/uploads/[...path]/route.ts`

## Change summary
1. Middleware matcher updated to no longer exclude `/uploads` from auth.
2. Uploads route now checks session explicitly with `getSession()` and returns `401` if absent.
3. Added ownership check for user-scoped paths:
   - Pattern: `users/<userId>/...`
   - If session user does not match path owner, route returns `403`.

## Risk / impact
- Existing unauthenticated links to `/uploads/...` will stop working.
- If there are current share/public flows relying on raw `/uploads`, they now require explicit allow-path logic.

## Validation checklist
- [ ] Unauthenticated `GET /uploads/<known-path>` returns 401/redirect to login
- [ ] User A can fetch own `users/A/...` media
- [ ] User B cannot fetch User A media (`403`)
- [ ] Non-user-scoped paths still behave as expected (if any exist)

## Rollback
- Revert `middleware.ts` matcher change.
- Remove session/ownership guards from `uploads/[...path]/route.ts`.

## Reviewer sign-off
- Lead Dev: ☐ Approved ☐ Changes requested
- Product: ☐ Approved ☐ Changes requested
