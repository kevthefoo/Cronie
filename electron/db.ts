import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database | null = null;

export async function initDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  const dbPath = path.join(app.getPath('userData'), 'cronie.db');

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  migrate(db);
  saveDb();
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function saveDb() {
  if (!db) return;
  const dbPath = path.join(app.getPath('userData'), 'cronie.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function migrate(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cron_expression TEXT NOT NULL,
      task_type TEXT NOT NULL CHECK(task_type IN ('shell', 'http', 'plugin')),
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      tags TEXT DEFAULT '',
      retry_count INTEGER NOT NULL DEFAULT 0,
      retry_delay_ms INTEGER NOT NULL DEFAULT 1000,
      timeout_ms INTEGER NOT NULL DEFAULT 30000,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failure', 'timeout', 'skipped')),
      exit_code INTEGER,
      stdout TEXT DEFAULT '',
      stderr TEXT DEFAULT '',
      http_status INTEGER,
      http_response_body TEXT,
      error_message TEXT,
      error_stack TEXT,
      retry_attempt INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_task_id ON execution_logs(task_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_status ON execution_logs(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_start_time ON execution_logs(start_time)`);

  // Add sort_order column if it doesn't exist
  try {
    db.run(`ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
