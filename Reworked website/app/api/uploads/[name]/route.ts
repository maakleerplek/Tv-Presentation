import fs from 'fs';
import { NextResponse } from 'next/server';
import { uploadPath, UPLOAD_TYPES } from '@/lib/uploads';

/** Serves images uploaded in the admin panel. Names are uuids, so the bytes never change. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const file = uploadPath(name);
  if (!file || !fs.existsSync(file)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: {
      'Content-Type': UPLOAD_TYPES[name.split('.').pop()!],
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
