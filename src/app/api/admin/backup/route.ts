import { NextRequest } from "next/server";
import { createReadStream, unlinkSync, statSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { randomBytes } from "crypto";
import { createGzip } from "zlib";
import { Readable } from "stream";
import { getDb } from "@/lib/db";
import { safeEqual, getClientIp } from "@/lib/security";
import { rateLimit } from "@/lib/rateLimit";

/**
 * GET /api/admin/backup
 *
 * Streams a gzipped, *consistent* snapshot of the SQLite database.
 * Called by the GitHub Actions nightly-backup workflow; never exposed in the UI.
 *
 * ── Auth ─────────────────────────────────────────────────────────────
 * Shared-secret via `Authorization: Bearer <BACKUP_API_KEY>`. Comparison is
 * constant-time. If `BACKUP_API_KEY` isn't set on the server (or is too short),
 * the endpoint refuses every request — no accidental public backups.
 *
 * ── Consistency ──────────────────────────────────────────────────────
 * Uses better-sqlite3's online `.backup()` which correctly handles the WAL
 * so the snapshot is transactionally consistent even while the app writes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const expected = process.env.BACKUP_API_KEY;
  if (!expected || expected.length < 24) {
    // Never expose the endpoint when no key (or a weak one) is configured.
    return unauthorized();
  }

  // Rate limit by IP — a legit cron hits this once a day; anything remotely
  // bursty is an attack. 5 tries / hour / IP.
  const ip = getClientIp(req);
  const rl = rateLimit(`backup:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfter),
      },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return unauthorized();
  const provided = m[1].trim();
  if (provided.length !== expected.length || !safeEqual(provided, expected)) {
    return unauthorized();
  }

  // Take the snapshot into a temp file, then stream+gzip it back.
  const tmpRoot = path.join(tmpdir(), "mp6-backups");
  mkdirSync(tmpRoot, { recursive: true });
  const snapName = `mp6-${Date.now()}-${randomBytes(4).toString("hex")}.db`;
  const snapPath = path.join(tmpRoot, snapName);

  try {
    const db = getDb();
    await db.backup(snapPath);
  } catch (err) {
    console.error("Backup snapshot failed:", err);
    try { unlinkSync(snapPath); } catch { /* best effort */ }
    return new Response(JSON.stringify({ error: "Backup failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawSize = statSync(snapPath).size;

  // Stream the file through gzip so we never hold the whole DB in memory.
  const fileStream = createReadStream(snapPath);
  const gzip = createGzip({ level: 9 });
  const gzipped = fileStream.pipe(gzip);

  // Clean up the temp file once the stream has finished (success or error).
  const cleanup = () => { try { unlinkSync(snapPath); } catch { /* ignore */ } };
  gzipped.on("end", cleanup);
  gzipped.on("error", cleanup);
  fileStream.on("error", cleanup);

  const filename = `mp6-${new Date().toISOString().replace(/[:.]/g, "-")}.db.gz`;

  return new Response(Readable.toWeb(gzipped) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Backup-Uncompressed-Size": String(rawSize),
      "Cache-Control": "no-store",
    },
  });
}
