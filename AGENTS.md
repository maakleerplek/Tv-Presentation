# Maakleerplek TV Presentation — Agent Guide

## Project Overview

A full-screen TV presentation app for the maakleerplek makerspace, displayed on a 4K TV via
Chromecast (rendered at 1080p, upscaled). Shows current time/weather, an event/news carousel,
a drinks menu, and rotating tips at the bottom.

## Repository Structure

```
Tv-Presentation/
├── data-fetcher/          # Node.js 20 + Express + Cheerio scraper (plain ESM JS)
│   └── server.js          # Scrapes maakleerplek.be, serves JSON on :8080
├── Reworked website/      # Next.js 15 App Router frontend (TypeScript + Tailwind v4)
│   ├── app/               # Next.js routes: page.tsx, layout.tsx, api/screen-data/
│   ├── components/        # React UI components (clock, weather, event-carousel, etc.)
│   ├── hooks/             # Custom React hooks (useScreenData, use-mobile)
│   ├── lib/               # Shared utilities (cn() helper)
│   └── public/            # Static assets (logos, QR images)
├── Public/                # Brand assets (SVG/PNG logos)
├── docker-compose.yml     # Two services: frontend :8083, data-fetcher :8085
└── agent.md               # Domain/architecture notes (read this too)
```

## Build, Dev, and Lint Commands

All commands run inside `Reworked website/`. Use `npm` or `bun` (both lockfiles are present;
Bun is used in the Docker image).

```bash
# Development
cd "Reworked website"
npm run dev          # next dev — hot-reload dev server on :3000

# Production build
npm run build        # next build (TypeScript errors fail the build)
npm run start        # next start (serves the built app)

# Lint
npm run lint         # eslint . (uses eslint-config-next; errors do NOT fail builds)

# Clean
npm run clean        # next clean (removes .next/ build cache)
```

**Data-fetcher (plain Node.js, no build step):**
```bash
cd data-fetcher
npm start            # node --no-warnings server.js
npm run dev          # node --no-warnings --watch server.js  (auto-restarts)
```

**Docker (full stack):**
```bash
docker compose up --build    # Build and start both services
docker compose up            # Start with cached images
docker compose down          # Stop and remove containers
```

### Testing

**There are no automated tests in this repository.** No test runner (Jest, Vitest, Playwright,
etc.) is configured. The `data-fetcher/check-images.js` and `check-time.cjs` files are manual
debug scripts run with `node` directly, not part of any test suite.

If adding tests, prefer **Vitest** for the frontend (compatible with Vite/Next.js tooling) and
plain **Node.js `assert`** or Vitest for the data-fetcher.

## Architecture Notes

### Layout Grid

```
┌──────────────┬──────────────────────┬──────────────┐
│  Left (2/12) │    Middle (5/12)     │ Right (5/12) │
│  Clock       │  Event/News Carousel │  Drinks List │
│  Weather     │                      │  + QR codes  │
│  Status      │                      │              │
├──────────────┴──────────────────────┴──────────────┤
│              Tips Footer (120px height)             │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. `data-fetcher/server.js` scrapes `maakleerplek.be` (calendar + homepage) with Cheerio.
2. Next.js API route `app/api/screen-data/route.ts` proxies requests to the data-fetcher.
3. `hooks/useScreenData.ts` polls the API route from the browser and provides data to components.

### Key Scraper Selectors

```
.agenda_element, .agenda_date h4, .agenda_item
.agenda_item_title, .agenda_item_time
```

- Calendar: `https://maakleerplek.be/kalender/`
- Homepage (news): `https://maakleerplek.be/`

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** (`"strict": true` in tsconfig). All new code must be type-safe.
- `tsconfig.json` target is `ES2017`; module resolution is `bundler` (Next.js).
- The build (`next build`) will **fail on TypeScript errors**. Lint errors do not fail builds.
- Avoid `any` for new code. Existing hooks use `any[]` for API payloads as a pragmatic trade-off;
  prefer adding narrower types when touching those areas.
- Place types alongside their usage. There is no dedicated `types/` directory.
- Use `export type` for type-only exports.

### Imports and Module System

- **Frontend:** ESM (`import`/`export`). Never use `require()`.
- **Data-fetcher:** Also ESM (`"type": "module"` in its `package.json`).
- Use the `@/` path alias for all cross-directory imports within `Reworked website/`:
  ```ts
  import { useScreenData } from '@/hooks/useScreenData';
  import { cn } from '@/lib/utils';
  import { Clock } from '@/components/clock';
  ```
- Import order (not enforced by linter, but follow this convention):
  1. React / Next.js core
  2. Third-party libraries
  3. Internal `@/` imports
  4. Relative imports (if any)

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Component files | `kebab-case.tsx` | `event-carousel.tsx` |
| Hook files | `kebab-case.ts` (preferred) or `camelCase.ts` | `use-mobile.ts` |
| Component functions | `PascalCase` | `EventCarousel` |
| Hook functions | `use` prefix, `camelCase` | `useScreenData` |
| Utility functions | `camelCase` | `parseDateFromDutchString` |
| Constants | `SCREAMING_SNAKE_CASE` | `CACHE_DURATION_MS`, `DUTCH_MONTHS` |
| Private/runtime fields | `_` prefix | `_icon`, `_color` |

### React Component Conventions

- **Server Components by default.** Add `'use client'` only when the component uses hooks,
  browser APIs, or event listeners.
- `page.tsx` and `layout.tsx` are always Server Components.
- All interactive UI components (`clock.tsx`, `event-carousel.tsx`, etc.) must have `'use client'`
  at the top.
- Use **named exports** for all components and hooks:
  ```tsx
  export function Clock() { ... }
  ```
  Use default exports only where Next.js requires them (`page.tsx`, `layout.tsx`, `route.ts`).

### Styling — Tailwind CSS v4

- Tailwind v4 is driven by PostCSS. There is **no `tailwind.config.js`**.
- Entry point is `app/globals.css`: a single `@import "tailwindcss";` line.
- Use inline arbitrary values for the brand palette rather than config aliases:
  ```tsx
  className="bg-[#F5F2EB] text-[#2C1E16] border-[#2C1E16]"
  ```
- Brand colors: background `#F5F2EB` (warm cream), text/borders `#2C1E16` (dark brown).
- Use `cn()` from `@/lib/utils` (clsx + tailwind-merge) when conditionally combining classes.
- The layout targets a **1080p TV screen**. Use `xl:` breakpoints for responsive adjustments.
  Flex/grid containment utilities (`shrink-0`, `min-h-0`, `overflow-hidden`) are critical to
  prevent layout overflow on the fixed TV canvas.

### Fonts

- `Space Grotesk` — primary sans-serif font
- `JetBrains Mono` — monospace font
- Both loaded via `next/font/google` in `app/layout.tsx`.

### Animation

- Use `motion/react` (Framer Motion v12) — **not** `framer-motion` directly:
  ```ts
  import { motion, AnimatePresence } from 'motion/react';
  ```
- Prefer `AnimatePresence` with `mode="wait"` for slide/fade transitions between content.

### Error Handling

- **Client components:** Maintain `loading` and `error` state; render a full-panel fallback:
  ```tsx
  if (loading) return <div className="...">Loading...</div>;
  if (error || !data) return <div className="...">Error loading data</div>;
  ```
- **API routes (`route.ts`):** Use try/catch and return `NextResponse.json({ error }, { status: 500 })`.
- **Data-fetcher (`server.js`):** Use try/catch per route handler; log with `console.error` using
  module-prefixed tags: `[Calendar]`, `[News]`, `[Drinks]`.
- Defensive defaults: use `|| []` and `|| null` for missing API payload fields.

### Environment Variables

- Frontend env vars are defined in `Reworked website/.env.example`.
- Root `.env` (based on `.env.example`) provides Docker Compose vars (`HOST_PORT`).
- Access in Next.js: server-side vars are plain `process.env.VAR`; client-side vars must be
  prefixed `NEXT_PUBLIC_`.

## Known Limitations / Gotchas

- News scraping uses link-exclusion heuristics; brittle against site redesigns.
- Event times may be missing from the calendar listing and require a secondary fetch.
- `eslint.ignoreDuringBuilds: true` in `next.config.ts` means lint errors are silent in CI/CD.
- Two ESLint config files coexist (`.eslintrc.json` legacy + `eslint.config.mjs` flat). The flat
  config takes precedence in ESLint 9.
- `data-fetcher` has no TypeScript, no linting, and no tests. Keep it simple and well-commented.
