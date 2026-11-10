# CLAUDE.md

## Overview

Full-screen TV display for maakleerplek, a makerspace in Leuven. Shows time, weather, events, news, drinks inventory, and machine pricing on a 4K display (Raspberry Pi + Chromium).

Three services orchestrated by Docker Compose:
- **`Reworked website/`** — Next.js 15 frontend (App Router, TypeScript, Tailwind CSS v4, Bun runtime)
- **`data-fetcher/`** — Node.js/Express scraper (calendar, news, wiki pricing, InvenTree drinks)
- **`nginx/`** — Reverse proxy (port 8083 → frontend)

## Commands

### Full stack
```bash
cp .env.example .env          # configure before first run
docker compose up --build     # Frontend: http://localhost:8083 | Data-fetcher API: http://localhost:8085
```

### Frontend (`Reworked website/`)
```bash
cd "Reworked website"
bun install
bun run dev         # Next.js dev server
bun run build       # Production build
bun run lint        # ESLint
bun test            # Run all tests
bun test --watch    # Watch mode
bun test tests/db.test.ts  # Run a single test file
```

### Data-fetcher (`data-fetcher/`)
```bash
cd data-fetcher
node --no-warnings --watch server.js  # Dev with hot reload
bun test            # Run all tests
```

## Architecture

### Data Flow
```
data-fetcher (Express) ──→ Next.js server (getScreenData in lib/data.ts) ──→ page.tsx (SSR)
                                                                               │
                                                                      components (initialData prop)
                                                                               │
                                                               useScreenData hook (client polling)
```

The root page (`app/page.tsx`) is a Server Component that fetches all data at render time and passes it as `initialData` to each Client Component. This avoids loading flashes on the Raspberry Pi. The `useScreenData` hook then polls `/api/screen-data` in the background to keep data fresh without full page reloads.

### Frontend Key Files
- `lib/data.ts` — All server-side data fetching. Calls data-fetcher, merges custom news from SQLite, translates Dutch text via LibreTranslate or MyMemory fallback.
- `lib/db.ts` — SQLite access via `bun:sqlite`. Stores custom news items and admin credentials. Uses `eval('require')` to prevent Next.js from bundling `bun:sqlite` at build time.
- `lib/types.ts` — Shared TypeScript types (`ScreenData`, `CalendarEvent`, `NewsItem`, etc.)
- `hooks/useScreenData.ts` — Client-side polling hook. All interactive components should consume this.
- `hooks/useChangelog.ts` (15 s poll), `hooks/useDrinksData.ts`, `hooks/ScreenDataOverrideProvider.tsx` (overrides the data `useScreenData` returns).
- `app/api/` — `screen-data`, `drinks-data`, `changelog`, `weather`, `proxy-image`.
- `app/page.tsx` — Root layout: 3-column grid (left: clock/weather/status; center: carousel; right: drinks) + footer.
- `app/admin/` — Password-protected admin panel for adding/deleting custom news items. Auth via Server Actions and cookies.

### Data-fetcher Key Files
- `server.js` — Express entry point. `/api/screen-data` aggregates all scrapers concurrently and returns the full payload. Pre-warms caches on startup.
- `scrapers/calendar.js`, `scrapers/news.js`, `scrapers/pricing.js`, `scrapers/drinks.js` — Purpose-built scrapers using Cheerio. Calendar and news read the Next.js site at `/nl/agenda` and `/nl/verhalen`; the WordPress `/wp-json` API they used before September 2026 no longer exists.
- `categorise.js` — Classifies calendar events as `workshops` vs `recurringEvents`.
- `event-detail.js` — Reads one event page: schema.org JSON-LD first, Open Graph tags as fallback.
- `changelog-reporter.js` — Detects InvenTree stock changes and POSTs them to the frontend's `/api/changelog`. Skips events already logged by stock-frontend/interface-stock in the last 2 min.
- `config.js` — All env vars. `scraper-config.js` — Target URLs.
- `utils.js` — Cache validity helpers.

### Styling
Tailwind CSS v4 with no `tailwind.config.js` — configuration is done inside `app/globals.css` via `@theme` blocks. Palette: `bg-[#F5F2EB]` (beige), `text-[#2C1E16]` (dark brown), `#C8A98B` (accent). Heavy use of `border-2 border-[#2C1E16]`, no rounded corners, `font-black uppercase tracking-widest`.

### SSR & Caching Strategy
- Server Components fetch data via `lib/data.ts` using `next: { revalidate: 300 }` (5-minute Next.js cache).
- Data-fetcher caches scraped results in memory (`CACHE_DURATION_MINUTES`, default 15 min).
- All Client Components accept an `initialData` prop to avoid loading state on first render.
- `NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES` (build-time constant) controls how often clients re-poll.
- SQLite lives in the `tv-db` volume (`/app/data`). Without it, custom news and admin credentials are lost on every rebuild.

### Environment Variables
Copy `.env.example` to `.env`. Key variables:
- `DATA_FETCHER_INTERNAL_URL` / `DATA_FETCHER_EXTERNAL_URL` — Next.js tries internal Docker URL first, falls back to external for local dev.
- `INVENTREE_URL` / `INVENTREE_TOKEN` — InvenTree API access (used by the data-fetcher only).
- `INVENTREE_DRINKS_LOCATIONS` — Comma-separated location names to show in the drinks panel.
- `TRANSLATION_ENABLED` / `TRANSLATION_SOURCE_LANG` / `TRANSLATION_TARGET_LANG` / `LIBRETRANSLATE_URL` — Translation pipeline; MyMemory is the free fallback.
- `EVENT_PRIORITY` — Comma-separated keywords controlling which event appears in the "Nu bezig / Volgend" status panel.
- `CALENDAR_MONTHS_AHEAD` — How many agenda months past the current one to pull (one HTTP request each).
- `TIP_1`, `TIP_2`, … — Footer tips, numbered sequentially.

## Conventions
- Server Components by default; add `'use client'` only for hooks, browser APIs or event listeners. `page.tsx`, `layout.tsx` stay Server Components.
- Every interactive component (Clock, Carousel, ...) takes an `initialData` prop and reads data through the shared `useScreenData` hook (one poller for the whole page).
- All server-side fetches live in `lib/data.ts`; do not scatter `fetch` calls.
- TypeScript strict; the build fails on type errors. Use the `@/` alias for cross-directory imports, named exports (default only where Next.js requires it), `cn()` from `@/lib/utils` for conditional classes.
- Error handling: API routes use try/catch and return `NextResponse.json({ error }, { status: 500 })`; the data-fetcher logs with tags such as `[Calendar]`, `[News]`, `[Drinks]`.
- Fonts: Space Grotesk (sans) and JetBrains Mono via `next/font/google` in `app/layout.tsx`.

## Layout and performance
- Target is a Raspberry Pi running Chromium on a 4K TV (1080p canvas, upscaled). Keep client-side JS minimal and prefer CSS animations over JS animation libraries.
- Use flex/grid containment (`shrink-0`, `min-h-0`, `overflow-hidden`) so nothing overflows the fixed canvas.

## Docker and deploy
- `docker-compose.yml`: `nginx` (`tv-nginx`, `${HOST_PORT:-8083}`), `frontend` (`tv-frontend`, port 3000, no host port, only reachable via nginx), `data-fetcher` (`tv-data-fetcher`, 8080 inside, published as `127.0.0.1:8085`). Both app images run on Bun.
- `master` is production. `scripts/autodeploy.sh` runs from cron every 5 minutes and pulls (log: `.git/autodeploy.log`, details in `README.md`).

## Architecture rules
- Max ~400 lines per file; split before it grows past that.
- All InvenTree calls go through the data-fetcher. The frontend never calls InvenTree directly (`app/api/proxy-image` goes via the data-fetcher).
- Nothing is copied between repos (stock-frontend, interface-stock); share through an API instead.
- Known problems: caches stack (data-fetcher 15 min + Next.js `revalidate` 5 min + client poll 5 min), so changes can take up to ~25 min to show; news scraping relies on link-exclusion heuristics and breaks on site redesigns; event times sometimes need a second fetch from the detail page; `eslint.ignoreDuringBuilds: true` in `next.config.ts` hides lint errors in CI; two ESLint configs coexist (`.eslintrc.json` and `eslint.config.mjs`, the flat one wins).

## CI/CD
- `test.yml`, `build.yml` — run on push/PR to `main` and `master`.
- `prerelease.yml` — `master` only. Runs the tests, then creates a Prerelease tagged `master-<sha>` or `pr-<n>-<sha>`.
