# Phase 0 Deployment Runbook — CHG-010 + Large Video Support

**Target:** Production deployment of Phase 0 hardening (CHG-006b through CHG-010)
**Date:** 2026-05-04
**Author:** Bobby (implementation) + Cline (review)

---

## 1) Environment Variables (Required)

Set in your deploy environment (`.env`, docker-compose, or platform secrets):

```bash
# 2GB max upload (default in code, but set explicitly for clarity)
MAX_MEDIA_SIZE_BYTES=2147483648

# Keep inline transcode bounded so big videos defer to worker
INLINE_VIDEO_TRANSCODE=true
MAX_INLINE_VIDEO_BYTES=52428800  # 50MB
```

**Optional:** If you want 1GB instead of 2GB:
```bash
MAX_MEDIA_SIZE_BYTES=1073741824
```

---

## 2) Container/Runtime Sizing (Recommended)

For 2GB uploads:
- **Memory limit:** 4GB minimum (better 6GB if ffmpeg runs inline for many small videos)
- **Temp storage:** Ensure `/tmp` has headroom for ffmpeg intermediates

**Docker example:**
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 4g
```

---

## 3) Reverse Proxy/Body Limits (Must Match App Cap)

If proxy limit is lower than app, uploads fail before reaching Next.

### Nginx
```nginx
client_max_body_size 2048M;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
```

### Caddy
```caddyfile
request_body {
  max_size 2147483648
}
```

### Cloudflare / Other Edge
- Confirm plan/body upload cap supports your target size
- If capped below 2GB, either:
  - Lower `MAX_MEDIA_SIZE_BYTES`, or
  - Bypass edge for upload path

---

## 4) Worker/Cron for Deferred Videos (Required for Large Files)

Large videos skip inline transcode and need the worker.

**Set cron (every minute recommended):**
```cron
* * * * * cd /path/to/app && npm run media:process-pending >> /var/log/media-worker.log 2>&1
```

**Verify worker is running:**
```bash
tail -f /var/log/media-worker.log
```

---

## 5) S3 Mode Checks (If Enabled)

Ensure these are set and valid:
- `S3_BUCKET`
- `S3_REGION`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- Any custom endpoint if used (e.g., DigitalOcean Spaces, Cloudflare R2)

**Then verify HeadObject/PutObject permissions for:**
- Original video
- `*.thumb.webp`

---

## 6) Deploy + Verify Commands

### From app directory:
```bash
npm ci
npm run build
npm run start
```

### Sanity checks after deploy:

#### 1. Large video upload (>50MB)
- Upload returns quickly
- UI shows **⏳ Processing** badge

#### 2. Run worker
```bash
npm run media:process-pending
```

#### 3. Refresh UI
- Badge disappears
- Thumbnail appears

#### 4. API confirmation
- `GET /api/posts/:id/media` returns `processingStatus: "ready"` once thumb exists

---

## 7) Post-Deploy Smoke Checklist

- [ ] Build passes clean (no middleware/CSS warnings)
- [ ] 2GB request accepted by proxy + app
- [ ] Deferred processing works end-to-end
- [ ] Job media and post media both show/clear processing badge correctly
- [ ] No broken thumbs for newly processed videos
- [ ] Legacy media (pre-CHG-006) still accessible with owner checks
- [ ] `/uploads` route enforces auth + ownership for new and legacy paths
- [ ] S3 mode (if enabled) serves signed URLs correctly

---

## Troubleshooting

### Upload fails at proxy
- Check `client_max_body_size` / `request_body.max_size`
- Check reverse proxy logs for 413/timeout errors

### Upload succeeds but worker doesn't process
- Verify cron is running: `ps aux | grep media:process-pending`
- Check worker log: `tail -f /var/log/media-worker.log`
- Manually run: `npm run media:process-pending`

### Processing badge never clears
- Check thumbnail exists: `ls -lh public/uploads/<filename>.thumb.webp`
- Check S3 if enabled: `aws s3 ls s3://<bucket>/uploads/<filename>.thumb.webp`
- Check API response: `curl /api/posts/:id/media` (should show `processingStatus: "ready"`)

### OOM during large upload
- Increase Docker memory limit to 6GB+
- Verify `MAX_INLINE_VIDEO_BYTES` is set (should skip inline transcode for large files)

---

## Related Documents

- **PHASE0-REVIEW.md** — Initial comprehensive review (18 risks identified)
- **CHG-006b-REVIEW.md** through **CHG-010-CLEANUP-REVIEW.md** — Individual change reviews
- **CHG-010-IMPLEMENTATION-SPEC.md** — Processing status spec

---

## Next Steps

After successful Phase 0 deployment:
- Monitor worker logs for processing failures
- Track processing latency metrics (time from upload → thumbnail ready)
- Phase 1: Atomic thumbnail writes, DB `thumbnailReady` flag, resumable uploads
