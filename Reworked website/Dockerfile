FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install

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

# Mount a persistent cache directory so Next.js can reuse its build cache across Docker builds
RUN --mount=type=cache,target=/app/.next/cache bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

# Ensure bun user owns /app directory for SQLite database writes
RUN chown -R bun:bun /app

USER bun

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
