import { NextResponse } from 'next/server';

const INTERNAL_URL = process.env.DATA_FETCHER_INTERNAL_URL || 'http://data-fetcher:8080';
const EXTERNAL_URL = process.env.DATA_FETCHER_EXTERNAL_URL || 'http://localhost:8085';

export async function GET() {
    for (const base of [INTERNAL_URL, EXTERNAL_URL]) {
        try {
            const res = await fetch(`${base}/api/drinks`, { cache: 'no-store' });
            if (!res.ok) continue;
            const drinks = await res.json();
            return NextResponse.json(drinks, {
                headers: { 'Cache-Control': 'no-store' },
            });
        } catch {
            // try next base URL
        }
    }
    return NextResponse.json([], { status: 502 });
}
