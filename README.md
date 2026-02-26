# Tv-Presentation

Full-screen TV display for [maakleerplek](https://maakleerplek.be/) — a public makerspace in Leuven. Shows news, upcoming events, drink menu, and tips on a 4K TV via Chromecast.

## Layout

Three-panel design: **Calendar** (left) · **News Carousel** (center) · **Drinks + Tips** (right)

## Tech

- **Astro** (SSG) + **Tailwind CSS v4**
- **Node.js** data-fetcher (Express + Cheerio scraper)
- **Docker** (frontend on nginx, data-fetcher on Express)

## Quick Start

```bash
docker compose up
```

Frontend: `http://localhost:8083` · Data-fetcher API: `http://localhost:8085`

## Configuration

All settings in `Tv-presentation/src/data/tv-config.json` — slide timing, drinks menu, tips, branding, and API endpoints.
