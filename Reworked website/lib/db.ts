import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { DEFAULT_CATEGORY_ORDER, sanitizeCategoryOrder } from './category-order';

// Define the shape of our custom news
export type CustomNewsRow = {
  id: number;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  tags: string;
  created_at: string;
};

export type ChangelogRow = {
  id: number;
  action: string;
  source: string;
  item_name: string;
  quantity: number;
  price: number | null;
  created_at: string;
};

// Lazily initialize the database connection
type DbLike = {
  prepare: (query: string) => { get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[]; run: (...args: unknown[]) => { lastInsertRowid: number } };
  exec: (sql: string) => void;
};

let dbInstance: DbLike | null = null;

/**
 * Where the SQLite file lives.
 *
 * It sits in its own directory so a Docker volume can be mounted over it —
 * a volume mounts a directory, not a file, and WAL mode puts `-wal` and
 * `-shm` alongside the database anyway. Without that mount the database
 * lives in the container's writable layer and every `docker compose build`
 * silently discards the changelog, the custom news items and the admin
 * credentials.
 *
 * Databases written before this moved are migrated once, so an existing
 * deployment keeps its data.
 */
export function resolveDbPath(): string {
  const dir = process.env.DB_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });

  const dbPath = path.join(dir, 'custom-news.db');
  const legacyPath = path.join(process.cwd(), 'custom-news.db');

  if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
    try {
      fs.renameSync(legacyPath, dbPath);
      // WAL sidecars have to travel with the database or its last
      // transactions are lost.
      for (const suffix of ['-wal', '-shm']) {
        if (fs.existsSync(legacyPath + suffix)) {
          fs.renameSync(legacyPath + suffix, dbPath + suffix);
        }
      }
      console.log(`[DB] Migrated database from ${legacyPath} to ${dbPath}`);
    } catch (error) {
      console.error('[DB] Could not migrate the existing database:', error);
    }
  }

  return dbPath;
}

function getDb(): DbLike {
  if (dbInstance) return dbInstance;
  
  const dbPath = resolveDbPath();
  
  // Only import bun:sqlite if we are actually running inside Bun runtime
  if (typeof process !== 'undefined' && process.versions && Boolean((process.versions as NodeJS.ProcessVersions & { bun?: string }).bun)) {
    try {
      // Use createRequire so webpack can't statically analyze the 'bun:sqlite' argument
      // and won't attempt to bundle it. eval('require') was the prior approach but
      // 'require' is not in scope in Bun's ESM test runner on CI.
      const { Database } = createRequire(import.meta.url)('bun:sqlite');
      const db = new Database(dbPath);
      db.exec('PRAGMA journal_mode = WAL;');

      // Create the table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS custom_news (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          url TEXT,
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migrate to add image_url if it doesn't exist
      try {
        db.exec(`ALTER TABLE custom_news ADD COLUMN image_url TEXT`);
      } catch (e) {
        // Column might already exist, safe to ignore
      }

      // Create changelog table
      db.exec(`
        CREATE TABLE IF NOT EXISTS changelog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          source TEXT NOT NULL,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          price REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migrate: add price column if it doesn't exist yet
      try {
        db.exec(`ALTER TABLE changelog ADD COLUMN price REAL`);
      } catch {
        // Column already exists, safe to ignore
      }

      // Key/value settings edited in the admin panel (e.g. the TV category order)
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // Create admin users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `);

      // Seed the admin user if it doesn't exist
      const stmt = db.prepare(`SELECT 1 FROM admin_users WHERE username = 'admin'`);
      const adminExists = stmt.get();
      
      if (!adminExists) {
        db.prepare(`INSERT INTO admin_users (username, password) VALUES ('admin', '3EmmertjesWater')`).run();
      }
      dbInstance = db;
    } catch (error) {
      console.error('[DB] Failed to initialize SQLite:', error);
      // Fallback to dummy instance
      dbInstance = {
        prepare: () => ({ get: () => null, all: () => [], run: () => ({ lastInsertRowid: 0 }) }),
        exec: () => {}
      };
    }
  } else {
    // Dummy DB instance for Node.js build process to prevent crashes
    // In production, the Next.js server runs inside Bun, so it will use the block above
    dbInstance = {
      prepare: () => ({ get: () => null, all: () => [], run: () => ({ lastInsertRowid: 0 }) }),
      exec: () => {}
    };
  }

  if (!dbInstance) {
    dbInstance = {
      prepare: () => ({ get: () => null, all: () => [], run: () => ({ lastInsertRowid: 0 }) }),
      exec: () => {}
    };
  }

  return dbInstance;
}

export function getCustomNews(): CustomNewsRow[] {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM custom_news ORDER BY created_at DESC');
    return stmt.all() as CustomNewsRow[];
  } catch (error) {
    console.error('[DB] Error fetching custom news:', error);
    return [];
  }
}

export function addCustomNews(title: string, description: string, url: string, image_url: string, tags: string) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO custom_news (title, description, url, image_url, tags)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(title, description, url, image_url, tags);
  return info.lastInsertRowid; 
}

export function deleteCustomNews(id: number) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM custom_news WHERE id = ?');
  stmt.run(id);
}

export function getChangelog(limit = 20): ChangelogRow[] {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM changelog ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as ChangelogRow[];
  } catch (error) {
    console.error('[DB] Error fetching changelog:', error);
    return [];
  }
}

export function addChangelogEntry(action: string, source: string, item_name: string, quantity: number, price?: number | null): number {
  const db = getDb();
  // Prune entries older than 7 days to keep the table small
  db.prepare(`DELETE FROM changelog WHERE created_at < datetime('now', '-7 days')`).run();
  const stmt = db.prepare(`
    INSERT INTO changelog (action, source, item_name, quantity, price)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(action, source, item_name, quantity, price ?? null);
  return info.lastInsertRowid;
}

export function verifyAdmin(password: string): boolean {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT password FROM admin_users WHERE username = 'admin'`).get() as { password?: string } | undefined;
    return row?.password === password;
  } catch (error) {
    console.error('[DB] Error verifying admin:', error);
    return false;
  }
}

export function getSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value?: string } | null;
    return row?.value ?? null;
  } catch (error) {
    console.error('[DB] Error reading setting:', error);
    return null;
  }
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

const CATEGORY_ORDER_KEY = 'tv_category_order';

export function getCategoryOrder(): string[] {
  const raw = getSetting(CATEGORY_ORDER_KEY);
  if (!raw) return DEFAULT_CATEGORY_ORDER;
  try {
    return sanitizeCategoryOrder(JSON.parse(raw)) ?? DEFAULT_CATEGORY_ORDER;
  } catch {
    return DEFAULT_CATEGORY_ORDER;
  }
}

export function setCategoryOrder(order: string[]) {
  setSetting(CATEGORY_ORDER_KEY, JSON.stringify(order));
}
