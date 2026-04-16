import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkOrigin, getClientIp } from "@/lib/security";
import { audit } from "@/lib/audit";
import { isMember } from "@/lib/poolOps";

/**
 * POST /api/pool/transfer
 * Body: { poolId, newAdminUserId }
 *
 * Transfer the admin role to another existing member of the pool.
 * Only the current admin can call this. The previous admin remains a member
 * (so they can also leave afterward if they want — or use POST /api/pool/leave
 * with `transferToUserId` to do it in one step).
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
    const { poolId, newAdminUserId } = body as Record<string, unknown>;

    if (typeof poolId !== "string" || !poolId) {
      return NextResponse.json({ error: "poolId is required" }, { status: 400 });
    }
    if (typeof newAdminUserId !== "string" || !newAdminUserId) {
      return NextResponse.json({ error: "newAdminUserId is required" }, { status: 400 });
    }
    if (newAdminUserId === session.userId) {
      return NextResponse.json({ error: "You are already the admin." }, { status: 400 });
    }

    const db = getDb();
    const pool = db
      .prepare("SELECT admin_user_id FROM pools WHERE id = ?")
      .get(poolId) as { admin_user_id: string } | undefined;

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    if (pool.admin_user_id !== session.userId) {
      return NextResponse.json(
        { error: "Only the current admin can transfer admin." },
        { status: 403 }
      );
    }
    if (!isMember(db, newAdminUserId, poolId)) {
      return NextResponse.json(
        { error: "That user isn't a member of this pool." },
        { status: 400 }
      );
    }

    db.prepare("UPDATE pools SET admin_user_id = ? WHERE id = ?").run(newAdminUserId, poolId);

    audit({
      actorUserId: session.userId,
      action: "pool.transferAdmin",
      targetType: "pool",
      targetId: poolId,
      poolId,
      before: { adminUserId: session.userId },
      after: { adminUserId: newAdminUserId },
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Transfer admin error:", err);
    return NextResponse.json({ error: "Failed to transfer admin" }, { status: 500 });
  }
}
