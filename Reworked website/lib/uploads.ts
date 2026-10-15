import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/** Images uploaded in the admin panel. They sit in the data volume, so a rebuild keeps them. */
export const UPLOAD_PREFIX = '/api/uploads/';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};
export const UPLOAD_TYPES: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t]));

function uploadDir(): string {
  const dir = path.join(process.env.DB_DIR || path.join(process.cwd(), 'data'), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Only names this module wrote: a uuid and a known extension, so no path tricks. */
export function uploadPath(name: string): string | null {
  return /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(name) ? path.join(uploadDir(), name) : null;
}

/** Stores the file and returns the URL the TV loads it from, or an error message. */
export async function saveUpload(file: File): Promise<{ url: string } | { error: string }> {
  const ext = EXT[file.type];
  if (!ext) return { error: 'Image must be JPG, PNG, WebP or GIF' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'Image is larger than 8 MB' };
  const name = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));
  return { url: UPLOAD_PREFIX + name };
}

/** Removes an uploaded image; links to other hosts are left alone. */
export function deleteUpload(url: string | null | undefined) {
  if (!url?.startsWith(UPLOAD_PREFIX)) return;
  const p = uploadPath(url.slice(UPLOAD_PREFIX.length));
  if (p) fs.rmSync(p, { force: true });
}
