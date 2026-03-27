# Tv-Presentation

Full-screen TV display for [maakleerplek](https://maakleerplek.be/) — a public makerspace in Leuven. Shows the current time, weather, upcoming events, news, a drinks/materials inventory, and machine usage rates on a 4K TV.

![Image of the website](Public/image.png)

## Layout

The screen is optimized for a 4K display and divided into three main columns:

```
┌─────────────┬──────────────────────┬──────────────────────┐
│ Clock       │                      │ Inventory (InvenTree)│
│ Weather     │   Event/News Carousel│                      │
│ Status      │                      ├──────────────────────┤
│             │                      │ Machine Usage (Wiki) │
├─────────────┴──────────────────────┴──────────────────────┤
│ Bezoek QR URL │      HTL Logo      │      Wiki QR URL     │
└────────────────────────────────────────────────────────────┘
```

- **Left:** Time, date, local weather, and currently running or next upcoming event.
- **Center:** A rotating carousel of upcoming workshops, recurring events, and recent news articles.
- **Right:** Live inventory from InvenTree (Drinks, Snacks & Materialen) and dynamic machine usage pricing scraped from the Wiki.
- **Footer:** Direct links to the website and the general Wiki page via QR codes.

## Features

### 🛠️ Dynamic Wiki Scraper
The data-fetcher service includes a resilient scraper that pulls live pricing and equipment data from the [High Tech Lab Wiki](https://wiki.maakleerplek.be/en/hightechlab).
- **Auto-detection:** Automatically identifies "Machine Gebruik" sections.
- **Resilient Parsing:** Handles standard tables, nested lists, and grid-style pricing (like MDF dimensions).
- **Caching:** Scraped data is cached along with calendar and news data to minimize load on the Wiki.

### 📦 InvenTree Integration
Pulls live stock levels and prices for drinks, snacks, and consumable materials directly from an InvenTree instance.

### 📅 Calendar & News
Scrapes the main maakleerplek.be website for the latest news and upcoming events, automatically prioritizing "high-profile" events like OpenLabs or Repair Cafés.

## Quick Start

```bash
# 1. Copy config
cp .env.example .env

# 2. Build and run
docker compose up --build
```

- Frontend: `http://localhost:8083`
- Data-fetcher API: `http://localhost:8085`

## Configuration

| Variable | Description |
|---|---|
| `MAAKLEERPLEK_URL` | Base URL of the website; also used for the "Bezoek" QR code |
| `WIKI_QR_URL` | URL encoded into the "Wiki" QR code in the footer |
| `WIKI_PRICING_URL` | The specific Wiki page to scrape machine usage from |
| `INVENTREE_URL` | URL of your InvenTree instance |
| `INVENTREE_TOKEN` | InvenTree API token |
| `INVENTREE_DRINKS_LOCATIONS` | Comma-separated location names to show in the inventory panel |
| `PAYMENT_QR_URL` | URL for the payment QR code shown in the inventory section |
| `CAROUSEL_TRANSITION_TIME` | Seconds per carousel slide (default `15`) |
| `EVENT_PRIORITY` | Comma-separated keywords; earlier = higher priority in the status panel |
| `WEATHER_LAT` / `WEATHER_LON` | Coordinates for Open-Meteo weather |
| `CACHE_DURATION_MINUTES` | How long scraped data is cached (default `15`) |

## Development

```bash
# Run docker compose
docker compose up --build 
# Frontend: http://localhost:8083
# Data-fetcher API: http://localhost:8085

## Tests

```bash
# Frontend
cd "Reworked website"
bun test

# Data-fetcher
cd data-fetcher
bun test
```

## Styling — Tailwind CSS v4

The project uses Tailwind CSS v4, which leverages native CSS features like `@theme` blocks and cascade layers (`@layer`) for maximum performance. Styling is driven by `@tailwindcss/postcss`.

- **Configuration:** No `tailwind.config.js`. CSS variables (originating from `next/font/google`) are mapped to utility classes inside `app/globals.css` via an `@theme` block.
- **TV Display Context:** The frontend is displayed on a Raspberry Pi running a modern Chromium browser capable of supporting v4 features like `oklch()` and `@property`.

## Tech Stack

- **Next.js 15** (App Router, TypeScript, Tailwind CSS v4)
- **Node.js + Express + Cheerio** — Modular data-fetcher service (with dedicated scrapers for calendar, news, pricing, and drinks)
- **InvenTree** — source for the drinks menu
- **Docker Compose** — runs both services together

## CI / CD

A GitHub Actions workflow is set up to automatically create and update a **Prerelease** whenever code is pushed to a PR targeting `master` or directly to `master`. The prerelease is tagged dynamically (e.g. `pr-42-abc1234` or `master-abc1234`) and automatically includes test verification.
