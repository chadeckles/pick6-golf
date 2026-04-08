import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "masters-pick6.db");

// Ensure the directory exists (critical for Railway persistent volumes)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pool_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      admin_user_id TEXT NOT NULL,
      lock_date TEXT NOT NULL,
      payment_link TEXT,
      payment_label TEXT DEFAULT 'Pay Entry Fee',
      entry_fee TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS picks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      tier INTEGER NOT NULL,
      golfer_id TEXT NOT NULL,
      golfer_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (pool_id) REFERENCES pools(id),
      UNIQUE(user_id, pool_id, golfer_id)
    );

    CREATE TABLE IF NOT EXISTS pool_payments (
      pool_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      marked_by TEXT,
      marked_at TEXT,
      PRIMARY KEY (pool_id, user_id),
      FOREIGN KEY (pool_id) REFERENCES pools(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_picks_user_pool ON picks(user_id, pool_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_pools_invite ON pools(invite_code);
  `);

  // Migrate: add payment columns to pools if missing
  const poolCols = db.prepare("PRAGMA table_info(pools)").all() as { name: string }[];
  const poolColNames = new Set(poolCols.map((c) => c.name));
  if (!poolColNames.has("payment_link")) {
    db.exec("ALTER TABLE pools ADD COLUMN payment_link TEXT");
  }
  if (!poolColNames.has("payment_label")) {
    db.exec("ALTER TABLE pools ADD COLUMN payment_label TEXT DEFAULT 'Pay Entry Fee'");
  }
  if (!poolColNames.has("entry_fee")) {
    db.exec("ALTER TABLE pools ADD COLUMN entry_fee TEXT");
  }
}
