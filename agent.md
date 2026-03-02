# Maakleerplek TV Presentation — Agent Notes

## Project Overview

A full-screen TV presentation app for the maakleerplek community space / makerspace.
Displays a layout with **current info (time, weather, event)**, **news carousel**, **drink menu**, and **rotating tips** at the bottom.
Designed for a 4K TV via Chromecast (rendered at 1080p, upscaled).

## Architecture

```
Tv-Presentation/
├── data-fetcher/              # Node.js Express + Cheerio scraper
│   ├── server.js              # Scrapes maakleerplek.be/kalender/ and homepage
│   ├── Dockerfile             # node:20-alpine
│   └── package.json           # ESM, Express, Cheerio, CORS
├── Reworked website/          # Next.js frontend (React + Tailwind CSS v4)
│   ├── app/                   # Next.js App Router (page.tsx, layout.tsx)
│   │   └── api/               # API routes (e.g., screen-data)
│   ├── components/            # React UI components (Clock, Weather, EventCarousel, DrinksList, etc.)
│   ├── lib/                   # Utility functions
│   ├── public/                # Static assets (logos, QR images)
│   ├── Dockerfile             # Multi-stage Bun build for production
│   ├── package.json           # Next.js, React, Tailwind v4
│   └── screen-data.json       # Example/cached data
├── README.md                  # Project documentation
└── docker-compose.yml         # frontend:8083, data-fetcher:8085
```

## Layout Design

```
┌─────────────────────────────────────────────────────┐
│  Left (16%)  │       Middle (42%)    │ Right (42%)  │
├──────────────┼───────────────────────┼──────────────┤
│  Clock       │     News / Event      │  Drinks List │
│  Weather     │       Carousel        │  + QR codes  │
│  Status      │                       │              │
├──────────────┴───────────────────────┴──────────────┤
│                Tips Footer (120px height)           │
└─────────────────────────────────────────────────────┘
```

- **Left Section** (2/12): Shows current time (Clock), Weather, and current event/status.
- **Middle Section** (5/12): Event/News Carousel. Auto-sliding articles.
- **Right Section** (5/12): Drinks List with pricing and QR codes for payment.
- **Footer Section** (Bottom 120px): Rotating tips with fade animations.

## Key Technical Decisions

- **Next.js & React**: Utilizing modern Next.js App Router (`Reworked website/`).
- **Tailwind CSS v4**: Using Tailwind for rapid, responsive UI styling.
- **Bun**: Next.js is built and served using Bun instead of Node in the frontend container.
- **Scraping**: Website has no public API → Cheerio parses HTML from `/kalender/` and homepage via the `data-fetcher` Express app.
- **Dockerized**: Two services defined in `docker-compose.yml` (`frontend` and `data-fetcher`), managing port mappings and building images cleanly.

## Configuration

Settings and configuration are primarily managed via Environment Variables pointing to `.env` files (based on `.env.example` in `Reworked website`).

## Branding

- Background: `#F5F2EB` (Warm cream color).
- Text/Accent: `#2C1E16` (Dark brown/black) used for text, borders, and selection highlight.

## Docker Setup

- **Frontend (`tv-frontend`)**: Reaches port `3000` internally, exposed at `${HOST_PORT:-8083}`.
- **Data-fetcher (`tv-data-fetcher`)**: Reaches port `8080` internally, exposed at `8085`.
- **Quick start**: `docker compose up --build` will run both services and map ports.

## Important URLs

- Calendar: https://maakleerplek.be/kalender/
- Homepage (news): https://maakleerplek.be/
- HTML selectors (Backend): `.agenda_element`, `.agenda_date h4`, `.agenda_item`, `.agenda_item_title`, `.agenda_item_time`

## Known Limitations

- News scraping relies on link filtering heuristics (exclusion list of known non-article paths).
- Event times not always available; fetched from detail pages when possible.
