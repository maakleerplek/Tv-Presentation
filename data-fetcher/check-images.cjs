const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function checkURL(url) {
    console.log('Fetching:', url);
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const ogImg = $('meta[property="og:image"]').attr('content');
    const wpImg = $('.wp-post-image').attr('src');
    const entryImg = $('.entry-content img').first().attr('src');

    console.log('og:image:', ogImg);
    console.log('wp-post-image:', wpImg);
    console.log('.entry-content img:', entryImg);

    // Also try to grab srcset if it has higher res
    const wpImgSrcset = $('.wp-post-image').attr('srcset');
    console.log('wp-post-image srcset:', wpImgSrcset ? wpImgSrcset.substring(0, 100) + '...' : 'none');
}

checkURL('https://maakleerplek.be/kalender/workshop-visible-mending-breigoed/');
