const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function testScrape() {
    try {
        const res = await fetch('https://maakleerplek.be/kalender/');
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
