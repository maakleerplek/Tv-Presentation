import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

process.env.DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
const { saveUpload, deleteUpload, uploadPath } = await import('../lib/uploads');

describe('uploads', () => {
  it('stores an image, then deletes it', async () => {
    const res = await saveUpload(new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));
    if (!('url' in res)) throw new Error(res.error);
    const p = uploadPath(res.url.split('/').pop()!)!;
    expect(fs.readFileSync(p).length).toBe(3);
    deleteUpload(res.url);
    expect(fs.existsSync(p)).toBe(false);
  });

  it('refuses other types and odd names', async () => {
    expect(await saveUpload(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toHaveProperty('error');
    expect(uploadPath('../custom-news.db')).toBeNull();
  });
});
