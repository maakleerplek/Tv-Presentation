import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side image proxy.
 *
 * Forwards /api/proxy-image?url=<encoded-url> to the data-fetcher, which in
 * turn authenticates against InvenTree and streams the image bytes back.
 * This avoids exposing the InvenTree host/token to the browser and fixes the
 * broken "http://data-fetcher:8080" hardcoded URL in the client component.
 *
 * Usage: <img src="/api/proxy-image?url=<encoded-inventree-img-url>" />
 */

// Docker-internal hostname (used when running inside the compose network)
const INTERNAL_URL = process.env.DATA_FETCHER_INTERNAL_URL || 'http://data-fetcher:8080';
// Local-dev fallback (used when Next.js runs outside Docker)
const EXTERNAL_URL = process.env.DATA_FETCHER_EXTERNAL_URL || 'http://localhost:8085';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    // Build the full target URL on the data-fetcher (which handles InvenTree auth)
    const targetPath = `/api/proxy-image?url=${encodeURIComponent(url)}`;

    // Try Docker-internal hostname first, fall back to external URL for dev
    let dataFetcherRes: Response | null = null;
    try {
        dataFetcherRes = await fetch(`${INTERNAL_URL}${targetPath}`, {
            cache: 'no-store',
        });
    } catch {
        // data-fetcher container not reachable — fall through to external URL
    }

    if (!dataFetcherRes || !dataFetcherRes.ok) {
        try {
            dataFetcherRes = await fetch(`${EXTERNAL_URL}${targetPath}`, {
                cache: 'no-store',
            });
        } catch {
            return new NextResponse('Failed to fetch image from data-fetcher', { status: 502 });
        }
    }

    if (!dataFetcherRes.ok) {
        return new NextResponse('Image not found', { status: dataFetcherRes.status });
    }

    const buffer = await dataFetcherRes.arrayBuffer();
    const contentType = dataFetcherRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
