import * as cheerio from 'cheerio';
import { MAAKLEERPLEK_URL as BASE_URL_RAW } from './scraper-config.js';

// Reuse the same URL resolution pattern as server.js:
// parse the base URL, resolve the sub-path, then restore the translate query string.
const _base = new URL(BASE_URL_RAW.replace(/\/$/, ''));
function resolveUrl(subPath) {
    const resolved = new URL(subPath, _base);
    if (_base.search) resolved.search = _base.search;
    return resolved.href;
}

const calendarUrl = resolveUrl('kalender/');

async function testScrape() {
    try {
        console.log('Fetching:', calendarUrl);
        const res = await fetch(calendarUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const $ = cheerio.load(html);

        console.log('--- Calendar Elements ---');
        $('.elementor-post').slice(0, 3).each((i, el) => {
            const title = $(el).find('.elementor-post__title').text().trim();
            const img = $(el).find('.elementor-post__thumbnail img');
            const src = img.attr('src');
            const dataSrc = img.attr('data-src');
            const dataLazySrc = img.attr('data-lazy-src');
            const srcset = img.attr('srcset');
            const dataSrcset = img.attr('data-srcset');

            console.log(`\nEvent ${i + 1}: ${title}`);
            console.log(`src: ${src}`);
            console.log(`data-src: ${dataSrc}`);
            console.log(`data-lazy-src: ${dataLazySrc}`);
            console.log(`srcset: ${srcset}`);
            console.log(`data-srcset: ${dataSrcset}`);
        });

    } catch (err) {
        console.error(err);
    }
}

testScrape();
