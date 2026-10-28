# Garage Work Manager - Dockerfile
FROM node:22-alpine AS base

# Install dependencies needed for Prisma + native modules + media optimization + OCR
RUN apk add --no-cache libc6-compat openssl ffmpeg tesseract-ocr tesseract-ocr-data-eng

WORKDIR /app

# ── deps stage ──────────────────────────────────────────────
FROM base AS deps
COPY app/package.json app/package-lock.json ./
RUN npm ci

# ── builder stage ────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output for smaller image)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BASE_URL=https://garagemeet.com
RUN npm run build

# ── runner stage ─────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + migrations + client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Uploads live in /uploads (mounted volume)
RUN mkdir -p /uploads && chown nextjs:nodejs /uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start
# DATABASE_URL (PostgreSQL) comes from the runtime environment
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
