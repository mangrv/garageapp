# Change Log Index (Media Upload Hardening)

This folder tracks each implementation change as a separate review artifact for Lead Developer + Product.

## Convention
- One markdown file per change: `YYYY-MM-DD-CHG-###-<slug>.md`
- Each file includes:
  - Why
  - Files touched
  - Exact code diff summary
  - Risks
  - Validation steps / evidence
  - Rollback steps
  - Reviewer sign-off fields

## Planned sequence (Phase 0)
1. CHG-001 — Secure S3 defaults (remove public-read fallback, enable SSE header, signed URL helper)
2. CHG-002 — Protect `/uploads` route (auth + ownership check)
3. CHG-003 — S3/local read asymmetry fix (`readMedia` abstraction)
4. CHG-004 — Route `cars/documents` through storage abstraction
5. CHG-005 — Reduce request-path ffmpeg blast radius (feature-flag path)
