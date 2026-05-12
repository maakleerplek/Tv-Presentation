/**
 * changelog-reporter.js — Detects InvenTree stock changes and reports them
 * to the Next.js changelog API, deduplicating against events already fired
 * by stock-frontend or interface-stock.
 */

const FRONTEND_INTERNAL_URL = process.env.FRONTEND_INTERNAL_URL || 'http://tv-frontend:3000';

// How long (ms) to look back when checking for already-tracked events.
// Longer than the drinks poll interval so direct-source events always win.
const DEDUP_WINDOW_MS = 2 * 60 * 1000;

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

function isRecentlyTracked(changelog, itemName) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    return changelog.some(entry => {
        return (
            entry.item_name === itemName &&
            new Date(entry.created_at).getTime() > cutoff &&
            entry.source !== 'inventree-sync'  // don't dedup our own synthetic events
        );
    });
}

export async function reportStockChange(itemName, delta, price) {
    if (delta === 0) return;

    const changelog = await getRecentChangelog();
    if (isRecentlyTracked(changelog, itemName)) {
        console.log(`[Changelog] Skipping "${itemName}" — already tracked by source`);
        return;
    }

    const action = delta > 0 ? 'add' : 'checkout';
    const quantity = Math.abs(Math.round(delta));
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
