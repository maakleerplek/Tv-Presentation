# Data-Fetcher Backend

Node.js scraper service that periodically fetches calendar events and news from [maakleerplek.be](https://maakleerplek.be).

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 (Alpine) | Runtime |
| Express | 4.x | HTTP server |
| Cheerio | 1.x | HTML parsing/scraping |
| CORS | 2.x | Cross-origin headers |

## API Endpoints

### `GET /api/calendar`
Returns upcoming events scraped from the [calendar page](https://maakleerplek.be/kalender/).

**Response** — Array of event objects:
```json
[
  {
    "title": "Open (High Tech) Lab op donderdag",
    "location": "High Tech Lab",
    "date": "do 27 feb",
    "dateISO": "2026-02-27",
    "link": "https://maakleerplek.be/kalender/open-high-tech-lab-op-donderdag-10/",
    "description": "Kom langs in het High Tech Lab...",
    "imageUrl": "https://maakleerplek.be/wp-content/uploads/...",
    "time": "18:00 - 22:00"
  }
]
```

**Scraping logic:**
1. Fetches HTML from `/kalender/`
2. Parses `.agenda_element` blocks → one block per day
3. Reads `.agenda_date h4` for the Dutch date (e.g. "do 26 feb")
4. Reads `.agenda_item` for each event (title, location, link)
5. Enriches the **first 10** events by fetching their detail pages for `og:description`, `og:image`, and time patterns
6. Skips past dates (before today)

### `GET /api/news`
Returns recent news articles from the [homepage](https://maakleerplek.be).

**Response** — Array of news objects:
```json
[
  {
    "title": "Nieuwe workshops in maart",
    "description": "Ontdek onze nieuwe workshops...",
    "imageUrl": "https://maakleerplek.be/wp-content/uploads/...",
    "date": "25/02/2026",
    "link": "https://maakleerplek.be/nieuwe-workshops-maart/"
  }
]
```

**Scraping logic:**
1. Fetches HTML from the homepage
2. Finds article-like links (filters out navigation, calendar, wp-admin, etc.)
3. Enriches each article by fetching its page for `og:description`, `og:image`, `article:modified_time`
4. Filters out articles older than **14 days** (configurable via `NEWS_MAX_AGE_DAYS`)
5. Capped at 6 articles

### `GET /api/health`
Health check endpoint returning cache status.

## Caching
Both endpoints use a **15-minute in-memory cache** (`CACHE_DURATION_MS`). On startup, caches are pre-warmed by immediately scraping both endpoints.

## Dutch Date Parsing
The calendar page uses short Dutch dates like `"do 26 feb"`. The parser:
- Maps Dutch month abbreviations → month index (`jan=0`, `feb=1`, `maa/mrt=2`, etc.)
- Uses current year, bumps to next year if the date is >2 months in the past
- Returns ISO date strings for easy frontend sorting

## Running Locally
```bash
cd data-fetcher
npm install
npm run dev    # uses --watch for live reload
# or
npm start      # production
```
Server starts on port `8080` (configurable via `PORT` env var).

## Docker
```dockerfile
FROM node:20-alpine
# see data-fetcher/Dockerfile
```
Exposed on port `8085` via docker-compose.

## File Structure
```
data-fetcher/
├── server.js         # Express server with scraping logic
├── package.json      # Dependencies & scripts
├── package-lock.json # Lock file
└── Dockerfile        # Production container
```
