# TV Presentation Frontend

Astro-based static site that displays a full-screen rotating slideshow for the maakleerplek community TV.

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Astro | 5.x | Static site generator |
| Swiper.js | 11 (CDN) | Slide transitions & autoplay |
| Material Symbols | — | Icons |
| Roboto | — | Typography (Google Fonts) |
| nginx | Alpine | Production HTTP server |

## Slideshow Structure

The app has **3 slides** that rotate automatically:

### 1. Calendar Slide (`CalendarSlide.astro`)
- Timeline layout with events grouped by day
- Color-coded location badges (High Tech Lab → blue, TextielLab → orange, etc.)
- "Vandaag" / "Morgen" labels for today and tomorrow
- Event images and descriptions from `og:meta` enrichment
- Configurable max events via `tv-config.json`

### 2. News Slide (`NewsSlide.astro`)
- 2-column grid layout
- First item spans full width as "featured"
- Article images with gradient overlays
- Date badges
- Only shows articles from the last 2 weeks

### 3. Drinks Slide (`DrinksSlide.astro`)
- Two-column menu with dotted leaders between name and price
- Drink items configured in `tv-config.json`
- **Two QR codes** generated dynamically from URLs:
  - Order QR (teal) — link to ordering page
  - Payconiq QR (pink) — link to payment
- QR codes generated via [qrserver.com API](https://goqr.me/api/)

## Configuration (`src/data/tv-config.json`)

All settings are in one file:

```json
{
  "slideshow": {
    "intervalSeconds": 15,       // Time per slide
    "transitionEffect": "fade",  // Swiper effect (fade, slide, cube, etc.)
    "autoRefreshMinutes": 30     // Full page reload interval
  },
  "branding": { ... },          // Colors, name, tagline
  "calendar": { ... },          // Max events, title
  "news": { ... },              // Max items, max age
  "drinks": {
    "items": [ ... ],           // Menu items with name + price
    "qrOrderUrl": "...",        // URL for order QR code
    "qrPayconiqUrl": "..."      // URL for Payconiq QR code
  },
  "dataFetcher": {
    "baseUrl": "http://data-fetcher:8080"  // Backend URL (Docker network)
  }
}
```

## Layout & Styling

### Header Bar
- **Left**: maakleerplek cube logo (animated pulse) + organization name + tagline
- **Right**: High Tech Lab SVG logo + live clock (Dutch locale)

### Design System (CSS Custom Properties)
```css
--primary: #008080       /* Teal */
--primary-light: #00A89D
--bg-color: #FAFAFA      /* Clean white */
--surface: #FFFFFF
--shadow-sm/md/lg        /* 3 elevation levels */
--radius-sm/md/lg/xl     /* 4 border-radius levels */
```

### Progress Bar
A thin animated bar at the bottom of each slide shows time remaining before the next slide transition.

## Data Flow

```
Build time: Astro fetches from data-fetcher → static HTML
Runtime:    Swiper.js rotates slides, clock updates every second
            Page reloads every 30 minutes to refresh data
            QR codes generated client-side from URLs
```

> **Note**: Data is fetched during the Docker build. The page auto-refreshes every 30 minutes, which triggers a full reload but serves the same static build. For truly live data, the build would need to be re-triggered. The data-fetcher's own 15-minute cache ensures reasonable freshness.

## Logos

Logos sourced from `Public/` directory at project root:
- `maakleerplek-logo.png` — Teal cube logo (in header, with CSS pulse animation)
- `htl-logo.svg` — High Tech Lab wordmark (in header, CSS-filtered to teal)

## File Structure
```
Tv-presentation/
├── src/
│   ├── pages/
│   │   └── index.astro          # Main page: header + Swiper slideshow
│   ├── layouts/
│   │   └── Layout.astro         # HTML head, CSS reset, brand variables
│   ├── components/
│   │   ├── CalendarSlide.astro   # Timeline event display
│   │   ├── NewsSlide.astro       # News grid
│   │   └── DrinksSlide.astro     # Menu + QR codes
│   └── data/
│       └── tv-config.json        # All configuration
├── public/
│   ├── maakleerplek-logo.png     # Brand logo
│   └── htl-logo.svg              # High Tech Lab logo
├── Dockerfile                    # Multi-stage: node build → nginx serve
├── nginx.conf                    # nginx config for SPA
└── package.json
```

## Running Locally
```bash
cd Tv-presentation
npm install
npm run dev     # http://localhost:4321
```

## Docker
Multi-stage build:
1. `node:22-alpine` → `npm ci && npm run build`
2. `nginx:alpine` → serves `/dist` on port `80`

Exposed on port `${HOST_PORT:-8083}` via docker-compose.
