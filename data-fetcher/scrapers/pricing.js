/**
 * scrapers/pricing.js — Scrapes membership and equipment pricing from the
 * maakleerplek wiki.
 *
 * Exported: scrapeWikiPricing()
 */

import * as cheerio from 'cheerio';
import { CACHE_DURATION_MS } from '../config.js';
import { isCacheValid } from '../utils.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let pricingCache = { data: null, timestamp: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Map section heading keywords to their corresponding property in the pricing object.
 * The first matching keyword wins.
 */
const SECTION_MAP = [
    { keys: ['lidmaatschap', 'membership'],                                          prop: 'memberships' },
    { keys: ['equipment usage', 'machine gebruik', 'machine usage', 'gebruik'],      prop: 'equipment'   },
    { keys: ['material', 'grondstof', 'benodigdheden'],                              prop: 'materials'   },
    { keys: ['workshop', 'training', 'certificatie', 'opleiding', 'cursus'],         prop: 'workshops'   },
];

/**
 * Parse a `<ul>` or `<table>` element into an array of `{ name, price }` entries.
 *
 * Table handling:
 *   - Grid tables (first row has many short column headers like A4/A3/A2) are
 *     expanded into `rowLabel (colHeader)` → price pairs.
 *   - Standard key-value tables use column 0 as the name and column 1 as the price.
 * List handling:
 *   - Each `<li>` is split on common delimiters (`:`, `-`, `–`, `€`).
 *
 * @param {cheerio.CheerioAPI} $ - Cheerio instance
 * @param {cheerio.Cheerio}    container - The table or ul element
 * @param {string}             [prefix=''] - Optional prefix prepended to each name
 */
function parseEntries($, container, prefix = '') {
    const results = [];

    if (container.is('table')) {
        const rows = container.find('tr').get();
        if (rows.length === 0) return results;

        const tableData = rows.map(tr =>
            $(tr).find('td, th').map((_, cell) => $(cell).text().trim()).get()
        );

        const firstRow = tableData[0];

        // A "grid" table has a short first-column header and all other headers
        // look like dimension labels (A4, A3, A2 …) rather than label/price columns.
        const isGrid =
            firstRow.length > 2 &&
            firstRow.slice(1).every(h => h.length > 0 && h.length < 15) &&
            !firstRow.some(h => /price|kosten|equipment|item/i.test(h));

        if (isGrid) {
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
                        name:  `${prefix}${rowLabel}${colHeader ? ` (${colHeader})` : ''}`,
                        price: val.includes('€') ? val : `€${val}`,
                    });
                }
            }
        } else {
            // Standard key-value table
            tableData.forEach((row, idx) => {
                if (row.length < 2) return;
                // Skip header rows
                if (idx === 0 && row.some(c => /item|price|equipment|machine|naam|kosten/i.test(c))) return;

                const name  = row[0];
                const price = row[1];
                if (!name || !price || price === '-' || price === '—') return;
                if (/price|notes|equipment/i.test(name)) return;

                results.push({
                    name:  `${prefix}${name}`,
                    price: price.includes('€') || /free|gratis/i.test(price) ? price : `€${price}`,
                });
            });
        }
    } else {
        // Parse as an unordered list
        container.find('li').each((_, li) => {
            const text  = $(li).text().trim();
            const match = text.match(/^(.*?)\s*[:\-\u2013\u2014\u20AC]\s*(.*)$/);
            if (!match) return;
            let name  = match[1].trim();
            let price = match[2].trim();
            if (text.includes('€') && !price.includes('€')) price = '€' + price;
            results.push({ name: `${prefix}${name}`, price });
        });
    }

    return results;
}

/**
 * Walk the siblings of a heading element and extract pricing entries from any
 * `<ul>`, `<table>`, or `<details>` block encountered before the next heading.
 */
function extractEntriesUnderHeading($, heading, prop, pricing) {
    let next = $(heading).next();

    while (next.length && !next.is('h1, h2, h3, h4')) {
        // Direct list / table
        if (next.is('ul, table')) {
            const entries = parseEntries($, next);
            if (entries.length) pricing[prop].push(...entries);
        }

        // Accordion / details element — prefix entries with the summary text
        if (next.is('details')) {
            const prefix = next.find('summary').text().trim();
            next.find('ul, table').each((_, inner) => {
                const entries = parseEntries($, $(inner), prefix ? `${prefix} ` : '');
                if (entries.length) pricing[prop].push(...entries);
            });
        } else {
            // Generic container — look inside, but avoid items already handled
            next.find('ul, table').each((_, inner) => {
                if ($(inner).parents('ul, table, details').length === 0 || $(inner).parent().is(next)) {
                    const entries = parseEntries($, $(inner));
                    if (entries.length) pricing[prop].push(...entries);
                }
            });
        }

        next = next.next();
    }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Scrape the maakleerplek wiki pricing page and return a `{ memberships,
 * equipment, materials, workshops }` object.
 * Results are cached for CACHE_DURATION_MS.
 */
export async function scrapeWikiPricing() {
    if (isCacheValid(pricingCache, CACHE_DURATION_MS)) return pricingCache.data;

    const wikiUrl = process.env.WIKI_PRICING_URL || 'https://wiki.maakleerplek.be/en/hightechlab';
    console.log('[Pricing] Scraping', wikiUrl);

    try {
        const response = await fetch(wikiUrl, { headers: { 'User-Agent': USER_AGENT } });
        const $        = cheerio.load(await response.text());

        const pricing = { memberships: [], equipment: [], materials: [], workshops: [] };

        // Walk every heading, check if it matches a known section, then extract entries
        $('h1, h2, h3, h4').each((_, header) => {
            const headerText = $(header).text().toLowerCase();
            const section    = SECTION_MAP.find(s => s.keys.some(k => headerText.includes(k)));
            if (!section) return;

            console.log(`[Pricing] Found section matching "${section.prop}": "${headerText}"`);
            extractEntriesUnderHeading($, header, section.prop, pricing);
        });

        // Deduplicate by name within each section
        for (const prop in pricing) {
            const seen = new Set();
            pricing[prop] = pricing[prop].filter(item => {
                if (seen.has(item.name)) return false;
                seen.add(item.name);
                return true;
            });
        }

        console.log('[Pricing] Final scraped data:', JSON.stringify(pricing, null, 2));

        if (Object.values(pricing).every(arr => arr.length === 0)) {
            console.warn('[Pricing] Scraping found no sections; returning empty object');
        }

        pricingCache = { data: pricing, timestamp: Date.now() };
        return pricing;
    } catch (err) {
        console.error('[Pricing] Error scraping wiki:', err.message);
        return null;
    }
}
