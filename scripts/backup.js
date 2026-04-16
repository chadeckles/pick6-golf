#!/usr/bin/env node
/**
 * Masters Pick 6 — Nightly backup
 *
 * Takes a *consistent* snapshot of the SQLite database (safe to run while
 * the app is live), gzips it, writes it to BACKUP_DIR, and prunes snapshots
 * older than RETENTION_DAYS.
 *
 * ── Usage ────────────────────────────────────────────────────────────
 *   node scripts/backup.js            # one-off
 *   npm run backup                    # same, via package.json
 *
 * ── Env ──────────────────────────────────────────────────────────────
 *   DATABASE_PATH    source .db (default: <repo>/masters-pick6.db)
 *   BACKUP_DIR       destination dir (default: <repo>/backups)
 *   RETENTION_DAYS   how many days of snapshots to keep (default: 14)
 *
 *   # Optional — enable S3/R2 upload later without code changes:
 *   BACKUP_S3_BUCKET       e.g. "masters-pick6-backups"
 *   BACKUP_S3_ENDPOINT     Cloudflare R2 / custom endpoint (optional)
 *   BACKUP_S3_REGION       e.g. "auto" for R2, "us-east-1" for AWS
 *   AWS_ACCESS_KEY_ID      access key
 *   AWS_SECRET_ACCESS_KEY  secret
 *
 * ── Scheduling ───────────────────────────────────────────────────────
 * On Railway:
 *   Add a Cron job (Project → New → Cron). Schedule "15 7 * * *" (07:15 UTC
 *   = 2:15 AM ET). Command: `node scripts/backup.js`. Point it at the same
 *   volume your main service uses.
 *
 * On any other host with cron:
 *   15 2 * * *  cd /path/to/app && /usr/bin/node scripts/backup.js >> /var/log/mp6-backup.log 2>&1
 *
 * ── Restoring ────────────────────────────────────────────────────────
 *   gunzip -k backups/mp6-YYYY-MM-DD_HH-MM-SS.db.gz
 *   mv masters-pick6.db masters-pick6.db.bad
 *   mv backups/mp6-YYYY-MM-DD_HH-MM-SS.db masters-pick6.db
 *   # restart the app
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const Database = require("better-sqlite3");

const REPO_ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DATABASE_PATH || path.join(REPO_ROOT, "masters-pick6.db");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(REPO_ROOT, "backups");
const RETENTION_DAYS = Math.max(1, parseInt(process.env.RETENTION_DAYS || "14", 10));

const FILE_PREFIX = "mp6-";
const FILE_REGEX = /^mp6-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db(\.gz)?$/;

function log(msg) {
  console.log(`[backup ${new Date().toISOString()}] ${msg}`);
}

function fail(msg, err) {
  console.error(`[backup ${new Date().toISOString()}] ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

/**
 * Use better-sqlite3's online backup. Unlike `cp`, this handles the WAL
 * correctly so the resulting file is a fully-consistent snapshot even if
 * the live app is writing during the copy.
 */
async function takeSnapshot(srcPath, destPath) {
  const db = new Database(srcPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }
}

async function gzipFile(srcPath, gzPath) {
  const src = fs.createReadStream(srcPath);
  const dest = fs.createWriteStream(gzPath);
  const gz = zlib.createGzip({ level: 9 });
  await pipeline(src, gz, dest);
  fs.unlinkSync(srcPath);
}

function pruneOld(dir, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  let bytesFreed = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!FILE_REGEX.test(entry)) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      bytesFreed += stat.size;
      fs.unlinkSync(full);
      removed++;
    }
  }
  return { removed, bytesFreed };
}

/**
 * Optional S3/R2 upload. Requires `@aws-sdk/client-s3` — we lazy-require
 * so the script still works without it installed when you're running local-only.
 */
async function maybeUploadToS3(localPath) {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) return false;

  let S3Client, PutObjectCommand;
  try {
    ({ S3Client, PutObjectCommand } = require("@aws-sdk/client-s3"));
  } catch {
    log(
      "BACKUP_S3_BUCKET is set but @aws-sdk/client-s3 is not installed. " +
        "Run `npm install @aws-sdk/client-s3` to enable uploads. Skipping."
    );
    return false;
  }

  const client = new S3Client({
    region: process.env.BACKUP_S3_REGION || "auto",
    endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const key = path.basename(localPath);
  const body = fs.readFileSync(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
    })
  );
  log(`uploaded → s3://${bucket}/${key} (${body.length} bytes)`);
  return true;
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    fail(`source DB not found at ${DB_PATH}`);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const snapName = `${FILE_PREFIX}${timestamp()}.db`;
  const snapPath = path.join(BACKUP_DIR, snapName);
  const gzPath = `${snapPath}.gz`;

  log(`source: ${DB_PATH}`);
  log(`target: ${gzPath}`);

  try {
    await takeSnapshot(DB_PATH, snapPath);
  } catch (err) {
    fail("snapshot failed", err);
  }

  const rawSize = fs.statSync(snapPath).size;

  try {
    await gzipFile(snapPath, gzPath);
  } catch (err) {
    try { fs.unlinkSync(snapPath); } catch { /* best effort */ }
    fail("gzip failed", err);
  }

  const gzSize = fs.statSync(gzPath).size;
  const ratio = rawSize > 0 ? ((1 - gzSize / rawSize) * 100).toFixed(1) : "0";
  log(`snapshot ok — ${rawSize} → ${gzSize} bytes (${ratio}% saved)`);

  try {
    await maybeUploadToS3(gzPath);
  } catch (err) {
    // Don't fail the whole backup on upload issues — local copy still exists
    log(`upload failed (local copy preserved): ${err.message || err}`);
  }

  const { removed, bytesFreed } = pruneOld(BACKUP_DIR, RETENTION_DAYS);
  if (removed > 0) {
    log(`pruned ${removed} old snapshot(s), freed ${bytesFreed} bytes`);
  }

  const kept = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => FILE_REGEX.test(f)).length;
  log(`done. ${kept} snapshot(s) retained in ${BACKUP_DIR}`);
}

main().catch((err) => fail("unexpected error", err));
