import { describe, test, expect } from 'bun:test';
import { parseEventDetailHtml } from '../event-detail.js';

// ── Helper: build minimal event detail HTML ───────────────────────
function makeHtml({ ogImage = '', ogDescription = '', timeText = '', locationText = '', priceText = '', mainExtra = '' } = {}) {
    return `<!DOCTYPE html>
<html>
<head>
  ${ogImage       ? `<meta property="og:image" content="${ogImage}">` : ''}
  ${ogDescription ? `<meta property="og:description" content="${ogDescription}">` : ''}
</head>
<body>
<main>
  ${timeText     ? `<p><img data-src="/icons/icon-time.svg" class="lazyload"> ${timeText}</p>` : ''}
  ${locationText ? `<p><img data-src="/icons/icon-location.svg" class="lazyload"> ${locationText}</p>` : ''}
  ${priceText    ? `<p><img data-src="/icons/icon-price.svg" class="lazyload"> ${priceText}</p>` : ''}
  ${mainExtra}
</main>
</body>
</html>`;
}

// ── description ───────────────────────────────────────────────────
describe('parseEventDetailHtml — description', () => {
    test('extracts og:description and strips HTML', () => {
        const html = makeHtml({ ogDescription: 'Leer <b>3D</b> ontwerpen.' });
        const result = parseEventDetailHtml(html);
        expect(result.description).toBe('Leer 3D ontwerpen.');
    });

    test('returns empty string when og:description is absent', () => {
        const result = parseEventDetailHtml(makeHtml());
        expect(result.description).toBe('');
    });

    test('truncates long descriptions to 400 chars with ellipsis', () => {
        const long = 'a'.repeat(500);
        const result = parseEventDetailHtml(makeHtml({ ogDescription: long }));
        expect(result.description.length).toBeLessThanOrEqual(401); // 400 chars + '…'
        expect(result.description.endsWith('…')).toBe(true);
    });
});

// ── imageUrl ──────────────────────────────────────────────────────
describe('parseEventDetailHtml — imageUrl', () => {
    test('returns og:image when present', () => {
        const result = parseEventDetailHtml(makeHtml({ ogImage: 'https://example.com/img.jpg' }));
        expect(result.imageUrl).toBe('https://example.com/img.jpg');
    });

    test('normalises http:// to https://', () => {
        const result = parseEventDetailHtml(makeHtml({ ogImage: 'http://example.com/img.jpg' }));
        expect(result.imageUrl).toBe('https://example.com/img.jpg');
    });

    test('resolves a root-relative path to an absolute URL', () => {
        const result = parseEventDetailHtml(makeHtml({ ogImage: '/wp-content/uploads/img.jpg' }));
        expect(result.imageUrl).toMatch(/^https:\/\//);
        expect(result.imageUrl).toContain('/wp-content/uploads/img.jpg');
    });

    test('returns empty string when no image is present', () => {
        const result = parseEventDetailHtml(makeHtml());
        expect(result.imageUrl).toBe('');
    });
});

// ── time ──────────────────────────────────────────────────────────
describe('parseEventDetailHtml — time', () => {
    test('extracts time range from icon-time paragraph', () => {
        const result = parseEventDetailHtml(makeHtml({ timeText: '11/03/2026 19:00-22:00' }));
        expect(result.time).toBe('19:00-22:00');
    });

    test('normalises dot-separated times (19.00-22.00) to colons', () => {
        const result = parseEventDetailHtml(makeHtml({ timeText: '11/03/2026 19.00-22.00' }));
        expect(result.time).toBe('19:00-22:00');
    });

    test('falls back to scanning main text when icon is absent', () => {
        const html = makeHtml({ mainExtra: '<p>Het evenement loopt van 18:00–21:00 uur.</p>' });
        const result = parseEventDetailHtml(html);
        expect(result.time).toBe('18:00–21:00');
    });

    test('returns empty string when no time is found', () => {
        const result = parseEventDetailHtml(makeHtml());
        expect(result.time).toBe('');
    });
});

// ── location ──────────────────────────────────────────────────────
describe('parseEventDetailHtml — location', () => {
    test('extracts location from icon-location paragraph', () => {
        const result = parseEventDetailHtml(makeHtml({ locationText: 'High Tech Lab' }));
        expect(result.location).toBe('High Tech Lab');
    });

    test('strips "Locatie" prefix if present', () => {
        const result = parseEventDetailHtml(makeHtml({ locationText: 'Locatie Grafisch Lab' }));
        expect(result.location).toBe('Grafisch Lab');
    });

    test('returns empty string when location icon is absent', () => {
        const result = parseEventDetailHtml(makeHtml());
        expect(result.location).toBe('');
    });
});

// ── price ─────────────────────────────────────────────────────────
describe('parseEventDetailHtml — price', () => {
    test('extracts price from icon-price paragraph', () => {
        const result = parseEventDetailHtml(makeHtml({ priceText: '€30' }));
        expect(result.price).toBe('€30');
    });

    test('strips "Prijs" prefix if present', () => {
        const result = parseEventDetailHtml(makeHtml({ priceText: 'Prijs €15' }));
        expect(result.price).toBe('€15');
    });

    test('strips "Price" prefix (English) if present', () => {
        const result = parseEventDetailHtml(makeHtml({ priceText: 'Price €10' }));
        expect(result.price).toBe('€10');
    });

    test('falls back to scanning main text for a € amount', () => {
        const html = makeHtml({ mainExtra: '<p>Inschrijving kost €25 per persoon.</p>' });
        const result = parseEventDetailHtml(html);
        expect(result.price).toBe('€25');
    });

    test('falls back to scanning main for decimal price', () => {
        const html = makeHtml({ mainExtra: '<p>Prijs: € 5,00</p>' });
        const result = parseEventDetailHtml(html);
        expect(result.price).toBe('€5,00');
    });

    test('returns empty string when no price is found', () => {
        const result = parseEventDetailHtml(makeHtml());
        expect(result.price).toBe('');
    });

    test('icon-ticket.svg is also recognised', () => {
        const html = `<html><body><main>
          <p><img data-src="/icons/icon-ticket.svg"> €20</p>
        </main></body></html>`;
        const result = parseEventDetailHtml(html);
        expect(result.price).toBe('€20');
    });
});
