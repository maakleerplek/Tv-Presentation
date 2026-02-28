# Tv-Presentation

Full-screen TV display for [maakleerplek](https://maakleerplek.be/) — a public makerspace in Leuven. Shows news, upcoming events, drink menu, and tips on a 4K TV via Chromecast.

## Layout

Three-panel design: **Info current even, weather, time (left)** · **News Carousel** (center) · **Drinks + Tips** (right)

## Tech

- **Next.js + react** + **Tailwind CSS v4**
- **Node.js** data-fetcher (Express + Cheerio scraper)
- **Docker** (frontend on nginx, data-fetcher on Express)

## Quick Start

```bash
docker compose up --build
```

Frontend: `http://localhost:8083` · Data-fetcher API: `http://localhost:8085`

## Configuration

All settings in `Reworked website/src/data/tv-config.json` — slide timing, drinks menu, tips, branding, and API endpoints.
or in .env.example _Copy this file and rename it to .env and fill in your configuration_