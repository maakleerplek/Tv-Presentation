/**
 * scrapers/pricing.js — Machine usage prices from InvenTree.
 *
 * Every machine is a virtual part in the INVENTREE_MACHINE_CATEGORY category.
 * The sale price break is the price per unit (the part's `units`, e.g. min or
 * g), and the optional "Minimum" parameter is the least a job costs.
 * scripts/seed-machine-pricing.js creates them.
 *
 * Exported: fetchMachinePricing(), buildEquipment()
 */

import {
    INVENTREE_URL,
    INVENTREE_TOKEN,
    INVENTREE_MACHINE_CATEGORY,
    CACHE_DURATION_MS,
} from '../config.js';
import { isCacheValid } from '../utils.js';
import { fetchWithTimeout, fetchAllPages, fetchSalePrices } from './drinks.js';

/** Name of the parameter template that holds a machine's minimum price. */
export const MINIMUM_TEMPLATE = 'Minimum';

let pricingCache = { data: null, timestamp: 0 };

const euro = (value) => '€' + value.toFixed(2);

/**
 * One row per machine, in name order. A part without a sale price is skipped:
 * a machine with no price on the TV reads as free.
 *
 * @param {{ pk: number, name: string, units?: string }[]} parts
 * @param {Map<number, number>} salePrices  part pk → price per unit
 * @param {Map<number, number>} minimums    part pk → minimum price
 */
export function buildEquipment(parts, salePrices, minimums) {
    return parts
        .filter(p => salePrices.has(p.pk))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(p => {
            const minimum = minimums.get(p.pk);
            return {
                name:    p.name,
                price:   euro(salePrices.get(p.pk)),
                unit:    p.units || null,
                minimum: minimum ? euro(minimum) : null,
            };
        });
}

async function getJson(url, headers) {
    const res = await fetchWithTimeout(url, { headers }, 10_000);
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return res.json();
}

/** Part pk → numeric value of the Minimum parameter. */
async function fetchMinimums(base, headers) {
    const templates = await getJson(`${base}/api/parameter/template/?name=${encodeURIComponent(MINIMUM_TEMPLATE)}`, headers);
    const template  = (Array.isArray(templates) ? templates : templates.results || [])[0];
    if (!template) return new Map();

    const params = await fetchAllPages(
        `${base}/api/parameter/?model_type=part.part&template=${template.pk}`, headers);
    return new Map(params
        .map(p => [p.model_id, p.data_numeric ?? parseFloat(p.data)])
        .filter(([, v]) => isFinite(v)));
}

/**
 * Returns `{ memberships, equipment, materials, workshops }`; only `equipment`
 * is filled. Null when InvenTree cannot be reached, so the TV keeps its last data.
 * `base` and `token` default to the config; tests pass their own.
 */
export async function fetchMachinePricing({ base = INVENTREE_URL, token = INVENTREE_TOKEN, useCache = true } = {}) {
    if (useCache && isCacheValid(pricingCache, CACHE_DURATION_MS)) return pricingCache.data;

    if (!token) {
        console.warn('[Pricing] No INVENTREE_TOKEN configured');
        return null;
    }

    try {
        const headers    = { 'Authorization': `Token ${token}` };
        const categories = await getJson(
            `${base}/api/part/category/?name=${encodeURIComponent(INVENTREE_MACHINE_CATEGORY)}`, headers);
        const category   = (Array.isArray(categories) ? categories : categories.results || [])[0];

        let equipment = [];
        if (category) {
            const [parts, salePrices, minimums] = await Promise.all([
                fetchAllPages(`${base}/api/part/?category=${category.pk}&active=true`, headers),
                fetchSalePrices(headers, base),
                fetchMinimums(base, headers),
            ]);
            equipment = buildEquipment(parts, salePrices, minimums);
        } else {
            console.warn(`[Pricing] No InvenTree category "${INVENTREE_MACHINE_CATEGORY}"`);
        }

        const pricing = { memberships: [], equipment, materials: [], workshops: [] };
        pricingCache = { data: pricing, timestamp: Date.now() };
        return pricing;
    } catch (err) {
        console.error('[Pricing] Error fetching from InvenTree:', err.message);
        return null;
    }
}
