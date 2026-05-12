import { NextRequest, NextResponse } from 'next/server';
import { getChangelog, addChangelogEntry } from '@/lib/db';

export async function GET() {
    const entries = getChangelog(20);
    return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
    }

    const { action, source, item_name, quantity, price } = body as Record<string, unknown>;

    if (typeof action !== 'string' || !['checkout', 'add', 'remove', 'set', 'create'].includes(action)) {
        return NextResponse.json({ error: 'action must be one of: checkout, add, remove, set, create' }, { status: 400 });
    }
    if (typeof source !== 'string' || !source.trim()) {
        return NextResponse.json({ error: 'source is required' }, { status: 400 });
    }
    if (typeof item_name !== 'string' || !item_name.trim()) {
        return NextResponse.json({ error: 'item_name is required' }, { status: 400 });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
        return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
    }
    const parsedPrice = typeof price === 'number' && price >= 0 ? price : null;

    const id = addChangelogEntry(action, source, item_name.trim(), Math.round(quantity), parsedPrice);
    return NextResponse.json({ id }, { status: 201 });
}
