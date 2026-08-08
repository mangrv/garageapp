# CHG-007a — Worker Runtime Dependency Fix (`ts-node` in production)

**Date:** 2026-05-01  
**Owner:** Bobby (implementation)  
**Status:** Implemented (pending review)

## Why
CHG-007 introduced `npm run media:process-pending` using `ts-node`, but `ts-node` was only in `devDependencies`, which can fail in production-pruned Docker images.

## Files touched
- `app/package.json`

## Change summary
- Moved `ts-node` from `devDependencies` to `dependencies`.
- Keeps the worker runnable in environments that install production deps only.

## Notes
- This is a pragmatic stop-gap. Long-term preferred approach is precompiled worker JS in build artifacts.

## Validation checklist
- [ ] Build/install with production dependency mode
- [ ] `npm run media:process-pending` executes successfully in container/runtime

## Rollback
- Move `ts-node` back to `devDependencies` and adopt precompiled worker runtime instead.
