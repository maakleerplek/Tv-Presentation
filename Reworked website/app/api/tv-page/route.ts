import { NextRequest, NextResponse } from 'next/server';
import { getView, navigatePage } from '@/lib/tv-state';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(getView(), { headers: { 'Cache-Control': 'no-store' } });
}

/** The Pi scanner posts here when someone scans PAGE-PREV or PAGE-NEXT. */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const action = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).action : undefined;
    if (action !== 'next' && action !== 'prev') {
        return NextResponse.json({ error: 'action must be one of: next, prev' }, { status: 400 });
    }

    return NextResponse.json(navigatePage(action === 'next' ? 1 : -1));
}
