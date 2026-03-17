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
const VERHALEN_URL      = `${MAAKLEERPLEK_URL}/verhalen/`;
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
let pricingCache = { data: null, timestamp: 0 };

/** Wrap isCacheValidUtil with a default duration from this module's config. */
function isCacheValid(cache, duration = CACHE_DURATION_MS) {
    return isCacheValidUtil(cache, duration);
}

// ── Wiki Pricing Scraper ─────────────────────────────────────────
async function scrapeWikiPricing() {
    if (isCacheValid(pricingCache)) return pricingCache.data;

    const WIKI_URL = process.env.WIKI_PRICING_URL || 'https://wiki.maakleerplek.be/en/hightechlab';
    console.log('[Pricing] Scraping', WIKI_URL);

    try {
        const response = await fetch(WIKI_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        const pricing = {
            memberships: [],
            equipment: [],
            materials: [],
            workshops: []
        };

        /**
         * Generic parser for a list of items (either <ul> or <table>).
         * Splits lines by common delimiters like ":" or " - " or detects "€".
         */
        const parseEntries = (container, prefix = '') => {
            const results = [];
            
            if (container.is('table')) {
                const rows = container.find('tr').get();
                if (rows.length === 0) return results;

                // Extract all cells from all rows
                const tableData = rows.map(tr => 
                    $(tr).find('td, th').map((_, cell) => $(cell).text().trim()).get()
                );

                // Detect if it's a grid table (first row has multiple headers like A4, A3, A2)
                const firstRow = tableData[0];
                // Grid if: first cell is empty/small AND subsequent cells look like dimensions/headers
                const looksLikeGrid = firstRow.length > 2 && firstRow.slice(1).every(h => h.length > 0 && h.length < 15)
                                     && !firstRow.some(h => /price|kosten|equipment|item/i.test(h));
                
                if (looksLikeGrid) {
                    const headers = firstRow;
                    for (let i = 1; i < tableData.length; i++) {
                        const row = tableData[i];
                        if (row.length < 2) continue;
                        const rowLabel = row[0];
                        if (!rowLabel || /thickness|dikte/i.test(rowLabel)) continue;
                        
                        for (let j = 1; j < row.length; j++) {
                            const val = row[j];
                            if (!val || val === '-' || val === '—') continue;
                            const colHeader = headers[j] || '';
                            results.push({
                                name: `${prefix}${rowLabel}${colHeader ? ` (${colHeader})` : ''}`,
                                price: val.includes('€') ? val : `€${val}`
                            });
                        }
                    }
                } else {
                    // Standard Key-Value table
                    tableData.forEach((row, idx) => {
                        if (row.length < 2) return;
                        // Skip header rows
                        if (idx === 0 && row.some(c => /item|price|equipment|machine|naam|kosten/i.test(c))) return;
                        
                        let name = row[0];
                        let price = row[1];
                        if (!name || !price || price === '-' || price === '—') return;
                        
                        // Clean up generic header suffixes that might have been scraped if name is equal to header
                        if (/price|notes|equipment/i.test(name)) return;

                        results.push({ 
                            name: `${prefix}${name}`, 
                            price: price.includes('€') || /free|gratis/i.test(price) ? price : `€${price}`
                        });
                    });
                }
            } else {
                // Try parsing as list
                container.find('li').each((_, li) => {
                    const text = $(li).text().trim();
                    const match = text.match(/^(.*?)\s*[:\-\u2013\u2014\u20AC]\s*(.*)$/);
                    if (match) {
                        let name = match[1].trim();
                        let price = match[2].trim();
                        if (text.includes('€') && !price.includes('€')) {
                            price = '€' + price;
                        }
                        results.push({ name: `${prefix}${name}`, price });
                    }
                });
            }
            return results;
        };

        // Section mappings: Header Keywords -> Pricing Property
        const sectionMap = [
            { keys: ['lidmaatschap', 'membership'], prop: 'memberships' },
            { keys: ['equipment usage', 'machine gebruik', 'machine usage', 'gebruik'], prop: 'equipment' },
            { keys: ['material', 'grondstof', 'benodigdheden'], prop: 'materials' },
            { keys: ['workshop', 'training', 'certificatie', 'opleiding', 'cursus'], prop: 'workshops' }
        ];

        $('h1, h2, h3, h4').each((_, header) => {
            const headerText = $(header).text().toLowerCase();
            const section = sectionMap.find(s => s.keys.some(k => headerText.includes(k)));
            
            if (section) {
                console.log(`[Pricing] Found section matching "${section.prop}": "${headerText}"`);
                let next = $(header).next();
                while (next.length && !next.is('h1, h2, h3, h4')) {
                    // 1. Check if next is a list or table directly
                    if (next.is('ul, table')) {
                        const entries = parseEntries(next);
                        if (entries.length > 0) {
                            pricing[section.prop] = [...pricing[section.prop], ...entries];
                        }
                    } 
                    
                    // 2. Check for details/accordion containers
                    if (next.is('details')) {
                        const summary = next.find('summary').text().trim();
                        const prefix = summary ? `${summary} ` : '';
                        next.find('ul, table').each((_, inner) => {
                            const entries = parseEntries($(inner), prefix);
                            if (entries.length > 0) {
                                pricing[section.prop] = [...pricing[section.prop], ...entries];
                            }
                        });
                    }

                    // 3. Search for lists/tables inside general containers (divs, etc)
                    // but skip if we already parsed it via details logic
                    if (!next.is('details')) {
                        next.find('ul, table').each((_, inner) => {
                            // Avoid double-parsing if this table is inside another already-handled container
                            if ($(inner).parents('ul, table, details').length === 0 || $(inner).parent().is(next)) {
                                const entries = parseEntries($(inner));
                                if (entries.length > 0) {
                                    pricing[section.prop] = [...pricing[section.prop], ...entries];
                                }
                            }
                        });
                    }
                    
                    next = next.next();
                }
            }
        });

        // Deduplicate entries by name
        for (const prop in pricing) {
            const seen = new Set();
            pricing[prop] = pricing[prop].filter(item => {
                if (seen.has(item.name)) return false;
                seen.add(item.name);
                return true;
            });
        }

        console.log('[Pricing] Final scraped data:', JSON.stringify(pricing, null, 2));

        // Fallback to hardcoded values ONLY for essential sections if completely empty
        if (Object.values(pricing).every(arr => arr.length === 0)) {
            console.warn('[Pricing] Scraping failed to find any sections, using defaults');
            pricing.memberships = [{ name: 'Basis', price: '€25/m' }]; // etc...
            // (Keeping the logic minimal here as requested to make it dynamic)
        }

        pricingCache = { data: pricing, timestamp: Date.now() };
        return pricing;
    } catch (err) {
        console.error('[Pricing] Error scraping wiki:', err.message);
        return null;
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
            const titleRaw = $(itemEl).find('.agenda_item_title').text().trim();
            const timeRaw = $(itemEl).find('.agenda_item_time').text().trim();
            const link = $(itemEl).find('a').attr('href') || '';

            if (!titleRaw) {
                console.warn(`[Calendar] Missing title for an event on ${dateText}`);
            }

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

            if (!timeStr) {
                console.warn(`[Calendar] No time found for "${titleRaw}" on ${dateText}`);
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
    const recurringKeywordsForDetail = EVENT_PRIORITY;
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
    console.log(`[Calendar] Scraped events list: ${result.map(e => e.title).join(', ')}`);
    return result;
}

// ── News Scraper ─────────────────────────────────────────────────
async function scrapeNews() {
    if (isCacheValid(newsCache)) return newsCache.data;

    console.log('[News] Scraping', VERHALEN_URL);
    const response = await fetch(VERHALEN_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const newsItems = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - NEWS_MAX_AGE_DAYS);

    // News items in /verhalen/ are inside <article class="archive_item">
    $('article.archive_item').each((_, el) => {
        const titleEl = $(el).find('h3 a');
        const href = titleEl.attr('href');
        const title = titleEl.text().trim();
        const dateStr = $(el).find('p.date').text().trim(); // Format: DD/MM/YYYY

        if (!href || !title) return;

        // Parse date to check against cutoff
        let modifiedTime = '';
        if (dateStr) {
            const [d, m, y] = dateStr.split('/').map(Number);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                modifiedTime = new Date(y, m - 1, d).toISOString();
            }
        }

        // Avoid duplicate URLs
        if (newsItems.some(n => n.link === href)) return;

        newsItems.push({ 
            title, 
            link: href, 
            dateStr,
            modifiedTime 
        });
    });

    // Fetch detail info from each news article page.
    const enrichedItems = [];
    for (const item of newsItems) {
        if (enrichedItems.length >= MAX_NEWS_ITEMS) break;

        // Check if article is within the age limit
        if (item.modifiedTime) {
            const articleDate = new Date(item.modifiedTime);
            if (articleDate < cutoffDate) continue; 
        }

        try {
            const resp = await fetch(item.link, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!resp.ok) continue;
            const articleHtml = await resp.text();
            const $a = cheerio.load(articleHtml);

            // Real title might be better in og:title, but we already have a good one from the archive list.
            const description = $a('meta[property="og:description"]').attr('content') || 
                                $a('meta[name="description"]').attr('content') || '';
            
            // Image extraction strategy: og:image > body images
            const bodyImageSelectors = [
                '.wp-post-image',
                '.post-thumbnail img',
                '.elementor-post__thumbnail img',
                'article img',
                'main img',
                '.entry-content img'
            ];

            let imageUrl = $a('meta[property="og:image"]').attr('content') || '';

            if (!imageUrl) {
                for (const selector of bodyImageSelectors) {
                    const imgEl = $a(selector).first();
                    if (imgEl.length > 0) {
                        imageUrl = imgEl.attr('data-src') || 
                                   imgEl.attr('data-lazy-src') || 
                                   imgEl.attr('data-srcset')?.split(',')[0].trim().split(' ')[0] ||
                                   imgEl.attr('data-orig-file') || 
                                   imgEl.attr('src') || '';
                        if (imageUrl) break;
                    }
                }
            }

            if (imageUrl.startsWith('http://')) {
                imageUrl = imageUrl.replace('http://', 'https://');
            } else if (imageUrl && !imageUrl.startsWith('https://') && imageUrl.startsWith('/')) {
                imageUrl = `${MAAKLEERPLEK_URL}${imageUrl}`;
            }

            enrichedItems.push({
                ...item,
                description: truncate(stripHtml(description), 200),
                imageUrl,
                date: item.dateStr || (item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString('nl-BE') : ''),
            });
        } catch (err) {
            console.error(`[News] Failed to fetch details for ${item.link}:`, err.message);
        }
    }

    newsCache = { data: enrichedItems, timestamp: Date.now() };
    console.log(`[News] Found ${enrichedItems.length} recent news items from /verhalen/`);
    return enrichedItems;
}


// ── Inventree Drinks Scraper ───────────────────────────────────────
const INVENTREE_URL = process.env.INVENTREE_URL || 'https://10.72.3.68:8443';
const INVENTREE_TOKEN = process.env.INVENTREE_TOKEN;
// Supports comma-separated list of locations, e.g. "HTL-fridge,HTL-snacks"
// Falls back to singular INVENTREE_DRINKS_LOCATION for backwards compatibility
const INVENTREE_DRINKS_LOCATIONS = (
    process.env.INVENTREE_DRINKS_LOCATIONS || process.env.INVENTREE_DRINKS_LOCATION || ''
).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// ── Carousel config ────────────────────────────────────────────────
// Number of seconds each carousel slide is shown before advancing
const CAROUSEL_TRANSITION_TIME = parseInt(process.env.CAROUSEL_TRANSITION_TIME || '15', 10);
// Number of seconds each tip is shown before advancing
const TIPS_TRANSITION_TIME = parseInt(process.env.TIPS_TRANSITION_TIME || '10', 10);
// URL encoded into the payment QR code in the drinks panel
const PAYMENT_QR_URL = process.env.PAYMENT_QR_URL || '';
// URL encoded into the wiki QR code in the tips footer
const WIKI_QR_URL = process.env.WIKI_QR_URL || 'https://wiki.maakleerplek.be/en/hightechlab';

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
        const [calendar, news, drinks, pricing] = await Promise.all([
            scrapeCalendar(),
            scrapeNews(),
            fetchDrinks(),
            scrapeWikiPricing()
        ]);

        const workshops = [];
        const recurringEvents = [];

        // Keywords to catch recurring events even if only 1 is currently in the calendar window
        const recurringKeywords = EVENT_PRIORITY;

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
            pricing,
            config: {
                transitionTime: CAROUSEL_TRANSITION_TIME,
                tipsTransitionTime: TIPS_TRANSITION_TIME,
                paymentQrUrl: PAYMENT_QR_URL,
                wikiQrUrl: WIKI_QR_URL,
                eventPriority: EVENT_PRIORITY,
                tips: TIPS,
                websiteQrUrl: MAAKLEERPLEK_URL,
            }
        };

        console.log(`[ScreenData] eventPriority: ${JSON.stringify(EVENT_PRIORITY)}`);
        console.log(`[ScreenData] workshops: ${workshops.length} (${workshops.map(e => e.title).join(', ')})`);
        console.log(`[ScreenData] recurringEvents: ${recurringEvents.length} (${recurringEvents.map(e => e.title).join(', ')})`);
        console.log(`[ScreenData] news: ${newsWithType.length} (${newsWithType.map(e => e.title).join(', ')})`);

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
