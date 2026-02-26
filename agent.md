# Maakleerplek TV Presentation — Agent Notes

## Project Overview

A full-screen TV presentation app for the maakleerplek community space / makerspace.
Displays a **three-panel layout** with a **news carousel**, **calendar sidebar**, **drink menu**, and **rotating tips**.
Designed for a 4K TV via Chromecast (rendered at 1080p, upscaled).

## Architecture

```
Tv-Presentation/
├── data-fetcher/              # Node.js Express + Cheerio scraper
│   ├── server.js              # Scrapes maakleerplek.be/kalender/ and homepage
│   ├── Dockerfile             # node:20-alpine
│   └── package.json           # ESM, Express, Cheerio, CORS
├── Tv-presentation/           # Astro frontend (SSG → nginx)
│   ├── src/
│   │   ├── pages/index.astro          # Main page: 3-panel layout + all client JS
│   │   ├── layouts/Layout.astro       # Base layout, fonts, Tailwind import
│   │   ├── styles/global.css          # Tailwind v4 @theme (colors, fonts, shadows)
│   │   ├── components/
│   │   │   ├── CalendarPanel.astro    # Left sidebar: next 3 events
│   │   │   ├── NewsCarousel.astro     # Center: 3D carousel with blur/depth
│   │   │   ├── DrinksPanel.astro      # Right sidebar: menu + QR codes
│   │   │   └── TipsBox.astro          # Rotating tips below drinks
│   │   └── data/tv-config.json        # All configuration
│   ├── public/                         # Static assets (logos, QR images)
│   ├── Dockerfile                      # Multi-stage: build → nginx
│   └── nginx.conf
├── Public/                    # Source logos (HTL SVG, maakleerplek PNG)
└── docker-compose.yml         # frontend:8083, data-fetcher:8085
```

## Layout Design

```
┌─────────────────────────────────────────────────────┐
│  Header: logo + "maakleerplek" + clock              │
├──────────┬────────────────────────────┬──────────────┤
│ Calendar │      News Carousel        │  Drinks Menu │
│ (next 3  │  [prev] [ACTIVE] [next]   │  + QR codes  │
│ events)  │   blurred ← → blurred    │              │
│  18%     │        52%                │  + Tips box  │
│          │                           │     30%      │
└──────────┴────────────────────────────┴──────────────┘
```

- **Calendar Panel** (left): Shows next 3 upcoming events with date, title, time, location badge
- **News Carousel** (center): One article per slide, image left / text right, 3D depth transitions with prev/next slides blurred and scaled behind the active slide
- **Drinks Panel** (right): Single-column menu with emoji + name + price, QR codes for payment
- **Tips Box** (below drinks): Rotates through configurable tips with fade animation

## Key Technical Decisions

- **Tailwind CSS v4**: Using `@tailwindcss/vite` plugin with CSS-based `@theme` configuration in `global.css`
- **No Swiper.js**: Custom vanilla JS carousel with CSS transforms (`translateX`, `scale`, `filter: blur()`) for the 3D depth effect
- **Scraping**: Website has no public API → Cheerio parses HTML from `/kalender/` and homepage
- **Dutch dates**: Custom parser for "do 26 feb" → Date objects, with year-wraparound logic
- **Event enrichment**: Detail pages fetched for og:description, og:image (capped at 10)
- **News filter**: Only items modified in the last 14 days (from `article:modified_time` meta)
- **Cache**: 15-minute in-memory cache on both endpoints
- **Frontend**: Astro (SSG) builds static; fetches data client-side from data-fetcher
- **Auto-refresh**: Page reloads every 30 minutes to pick up new data

## Configuration

All user-editable settings live in `Tv-presentation/src/data/tv-config.json`:

- `carousel`: slide interval (seconds), transition speed, auto-refresh minutes
- `branding`: colors, org name, tagline
- `calendar`: max events to show, title
- `news`: max items, max age days, title
- `drinks`: items (name, price, emoji), QR URLs, subtitle
- `tips`: array of tip strings, rotation interval
- `dataFetcher`: API base URL, endpoints

## Branding

- Primary: `#008080` (teal), Accent: `#00A89D`
- Font: Inter (primary), Roboto (fallback) via Google Fonts CDN
- Icons: Material Symbols Outlined
- Logos: `maakleerplek-logo.png`, `htl-logo.svg` (fallback when news has no image)
- Background: `#FAFAFA` clean white

## Docker

- Frontend: port `${HOST_PORT:-8083}` → 80 (nginx)
- Data-fetcher: port `8085` → 8080 (Express)
- Data-fetcher URL inside Docker network: `http://data-fetcher:8080`

## Important URLs

- Calendar: https://maakleerplek.be/kalender/
- Homepage (news): https://maakleerplek.be/
- HTML selectors: `.agenda_element`, `.agenda_date h4`, `.agenda_item`, `.agenda_item_title`, `.agenda_item_time`

## Known Limitations

- News scraping relies on link filtering heuristics (exclusion list of known non-article paths)
- Event times not always available; fetched from detail pages when possible
- QR codes generated via [qrserver.com API](https://goqr.me/api/) — set URLs in `tv-config.json`
- Data is fetched client-side; auto-refresh reloads the page (scraper has its own cache)
