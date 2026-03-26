import * as cheerio from 'cheerio';
import { MAAKLEERPLEK_URL as BASE_URL_RAW } from './scraper-config.js';

// Reuse the same URL resolution pattern as server.js
const _base = new URL(BASE_URL_RAW.replace(/\/$/, ''));
function resolveUrl(subPath) {
    const resolved = new URL(subPath, _base);
    if (_base.search) resolved.search = _base.search;
    return resolved.href;
}

// Change this path to whichever event page you want to inspect
const url = resolveUrl('kalender/initiatie-hoe-belicht-je-een-zeef-voor-zeefdrukken-3/');

async function check() {
    try {
        console.log('Fetching:', url);
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const $ = cheerio.load(html);

        console.log('calendar layout text:');
        const timeIcon = $('img[src*="icon-time.svg"], img[data-src*="icon-time.svg"]');
        if (timeIcon.length) {
            console.log('Time parent html:', timeIcon.parent().html());
            console.log('Time parent text:', timeIcon.parent().text().trim());
        } else {
            console.log('No time icon found');
        }
    } catch (e) {
        console.error(e);
    }
}
check();
