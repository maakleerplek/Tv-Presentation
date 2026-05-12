# Tv-Presentation

Full-screen TV display for [maakleerplek](https://maakleerplek.be/) — a public makerspace in Leuven. Shows the current time, weather, upcoming events, news, a drinks/materials inventory, and machine usage rates on a 4K TV.

![Screenshot of the TV display](Public/image.png)

## Layout

The screen is optimized for a 4K display and divided into three main columns:

```
┌─────────────┬──────────────────────┬──────────────────────┐
│ Clock       │                      │ Inventory (InvenTree)│
│ Weather     │   Event/News Carousel│                      │
│ Status      │                      │                      │
├─────────────┴──────────────────────┴──────────────────────┤
│ Bezoek QR URL │      HTL Logo      │      Wiki QR URL     │
└────────────────────────────────────────────────────────────┘
```

- **Left:** Time, date, local weather, and currently running or next upcoming event.
- **Center:** A rotating carousel of upcoming workshops, recurring events, and recent news articles.
- **Right:** Live inventory from InvenTree (drinks, snacks & materials).
- **Footer:** Direct links to the website and the Wiki via QR codes.

## Features

### Dynamic Wiki Scraper
The data-fetcher service includes a resilient scraper that pulls live pricing and equipment data from the [High Tech Lab Wiki](https://wiki.maakleerplek.be/en/hightechlab).
- **Auto-detection:** Automatically identifies "Machine Gebruik" sections.
- **Resilient Parsing:** Handles standard tables, nested lists, and grid-style pricing (like MDF dimensions).
- **Caching:** Scraped data is cached along with calendar and news data to minimize load on the Wiki.

### InvenTree Integration
Pulls live stock levels and prices for drinks, snacks, and consumable materials directly from an InvenTree instance.

### Calendar & News
Scrapes the main maakleerplek.be website for the latest news and upcoming events, automatically prioritizing "high-profile" events like OpenLabs or Repair Cafés.

### Changelog API
External projects can report stock actions that are then shown as a live "Recent activity" feed in the inventory panel.

**Endpoint:** `POST /api/changelog`

**Body:**
```json
{
  "action": "checkout",
  "source": "my-project",
  "item_name": "Club Mate",
  "quantity": 2
}
```

| Field | Type | Values |
|---|---|---|
| `action` | string | `checkout` (sold), `add` (restocked), `remove`, `set` |
| `source` | string | Free-form identifier of the sending project |
| `item_name` | string | Human-readable name of the item |
| `quantity` | number | Positive integer |

The endpoint is available at the TV presentation URL (default port 8083). Failures are silently ignored so they never block the calling workflow.

**Integrations already included:**
- `stock-management-frontend` — set `VITE_TV_PRESENTATION_URL` in `.env`
- `interface-stock` — set `TV_PRESENTATION_URL` in `.env`

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
# Full stack
docker compose up --build

# Frontend only
cd "Reworked website"
bun install
bun run dev

# Data-fetcher only
cd data-fetcher
node --no-warnings --watch server.js
```

## Tests

```bash
# Frontend
cd "Reworked website"
bun test

# Data-fetcher
cd data-fetcher
bun test
```

## Tech Stack

- **Next.js 15** (App Router, TypeScript, Tailwind CSS v4, Bun runtime)
- **Node.js + Express + Cheerio** — Modular data-fetcher service
- **SQLite** (`bun:sqlite`) — Stores custom news items and admin credentials
- **InvenTree** — Source for the drinks/materials inventory
- **Docker Compose** — Orchestrates frontend, data-fetcher, and nginx reverse proxy

## CI / CD

A GitHub Actions workflow automatically creates a **Prerelease** on every push to `master` or a PR targeting it, tagged as `master-<sha>` or `pr-<n>-<sha>`. Tests run as part of the workflow.
