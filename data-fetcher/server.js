import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import https from 'https';
import { parseDutchDate, stripHtml, truncate, isCacheValid as isCacheValidUtil, DUTCH_MONTHS } from './utils.js';
import { fetchEventDetail } from './event-detail.js';

const app = express();
app.use(cors());

// Global bypass for self-signed certificates (InvenTree)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Configurable via .env ────────────────────────────────────────
const MAAKLEERPLEK_URL  = (process.env.MAAKLEERPLEK_URL || 'https://maakleerplek.be').replace(/\/$/, '');
const CALENDAR_URL      = `${MAAKLEERPLEK_URL}/kalender/`;
const HOMEPAGE_URL      = `${MAAKLEERPLEK_URL}/`;
const CACHE_DURATION_MS = parseInt(process.env.CACHE_DURATION_MINUTES || '15', 10) * 60 * 1000;
const DRINKS_CACHE_DURATION_MS = parseInt(process.env.DRINKS_CACHE_DURATION_MINUTES || '5', 10) * 60 * 1000;
const NEWS_MAX_AGE_DAYS = parseInt(process.env.NEWS_MAX_AGE_DAYS       || '14', 10);
const MAX_NEWS_ITEMS    = parseInt(process.env.MAX_NEWS_ITEMS          || '6',  10);
const MAX_EVENT_DETAILS = parseInt(process.env.MAX_EVENT_DETAILS       || '30', 10);
// Comma-separated list of title keywords in priority order, e.g. "openlab,repair,young maker"
// Events whose title contains an earlier keyword beat those with a later keyword when both qualify.
const EVENT_PRIORITY = (process.env.EVENT_PRIORITY || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Numbered tips shown in the footer: TIP_1, TIP_2, TIP_3, …
// Collected in numeric order; stops at the first missing index.
const TIPS = (() => {
    const tips = [];
    for (let i = 1; ; i++) {
        const val = process.env[`TIP_${i}`];
        if (!val) break;
        tips.push(val.trim());
    }
    return tips;
})();

// State for manual transitions via /api/transition
let forceTransitionTime = Date.now();

// ── In-memory cache ──────────────────────────────────────────────
let calendarCache = { data: null, timestamp: 0 };
let newsCache = { data: null, timestamp: 0 };
let drinksCache = { data: null, timestamp: 0 };

/** Wrap isCacheValidUtil with a default duration from this module's config. */
function isCacheValid(cache, duration = CACHE_DURATION_MS) {
    return isCacheValidUtil(cache, duration);
}

// ── Calendar Scraper ─────────────────────────────────────────────
async function scrapeCalendar() {
    if (isCacheValid(calendarCache)) return calendarCache.data;

    console.log('[Calendar] Scraping', CALENDAR_URL);
    const response = await fetch(CALENDAR_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const events = [];

    // Each .agenda_element contains one day
    $('.agenda_element').each((_, dayEl) => {
        const dateText = $(dayEl).find('.agenda_date h4').text().trim();
        const date = parseDutchDate(dateText);
        if (!date) return;

        // Skip dates that have already passed (before today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return;

        // Each .agenda_item is one event
        $(dayEl).find('.agenda_item').each((_, itemEl) => {
            const titleRaw = $(itemEl).find('.agenda_item_title').text().trim();
            const timeRaw = $(itemEl).find('.agenda_item_time').text().trim();
            const link = $(itemEl).find('a').attr('href') || '';

            // The calendar list HTML uses `.agenda_item_time` for either the exact time OR the location!
            let timeStr = '';
            let locationStr = '';
            // If the string contains a digit, it's a time (e.g. 18:00 - 20:00). Otherwise, it's a location (e.g. "Grafisch Lab").
            if (/(\d{1,2}[:.]\d{2})/.test(timeRaw)) {
                timeStr = timeRaw;
            } else {
                locationStr = timeRaw;
            }

            // If no time was found in .agenda_item_time, check if the title itself contains a
            // time pattern like "Workshop naam 19:00" or "19:00 - 21:00 Naam".
            // Extract the time range (or single time) from the title and strip it from the display title.
            let title = titleRaw;
            if (!timeStr) {
                const titleTimeMatch = titleRaw.match(/\b(\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}|\d{1,2}[:.]\d{2})\b/);
                if (titleTimeMatch) {
                    timeStr = titleTimeMatch[0].replace(/\./g, ':').trim();
                    // Remove the matched time (and any surrounding separators/spaces) from the title
                    title = titleRaw.replace(titleTimeMatch[0], '').replace(/^\s*[-–|:]\s*|\s*[-–|:]\s*$/g, '').trim();
                }
            }

            if (title) {
                // Build dateISO from local date parts to avoid UTC timezone shift.
                // new Date(...).toISOString() converts to UTC which can give the wrong
                // calendar day when the server runs in a timezone east of UTC (e.g. Belgium).
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const dateISO = `${date.getFullYear()}-${mm}-${dd}`;
                events.push({
                    title,
                    location: locationStr,
                    time: timeStr,
                    date: dateText,
                    dateISO,
                    link,
                });
            }
        });
    });

    // Always fetch details for recurring-keyword events (they appear prominently in the UI
    // regardless of their position in the calendar list). For all other events, only fetch
    // details for the first MAX_EVENT_DETAILS to cap scraping time.
    const recurringKeywordsForDetail = ['openlab', 'young maker', 'repair'];
    const detailPromises = events.map(async (event, i) => {
        const isRecurringKeyword = recurringKeywordsForDetail.some(kw =>
            event.title.toLowerCase().includes(kw)
        );
        const withinLimit = i < MAX_EVENT_DETAILS;
        if (event.link && (isRecurringKeyword || withinLimit)) {
            const detail = await fetchEventDetail(event.link);
            return {
                ...event,
                ...detail,
                time: detail.time || event.time,
                location: detail.location || event.location || 'maakleerplek'
            };
        }
        return event;
    });

    const enrichedEvents = await Promise.all(detailPromises);
    // Merge enriched events back
    const result = events.map((event, i) => {
        if (i < enrichedEvents.length) return enrichedEvents[i];
        return event;
    });

    calendarCache = { data: result, timestamp: Date.now() };
    console.log(`[Calendar] Scraped ${result.length} upcoming events`);
    return result;
}

// ── News Scraper ─────────────────────────────────────────────────
async function scrapeNews() {
    if (isCacheValid(newsCache)) return newsCache.data;

    console.log('[News] Scraping', HOMEPAGE_URL);
    const response = await fetch(HOMEPAGE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const newsItems = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - NEWS_MAX_AGE_DAYS);

    // News items are listed as links in the "Nieuws" section on the homepage.
    // We collect candidate URLs here; titles will be replaced by og:title from the detail fetch.
    // Only keep slug-like paths (no taxonomy/system paths, no query strings, no anchors).
    const EXCLUDED_PATHS = [
        '/wp-admin/', '/wp-json/', '/wp-content/', '/wp-includes/',
        '/kalender/', '/partners/', '/deelplekken/', '/contact/', '/zoeken',
        '/nieuwsbrief', '/leefregels/', '/foto-studio/', '/word-vrijwilliger/',
        '/wat-is-maakleerplek/', '/wat-kan-ik-er-komen-doen/', '/verhalen/',
        '/leuven-river-upcycling/', '/kantine', '/feed/', '/page/',
        '/algemene-voorwaarden/', '/privacy', '/toegankelijkheid/',
    ];

    $('a[href*="maakleerplek.be/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        // Must be a clean slug URL (no hash, no query string)
        if (href.includes('#') || href.includes('?')) return;

        // Skip all known non-article paths
        if (EXCLUDED_PATHS.some(p => href.includes(p))) return;

        // Skip the bare homepage itself
        if (href.replace(/\/$/, '') === 'https://maakleerplek.be') return;

        // Avoid duplicate URLs
        if (newsItems.some(n => n.link === href)) return;

        // Use href as placeholder title — will be overwritten by og:title below
        newsItems.push({ title: '', link: href });
    });

    // Fetch detail info from each news article page
    const enrichedItems = [];
    for (const item of newsItems.slice(0, MAX_NEWS_ITEMS)) {
        try {
            const resp = await fetch(item.link, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!resp.ok) continue;
            const articleHtml = await resp.text();
            const $a = cheerio.load(articleHtml);

            // Get the REAL title from og:title (most reliable)
            const ogTitle = $a('meta[property="og:title"]').attr('content') || '';
            const pageTitle = $a('title').text().trim().split('|')[0].trim();
            const h1Title = $a('h1.entry-title, h1.post-title, h1').first().text().trim();

            // Pick the best title: og:title > h1 > page title > clean scraped title > slug
            // Strip " - maakleerplek" suffix that WordPress appends to og:title
            let cleanTitle = (ogTitle || h1Title || pageTitle).replace(/\s*[-–]\s*maakleerplek\s*$/i, '').trim();
            if (!cleanTitle || cleanTitle.startsWith('<')) {
                // Fallback: extract title from URL slug
                const slug = item.link.replace(/\/$/, '').split('/').pop() || '';
                cleanTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }

            const description = $a('meta[property="og:description"]').attr('content') || '';
            let imageUrl = $a('meta[property="og:image"]').attr('content') ||
                $a('.wp-post-image').attr('src') ||
                $a('.post-thumbnail img').attr('src') ||
                $a('.elementor-post__thumbnail img').attr('src') ||
                $a('article img').first().attr('src') ||
                $a('main img').first().attr('src') || '';

            if (imageUrl.startsWith('http://')) {
                imageUrl = imageUrl.replace('http://', 'https://');
            } else if (imageUrl && !imageUrl.startsWith('https://') && imageUrl.startsWith('/')) {
                imageUrl = `${MAAKLEERPLEK_URL}${imageUrl}`;
            } else if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `${MAAKLEERPLEK_URL}/${imageUrl}`;
            }
            const modifiedTime = $a('meta[property="article:modified_time"]').attr('content') || '';

            // Check if article is within the last 2 weeks
            if (modifiedTime) {
                const articleDate = new Date(modifiedTime);
                if (articleDate < cutoffDate) continue; // Skip old articles
            }

            enrichedItems.push({
                ...item,
                title: cleanTitle,
                description,
                imageUrl,
                date: modifiedTime ? new Date(modifiedTime).toLocaleDateString('en-GB') : '',
            });
        } catch {
            // Skip articles that fail to fetch
        }
    }

    newsCache = { data: enrichedItems, timestamp: Date.now() };
    console.log(`[News] Found ${enrichedItems.length} recent news items`);
    return enrichedItems;
}

// ── Inventree Drinks Scraper ───────────────────────────────────────
const INVENTREE_URL = process.env.INVENTREE_URL || 'https://10.72.3.68:8443';
const INVENTREE_TOKEN = process.env.INVENTREE_TOKEN;
const INVENTREE_DRINKS_CATEGORY = process.env.INVENTREE_DRINKS_CATEGORY || 'drinks';
// Supports comma-separated list of locations, e.g. "HTL-fridge,HTL-snacks"
// Falls back to singular INVENTREE_DRINKS_LOCATION for backwards compatibility
const INVENTREE_DRINKS_LOCATIONS = (
    process.env.INVENTREE_DRINKS_LOCATIONS || process.env.INVENTREE_DRINKS_LOCATION || ''
).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// ── Carousel config ────────────────────────────────────────────────
// Number of seconds each carousel slide is shown before advancing
const CAROUSEL_TRANSITION_TIME = parseInt(process.env.CAROUSEL_TRANSITION_TIME || '15', 10);
// Number of seconds each page of the drinks list is shown before advancing
const DRINKS_TRANSITION_TIME = parseInt(process.env.DRINKS_TRANSITION_TIME || '30', 10);
// Number of seconds each tip is shown before advancing
const TIPS_TRANSITION_TIME = parseInt(process.env.TIPS_TRANSITION_TIME || '10', 10);
// URL encoded into the payment QR code in the drinks panel
const PAYMENT_QR_URL = process.env.PAYMENT_QR_URL || '';

// Helper function to fetch with a timeout
const fetchWithTimeout = async (resource, options = {}, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

async function fetchDrinks() {
    if (isCacheValid(drinksCache, DRINKS_CACHE_DURATION_MS)) return drinksCache.data;
    if (!INVENTREE_TOKEN) {
        console.warn('[Drinks] No INVENTREE_TOKEN configured');
        return [];
    }

    console.log('[Drinks] Fetching from Inventree', INVENTREE_URL);
    try {
        // Fetch stock items with part and location details
        const stockRes = await fetchWithTimeout(`${INVENTREE_URL}/api/stock/?part_detail=true&location_detail=true`, {
            headers: { 'Authorization': `Token ${INVENTREE_TOKEN}` }
        }, 15000);

        if (!stockRes.ok) {
            console.error('[Drinks] Failed to fetch stock', stockRes.status);
            return [];
        }

        const stockData = await stockRes.json();
        const stockItems = Array.isArray(stockData) ? stockData : (stockData.results || []);

        console.log('[Drinks] Found', stockItems.length, 'total stock items');
        if (stockItems.length > 0 && INVENTREE_DRINKS_LOCATIONS.length > 0) {
            const locs = new Set(stockItems.map(i => i.location_detail?.name).filter(Boolean));
            console.log('[Drinks] Available locations:', Array.from(locs).join(', '));
            console.log('[Drinks] Filtering by locations:', INVENTREE_DRINKS_LOCATIONS.join(', '));
        }

        // Map and group by part ID to aggregate stock
        const drinksMap = new Map();
        const categoryNameLower = INVENTREE_DRINKS_CATEGORY ? INVENTREE_DRINKS_CATEGORY.toLowerCase() : '';

        for (const item of stockItems) {
            const partDetail = item.part_detail || {};
            const locDetail = item.location_detail || {};

            // Filter by configured locations if any are specified — match any in the list
            if (INVENTREE_DRINKS_LOCATIONS.length > 0) {
                const locName = (locDetail.name || '').toLowerCase();
                const locPath = (locDetail.pathstring || '').toLowerCase();
                const matched = INVENTREE_DRINKS_LOCATIONS.some(
                    loc => locName.includes(loc) || locPath.includes(loc)
                );
                if (!matched) continue;
            }

            // Exclude items without a valid part name
            if (!partDetail.name) continue;

            const partId = item.part;
            const quantity = parseFloat(item.quantity || 0);

            if (!drinksMap.has(partId)) {
                // Determine price
                let price = "-";
                // In part_detail from stock, pricing might be in pricing_min or sell_price
                if (partDetail.pricing_min) {
                    price = '€' + parseFloat(partDetail.pricing_min).toFixed(2);
                } else if (partDetail.pricing_min_string) {
                    price = partDetail.pricing_min_string;
                } else if (partDetail.sell_price) {
                    price = '€' + parseFloat(partDetail.sell_price).toFixed(2);
                } else if (partDetail.description && partDetail.description.toLowerCase() !== partDetail.name.toLowerCase()) {
                    price = partDetail.description;
                }

                // Proxy image URL
                let imageUrl = null;
                const imgSource = partDetail.thumbnail || partDetail.image;
                if (imgSource) {
                    // Ensure it's an absolute URL
                    const fullImgUrl = imgSource.startsWith('/') ? `${INVENTREE_URL}${imgSource}` : imgSource;
                    imageUrl = `/api/proxy-image?url=${encodeURIComponent(fullImgUrl)}`;
                }

                drinksMap.set(partId, {
                    name: partDetail.name,
                    price: price,
                    stock: quantity,
                    imageUrl: imageUrl
                });
            } else {
                // If we have multiple stock items for the same part, aggregate the quantity
                const existing = drinksMap.get(partId);
                existing.stock += quantity;
            }
        }

        const formattedDrinks = Array.from(drinksMap.values());

        console.log('[Drinks] Successfully mapped', formattedDrinks.length, 'unique drink items');
        drinksCache = { data: formattedDrinks, timestamp: Date.now() };
        console.log(`[Drinks] Fetched ${formattedDrinks.length} drinks`);
        return formattedDrinks;

    } catch (err) {
        console.error('[Drinks] Exception fetching drinks:', err.message);
        return [];
    }
}

// ── API Routes ───────────────────────────────────────────────────
app.get('/api/calendar', async (_req, res) => {
    try {
        const events = await scrapeCalendar();
        res.json(events);
    } catch (err) {
        console.error('[Calendar] Error:', err.message);
        res.status(500).json({ error: 'Failed to scrape calendar' });
    }
});

app.get('/api/news', async (_req, res) => {
    try {
        const news = await scrapeNews();
        res.json(news);
    } catch (err) {
        console.error('[News] Error:', err.message);
        res.status(500).json({ error: 'Failed to scrape news' });
    }
});

app.get('/api/drinks', async (_req, res) => {
    try {
        const drinks = await fetchDrinks();
        res.json(drinks);
    } catch (e) {
        console.error('[Drinks] Error in endpoint:', e);
        res.status(500).json({ error: 'Failed to fetch drinks' });
    }
});

app.get('/api/screen-data', async (_req, res) => {
    try {
        // Fetch all data sources concurrently
        const [calendar, news, drinks] = await Promise.all([
            scrapeCalendar(),
            scrapeNews(),
            fetchDrinks()
        ]);

        const workshops = [];
        const recurringEvents = [];

        // Keywords to catch recurring events even if only 1 is currently in the calendar window
        const recurringKeywords = ['openlab', 'young maker', 'repair'];

        // Count title occurrences to detect repeating events
        const titleCounts = {};
        for (const event of calendar) {
            titleCounts[event.title] = (titleCounts[event.title] || 0) + 1;
        }

        // For recurring events, collect ALL instances first, then pick the best one
        // per title: prefer a currently-running instance, else the soonest upcoming one.
        const recurringByTitle = {};

        for (const event of calendar) {
            const isRecurringByCount = titleCounts[event.title] > 1;
            const isRecurringByKeyword = recurringKeywords.some(kw => event.title.toLowerCase().includes(kw));
            console.log(`[ScreenData] classify "${event.title}" — byCount=${isRecurringByCount} byKeyword=${isRecurringByKeyword}`);

            if (isRecurringByCount || isRecurringByKeyword) {
                if (!recurringByTitle[event.title]) recurringByTitle[event.title] = [];
                recurringByTitle[event.title].push(event);
            } else {
                workshops.push({ ...event, type: 'workshop' });
            }
        }

        // Pick the best instance for each recurring event title.
        // Scoring rules (lower = better):
        //   - Happening right now:  -Infinity (always wins)
        //   - Future with time:     ms until start (sooner = lower)
        //   - No time info:         ms until midnight of that day (treated as all-day, lower than distant future)
        //   - Past events:          +Infinity (never picked if anything better exists)
        const now = new Date();
        for (const [, instances] of Object.entries(recurringByTitle)) {
            let best = null;
            let bestScore = Infinity;

            for (const event of instances) {
                const [isoYear, isoMonth, isoDay] = (event.dateISO || '').split('-').map(Number);
                if (!isoYear) continue; // skip events with no date at all

                // If no parseable time, score by date midnight (all-day treatment)
                const startMatch = event.time ? event.time.match(/(\d{1,2})[:.](\d{2})/) : null;
                const startTime = startMatch
                    ? new Date(isoYear, isoMonth - 1, isoDay, parseInt(startMatch[1], 10), parseInt(startMatch[2], 10))
                    : new Date(isoYear, isoMonth - 1, isoDay, 0, 0);

                const endMatch = event.time ? event.time.match(/[-–](\d{1,2})[:.](\d{2})/) : null;
                const endTime = endMatch
                    ? new Date(isoYear, isoMonth - 1, isoDay, parseInt(endMatch[1], 10), parseInt(endMatch[2], 10))
                    : new Date(startTime.getTime() + (startMatch ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));

                const effectiveEnd = new Date(endTime.getTime() + 5 * 60 * 1000);
                const isNow = startTime <= now && now < effectiveEnd;

                // Also treat an all-day event on today's date as "happening now"
                const isAllDayToday = !startMatch &&
                    isoYear === now.getFullYear() &&
                    (isoMonth - 1) === now.getMonth() &&
                    isoDay === now.getDate();

                let score;
                if (isNow || isAllDayToday) {
                    // Happening right now — guaranteed winner
                    score = -Infinity;
                } else if (effectiveEnd <= now) {
                    // Already finished — only use as last resort
                    score = Infinity;
                } else {
                    // Future: sooner start = lower score
                    score = startTime.getTime() - now.getTime();
                }

                if (best === null || score < bestScore) {
                    best = event;
                    bestScore = score;
                }
            }

            if (best) recurringEvents.push({ ...best, type: 'recurring' });
        }

        // Add type tag to news for easy combining on the frontend
        const newsWithType = news.map(item => ({ ...item, type: 'news' }));

        const responseObj = {
            workshops,
            news: newsWithType,
            recurringEvents,
            drinks,
            config: {
                transitionTime: CAROUSEL_TRANSITION_TIME,
                drinksTransitionTime: DRINKS_TRANSITION_TIME,
                tipsTransitionTime: TIPS_TRANSITION_TIME,
                paymentQrUrl: PAYMENT_QR_URL,
                eventPriority: EVENT_PRIORITY,
                tips: TIPS,
            }
        };

        console.log(`[ScreenData] eventPriority: ${JSON.stringify(EVENT_PRIORITY)}`);
        console.log(`[ScreenData] workshops (${workshops.length}):`, workshops.map(e => `"${e.title}" ${e.dateISO} ${e.time}`));
        console.log(`[ScreenData] recurringEvents (${recurringEvents.length}):`, recurringEvents.map(e => `"${e.title}" ${e.dateISO} ${e.time}`));
        // DUMPING EXACT JSON TO LOGS PER USER REQUEST
        console.log(`[ScreenData API] First event raw dump:`, JSON.stringify(workshops[0] || recurringEvents[0], null, 2));

        res.json(responseObj);
    } catch (err) {
        console.error('[Screen-Data] Error:', err.message);
        res.status(500).json({ error: 'Failed to aggregate screen data' });
    }
});

// --- Transition Testing Endpoints ---

app.get('/api/transition', (req, res) => {
    forceTransitionTime = Date.now();
    console.log(`[Transition] Triggered at ${forceTransitionTime}`);
    res.json({ success: true, message: "Transition triggered", timestamp: forceTransitionTime });
});

app.get('/api/transition/check', (req, res) => {
    res.json({ forceTransitionTime });
});

app.get('/api/proxy-image', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': `Token ${INVENTREE_TOKEN}`,
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch image: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('[Image Proxy] Error fetching image:', err.message);
        res.status(500).send('Error proxying image');
    }
});

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        cache: {
            calendar: isCacheValid(calendarCache) ? 'valid' : 'stale',
            news: isCacheValid(newsCache) ? 'valid' : 'stale',
            drinks: isCacheValid(drinksCache) ? 'valid' : 'stale',
        },
    });
});

// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Data-fetcher listening on port ${PORT}`);
    // Pre-warm caches on startup
    scrapeCalendar().catch(err => console.error('[Calendar] Pre-warm failed:', err.message));
    scrapeNews().catch(err => console.error('[News] Pre-warm failed:', err.message));
    fetchDrinks().catch(err => console.error('[Drinks] Pre-warm failed:', err.message));
});
