import { getDb } from "./db";

export interface AuditEntry {
  actorUserId: string | null;
  action: string; // e.g. "picks.save", "pool.update", "pool.togglePaid"
  targetType: string; // e.g. "picks", "pool", "payment"
  targetId?: string | null;
  poolId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Write a single audit entry. Never throws — auditing must not break the write path. */
export function audit(entry: AuditEntry): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_log
        (actor_user_id, action, target_type, target_id, pool_id, before_json, after_json, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.actorUserId ?? null,
      entry.action,
      entry.targetType,
      entry.targetId ?? null,
      entry.poolId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      entry.ip ?? null,
    );
  } catch (err) {
    console.error("audit log failed:", err);
  }
}
