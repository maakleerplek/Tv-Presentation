FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_ vars must be present at build time — receive them as build args
ARG NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES=5
ENV NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES=$NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/.next ./.next
COPY --from=builder /app/public ./public

USER bun

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "start"]
