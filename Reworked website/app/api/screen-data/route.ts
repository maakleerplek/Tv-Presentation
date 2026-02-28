import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Proxy the request to the internal data-fetcher docker container
        let res;
        try {
            res = await fetch('http://data-fetcher:8080/api/screen-data', {
                // Fetch dynamically every time for the presentation
                cache: 'no-store'
            });
        } catch (e) {
            // failed to connect to docker container
        }

        if (!res || !res.ok) {
            // Fallback to localhost if not in docker network
            const localRes = await fetch('http://localhost:8085/api/screen-data', {
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
