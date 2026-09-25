import { NextRequest, NextResponse } from 'next/server';
import { setKioskState } from '@/lib/tv-state';

/**
 * The Pi scanner reports whether someone is shopping: "busy" from the first
 * scan until the cart is empty again, "idle" otherwise. It also repeats its
 * state as a heartbeat, so a Pi that goes silent can't freeze the TV forever.
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const state = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).state : undefined;
    if (state !== 'idle' && state !== 'busy') {
        return NextResponse.json({ error: 'state must be one of: idle, busy' }, { status: 400 });
    }

    return NextResponse.json(setKioskState(state === 'busy'));
}
