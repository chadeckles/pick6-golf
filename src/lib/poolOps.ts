/**
 * Shared helpers for pool membership mutations (leave, transfer, kick, delete).
 *
 * All operations that change who is in a pool MUST go through here so that
 * picks and payments are cleaned up atomically. Orphaned rows are how
 * "ghost members" show up in standings.
 */
import type Database from "better-sqlite3";

/** Remove a user from a pool (their picks + payment status for that pool too). */
export function removeUserFromPool(
  db: Database.Database,
  userId: string,
  poolId: string
) {
  db.prepare("DELETE FROM pool_members WHERE user_id = ? AND pool_id = ?").run(userId, poolId);
  db.prepare("DELETE FROM picks WHERE user_id = ? AND pool_id = ?").run(userId, poolId);
  db.prepare("DELETE FROM pool_payments WHERE user_id = ? AND pool_id = ?").run(userId, poolId);
  // Clear legacy users.pool_id pointer if it pointed here
  db.prepare("UPDATE users SET pool_id = NULL WHERE id = ? AND pool_id = ?").run(userId, poolId);
}

/** Delete a pool and everything associated with it. */
export function deletePool(db: Database.Database, poolId: string) {
  db.prepare("DELETE FROM picks WHERE pool_id = ?").run(poolId);
  db.prepare("DELETE FROM pool_payments WHERE pool_id = ?").run(poolId);
  db.prepare("DELETE FROM pool_members WHERE pool_id = ?").run(poolId);
  db.prepare("UPDATE users SET pool_id = NULL WHERE pool_id = ?").run(poolId);
  db.prepare("DELETE FROM pools WHERE id = ?").run(poolId);
}

/** Count members in a pool. */
export function memberCount(db: Database.Database, poolId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM pool_members WHERE pool_id = ?")
    .get(poolId) as { c: number };
  return row.c;
}

/** Check whether a user is currently a member of a pool. */
export function isMember(
  db: Database.Database,
  userId: string,
  poolId: string
): boolean {
  return !!db
    .prepare("SELECT 1 FROM pool_members WHERE user_id = ? AND pool_id = ?")
    .get(userId, poolId);
}
