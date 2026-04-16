import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkOrigin, getClientIp } from "@/lib/security";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const rawCode = body && typeof body === "object" ? (body as Record<string, unknown>).inviteCode : null;

    if (typeof rawCode !== "string" || rawCode.trim().length === 0 || rawCode.length > 32) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }
    const inviteCode = rawCode.trim().toUpperCase();

    const db = getDb();

    interface PoolRow {
      id: string;
      name: string;
    }
    const pool = db
      .prepare("SELECT id, name FROM pools WHERE invite_code = ?")
      .get(inviteCode.toUpperCase()) as PoolRow | undefined;

    if (!pool) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 404 }
      );
    }

    // Check if user is already in this pool
    interface MemberRow {
      user_id: string;
    }
    const existing = db
      .prepare("SELECT user_id FROM pool_members WHERE user_id = ? AND pool_id = ?")
      .get(session.userId, pool.id) as MemberRow | undefined;

    if (existing) {
      return NextResponse.json(
        { error: "You are already in this pool." },
        { status: 400 }
      );
    }

    db.prepare("INSERT INTO pool_members (user_id, pool_id) VALUES (?, ?)").run(
      session.userId,
      pool.id
    );
    // Legacy compat
    db.prepare("UPDATE users SET pool_id = ? WHERE id = ? AND pool_id IS NULL").run(
      pool.id,
      session.userId
    );

    audit({
      actorUserId: session.userId,
      action: "pool.join",
      targetType: "pool",
      targetId: pool.id,
      poolId: pool.id,
      ip: getClientIp(req),
    });

    return NextResponse.json({ poolId: pool.id, poolName: pool.name });
  } catch (err) {
    console.error("Join pool error:", err);
    return NextResponse.json(
      { error: "Failed to join pool" },
      { status: 500 }
    );
  }
}
