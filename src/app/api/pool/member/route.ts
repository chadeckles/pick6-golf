import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkOrigin, getClientIp } from "@/lib/security";
import { audit } from "@/lib/audit";
import { isMember, removeUserFromPool } from "@/lib/poolOps";

/**
 * DELETE /api/pool/member
 * Body: { poolId, userId }
 *
 * Admin-only. Kicks a member from the pool and wipes their picks + payment
 * for that pool. Admins CANNOT kick themselves via this endpoint (use
 * /api/pool/leave with a transferToUserId for that path).
 */
export async function DELETE(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { poolId, userId } = body as Record<string, unknown>;

    if (typeof poolId !== "string" || !poolId) {
      return NextResponse.json({ error: "poolId is required" }, { status: 400 });
    }
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (userId === session.userId) {
      return NextResponse.json(
        { error: "Use the Leave Pool option to remove yourself." },
        { status: 400 }
      );
    }

    const db = getDb();
    const pool = db
      .prepare("SELECT admin_user_id, lock_date, original_lock_date FROM pools WHERE id = ?")
      .get(poolId) as
      | { admin_user_id: string; lock_date: string; original_lock_date: string | null }
      | undefined;

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    if (pool.admin_user_id !== session.userId) {
      return NextResponse.json(
        { error: "Only the pool admin can remove members." },
        { status: 403 }
      );
    }

    // Once picks are locked, removing a member would change the leaderboard
    // retroactively and invite disputes. Block it.
    const original = new Date(pool.original_lock_date ?? pool.lock_date).getTime();
    if (Date.now() >= original) {
      return NextResponse.json(
        { error: "Cannot remove members after the tournament has started." },
        { status: 403 }
      );
    }

    if (!isMember(db, userId, poolId)) {
      return NextResponse.json(
        { error: "That user isn't in this pool." },
        { status: 400 }
      );
    }

    // Capture what we're removing for the audit trail.
    const removedUser = db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(userId) as { id: string; name: string; email: string } | undefined;
    const removedPicks = db
      .prepare("SELECT tier, golfer_id, golfer_name FROM picks WHERE user_id = ? AND pool_id = ?")
      .all(userId, poolId);

    const tx = db.transaction(() => {
      removeUserFromPool(db, userId, poolId);
    });
    tx();

    audit({
      actorUserId: session.userId,
      action: "pool.removeMember",
      targetType: "user",
      targetId: userId,
      poolId,
      before: { user: removedUser, picks: removedPicks },
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Remove member error:", err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
