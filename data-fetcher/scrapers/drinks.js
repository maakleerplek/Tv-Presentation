/**
 * scrapers/drinks.js — Fetches the current inventory from Inventree.
 *
 * Exported: fetchDrinks()
 */

import {
    INVENTREE_URL,
    INVENTREE_TOKEN,
    DRINKS_CACHE_DURATION_MS,
} from '../config.js';
import { isCacheValid } from '../utils.js';
import { reportStockChange } from '../changelog-reporter.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let drinksCache = { data: null, timestamp: 0 };

// Snapshot of the last known stock quantities: key → { stock, price }
let previousSnapshot = null;


// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return response;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

/**
 * Fetch all pages from a paginated Inventree endpoint.
 * Inventree returns { count, next, results } when results exceed the limit.
 */
async function fetchAllPages(baseUrl, headers) {
    const limit    = 500;
    let   offset   = 0;
    const allItems = [];

    while (true) {
        const url = `${baseUrl}&limit=${limit}&offset=${offset}`;
        const res = await fetchWithTimeout(url, { headers }, 15_000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data  = await res.json();
        const items = Array.isArray(data) ? data : (data.results || []);
        allItems.push(...items);

        if (!data.next || items.length < limit) break;
        offset += limit;
    }
    return allItems;
}

/**
 * Batch-fetch part records by ID and return a map of partId → category_name.
 * InvenTree includes category_name directly on the /api/part/ response.
 */
async function fetchCategoryNames(partIds, headers) {
    if (partIds.length === 0) return new Map();
    const ids = [...new Set(partIds)].join(',');
    try {
        const res = await fetchWithTimeout(
            `${INVENTREE_URL}/api/part/?pk__in=${ids}&limit=${partIds.length + 10}`,
            { headers },
            10_000,
        );
        if (!res.ok) return new Map();
        const data  = await res.json();
        const parts = Array.isArray(data) ? data : (data.results || []);
        return new Map(parts.map(p => [p.pk, p.category_name || null]));
    } catch {
        return new Map();
    }
}

/**
 * Derive a price string from a part_detail object.
 */
function extractPrice(partDetail) {
    if (partDetail.pricing_min)        return '€' + parseFloat(partDetail.pricing_min).toFixed(2);
    if (partDetail.pricing_min_string) return partDetail.pricing_min_string;
    if (partDetail.sell_price)         return '€' + parseFloat(partDetail.sell_price).toFixed(2);
    if (partDetail.description &&
        partDetail.description.toLowerCase() !== partDetail.name.toLowerCase()) {
        return partDetail.description;
    }
    return '-';
}

/**
 * Build a proxied image URL so the frontend doesn't need to hold an Inventree token.
 */
function buildProxiedImageUrl(partDetail) {
    const imgSource = partDetail.thumbnail || partDetail.image;
    if (!imgSource) return null;

    const fullUrl = imgSource.startsWith('/')
        ? `${INVENTREE_URL}${imgSource}`
        : imgSource;

    return `/api/proxy-image?url=${encodeURIComponent(fullUrl)}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch all stock from Inventree, optionally filtered by configured location(s).
 * Aggregates stock quantities per (part, location) pair.
 * Each item includes name, price, stock, imageUrl, location, and category.
 * Items are sorted by location → category → name.
 * Results are cached for DRINKS_CACHE_DURATION_MS.
 */
export async function fetchDrinks() {
    if (isCacheValid(drinksCache, DRINKS_CACHE_DURATION_MS)) return drinksCache.data;

    if (!INVENTREE_TOKEN) {
        console.warn('[Drinks] No INVENTREE_TOKEN configured');
        return [];
    }

    console.log('[Drinks] Fetching from Inventree', INVENTREE_URL);

    try {
        const headers    = { 'Authorization': `Token ${INVENTREE_TOKEN}` };
        const stockItems = await fetchAllPages(
            `${INVENTREE_URL}/api/stock/?part_detail=true&location_detail=true`,
            headers,
        );

        console.log('[Drinks] Found', stockItems.length, 'total stock items');

        // Aggregate quantities per (partId, locationId)
        const itemsByKey = new Map();

        for (const item of stockItems) {
            const partDetail = item.part_detail     || {};
            const locDetail  = item.location_detail || {};

            if (!partDetail.name) continue;

            const partId     = item.part;
            const locationId = item.location ?? '__none__';
            const key        = `${partId}::${locationId}`;
            const quantity   = parseFloat(item.quantity || 0);

            if (!itemsByKey.has(key)) {
                itemsByKey.set(key, {
                    name:     partDetail.name,
                    price:    extractPrice(partDetail),
                    stock:    quantity,
                    imageUrl: buildProxiedImageUrl(partDetail),
                    location: locDetail.name || null,
                    _partId:  partId,
                });
            } else {
                itemsByKey.get(key).stock += quantity;
            }
        }

        // Batch-fetch part records to get category_name
        const uniquePartIds  = [...new Set([...itemsByKey.values()].map(i => i._partId))];
        const categoryByPart = await fetchCategoryNames(uniquePartIds, headers);

        const drinks = [...itemsByKey.values()].map(({ _partId, ...rest }) => ({
            ...rest,
            category: categoryByPart.get(_partId) ?? null,
        }));

        // Sort by location → category → name
        drinks.sort((a, b) => {
            const locCmp = (a.location || '').localeCompare(b.location || '');
            if (locCmp !== 0) return locCmp;
            const catCmp = (a.category || '').localeCompare(b.category || '');
            if (catCmp !== 0) return catCmp;
            return a.name.localeCompare(b.name);
        });

        console.log(`[Drinks] Fetched ${drinks.length} unique items across all locations`);

        // Detect stock changes vs the previous snapshot and report to changelog
        if (previousSnapshot !== null) {
            const nextSnapshot = new Map(drinks.map(d => [d.name, { stock: d.stock, price: d.price }]));

            for (const [name, next] of nextSnapshot) {
                const prev = previousSnapshot.get(name);
                if (prev === undefined) continue; // newly appeared item — skip (handled by create events)
                const delta = next.stock - prev.stock;
                if (delta !== 0) {
                    // Parse numeric price from the formatted string (e.g. "€1.50" → 1.50)
                    const numericPrice = parseFloat(String(next.price).replace(/[^0-9.]/g, '')) || null;
                    const linePrice = numericPrice != null ? Math.round(Math.abs(delta) * numericPrice * 100) / 100 : null;
                    reportStockChange(name, delta, linePrice).catch(() => {});
                }
            }
        }

        previousSnapshot = new Map(drinks.map(d => [d.name, { stock: d.stock, price: d.price }]));

        drinksCache = { data: drinks, timestamp: Date.now() };
        return drinks;
    } catch (err) {
        console.error('[Drinks] Exception fetching drinks:', err.message);
        return [];
    }
}
