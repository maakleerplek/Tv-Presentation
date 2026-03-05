const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function check() {
    const url = 'https://maakleerplek.be/kalender/initiatie-hoe-belicht-je-een-zeef-voor-zeefdrukken-3/';
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const $ = cheerio.load(html);

        console.log("calendar layout text:");
        const timeIcon = $('img[src*="icon-time.svg"]');
        if (timeIcon.length) {
            console.log("Time parent html:", timeIcon.parent().html());
            console.log("Time parent text:", timeIcon.parent().text().trim());
        } else {
            console.log("No time icon found");
        }
    } catch (e) {
        console.error(e);
    }
}
check();
