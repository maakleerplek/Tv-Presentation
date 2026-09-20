# Data-Fetcher

Node.js/Express service that aggregates all external data for the TV presentation: calendar events, news articles, drinks inventory, and wiki pricing. The Next.js frontend polls this service rather than hitting external sources directly.

## Running locally

```bash
cd data-fetcher
node --no-warnings --watch server.js   # dev — restarts on file changes
bun test                               # run all tests
bun test --watch                       # watch mode
```

The server starts on port `8080` (mapped to `8085` by docker-compose).

---

## File overview

```
server.js          Express entry point — wires routes and pre-warms caches
config.js          All environment variables with defaults
scraper-config.js  Hardcoded target URLs (can be overridden by env vars)
categorise.js      Classifies flat event list → workshops vs recurring events
event-detail.js    Fetches a single maakleerplek event page for extra metadata
utils.js           Pure helpers: date parsing, caching, string utilities
check-images.js    One-off script: logs which calendar events have no image
check-time.js      One-off script: logs which calendar events have no time

scrapers/
  calendar.js      WP REST API → upcoming events with images
  news.js          HTML scraper → recent news articles from /nl/verhalen
  drinks.js        Inventree REST API → current drinks/snacks inventory
  pricing.js       HTML scraper → machine & membership pricing from the wiki
```

---

## API endpoints

### `GET /api/screen-data`
The main endpoint. Calls all four scrapers concurrently and returns the full payload used by the TV screen.

```json
{
  "workshops":       [...],   // unique upcoming events (one-off workshops)
  "recurringEvents": [...],   // best upcoming instance of each recurring event
  "news":            [...],   // recent news articles
  "drinks":          [...],   // current inventory from Inventree
  "pricing":         { "memberships": [], "equipment": [], "materials": [], "workshops": [] },
  "config": {
    "transitionTime": 120,    // seconds per carousel slide
    "tipsTransitionTime": 60,
    "statusRotationTime": 10,
    "paymentQrUrl": "...",
    "wikiQrUrl": "...",
    "eventPriority": ["open (high tech) lab", "repair"],
    "tips": ["Ruim je werkplek op..."],
    "websiteQrUrl": "https://maakleerplek.be"
  }
}
```

### `GET /api/calendar`
Raw upcoming events before categorisation. Useful for debugging what the scraper found.

### `GET /api/news`
Raw news articles.

### `GET /api/drinks`
Raw inventory items.

### `GET /api/proxy-image?url=<encoded-url>`
Proxies an Inventree image, forwarding the auth token server-side so the frontend never needs it.

### `GET /api/health`
Returns `{ "status": "ok" }`. Used by monitoring / docker healthchecks.

### `GET /api/transition` / `GET /api/transition/check`
Manual carousel-skip trigger for UI testing. POSTing to `/api/transition` sets a timestamp that the frontend can poll to force an immediate slide advance.

---

## Scrapers

### `scrapers/calendar.js` — `scrapeCalendar()`

Fetches upcoming events from the public agenda (`/nl/agenda`).

The site ran on WordPress until September 2026 and exposed a `kalender` custom post type over the WP REST API. The rebuild onto Next.js removed the whole `/wp-json` surface, and the new site publishes no JSON API, so the agenda is read directly.

**How it works:**
1. Requests the current month plus `CALENDAR_MONTHS_AHEAD` more, one per call: `?view=month&month=YYYY-MM`. All months are fetched concurrently, each retrying once on a 5xx.
2. Parses every occurrence link. The agenda encodes an event in the anchor itself:
   ```
   href  = /nl/agenda/<slug>?date=YYYY-MM-DD
   title = "13:00–17:00 · YOUNG MAKER LAB (woensdag) · Jongeren · High Tech Lab · Gewoon binnenlopen"
            └─ time ──┘   └─ name ─────────────────┘   └─ cat ─┘  └─ lab (opt) ┘  └─ registration ─┘
   ```
   The lab segment is optional, so the title has four or five parts.
   Reading the rendered agenda means the site's own expansion of recurring events — including its holiday cancellations — comes for free, instead of having to duplicate that logic here.
3. Drops past dates and occurrences the agenda marks `Geannuleerd`, then deduplicates on `slug|date|time`: the responsive layout renders each occurrence twice, and consecutive months overlap at the edges.
4. Enriches events with description, image and price from each event page's schema.org `Event` JSON-LD. The budget is spent per **distinct event**, not per occurrence, so a weekly open lab costs one fetch and the result is copied onto all of its dates. Fetched in batches of 4 with a 300 ms gap, capped at `MAX_EVENT_DETAILS` events, and cached per slug for 6 hours.
5. Produces the `CalendarEvent` shape: `title`, `dateISO`, `date` (Dutch display string like "do 7 mei"), `time`, `price`, `imageUrl`, `description`, `link`, plus `slug`, `category`, `registration` and `location` from the agenda.
6. Sorts results ascending by `dateISO`, then `time`.

**Partial failure:** a month that fails is logged and skipped; the cache is only left untouched when *every* month fails.

**Caching:** 15-minute in-memory cache (controlled by `CACHE_DURATION_MS`).  
**Stale-while-revalidate:** after the first successful fetch, expired cache is returned immediately while a background refresh runs. This prevents slow responses after cache expiry.  
**Deduplication:** a single shared `inflightFetch` promise prevents multiple simultaneous fetches (e.g. pre-warm + incoming request both starting at the same time).

---

### `scrapers/news.js` — `scrapeNews()`

Scrapes recent news articles from `maakleerplek.be/nl/verhalen`.

**How it works:**
1. Fetches the `/nl/verhalen` archive page. It is server-rendered, so no JavaScript execution is needed.
2. Parses each story card: `<h3>` is the title, the first `<p>` is `"<date> · <author>"`, the second is the excerpt, and the `<img>` carries the image.
3. Recovers the original CDN image URL from the Next.js optimiser `src` (`/_next/image?url=<encoded>`).
4. Parses the long Dutch date ("18 september 2026") into a sortable timestamp, then skips articles older than `NEWS_MAX_AGE_DAYS`.
5. Sorts newest first and caps at `MAX_NEWS_ITEMS` articles (default 6).

Unlike the old scraper this never visits the individual article pages: the archive card already carries every field the screen displays.

**Caching / stale-while-revalidate:** same pattern as the calendar scraper.

---

### `scrapers/drinks.js` — `fetchDrinks()`

Fetches live stock from an [InvenTree](https://inventree.readthedocs.io/) instance.

**How it works:**
1. Calls `GET /api/stock/?part_detail=true&location_detail=true` with a 15-second timeout.
2. Filters stock items by `INVENTREE_DRINKS_LOCATIONS` (matched against the location name and path string). If no locations are configured, all items are included.
3. Groups items by part ID and sums quantities (one physical drink can have multiple stock records).
4. Derives a price string from `pricing_min`, `pricing_min_string`, or `sell_price` — whichever is populated.
5. Builds a `/api/proxy-image?url=...` URL for each thumbnail so the token stays server-side.

**Caching:** 5-minute cache (`DRINKS_CACHE_DURATION_MS`) — shorter than others because stock levels change more frequently.

---

### `scrapers/pricing.js` — `scrapeWikiPricing()`

Scrapes machine usage and membership pricing from the wiki (`WIKI_PRICING_URL`).

**How it works:**
1. Fetches the wiki page and walks every `<h1>`–`<h4>` heading.
2. Matches headings against `SECTION_MAP` keywords to identify sections (memberships, equipment, materials, workshops).
3. Calls `extractEntriesUnderHeading()` which walks the siblings of the heading until the next heading, collecting entries from `<ul>`, `<table>`, and `<details>` (accordion) elements.
4. `parseEntries()` handles two table layouts:
   - **Grid tables** (e.g. MDF sheet prices with dimension columns): expands into `rowLabel (colHeader) → price` pairs.
   - **Standard key-value tables**: column 0 = name, column 1 = price.
   - **Lists**: splits each `<li>` on `:`, `-`, `–`, or `€`.
5. Deduplicates entries by name within each section.

**Caching:** 15-minute cache.

---

### `categorise.js` — `categoriseEvents(calendar)`

Takes the flat array from `scrapeCalendar()` and splits it into two buckets:

- **`workshops`** — events whose title appears only once in the list (unique events), plus recurring-titled events that look like paid workshops.
- **`recurringEvents`** — events whose title appears multiple times, where the "best" instance is selected (currently running > soonest upcoming > skip past).

**How it decides:**
1. Counts normalised title occurrences across all events.
2. Events with a unique title → always a `workshop`.
3. Events with a repeated title → grouped. For each group, `pickBestInstance()` scores each instance using `scoreRecurringEvent()` (returns `-Infinity` for in-progress, `Infinity` for past, ms-until-start for future). The lowest score wins.
4. Each group is categorised: if the title contains workshop keywords (or has a paid price) AND does NOT match a known free-service keyword → `workshop`; otherwise → `recurringEvent`.

---

### `event-detail.js` — `fetchEventDetail(url)` / `parseEventDetailHtml(html)`

Fetches a single maakleerplek event page and extracts extra metadata. **Currently unused** — was used by the old HTML calendar scraper; the new REST API approach gets this data directly. Kept because the tests cover it.

`parseEventDetailHtml()` is exported separately from `fetchEventDetail()` so tests can pass raw HTML without needing a real HTTP request.

Extracts: `description` (from `og:description`, falling back to first `<article>` paragraph), `imageUrl` (from `og:image`, falling back through several CSS selectors), `time` (from a clock icon element, falling back to a regex on `<main>` text), `location` (from a location icon, falling back to known lab names), `price` (from a price icon, falling back to a `€` pattern).

---

### `utils.js`

Pure functions with no side effects — safe to import in tests without spinning up Express.

| Function | What it does |
|---|---|
| `parseDutchDate(text)` | Parses `"do 26 feb"` → `Date`. Bumps to next year if the date is >60 days in the past. |
| `stripHtml(str)` | Removes all HTML tags and collapses whitespace. |
| `truncate(str, maxLen)` | Truncates to `maxLen` chars with a `…` suffix. |
| `isCacheValid(cache, duration)` | Returns `true` if `cache.data` exists and is younger than `duration` ms. |
| `scoreRecurringEvent(event, now)` | Scores a recurring event instance for `pickBestInstance()`. Returns `-Infinity` (in progress), `Infinity` (past), or ms-until-start (future). |

---

### `config.js`

Single source of truth for all environment variables. Nothing here makes network calls.

| Export | Env var | Default | Purpose |
|---|---|---|---|
| `MAAKLEERPLEK_URL` | `MAAKLEERPLEK_URL` | `https://maakleerplek.be` | Base URL (parsed as `URL` object) |
| `SITE_LOCALE` | `SITE_LOCALE` | `nl` | Locale prefix the site redirects to |
| `CALENDAR_URL` | — | `{base}/{locale}/agenda` | Agenda page |
| `VERHALEN_URL` | — | `{base}/{locale}/verhalen` | News archive page |
| `CALENDAR_MONTHS_AHEAD` | `CALENDAR_MONTHS_AHEAD` | 3 | Extra agenda months to pull (1 request each) |
| `CACHE_DURATION_MS` | `CACHE_DURATION_MINUTES` | 15 min | General scraper cache lifetime |
| `DRINKS_CACHE_DURATION_MS` | `DRINKS_CACHE_DURATION_MINUTES` | 5 min | Drinks cache lifetime |
| `NEWS_MAX_AGE_DAYS` | `NEWS_MAX_AGE_DAYS` | 14 | Max age for news articles |
| `MAX_NEWS_ITEMS` | `MAX_NEWS_ITEMS` | 6 | Max news articles returned |
| `MAX_EVENT_DETAILS` | `MAX_EVENT_DETAILS` | 30 | Max distinct events given detail-page enrichment |
| `EVENT_PRIORITY` | `EVENT_PRIORITY` | `""` | Comma-separated priority keywords |
| `WORKSHOP_KEYWORDS` | — | `['workshop', 'initiatie', …]` | Keywords that flag an event as a workshop |
| `RECURRING_SERVICE_KEYWORDS` | — | `['open lab', 'repair', …]` | Keywords that flag a free community event |
| `WORKSHOP_CATEGORIES` | — | `['workshop']` | Agenda categories that mean "workshop" |
| `RECURRING_SERVICE_CATEGORIES` | — | `['open lab', 'jongeren', …]` | Agenda categories that mean "community service" |
| `CAROUSEL_TRANSITION_TIME` | `CAROUSEL_TRANSITION_TIME` | 15 s | Seconds per carousel slide |
| `TIPS_TRANSITION_TIME` | `TIPS_TRANSITION_TIME` | 10 s | Seconds per footer tip |
| `STATUS_ROTATION_TIME` | `STATUS_ROTATION_TIME` | 10 s | Status panel rotation speed |
| `PAYMENT_QR_URL` | `PAYMENT_QR_URL` | `""` | Payment QR code URL |
| `WIKI_QR_URL` | `WIKI_QR_URL` | `https://wiki…` | Wiki QR code URL |
| `TIPS` | `TIP_1`, `TIP_2`, … | `[]` | Footer tips (stops at first missing number) |
| `INVENTREE_URL` | `INVENTREE_URL` | `https://10.72.3.68:8443` | InvenTree base URL |
| `INVENTREE_TOKEN` | `INVENTREE_TOKEN` | — | InvenTree API token |
| `INVENTREE_DRINKS_LOCATIONS` | `INVENTREE_DRINKS_LOCATIONS` | `""` | Comma-separated location names to filter |
