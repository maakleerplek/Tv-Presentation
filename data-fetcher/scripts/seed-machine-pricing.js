/**
 * Creates the machine usage prices in InvenTree, or brings them in line with
 * MACHINES below. Safe to run again: it finds what exists and only fixes what
 * differs.
 *
 * Run inside the data-fetcher container (it has INVENTREE_URL and a token
 * that can write):
 *   docker exec tv-data-fetcher node scripts/seed-machine-pricing.js
 */

import { INVENTREE_URL, INVENTREE_TOKEN, INVENTREE_MACHINE_CATEGORY } from '../config.js';
import { MINIMUM_TEMPLATE } from '../scrapers/pricing.js';

/** price is per unit; minimum is the least a job costs (null = none). */
const MACHINES = [
    { name: 'Lasercutter', units: 'min', price: 0.50, minimum: 5 },
    { name: 'CNC',         units: 'min', price: 0.50, minimum: 5 },
    { name: '3D-print',    units: 'g',   price: 0.10, minimum: null },
];

const headers = {
    'Authorization': `Token ${INVENTREE_TOKEN}`,
    'Content-Type':  'application/json',
};

async function api(method, path, body) {
    const res = await fetch(`${INVENTREE_URL}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
}

const list = (data) => (Array.isArray(data) ? data : data.results || []);
const query = (params) => new URLSearchParams(params).toString();

// Match the name here too: InvenTree ignores `name` as a filter on /api/part/
// and returns every part in the category.
async function findOrCreate(path, filter, body) {
    const found = list(await api('GET', `${path}?${query(filter)}`)).find(r => r.name === body.name);
    if (found) return found;
    console.log(`+ ${path} ${JSON.stringify(body)}`);
    return api('POST', path, body);
}

async function main() {
    if (!INVENTREE_TOKEN) throw new Error('INVENTREE_TOKEN is not set');

    const category = await findOrCreate('/api/part/category/',
        { name: INVENTREE_MACHINE_CATEGORY },
        { name: INVENTREE_MACHINE_CATEGORY, description: 'Machine usage prices shown on the HTL TV' });

    const template = await findOrCreate('/api/parameter/template/',
        { name: MINIMUM_TEMPLATE },
        { name: MINIMUM_TEMPLATE, units: '', description: 'Minimum price per job (€)', model_type: 'part.part' });

    for (const m of MACHINES) {
        const part = await findOrCreate('/api/part/',
            { category: category.pk, name: m.name },
            { name: m.name, category: category.pk, units: m.units, description: `Machine usage, per ${m.units}`,
              virtual: true, salable: true, purchaseable: false, component: false, active: true });
        if (part.units !== m.units || !part.virtual || !part.salable) {
            console.log(`~ part ${m.name}: units=${m.units}, virtual, salable`);
            await api('PATCH', `/api/part/${part.pk}/`, { units: m.units, virtual: true, salable: true });
        }

        // One sale price break, at quantity 1.
        const breaks = list(await api('GET', `/api/part/sale-price/?${query({ part: part.pk })}`));
        const one = breaks.find(b => parseFloat(b.quantity) === 1);
        if (!one) {
            console.log(`+ sale price ${m.name}: €${m.price}`);
            await api('POST', '/api/part/sale-price/', { part: part.pk, quantity: 1, price: m.price, price_currency: 'EUR' });
        } else if (parseFloat(one.price) !== m.price) {
            console.log(`~ sale price ${m.name}: €${one.price} → €${m.price}`);
            await api('PATCH', `/api/part/sale-price/${one.pk}/`, { price: m.price, price_currency: 'EUR' });
        }

        const param = list(await api('GET', `/api/parameter/?${query(
            { model_type: 'part.part', model_id: part.pk, template: template.pk })}`))[0];
        if (m.minimum == null) {
            if (param) {
                console.log(`- minimum ${m.name}`);
                await api('DELETE', `/api/parameter/${param.pk}/`);
            }
        } else if (!param) {
            console.log(`+ minimum ${m.name}: €${m.minimum}`);
            await api('POST', '/api/parameter/', {
                model_type: 'part.part', model_id: part.pk, template: template.pk, data: String(m.minimum) });
        } else if (parseFloat(param.data) !== m.minimum) {
            console.log(`~ minimum ${m.name}: €${param.data} → €${m.minimum}`);
            await api('PATCH', `/api/parameter/${param.pk}/`, { data: String(m.minimum) });
        }
    }
    console.log(`Machine prices up to date in "${INVENTREE_MACHINE_CATEGORY}" on ${INVENTREE_URL}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
