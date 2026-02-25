import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';

const app = express();
app.use(cors());

const CALENDAR_URL = 'https://maakleerplek.be/kalender/';
const HOMEPAGE_URL = 'https://maakleerplek.be/';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const NEWS_MAX_AGE_DAYS = 14; // Only show news from the last 2 weeks

// ── In-memory cache ──────────────────────────────────────────────
let calendarCache = { data: null, timestamp: 0 };
let newsCache = { data: null, timestamp: 0 };

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
        const response = await fetch(url);
        if (!response.ok) return {};
        const html = await response.text();
        const $ = cheerio.load(html);

        const description = $('meta[property="og:description"]').attr('content') || '';
        const imageUrl = $('meta[property="og:image"]').attr('content') || '';

        // Try to extract time from the detail page content
        // Look for patterns like "18:00-22:00" or "14:00-16:00"
        const bodyText = $('.kalender_single_content, .entry-content, .single_content, main').text();
        const timeMatch = bodyText.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/);
        const time = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : '';

        // Try to get the target group / audience
        const targetGroup = $('.kalender_single_doelgroep, .target-group').text().trim();

        return { description, imageUrl, time, targetGroup };
    } catch {
        return {};
    }
}

// ── Calendar Scraper ─────────────────────────────────────────────
async function scrapeCalendar() {
    if (isCacheValid(calendarCache)) return calendarCache.data;

    console.log('[Calendar] Scraping', CALENDAR_URL);
    const response = await fetch(CALENDAR_URL);
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
            const location = $(itemEl).find('.agenda_item_time').text().trim();
            const link = $(itemEl).find('a').attr('href') || '';

            if (title) {
                events.push({
                    title,
                    location,
                    date: dateText,
                    dateISO: date.toISOString().split('T')[0],
                    link,
                });
            }
        });
    });

    // Fetch detail info for the first 10 events (to avoid hammering the server)
    const detailPromises = events.slice(0, 10).map(async (event) => {
        if (event.link) {
            const detail = await fetchEventDetail(event.link);
            return { ...event, ...detail };
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
    const response = await fetch(HOMEPAGE_URL);
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
        if (href.includes('/kalender/') || href.includes('/wp-content/') ||
            href.includes('/wp-admin/') || href.includes('/wp-json/') ||
            href.includes('#') || href.includes('?lang=') ||
            href.includes('/partners/') || href.includes('/deelplekken/') ||
            href.includes('/contact/') || href.includes('/zoeken') ||
            href.includes('/nieuwsbrief') || href.includes('/leefregels/') ||
            href.includes('/machine-reserveren/') || href.includes('/kantine-2/') ||
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
            const resp = await fetch(item.link);
            if (!resp.ok) continue;
            const articleHtml = await resp.text();
            const $a = cheerio.load(articleHtml);

            const description = $a('meta[property="og:description"]').attr('content') || '';
            const imageUrl = $a('meta[property="og:image"]').attr('content') || '';
            const modifiedTime = $a('meta[property="article:modified_time"]').attr('content') || '';

            // Check if article is within the last 2 weeks
            if (modifiedTime) {
                const articleDate = new Date(modifiedTime);
                if (articleDate < cutoffDate) continue; // Skip old articles
            }

            enrichedItems.push({
                ...item,
                description,
                imageUrl,
                date: modifiedTime ? new Date(modifiedTime).toLocaleDateString('nl-BE') : '',
            });
        } catch {
            // Skip articles that fail to fetch
        }
    }

    newsCache = { data: enrichedItems, timestamp: Date.now() };
    console.log(`[News] Found ${enrichedItems.length} recent news items`);
    return enrichedItems;
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

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        cache: {
            calendar: isCacheValid(calendarCache) ? 'valid' : 'stale',
            news: isCacheValid(newsCache) ? 'valid' : 'stale',
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
});
