# Tv-Presentation

Full-screen TV display for [maakleerplek](https://maakleerplek.be/) — a public makerspace in Leuven. Shows the current time, upcoming events, news, a drinks menu, and rotating tips on a 4K TV via Chromecast (rendered at 1080p).

![Image of the website](Public/image.png)

## Layout

```
┌─────────────┬──────────────────────┬──────────────┐
│ Clock       │                      │ Drinks menu  │
│ Weather     │   Event/News Carousel│ + QR payment │
│ Next event  │                      │              │
├─────────────┴──────────────────────┴──────────────┤
│                  Tips footer                       │
└────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Copy and fill in config
cp .env.example .env

# 2. Build and run
docker compose up --build
```

- Frontend: `http://localhost:8083`
- Data-fetcher API: `http://localhost:8085`

## Configuration

Copy `.env.example` to `.env` and set the values:

| Variable | Description |
|---|---|
| `HOST_PORT` | Host port for the frontend (default `8083`) |
| `INVENTREE_URL` | URL of your InvenTree instance |
| `INVENTREE_TOKEN` | InvenTree API token |
| `INVENTREE_DRINKS_LOCATIONS` | Comma-separated location names to show in the drinks panel |
| `NEXT_PUBLIC_PAYMENT_QR_URL` | URL encoded into the payment QR code |
| `CAROUSEL_TRANSITION_TIME` | Seconds per carousel slide (default `15`) |
| `CACHE_DURATION_MINUTES` | How long scraped data is cached (default `15`) |

## Development

```bash
# Frontend (hot reload on :3000)
cd "Reworked website"
npm run dev

# Data-fetcher (auto-restart on :8085)
cd data-fetcher
npm run dev
```

## Tech Stack

- **Next.js 15** (App Router, TypeScript, Tailwind CSS v4)
- **Node.js + Express + Cheerio** — scrapes maakleerplek.be for events and news
- **InvenTree** — source for the drinks menu
- **Docker Compose** — runs both services together
