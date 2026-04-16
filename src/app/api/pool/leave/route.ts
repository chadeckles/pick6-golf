import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkOrigin, getClientIp } from "@/lib/security";
import { audit } from "@/lib/audit";
import { deletePool, isMember, memberCount, removeUserFromPool } from "@/lib/poolOps";

/**
 * POST /api/pool/leave
 * Body: { poolId, transferToUserId? }
 *
 * Rules:
 *  - You must be a member of the pool.
 *  - If you are the admin and there are OTHER members, you MUST pass
 *    `transferToUserId` pointing at another current member. Admin rights
 *    transfer to them before you leave.
 *  - If you are the sole member (admin or not), the pool is deleted.
 *  - Leaving always wipes your picks + payment row for that pool.
 */
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { poolId, transferToUserId } = body as Record<string, unknown>;

    if (typeof poolId !== "string" || !poolId) {
      return NextResponse.json({ error: "poolId is required" }, { status: 400 });
    }

    const db = getDb();

    const pool = db
      .prepare("SELECT id, admin_user_id, name FROM pools WHERE id = ?")
      .get(poolId) as { id: string; admin_user_id: string; name: string } | undefined;

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    if (!isMember(db, session.userId, poolId)) {
      return NextResponse.json({ error: "You are not in this pool" }, { status: 400 });
    }

    const total = memberCount(db, poolId);
    const isAdmin = pool.admin_user_id === session.userId;
    const isSoleMember = total === 1;
    const ip = getClientIp(req);

    // Sole member → delete the pool entirely.
    if (isSoleMember) {
      const tx = db.transaction(() => {
        deletePool(db, poolId);
      });
      tx();

      audit({
        actorUserId: session.userId,
        action: "pool.delete",
        targetType: "pool",
        targetId: poolId,
        poolId,
        before: { name: pool.name, lastMember: session.userId },
        ip,
      });

      return NextResponse.json({ ok: true, deleted: true });
    }

    // Admin leaving with other members → must transfer first.
    if (isAdmin) {
      if (typeof transferToUserId !== "string" || !transferToUserId) {
        return NextResponse.json(
          {
            error:
              "You are the pool admin. Choose another member to transfer admin to before leaving.",
          },
          { status: 400 }
        );
      }
      if (transferToUserId === session.userId) {
        return NextResponse.json(
          { error: "Can't transfer admin to yourself." },
          { status: 400 }
        );
      }
      if (!isMember(db, transferToUserId, poolId)) {
        return NextResponse.json(
          { error: "That user isn't a member of this pool." },
          { status: 400 }
        );
      }

      const tx = db.transaction(() => {
        db.prepare("UPDATE pools SET admin_user_id = ? WHERE id = ?").run(transferToUserId, poolId);
        removeUserFromPool(db, session.userId, poolId);
      });
      tx();

      audit({
        actorUserId: session.userId,
        action: "pool.transferAndLeave",
        targetType: "pool",
        targetId: poolId,
        poolId,
        before: { adminUserId: session.userId },
        after: { adminUserId: transferToUserId },
        ip,
      });

      return NextResponse.json({ ok: true, transferred: true });
    }

    // Regular member leaving.
    const tx = db.transaction(() => {
      removeUserFromPool(db, session.userId, poolId);
    });
    tx();

    audit({
      actorUserId: session.userId,
      action: "pool.leave",
      targetType: "pool",
      targetId: poolId,
      poolId,
      ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Leave pool error:", err);
    return NextResponse.json({ error: "Failed to leave pool" }, { status: 500 });
  }
}
