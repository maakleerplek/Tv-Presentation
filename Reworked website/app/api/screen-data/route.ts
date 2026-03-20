import { NextResponse } from 'next/server';
import { getScreenData } from '@/lib/data';

export async function GET() {
    const data = await getScreenData();
    if (!data) {
        return NextResponse.json(
            { error: 'Failed to fetch screen data' },
            { status: 500 }
        );
    }
    return NextResponse.json(data);
}
