import path from 'path';

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

// Lazily initialize the database connection
type DbLike = {
  prepare: (query: string) => { get: () => unknown; all: () => unknown[]; run: (...args: unknown[]) => { lastInsertRowid: number } };
  exec: (sql: string) => void;
};

let dbInstance: DbLike | null = null;

function getDb(): DbLike {
  if (dbInstance) return dbInstance;
  
  const dbPath = path.join(process.cwd(), 'custom-news.db');
  
  // Only import bun:sqlite if we are actually running inside Bun runtime
  if (typeof process !== 'undefined' && process.versions && Boolean((process.versions as NodeJS.ProcessVersions & { bun?: string }).bun)) {
    try {
      // Use import.meta.require to prevent Next.js from bundling bun:sqlite at build time.
      // import.meta.require is Bun's ESM-safe CJS bridge; eval('require') fails in ESM.
      const Database = (import.meta as ImportMeta & { require: (id: string) => { Database: new (dbPath: string) => DbLike } }).require('bun:sqlite').Database;
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
