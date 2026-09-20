import { describe, test, expect } from 'bun:test';
import { parseTitleAttr, parseAgendaMonth, isoToDutch, monthsToFetch } from '../scrapers/calendar.js';
import { parseNewsArchive, parseLongDutchDate, unwrapNextImage } from '../scrapers/news.js';

// ── Fixtures ──────────────────────────────────────────────────────
// Trimmed copies of the real markup maakleerplek.be serves, keeping the
// attributes the parsers rely on and dropping the Tailwind noise.

/** One agenda occurrence, as rendered in `?view=month`. */
function agendaLink({ slug, date, title }) {
    const label = title.split(' · ')[1];
    return `<a class="block min-w-0" title="${title}" aria-label="${title}" href="/nl/agenda/${slug}?date=${date}">` +
        `<span class="block break-words"><span class="font-medium">${label}</span></span></a>`;
}

const AGENDA_MONTH = `<!DOCTYPE html><html><body><main>
${agendaLink({ slug: 'young-maker-lab-woensdag', date: '2026-09-02', title: '13:00–17:00 · YOUNG MAKER LAB (woensdag) · Jongeren · High Tech Lab · Gewoon binnenlopen' })}
${agendaLink({ slug: 'honkantine', date: '2026-09-23', title: '11:30–14:30 · HONKantine · Kantine · Gewoon binnenlopen' })}
${agendaLink({ slug: 'de-lasercutter-leren-gebruiken', date: '2026-09-22', title: '19:00–22:00 · De lasercutter leren gebruiken · Workshop · High Tech Lab · Inschrijven' })}
${/* the responsive layout renders the same occurrence twice */ ''}
${agendaLink({ slug: 'honkantine', date: '2026-09-23', title: '11:30–14:30 · HONKantine · Kantine · Gewoon binnenlopen' })}
<a href="/nl/agenda?view=list">Lijst</a>
<a href="/nl/labs/high-tech-lab">High Tech Lab</a>
</main></body></html>`;

// ── parseTitleAttr ────────────────────────────────────────────────
describe('parseTitleAttr', () => {
    test('parses the five-part form with a lab', () => {
        const r = parseTitleAttr('13:00–17:00 · YOUNG MAKER LAB (woensdag) · Jongeren · High Tech Lab · Gewoon binnenlopen');
        expect(r).toEqual({
            time: '13:00 - 17:00',
            name: 'YOUNG MAKER LAB (woensdag)',
            category: 'Jongeren',
            lab: 'High Tech Lab',
            registration: 'Gewoon binnenlopen',
        });
    });

    test('parses the four-part form without a lab', () => {
        const r = parseTitleAttr('11:30–14:30 · HONKantine · Kantine · Gewoon binnenlopen');
        expect(r.lab).toBe('');
        expect(r.name).toBe('HONKantine');
        expect(r.registration).toBe('Gewoon binnenlopen');
    });

    test('normalises the en-dash time range to the format utils.js parses', () => {
        expect(parseTitleAttr('09:30–12:30 · X · Workshop · Inschrijven').time).toBe('09:30 - 12:30');
    });

    test('rejects a title that does not start with a time', () => {
        expect(parseTitleAttr('Geen tijd · X · Workshop · Inschrijven')).toBeNull();
    });

    test('rejects a title with too few parts', () => {
        expect(parseTitleAttr('19:00–22:00 · X · Workshop')).toBeNull();
    });
});

// ── parseAgendaMonth ──────────────────────────────────────────────
describe('parseAgendaMonth', () => {
    const events = parseAgendaMonth(AGENDA_MONTH);

    test('extracts every occurrence link, ignoring navigation links', () => {
        expect(events.length).toBe(4); // includes the duplicate; dedup happens in doFetch
        expect(events.every(e => e.slug && e.dateISO)).toBe(true);
    });

    test('maps an occurrence onto the frontend event shape', () => {
        const laser = events.find(e => e.slug === 'de-lasercutter-leren-gebruiken');
        expect(laser).toMatchObject({
            title: 'De lasercutter leren gebruiken',
            dateISO: '2026-09-22',
            time: '19:00 - 22:00',
            category: 'Workshop',
            registration: 'Inschrijven',
            location: 'High Tech Lab',
            link: 'https://maakleerplek.be/nl/agenda/de-lasercutter-leren-gebruiken?date=2026-09-22',
        });
    });

    test('falls back to "maakleerplek" when the event names no lab', () => {
        expect(events.find(e => e.slug === 'honkantine').location).toBe('maakleerplek');
    });

    test('leaves detail fields blank for the enrichment pass to fill', () => {
        expect(events[0].description).toBe('');
        expect(events[0].imageUrl).toBe('');
        expect(events[0].price).toBe('');
    });

    test('returns nothing for a page with no agenda links', () => {
        expect(parseAgendaMonth('<html><body><p>Niets</p></body></html>')).toEqual([]);
    });
});

// ── isoToDutch / monthsToFetch ────────────────────────────────────
describe('date helpers', () => {
    test('isoToDutch renders the short Dutch form', () => {
        expect(isoToDutch('2026-09-22')).toBe('di 22 sep');
        expect(isoToDutch('2026-03-01')).toBe('zo 1 mrt');
    });

    test('isoToDutch returns empty string on malformed input', () => {
        expect(isoToDutch('nonsense')).toBe('');
    });

    test('monthsToFetch includes the current month plus N ahead', () => {
        expect(monthsToFetch(3, new Date(2026, 8, 20))).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    });

    test('monthsToFetch rolls over the year boundary', () => {
        expect(monthsToFetch(2, new Date(2026, 10, 5))).toEqual(['2026-11', '2026-12', '2027-01']);
    });
});

// ── news helpers ──────────────────────────────────────────────────
describe('parseLongDutchDate', () => {
    test('parses a full Dutch date', () => {
        const d = parseLongDutchDate('18 september 2026');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(8);
        expect(d.getDate()).toBe(18);
    });

    test('is case-insensitive', () => {
        expect(parseLongDutchDate('1 Maart 2025').getMonth()).toBe(2);
    });

    test('returns null for an unparseable string', () => {
        expect(parseLongDutchDate('ooit')).toBeNull();
        expect(parseLongDutchDate('18 smurfmaand 2026')).toBeNull();
    });
});

describe('unwrapNextImage', () => {
    test('decodes the original CDN url out of the optimiser url', () => {
        const src = '/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fx%2Fy-1600x1200.jpg%3Fw%3D900&w=828&q=75';
        expect(unwrapNextImage(src)).toBe('https://cdn.sanity.io/images/x/y-1600x1200.jpg?w=900');
    });

    test('passes a plain url through unchanged', () => {
        expect(unwrapNextImage('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    });

    test('returns empty string for empty input', () => {
        expect(unwrapNextImage('')).toBe('');
    });
});

// ── parseNewsArchive ──────────────────────────────────────────────
const NEWS_ARCHIVE = `<!DOCTYPE html><html><body>
<a class="btn" href="/nl/verhalen/delen">Deel je verhaal</a>
<a class="group block" href="/nl/verhalen/battlebot-arena">
  <div><img alt="Battlebot" src="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fse2l18r1%2Fproduction%2Ff708-1600x1200.jpg&amp;w=3840&amp;q=75"/></div>
  <div><div><span class="etiket">Makers &amp; projecten</span></div>
  <h3>Zes jaar volhouden: naar de battlebot-arena</h3>
  <p class="tabular">18 september 2026 · Erwan Vercruysse, maker en vrijwilliger</p>
  <p>Toen Erwan als allereerste maker binnenstapte, wist hij nog niets van robots.</p></div>
</a>
<a class="group block" href="/nl/verhalen/zomerkamp-grafisch-lab">
  <div><img alt="Zomerkamp" src="/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fse2l18r1%2Fproduction%2Fd2a5-1417x945.jpg&amp;w=1080&amp;q=75"/></div>
  <div><div><span class="etiket">Workshop</span></div>
  <h3>INSCHRIJVINGEN OPEN: Zomerkamp in het Grafisch Lab!</h3>
  <p class="tabular">19 juni 2026 · Maakleerplek</p>
  <p>Voor wie graag creatief aan de slag gaat met foto- en druktechnieken.</p></div>
</a>
<a class="group block" href="/nl/verhalen/battlebot-arena"><h3>Zes jaar volhouden: naar de battlebot-arena</h3></a>
</body></html>`;

describe('parseNewsArchive', () => {
    const items = parseNewsArchive(NEWS_ARCHIVE);

    test('skips the "share your story" link and deduplicates cards', () => {
        expect(items.length).toBe(2);
        expect(items.some(i => i.link.endsWith('/delen'))).toBe(false);
    });

    test('reads title, date, author and excerpt off the card', () => {
        expect(items[0]).toMatchObject({
            title: 'Zes jaar volhouden: naar de battlebot-arena',
            link: 'https://maakleerplek.be/nl/verhalen/battlebot-arena',
            author: 'Erwan Vercruysse, maker en vrijwilliger',
            category: 'Makers & projecten',
            date: '18 september 2026',
        });
        expect(items[0].description).toContain('allereerste maker');
    });

    test('resolves the card image back to its CDN url', () => {
        expect(items[0].imageUrl)
            .toBe('https://cdn.sanity.io/images/se2l18r1/production/f708-1600x1200.jpg');
    });

    test('turns the Dutch date into a sortable ISO timestamp', () => {
        const first = new Date(items[0].modifiedTime);
        expect([first.getFullYear(), first.getMonth(), first.getDate()]).toEqual([2026, 8, 18]);
        expect(items[1].modifiedTime < items[0].modifiedTime).toBe(true);
    });

    test('returns nothing for a page with no story cards', () => {
        expect(parseNewsArchive('<html><body><p>Niets</p></body></html>')).toEqual([]);
    });
});
