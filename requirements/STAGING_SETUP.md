# Car Maintenance App — Staging Setup

Created: 2026-03-24

## What was created

- `docker-compose.staging.yml` (new service on port **3012**)
- `staging/data/garage.db` (copied from running `garage-app`)
- `staging/uploads/` (copied from running `garage-app`)

## Run staging

```bash
cd /home/ji/.openclaw/workspace/apps/personal/car-maintenance
docker-compose -f docker-compose.staging.yml up -d --build
```

## Check status

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep garage-app-staging
curl -I http://127.0.0.1:3012
```

## Stop staging

```bash
docker-compose -f docker-compose.staging.yml down
```

## Notes

- Main app remains on **3011** (`garage-app`) and is untouched.
- Staging uses bind mounts under `./staging`, so migrations there won’t alter production volume data.
- If you want a fresh staging reset later:

```bash
rm -rf staging/data staging/uploads
mkdir -p staging/data staging/uploads
# then recopy from garage-app using docker cp
```
