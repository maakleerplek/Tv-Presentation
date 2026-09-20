import { describe, test, expect } from 'bun:test';
import { parseEventDetailHtml, findJsonLd } from '../event-detail.js';
import * as cheerio from 'cheerio';

// ── Helpers: build minimal event detail HTML ──────────────────────

/** Wrap a schema.org Event object in a page, the way the site publishes it. */
function makeJsonLdHtml(event, { ogImage = '', ogDescription = '', mainExtra = '' } = {}) {
    return `<!DOCTYPE html>
<html>
<head>
  ${ogImage       ? `<meta property="og:image" content="${ogImage}">` : ''}
  ${ogDescription ? `<meta property="og:description" content="${ogDescription}">` : ''}
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"maakleerplek vzw"}</script>
  ${event ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', ...event })}</script>` : ''}
</head>
<body><main>${mainExtra}</main></body>
</html>`;
}

/** A fully populated, realistic event. */
const LASERCUTTER = {
    name: 'De lasercutter leren gebruiken',
    description: 'Leer werken met de grootste lasercutter van Leuven.',
    startDate: '2026-09-22T17:00:00Z', // 19:00 Brussels
    endDate:   '2026-09-22T20:00:00Z', // 22:00 Brussels
    location: { '@type': 'Place', name: 'maakleerplek — High Tech Lab' },
    image: 'https://odoo.maakleerplek.be/web/image/event.event/38/mlp_image',
    isAccessibleForFree: false,
    offers: { '@type': 'Offer', price: 30, priceCurrency: 'EUR' },
};

// ── findJsonLd ────────────────────────────────────────────────────
describe('findJsonLd', () => {
    test('picks the Event block, skipping the Organization one', () => {
        const $ = cheerio.load(makeJsonLdHtml(LASERCUTTER));
        expect(findJsonLd($, 'Event').name).toBe('De lasercutter leren gebruiken');
    });

    test('returns null when the type is absent', () => {
        const $ = cheerio.load(makeJsonLdHtml(null));
        expect(findJsonLd($, 'Event')).toBeNull();
    });

    test('ignores a malformed block instead of throwing', () => {
        const html = `<html><head>
          <script type="application/ld+json">{ this is not json </script>
          <script type="application/ld+json">{"@type":"Event","name":"Still found"}</script>
        </head><body></body></html>`;
        const $ = cheerio.load(html);
        expect(findJsonLd($, 'Event').name).toBe('Still found');
    });

    test('unwraps an @graph array', () => {
        const html = `<html><head><script type="application/ld+json">
          {"@graph":[{"@type":"WebSite"},{"@type":"Event","name":"In graph"}]}
        </script></head><body></body></html>`;
        const $ = cheerio.load(html);
        expect(findJsonLd($, 'Event').name).toBe('In graph');
    });
});

// ── description ───────────────────────────────────────────────────
describe('parseEventDetailHtml — description', () => {
    test('uses the JSON-LD description', () => {
        const result = parseEventDetailHtml(makeJsonLdHtml(LASERCUTTER));
        expect(result.description).toBe('Leer werken met de grootste lasercutter van Leuven.');
    });

    test('falls back to og:description when JSON-LD is absent', () => {
        const html = makeJsonLdHtml(null, { ogDescription: 'Leer 3D ontwerpen.' });
        expect(parseEventDetailHtml(html).description).toBe('Leer 3D ontwerpen.');
    });

    test('returns empty string when no description is found', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(null)).description).toBe('');
    });

    test('truncates long descriptions to 400 chars with ellipsis', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, description: 'a'.repeat(500) });
        const result = parseEventDetailHtml(html);
        expect(result.description.length).toBeLessThanOrEqual(401); // 400 chars + '…'
        expect(result.description.endsWith('…')).toBe(true);
    });
});

// ── imageUrl ──────────────────────────────────────────────────────
describe('parseEventDetailHtml — imageUrl', () => {
    test('returns the JSON-LD image', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(LASERCUTTER)).imageUrl)
            .toBe('https://odoo.maakleerplek.be/web/image/event.event/38/mlp_image');
    });

    test('accepts an ImageObject instead of a bare string', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, image: { '@type': 'ImageObject', url: 'https://example.com/o.jpg' } });
        expect(parseEventDetailHtml(html).imageUrl).toBe('https://example.com/o.jpg');
    });

    test('falls back to og:image when JSON-LD has none', () => {
        const html = makeJsonLdHtml(null, { ogImage: 'https://example.com/og.jpg' });
        expect(parseEventDetailHtml(html).imageUrl).toBe('https://example.com/og.jpg');
    });

    test('upgrades http to https', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, image: 'http://example.com/i.jpg' });
        expect(parseEventDetailHtml(html).imageUrl).toBe('https://example.com/i.jpg');
    });

    test('makes a relative image absolute', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, image: '/images/event.jpg' });
        expect(parseEventDetailHtml(html).imageUrl).toBe('https://maakleerplek.be/images/event.jpg');
    });
});

// ── time ──────────────────────────────────────────────────────────
describe('parseEventDetailHtml — time', () => {
    test('renders the UTC range in Brussels local time', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(LASERCUTTER)).time).toBe('19:00 - 22:00');
    });

    test('drops an end date that falls on another day (recurring series end)', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, endDate: '2027-07-14T12:30:00Z' });
        expect(parseEventDetailHtml(html).time).toBe('19:00');
    });

    test('falls back to a time range in the page body', () => {
        const html = makeJsonLdHtml(null, { mainExtra: '<p>Elke woensdag 11:30 – 14:30</p>' });
        expect(parseEventDetailHtml(html).time).toBe('11:30 - 14:30');
    });

    test('returns empty string when there is no time anywhere', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(null)).time).toBe('');
    });
});

// ── location ──────────────────────────────────────────────────────
describe('parseEventDetailHtml — location', () => {
    test('strips the venue prefix from the place name', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(LASERCUTTER)).location).toBe('High Tech Lab');
    });

    test('keeps a place name that has no prefix', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, location: { name: 'Kantine' } });
        expect(parseEventDetailHtml(html).location).toBe('Kantine');
    });

    test('returns empty string when there is no location', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(null)).location).toBe('');
    });
});

// ── price ─────────────────────────────────────────────────────────
describe('parseEventDetailHtml — price', () => {
    test('formats a whole-euro offer', () => {
        expect(parseEventDetailHtml(makeJsonLdHtml(LASERCUTTER)).price).toBe('€30');
    });

    test('keeps two decimals for a fractional amount', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, offers: { price: 12.5, priceCurrency: 'EUR' } });
        expect(parseEventDetailHtml(html).price).toBe('€12.50');
    });

    test('accepts offers as an array', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, offers: [{ price: 40 }] });
        expect(parseEventDetailHtml(html).price).toBe('€40');
    });

    test('returns empty string for a free event', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, isAccessibleForFree: true, offers: undefined });
        expect(parseEventDetailHtml(html).price).toBe('');
    });

    test('returns empty string when the event carries no offer', () => {
        const html = makeJsonLdHtml({ ...LASERCUTTER, isAccessibleForFree: false, offers: undefined });
        expect(parseEventDetailHtml(html).price).toBe('');
    });

    test('scans the body for a euro amount only when JSON-LD is absent', () => {
        const html = makeJsonLdHtml(null, { mainExtra: '<p>Deelname: € 25</p>' });
        expect(parseEventDetailHtml(html).price).toBe('€25');
    });
});
