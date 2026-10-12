/**
 * changelog-reporter.js — Detects InvenTree stock changes and reports them
 * to the Next.js changelog API, deduplicating against events already fired
 * by stock-frontend or interface-stock.
 */

const FRONTEND_INTERNAL_URL = process.env.FRONTEND_INTERNAL_URL || 'http://tv-frontend:3000';

// Slack before the previous stock check: a direct event can be logged a moment
// before the stock change it causes is visible in InvenTree.
const DEDUP_MARGIN_MS = 2 * 60 * 1000;

// Direct events (stock app, kiosk) already matched to a stock change, so one
// sale never cancels two changes. In memory: after a restart the first check
// only baselines (previousSnapshot is null), so nothing is matched twice.
const matched = new Set();

async function getRecentChangelog() {
    try {
        const res = await fetch(`${FRONTEND_INTERNAL_URL}/api/changelog`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

// created_at is SQLite UTC without a zone ("2026-10-12 11:30:20").
const utc = s => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z').getTime();

/**
 * How much of a stock change the direct sources did not log themselves.
 * The stock is only compared when the TV page asks for data, so with the TV
 * off a sale shows up much later: match against every direct event since the
 * previous check, not a fixed few minutes.
 */
export function untracked(changelog, itemName, delta, since) {
    let left = Math.abs(Math.round(delta));
    for (const e of changelog) {
        if (!left) break;
        if (e.item_name !== itemName || e.source === 'inventree-sync' || matched.has(e.id)) continue;
        if ((e.action === 'add') !== (delta > 0)) continue;     // same direction only
        if (utc(e.created_at) < since - DEDUP_MARGIN_MS) continue;
        matched.add(e.id);
        left -= Math.min(left, e.quantity);
    }
    return left;
}

/** `since`: when the previous stock check ran (ms). */
export async function reportStockChange(itemName, delta, price, since) {
    if (delta === 0) return;

    const quantity = untracked(await getRecentChangelog(), itemName, delta, since);
    if (!quantity) {
        console.log(`[Changelog] Skipping "${itemName}" — already tracked by source`);
        return;
    }

    const action = delta > 0 ? 'add' : 'checkout';
    const body = { action, source: 'inventree-sync', item_name: itemName, quantity };
    if (price != null) body.price = Math.round(price * 100) / 100;

    try {
        await fetch(`${FRONTEND_INTERNAL_URL}/api/changelog`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3000),
        });
        console.log(`[Changelog] Reported "${itemName}" Δ${delta > 0 ? '+' : ''}${delta}`);
    } catch (err) {
        console.warn('[Changelog] Failed to report change:', err.message);
    }
}
