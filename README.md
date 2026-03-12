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
# 1. Copy config (see "Getting the .env values" below)
cp .env.example .env

# 2. Build and run
docker compose up --build
```

- Frontend: `http://localhost:8083`
- Data-fetcher API: `http://localhost:8085`

## Chromecast

To cast the website to a Chromecast device:

1. Ensure your `.env` file has `CHROMECAST_NAME` (e.g. "HTL TV") and `FRONTEND_URL` set.
2. Run the cast command:
   ```bash
   docker compose --profile cast run chromecast
   ```
   *Note: If your device name has spaces, use the provided helper script instead:*
   ```bash
   bash scripts/cast.sh
   ```

This uses a custom Python-based caster (built on [pychromecast](https://github.com/home-assistant-libs/pychromecast)) to send the `FRONTEND_URL` to your TV.

## Getting the `.env` values

All deployment-specific values are stored as **GitHub repository secrets** so contributors don't need to share them over chat.

### Prerequisites

Install the [GitHub CLI](https://cli.github.com/) and authenticate:

```bash
gh auth login
```

### Pull all secrets into your `.env`

Run this from the repo root. It reads every secret from the repo and appends it to your local `.env`:

```bash
gh secret list --repo maakleerplek/Tv-Presentation --json name --jq '.[].name' | \
  while read name; do
    value=$(gh secret get "$name" --repo maakleerplek/Tv-Presentation 2>/dev/null || echo "")
    echo "$name=$value"
  done >> .env
```

> **Note:** GitHub Secrets are write-only — the CLI cannot read back the values once stored.
> If the command above produces empty values, ask a maintainer to share the `.env` file directly
> (e.g. via a password manager or private message).

### Push a new or updated secret

After editing `.env`, push any changed value back to GitHub:

```bash
# Single value
gh secret set MY_VAR --body "the-value" --repo maakleerplek/Tv-Presentation

# Or pipe from .env (push all at once)
grep -v '^#' .env | grep -v '^$' | while IFS='=' read -r key value; do
  gh secret set "$key" --body "$value" --repo maakleerplek/Tv-Presentation
done
```

## Configuration

All variables are documented in `.env.example`. Key ones:

| Variable | Description |
|---|---|
| `HOST_PORT` | Host port for the frontend (default `8083`) |
| `MAAKLEERPLEK_URL` | Base URL of the maakleerplek site; also used for the tips footer QR code |
| `INVENTREE_URL` | URL of your InvenTree instance |
| `INVENTREE_TOKEN` | InvenTree API token |
| `INVENTREE_DRINKS_LOCATIONS` | Comma-separated location names to show in the drinks panel |
| `PAYMENT_QR_URL` | URL encoded into the payment QR code in the drinks panel |
| `CAROUSEL_TRANSITION_TIME` | Seconds per carousel slide (default `15`) |
| `TIPS_TRANSITION_TIME` | Seconds per tip in the footer (default `10`) |
| `EVENT_PRIORITY` | Comma-separated keywords; earlier = higher priority in the status panel |
| `TIP_1`, `TIP_2`, … | Tips shown in the footer, in order |
| `WEATHER_LAT` / `WEATHER_LON` | Coordinates for Open-Meteo weather (no API key needed) |
| `CACHE_DURATION_MINUTES` | How long scraped data is cached (default `15`) |
| `CHROMECAST_IP` | IP address of your Chromecast device |
| `FRONTEND_URL` | Full URL (including IP/port) as reachable by the Chromecast |

## Development

```bash
# Frontend (hot reload on :3000)
cd "Reworked website"
npm run dev

# Data-fetcher (auto-restart on :8085)
cd data-fetcher
npm run dev
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

- **Next.js 15** (App Router, TypeScript, Tailwind CSS v4)
- **Node.js + Express + Cheerio** — scrapes maakleerplek.be for events and news
- **InvenTree** — source for the drinks menu
- **Docker Compose** — runs both services together
