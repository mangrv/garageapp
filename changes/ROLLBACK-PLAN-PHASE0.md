# Phase 0 Rollback Plan — 5-Minute Safe Undo

**Purpose:** Quick rollback procedure if Phase 0 deployment causes production issues
**Est. Time:** 5 minutes (code) + 10 minutes (data cleanup if needed)
**Author:** Cline (review architect)

---

## When to Rollback

Rollback if you observe:
- **Critical:** Upload failures, auth bypass, cross-user data access
- **High:** Worker crashes loop, OOM kills, processing never completes
- **Medium:** Missing thumbnails for new uploads after 5+ min, UI badge stuck

**Do NOT rollback for:**
- Individual video processing failures (fix via worker retry)
- Slow uploads on poor network (expected with large files)

---

## Rollback Sequence (Reverse Deploy Order)

### 1. Stop Worker (Immediate — 30 seconds)

Prevent worker from processing partially-deployed state:

```bash
# Disable cron
crontab -e
# Comment out: * * * * * ... npm run media:process-pending

# Kill running worker instances
pkill -f "media:process-pending"
```

**Verify:** `ps aux | grep media:process-pending` returns nothing

---

### 2. Revert Code (Git — 2 minutes)

```bash
cd /path/to/app

# Find last stable commit (before Phase 0 changes)
git log --oneline -10

# Rollback to pre-Phase0 commit
git reset --hard <commit-before-CHG-006b>

# Alternative: checkout tagged release
git checkout v0.9-stable  # (if you tagged pre-Phase0 state)

# Rebuild + restart
npm ci
npm run build
pm2 restart app  # or docker-compose restart, etc.
```

**Verify:** `git log -1` shows pre-CHG-006 commit

---

### 3. Restore Environment Variables (30 seconds)

Revert to previous upload limits if you raised them:

```bash
# Previous defaults (likely):
MAX_MEDIA_SIZE_BYTES=262144000  # 250 MB
MAX_INLINE_VIDEO_BYTES=52428800 # 50 MB (unchanged)
INLINE_VIDEO_TRANSCODE=true     # (unchanged)
```

Restart app after env change.

---

### 4. Proxy Limits (If Changed — 1 minute)

If you raised proxy body limits for 2GB support, revert:

**Nginx:**
```nginx
client_max_body_size 250M;  # was 2048M
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Caddy:**
```caddyfile
request_body {
  max_size 262144000  # was 2147483648
}
```
```bash
caddy reload
```

---

### 5. Container Limits (Optional — 1 minute)

If you increased Docker memory to 4-6GB, revert to previous:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2g  # was 4g
```

```bash
docker-compose up -d
```

**Note:** Lowering memory during rollback is optional—extra memory won't hurt. Only reduce if you need resources elsewhere.

---

## Data Cleanup (Optional — 10 minutes)

If Phase 0 was live long enough to create data in the new format:

### Orphaned Processing Videos

Videos uploaded during Phase 0 that are stuck in "processing" state after rollback:

```bash
# List videos with no thumbnail (pending worker processing)
find public/uploads -name "*.mp4" ! -exec test -f "{}.thumb.webp" \; -print

# Option A: Delete orphaned videos (clean slate)
find public/uploads -name "*.mp4" ! -exec test -f "{}.thumb.webp" \; -delete

# Option B: Keep videos, manually regenerate thumbnails
for video in $(find public/uploads -name "*.mp4" ! -exec test -f "{}.thumb.webp" \; -print); do
  ffmpeg -y -ss 00:00:01 -i "$video" -frames:v 1 -vf "scale='min(960,iw)':-2" \
    -c:v libwebp -quality 75 "${video}.thumb.webp"
done
```

### S3 Cleanup (If Enabled)

If using S3, orphaned videos may exist:

```bash
# List S3 videos without thumbnails
aws s3 ls s3://<bucket>/uploads/ --recursive | grep ".mp4$" | while read -r line; do
  key=$(echo "$line" | awk '{print $4}')
  thumb="${key}.thumb.webp"
  aws s3 ls "s3://<bucket>/$thumb" > /dev/null 2>&1 || echo "$key"
done

# Delete orphaned S3 videos (optional)
# aws s3 rm s3://<bucket>/<orphaned-key>
```

---

## Post-Rollback Verification

- [ ] App starts successfully
- [ ] Build has no errors
- [ ] Upload route accepts 250 MB files (pre-Phase0 limit)
- [ ] Existing media still renders (legacy paths work)
- [ ] No worker cron running
- [ ] No processing badge in UI (feature removed)

---

## Re-Deployment After Rollback

If you rolled back due to a specific bug:

1. Fix the issue in a branch
2. Re-test locally with full upload→worker→UI cycle
3. Deploy to staging first
4. Once validated, re-deploy to production using **DEPLOY-RUNBOOK-PHASE0.md**

---

## Known Rollback Limitations

### 1. Auth changes are sticky

CHG-006b/006c hardened `/uploads` route with ownership checks. Rolling back code **does not** undo the improved security. This is **safe** — users can only access their own media before and after rollback.

### 2. Middleware rename

If you deployed `proxy.ts` (CHG-010 cleanup), rolling back code will restore old `middleware.ts`. **Both work**, but you'll see the deprecation warning again (non-breaking).

### 3. CSS comment

Rolling back restores old CSS comment format. May cause tokenizer warning but **does not break build**.

---

## Emergency Contact / Escalation

If rollback doesn't restore service:

1. Check logs: `docker logs app` or `tail -f /var/log/app.log`
2. Verify database is accessible (Prisma connection)
3. Check disk space: `df -h` (uploads may have filled `/tmp` or `/public/uploads`)
4. Restart full stack: `docker-compose down && docker-compose up -d`

If still broken, restore from last known-good backup (database + `/public/uploads` volume).

---

## Success Criteria

Rollback is complete when:
- App serves traffic normally
- No upload failures
- No auth/ownership bypass
- Pre-Phase0 features work as before

You can then investigate the Phase 0 issue offline and re-deploy when fixed.
