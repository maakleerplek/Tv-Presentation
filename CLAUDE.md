# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `app/page.tsx` — Root layout: 3-column grid (left: clock/weather/status; center: carousel; right: drinks) + footer.
- `app/admin/` — Password-protected admin panel for adding/deleting custom news items. Auth via Server Actions and cookies.

### Data-fetcher Key Files
- `server.js` — Express entry point. `/api/screen-data` aggregates all scrapers concurrently and returns the full payload. Pre-warms caches on startup.
- `scrapers/calendar.js`, `scrapers/news.js`, `scrapers/pricing.js`, `scrapers/drinks.js` — Purpose-built scrapers using Cheerio.
- `categorise.js` — Classifies calendar events as `workshops` vs `recurringEvents`.
- `config.js` — All env vars. `scraper-config.js` — Target URLs.
- `utils.js` — Cache validity helpers.

### Styling
Tailwind CSS v4 with no `tailwind.config.js` — configuration is done inside `app/globals.css` via `@theme` blocks. Palette: `bg-[#F5F2EB]` (beige), `text-[#2C1E16]` (dark brown), `#C8A98B` (accent). Heavy use of `border-2 border-[#2C1E16]`, no rounded corners, `font-black uppercase tracking-widest`.

### SSR & Caching Strategy
- Server Components fetch data via `lib/data.ts` using `next: { revalidate: 300 }` (5-minute Next.js cache).
- Data-fetcher caches scraped results in memory (`CACHE_DURATION_MINUTES`, default 15 min).
- All Client Components accept an `initialData` prop to avoid loading state on first render.
- `NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES` (build-time constant) controls how often clients re-poll.

### Environment Variables
Copy `.env.example` to `.env`. Key variables:
- `DATA_FETCHER_INTERNAL_URL` / `DATA_FETCHER_EXTERNAL_URL` — Next.js tries internal Docker URL first, falls back to external for local dev.
- `INVENTREE_URL` / `INVENTREE_TOKEN` — InvenTree API access (TLS verification disabled in data-fetcher).
- `INVENTREE_DRINKS_LOCATIONS` — Comma-separated location names to show in the drinks panel.
- `TRANSLATION_ENABLED` / `TRANSLATION_SOURCE_LANG` / `TRANSLATION_TARGET_LANG` / `LIBRETRANSLATE_URL` — Translation pipeline; MyMemory is the free fallback.
- `EVENT_PRIORITY` — Comma-separated keywords controlling which event appears in the "Nu bezig / Volgend" status panel.
- `TIP_1`, `TIP_2`, … — Footer tips, numbered sequentially.

## CI/CD
GitHub Actions (`.github/workflows/`) auto-creates a Prerelease on pushes to `master` or PRs targeting it, tagged as `master-<sha>` or `pr-<n>-<sha>`. Tests run as part of the workflow.
