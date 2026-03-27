/**
 * scrapers/drinks.js — Fetches the current drinks inventory from Inventree.
 *
 * Exported: fetchDrinks()
 */

import {
    INVENTREE_URL,
    INVENTREE_TOKEN,
    INVENTREE_DRINKS_LOCATIONS,
    DRINKS_CACHE_DURATION_MS,
} from '../config.js';
import { isCacheValid } from '../utils.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let drinksCache = { data: null, timestamp: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wrapper around fetch() that aborts automatically after `timeout` ms.
 * Useful for Inventree requests which may hang on network issues.
 */
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
 * Determine whether a stock item belongs to one of the configured locations.
 * Returns true if no locations are configured (i.e. show everything).
 */
function isInConfiguredLocation(locDetail) {
    if (INVENTREE_DRINKS_LOCATIONS.length === 0) return true;
    const locName = (locDetail.name      || '').toLowerCase();
    const locPath = (locDetail.pathstring || '').toLowerCase();
    return INVENTREE_DRINKS_LOCATIONS.some(loc => locName.includes(loc) || locPath.includes(loc));
}

/**
 * Derive a price string from a part_detail object.
 * Inventree surfaces pricing in several different fields depending on configuration.
 */
function extractPrice(partDetail) {
    if (partDetail.pricing_min)        return '€' + parseFloat(partDetail.pricing_min).toFixed(2);
    if (partDetail.pricing_min_string) return partDetail.pricing_min_string;
    if (partDetail.sell_price)         return '€' + parseFloat(partDetail.sell_price).toFixed(2);
    // Use description as a last resort (staff sometimes put the price there)
    if (partDetail.description &&
        partDetail.description.toLowerCase() !== partDetail.name.toLowerCase()) {
        return partDetail.description;
    }
    return '-';
}

/**
 * Build a proxied image URL for a part thumbnail so the frontend doesn't
 * need to hold an Inventree token.
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
 * Fetch current drink stock from Inventree, filter by configured location(s),
 * and return an array of `{ name, price, stock, imageUrl }` objects.
 * Multiple stock items for the same part are aggregated.
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
        const stockRes = await fetchWithTimeout(
            `${INVENTREE_URL}/api/stock/?part_detail=true&location_detail=true`,
            { headers: { 'Authorization': `Token ${INVENTREE_TOKEN}` } },
            15_000
        );

        if (!stockRes.ok) {
            console.error('[Drinks] Failed to fetch stock:', stockRes.status);
            return [];
        }

        const stockData  = await stockRes.json();
        const stockItems = Array.isArray(stockData) ? stockData : (stockData.results || []);

        console.log('[Drinks] Found', stockItems.length, 'total stock items');
        if (stockItems.length > 0 && INVENTREE_DRINKS_LOCATIONS.length > 0) {
            const allLocations = new Set(stockItems.map(i => i.location_detail?.name).filter(Boolean));
            console.log('[Drinks] Available locations:', [...allLocations].join(', '));
            console.log('[Drinks] Filtering by locations:', INVENTREE_DRINKS_LOCATIONS.join(', '));
        }

        // Group stock items by part ID so we can aggregate quantities
        const drinksByPart = new Map();

        for (const item of stockItems) {
            const partDetail = item.part_detail  || {};
            const locDetail  = item.location_detail || {};

            if (!isInConfiguredLocation(locDetail)) continue;
            if (!partDetail.name) continue;

            const partId   = item.part;
            const quantity = parseFloat(item.quantity || 0);

            if (!drinksByPart.has(partId)) {
                drinksByPart.set(partId, {
                    name:     partDetail.name,
                    price:    extractPrice(partDetail),
                    stock:    quantity,
                    imageUrl: buildProxiedImageUrl(partDetail),
                });
            } else {
                drinksByPart.get(partId).stock += quantity;
            }
        }

        const drinks = Array.from(drinksByPart.values());
        console.log(`[Drinks] Fetched ${drinks.length} unique drink items`);

        drinksCache = { data: drinks, timestamp: Date.now() };
        return drinks;
    } catch (err) {
        console.error('[Drinks] Exception fetching drinks:', err.message);
        return [];
    }
}
