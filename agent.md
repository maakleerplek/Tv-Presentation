# Maakleerplek TV Presentation — Agent Notes

## Project Overview
A full-screen TV presentation app for the maakleerplek community space.  
Displays a rotating slideshow of **Calendar events**, **News**, and a **Drink menu with QR codes**.

## Architecture
```
Tv-Presentation/
├── data-fetcher/          # Node.js Express + Cheerio scraper
│   ├── server.js          # Scrapes maakleerplek.be/kalender/ and homepage
│   ├── Dockerfile         # node:20-alpine
│   └── package.json       # ESM, Express, Cheerio, CORS
├── Tv-presentation/       # Astro frontend (static site → nginx)
│   ├── src/
│   │   ├── pages/index.astro        # Main Swiper.js slideshow
│   │   ├── layouts/Layout.astro     # Base layout, CSS vars, CDN imports
│   │   ├── components/
│   │   │   ├── CalendarSlide.astro   # Timeline with color-coded locations
│   │   │   ├── NewsSlide.astro       # 2-col grid, featured article
│   │   │   └── DrinksSlide.astro     # Menu + QR codes
│   │   └── data/tv-config.json      # All configuration (drinks, timing, branding)
│   ├── public/                       # Static assets (logos, QR images)
│   ├── Dockerfile                    # Multi-stage: build → nginx
│   └── nginx.conf
├── Public/                # Source logos (HTL SVG, maakleerplek PNG, AI)
└── docker-compose.yml     # frontend:8083, data-fetcher:8085
```

## Key Technical Decisions
- **Scraping**: Website has no public API → Cheerio parses HTML from `/kalender/` and homepage
- **Dutch dates**: Custom parser for "do 26 feb" → Date objects, with year-wraparound logic
- **Event enrichment**: Detail pages fetched for og:description, og:image (capped at 10 to be polite)
- **News filter**: Only items modified in the last 14 days (from `article:modified_time` meta)
- **Cache**: 15-minute in-memory cache on both endpoints
- **Frontend**: Astro (SSG) builds at Docker image creation time; fetches data from data-fetcher during build
- **Swiper.js**: CDN-loaded, fade effect, configurable interval via `tv-config.json`
- **Auto-refresh**: Page reloads every 30 minutes to pick up new data

## Configuration
All user-editable settings live in `Tv-presentation/src/data/tv-config.json`:
- Slide timing & transition effect
- Brand colors (primary teal `#008080`)
- Drink items & prices
- QR code URLs
- Calendar/news display limits
- Data-fetcher base URL

## Branding
- Primary: `#008080` (teal), Accent: `#00A89D`
- Font: Roboto (Google Fonts CDN)
- Icons: Material Symbols Outlined
- Logos: `maakleerplek-logo.png` (cube), `htl-logo.svg` (High Tech Lab)
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
- Event times not always available on calendar list page; fetched from detail pages when possible
- Both QR codes (order + Payconiq) are generated from URLs via [qrserver.com API](https://goqr.me/api/) — set URLs in `tv-config.json`
- Data is fetched at build time; auto-refresh reloads the page but doesn't re-scrape (scraper has its own cache)
