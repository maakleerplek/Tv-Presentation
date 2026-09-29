import { describe, test, expect, afterEach } from 'bun:test';

import { buildEquipment, fetchMachinePricing } from '../scrapers/pricing.js';

const OPTS = { base: 'http://inventree.test', token: 'test-token', useCache: false };

const PARTS = [
    { pk: 1, name: 'Lasercutter', units: 'min' },
    { pk: 2, name: 'CNC', units: 'min' },
    { pk: 3, name: '3D-print', units: 'g' },
];

describe('buildEquipment', () => {
    test('one row per priced machine, sorted by name', () => {
        const rows = buildEquipment(PARTS, new Map([[1, 0.5], [2, 0.5], [3, 0.1]]), new Map([[1, 5], [2, 5]]));
        expect(rows).toEqual([
            { name: '3D-print', price: '€0.10', unit: 'g', minimum: null },
            { name: 'CNC', price: '€0.50', unit: 'min', minimum: '€5.00' },
            { name: 'Lasercutter', price: '€0.50', unit: 'min', minimum: '€5.00' },
        ]);
    });

    test('a machine without a sale price is left out', () => {
        const rows = buildEquipment(PARTS, new Map([[1, 0.5]]), new Map());
        expect(rows.map(r => r.name)).toEqual(['Lasercutter']);
    });
});

describe('fetchMachinePricing', () => {
    const realFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = realFetch; });

    const json = (body) => new Response(JSON.stringify(body), { status: 200 });

    test('reads category, parts, sale prices and minimums from InvenTree', async () => {
        globalThis.fetch = async (url) => {
            const u = String(url);
            if (u.includes('/api/part/category/')) return json([{ pk: 8, name: 'Other' }, { pk: 9, name: 'Machinegebruik' }]);
            if (u.includes('/api/part/sale-price/')) return json([
                { part: 1, quantity: '1', price: '0.50' },
                { part: 3, quantity: '1', price: '0.10' },
            ]);
            if (u.includes('/api/part/?category=9')) return json({ results: PARTS.filter(p => p.pk !== 2), next: null });
            if (u.includes('/api/parameter/template/')) return json([{ pk: 4, name: 'Minimum' }]);
            if (u.includes('/api/parameter/?')) return json({ results: [{ model_id: 1, data: '5', data_numeric: 5 }], next: null });
            throw new Error(`unexpected ${u}`);
        };
        const pricing = await fetchMachinePricing(OPTS);
        expect(pricing.equipment).toEqual([
            { name: '3D-print', price: '€0.10', unit: 'g', minimum: null },
            { name: 'Lasercutter', price: '€0.50', unit: 'min', minimum: '€5.00' },
        ]);
    });

    test('returns null when InvenTree answers with an error', async () => {
        globalThis.fetch = async () => new Response('nope', { status: 500 });
        expect(await fetchMachinePricing(OPTS)).toBeNull();
    });
});
