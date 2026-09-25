import { NextResponse } from 'next/server';
import { getCategoryOrder } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Settings the TV reads from the admin panel. Read-only; saving goes through the admin actions. */
export async function GET() {
    return NextResponse.json({ categoryOrder: getCategoryOrder() }, { headers: { 'Cache-Control': 'no-store' } });
}
