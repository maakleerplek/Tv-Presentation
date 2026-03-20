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
let dbInstance: any = null;

function getDb() {
  if (dbInstance) return dbInstance;
  
  // In production (Docker), this will be saved in the container's working directory.
  const dbPath = path.join(process.cwd(), 'custom-news.db');
  
  // Hide from Webpack using dynamic string to prevent build errors in Next.js
  const bunSqlite = 'bun' + ':sqlite';
  const { Database } = require(bunSqlite);
  dbInstance = new Database(dbPath);
  dbInstance.exec('PRAGMA journal_mode = WAL;');

  // Create the table if it doesn't exist
  dbInstance.exec(`
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
    dbInstance.exec(`ALTER TABLE custom_news ADD COLUMN image_url TEXT`);
  } catch (e) {
    // Column might already exist, safe to ignore
  }

  // Create admin users table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // Seed the admin user if it doesn't exist
  const stmt = dbInstance.prepare(`SELECT 1 FROM admin_users WHERE username = 'admin'`);
  const adminExists = stmt.get();
  
  if (!adminExists) {
    dbInstance.prepare(`INSERT INTO admin_users (username, password) VALUES ('admin', '3EmmertjesWater')`).run();
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
