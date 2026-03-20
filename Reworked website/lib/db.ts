import Database from 'better-sqlite3';
import path from 'path';

// Define the shape of our custom news
export type CustomNewsRow = {
  id: number;
  title: string;
  description: string;
  url: string;
  tags: string;
  created_at: string;
};

// Lazily initialize the database connection
let dbInstance: ReturnType<typeof Database> | null = null;

function getDb() {
  if (dbInstance) return dbInstance;
  
  // In production (Docker), this will be saved in the container's working directory.
  const dbPath = path.join(process.cwd(), 'custom-news.db');
  dbInstance = new Database(dbPath, { timeout: 5000 }); // Add timeout to wait for locks
  
  // Enable WAL mode for better performance
  dbInstance.pragma('journal_mode = WAL');

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

export function addCustomNews(title: string, description: string, url: string, tags: string) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO custom_news (title, description, url, tags)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(title, description, url, tags);
  return info.lastInsertRowid;
}

export function deleteCustomNews(id: number) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM custom_news WHERE id = ?');
  stmt.run(id);
}
