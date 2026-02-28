import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import https from 'https';

const app = express();
app.use(cors());

// Global bypass for self-signed certificates (InvenTree)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const CALENDAR_URL = 'https://maakleerplek.be/kalender/';
const HOMEPAGE_URL = 'https://maakleerplek.be/';
const CACHE_DURATION_MS = 15 * 60 * 1000;

// State for manual transitions via /api/transition
let forceTransitionTime = Date.now(); // 15 minutes
const NEWS_MAX_AGE_DAYS = 14; // Only show news from the last 2 weeks

// ── In-memory cache ──────────────────────────────────────────────
let calendarCache = { data: null, timestamp: 0 };
let newsCache = { data: null, timestamp: 0 };
let drinksCache = { data: null, timestamp: 0 };

function isCacheValid(cache) {
    return cache.data && (Date.now() - cache.timestamp < CACHE_DURATION_MS);
}

// ── Dutch month abbreviation → month index ──────────────────────
const DUTCH_MONTHS = {
    jan: 0, feb: 1, maa: 2, mrt: 2, apr: 3, mei: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11,
};

/**
 * Parse a Dutch short date like "do 26 feb" into a Date object.
 * Uses the current year, or next year if the date has passed.
 */
function parseDutchDate(text) {
    const cleaned = text.trim().toLowerCase();
    // Pattern: "do 26 feb" or "za 28 feb"
    const match = cleaned.match(/\w+\s+(\d+)\s+(\w+)/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const monthKey = match[2].substring(0, 3);
    const monthIndex = DUTCH_MONTHS[monthKey];
    if (monthIndex === undefined) return null;

    const now = new Date();
    let year = now.getFullYear();
    const date = new Date(year, monthIndex, day);

    // If date is more than 2 months in the past, assume next year
    if (date < new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)) {
        date.setFullYear(year + 1);
    }

    return date;
}

/**
 * Fetch event detail page for extra info (description, image, time).
 */
async function fetchEventDetail(url) {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!response.ok) {
            console.error(`[fetchEventDetail] Failed ${url}: ${response.status}`);
            return {};
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        const description = $('meta[property="og:description"]').attr('content') || '';
        let imageUrl = $('meta[property="og:image"]').attr('content') ||
            $('.wp-post-image').attr('src') ||
            $('.post-thumbnail img').attr('src') ||
            $('.elementor-post__thumbnail img').attr('src') ||
            $('article img').first().attr('src') ||
            $('main img').first().attr('src') || '';

        if (imageUrl.startsWith('http://')) {
            imageUrl = imageUrl.replace('http://', 'https://');
        } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
            imageUrl = '/' + imageUrl;
        }

        // Try to extract time from the detail page content
        // Try to find the time specifically near the time icon if it exists
        const timeIcon = $('img[src*="icon-time.svg"]');
        let time = '';
        if (timeIcon.length > 0) {
            const timeText = timeIcon.parent().text().trim() || timeIcon[0].nextSibling?.nodeValue?.trim() || '';
            // Example: "26/02/2026 14:00-16:00" -> we want "14:00-16:00"
            const match = timeText.match(/(\d{1,2}[:.]\d{2}[^ ]*)/);
            if (match) time = match[0];
            else time = timeText.split(' ').pop() || '';
        }

        if (!time) {
            // Try to extract time from the detail page content as fallback
            const bodyText = $('.kalender_single_content, .entry-content, .single_content, main').text();
            // Match formats like 14:00-16:00, 14.00-16.00, 14-16u
            const timeMatch = bodyText.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/) ||
                bodyText.match(/(\d{1,2})\s*[-–]\s*(\d{1,2}u)/);
            time = timeMatch ? (timeMatch[0]) : '';
        }

        // Try to get the target group / audience
        const targetGroup = $('.kalender_single_doelgroep, .target-group').text().trim();

        // Try to extract location from the detail page
        const locationIcon = $('img[src*="icon-location.svg"]');
        let location = '';
        if (locationIcon.length > 0) {
            location = locationIcon.parent().text().trim() || locationIcon[0].nextSibling?.nodeValue?.trim() || '';
            if (location) {
                location = location.replace(/^Locatie\s*/i, '').trim();
            }
        }

        return {
            description: truncate(stripHtml(description), 150),
            imageUrl,
            time: time.replace(/\./g, ':'),
            targetGroup,
            location
        };
    } catch {
        return {};
    }
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
            const title = $(itemEl).find('.agenda_item_title').text().trim();
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

            if (title) {
                events.push({
                    title,
                    location: locationStr,
                    time: timeStr,
                    date: dateText,
                    dateISO: date.toISOString().split('T')[0],
                    link,
                });
            }
        });
    });

    // Fetch detail info for the first 30 events (to ensure workshops get details over longer period)
    const detailPromises = events.slice(0, 30).map(async (event) => {
        if (event.link) {
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

    // News items are in the "Nieuws" section; they are listed as <li> or <a> items
    // On the homepage they appear as links in the news section
    // We'll find all links that look like news article links
    $('a[href*="maakleerplek.be/"]').each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();

        // Filter: skip navigation links, only keep article-like links  
        if (!href || !title || title.length < 10) return;
        if (href.includes('/wp-admin/') || href.includes('/wp-json/') ||
            href.includes('#') || href.includes('?lang=') ||
            href.includes('/partners/') || href.includes('/deelplekken/') ||
            href.includes('/contact/') || href.includes('/zoeken') ||
            href.includes('/nieuwsbrief') || href.includes('/leefregels/') ||
            href.includes('/foto-studio/') || href.includes('/word-vrijwilliger/') ||
            href.includes('/wat-is-maakleerplek/') || href.includes('/wat-kan-ik-er-komen-doen/') ||
            href.includes('/verhalen/') || href.includes('/leuven-river-upcycling/')) return;

        // Avoid duplicate URLs
        if (newsItems.some(n => n.link === href)) return;

        newsItems.push({ title, link: href });
    });

    // Fetch detail info from each news article page
    const enrichedItems = [];
    for (const item of newsItems.slice(0, 6)) {
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
            let cleanTitle = ogTitle || h1Title || pageTitle;
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
            } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
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
const INVENTREE_DRINKS_LOCATION = process.env.INVENTREE_DRINKS_LOCATION || '';

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
    if (isCacheValid(drinksCache)) return drinksCache.data;
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
        if (stockItems.length > 0 && INVENTREE_DRINKS_LOCATION) {
            const locs = new Set(stockItems.map(i => i.location_detail?.name).filter(Boolean));
            console.log('[Drinks] Available locations:', Array.from(locs).join(', '));
        }

        // Map and group by part ID to aggregate stock
        const drinksMap = new Map();
        const categoryNameLower = INVENTREE_DRINKS_CATEGORY ? INVENTREE_DRINKS_CATEGORY.toLowerCase() : '';
        const targetLocationLower = INVENTREE_DRINKS_LOCATION ? INVENTREE_DRINKS_LOCATION.toLowerCase() : '';

        for (const item of stockItems) {
            const partDetail = item.part_detail || {};
            const locDetail = item.location_detail || {};

            // Allow filtering by location if provided
            if (targetLocationLower) {
                const locName = (locDetail.name || '').toLowerCase();
                const locPath = (locDetail.pathstring || '').toLowerCase();
                if (!locName.includes(targetLocationLower) && !locPath.includes(targetLocationLower)) {
                    continue; // Skip items not in the configured location
                }
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
        const recurringTitles = new Set();

        // Keywords to catch recurring events even if only 1 is currently in the calendar window
        const recurringKeywords = ['openlab', 'young maker', 'repair'];

        // Count title occurrences to detect repeating events
        const titleCounts = {};
        for (const event of calendar) {
            titleCounts[event.title] = (titleCounts[event.title] || 0) + 1;
        }

        for (const event of calendar) {
            const isRecurringByCount = titleCounts[event.title] > 1;
            const isRecurringByKeyword = recurringKeywords.some(kw => event.title.toLowerCase().includes(kw));

            if (isRecurringByCount || isRecurringByKeyword) {
                // Only show the next instance of a recurring event
                if (!recurringTitles.has(event.title)) {
                    recurringTitles.add(event.title);
                    recurringEvents.push({ ...event, type: 'recurring' });
                }
            } else {
                workshops.push({ ...event, type: 'workshop' });
            }
        }

        // Add type tag to news for easy combining on the frontend
        const newsWithType = news.map(item => ({ ...item, type: 'news' }));

        const responseObj = {
            workshops,
            news: newsWithType,
            recurringEvents,
            drinks
        };

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
