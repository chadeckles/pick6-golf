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
  // Migrate: add tournament_slug to pools (defaults to 'masters' for existing pools)
  if (!poolColNames.has("tournament_slug")) {
    db.exec("ALTER TABLE pools ADD COLUMN tournament_slug TEXT DEFAULT 'masters'");
  }
  // Migrate: store the ORIGINAL lock_date so admins can't push it forward
  // after the tournament starts. Backfilled from the current lock_date.
  if (!poolColNames.has("original_lock_date")) {
    db.exec("ALTER TABLE pools ADD COLUMN original_lock_date TEXT");
    db.exec("UPDATE pools SET original_lock_date = lock_date WHERE original_lock_date IS NULL");
  }

  // Password reset tokens (short-lived, single-use)
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
  `);

  // Audit log for anything that could be disputed (picks, pool settings, payments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      pool_id TEXT,
      before_json TEXT,
      after_json TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_pool ON audit_log(pool_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  `);

  // Migrate: add pool_members junction table for multi-pool support
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_members (
      user_id TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, pool_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (pool_id) REFERENCES pools(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pool_members_user ON pool_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_pool_members_pool ON pool_members(pool_id);
  `);

  // Migrate existing users.pool_id data into pool_members
  const migrated = db.prepare("SELECT COUNT(*) as c FROM pool_members").get() as { c: number };
  if (migrated.c === 0) {
    db.exec(`
      INSERT OR IGNORE INTO pool_members (user_id, pool_id)
      SELECT id, pool_id FROM users WHERE pool_id IS NOT NULL
    `);
  }
}
