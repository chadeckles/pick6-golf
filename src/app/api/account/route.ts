import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { getDb } from "@/lib/db";
import { destroySession, getSession } from "@/lib/auth";
import { checkOrigin, getClientIp } from "@/lib/security";
import { audit } from "@/lib/audit";
import { deletePool, memberCount, removeUserFromPool } from "@/lib/poolOps";

/**
 * DELETE /api/account
 * Body: { password, confirm }
 *
 * Deletes the authenticated user's account permanently.
 *
 * Safeguards:
 *   - Must re-supply current password (CSRF + session-hijack belt-and-suspenders)
 *   - Must pass `confirm === "DELETE"` literal
 *   - If the user is the sole admin of ANY pool with other members, we refuse
 *     until they transfer admin. No orphaned pools.
 *
 * On success we wipe: picks, pool_payments, pool_members, password_reset_tokens,
 * and the user row. Pools they're the SOLE member of are deleted entirely.
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
    const { password, confirm } = body as Record<string, unknown>;

    if (confirm !== "DELETE") {
      return NextResponse.json(
        { error: 'Type DELETE (all caps) to confirm account deletion.' },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length === 0) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .get(session.userId) as { id: string; password_hash: string } | undefined;

    if (!user) {
      // Already gone — clear cookie so the client recovers.
      await destroySession();
      return NextResponse.json({ error: "Account no longer exists" }, { status: 404 });
    }

    const passwordOk = await compare(password, user.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Find every pool this user is in, split into:
    //   - sole-admin of a multi-member pool (BLOCK)
    //   - sole member (delete pool entirely)
    //   - regular member or admin with someone else to succeed them (just leave)
    const memberships = db
      .prepare(
        `SELECT pm.pool_id, p.admin_user_id, p.name
         FROM pool_members pm
         JOIN pools p ON p.id = pm.pool_id
         WHERE pm.user_id = ?`
      )
      .all(user.id) as { pool_id: string; admin_user_id: string; name: string }[];

    const blockingPools: string[] = [];
    for (const m of memberships) {
      if (m.admin_user_id === user.id && memberCount(db, m.pool_id) > 1) {
        blockingPools.push(m.name);
      }
    }
    if (blockingPools.length > 0) {
      return NextResponse.json(
        {
          error:
            "You're still the admin of: " +
            blockingPools.join(", ") +
            ". Transfer admin to another member or remove all other members first.",
        },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);

    const tx = db.transaction(() => {
      for (const m of memberships) {
        if (memberCount(db, m.pool_id) === 1) {
          // They're the sole member — the pool goes too.
          deletePool(db, m.pool_id);
        } else {
          removeUserFromPool(db, user.id, m.pool_id);
        }
      }
      db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    });
    tx();

    audit({
      actorUserId: user.id,
      action: "account.delete",
      targetType: "user",
      targetId: user.id,
      before: { poolsAffected: memberships.map((m) => m.pool_id) },
      ip,
    });

    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
