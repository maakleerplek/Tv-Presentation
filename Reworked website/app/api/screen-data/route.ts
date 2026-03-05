import { NextResponse } from 'next/server';

// Docker-internal hostname (used when running inside the compose network)
const INTERNAL_URL = process.env.DATA_FETCHER_INTERNAL_URL || 'http://data-fetcher:8080';
// Local-dev fallback (used when Next.js runs outside Docker)
const EXTERNAL_URL = process.env.DATA_FETCHER_EXTERNAL_URL || 'http://localhost:8085';

export async function GET() {
    try {
        // Proxy the request to the internal data-fetcher docker container
        let res: Response | undefined;
        try {
            res = await fetch(`${INTERNAL_URL}/api/screen-data`, {
                // Fetch dynamically every time for the presentation
                cache: 'no-store'
            });
        } catch {
            // failed to connect to docker container — fall through to external URL
        }

        if (!res || !res.ok) {
            // Fallback to configured external URL if not in docker network
            const localRes = await fetch(`${EXTERNAL_URL}/api/screen-data`, {
                cache: 'no-store'
            });
            if (!localRes.ok) {
                throw new Error('Failed to fetch from data fetcher');
            }
            const data = await localRes.json();
            return NextResponse.json(data);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch screen data' },
            { status: 500 }
        );
    }
}
