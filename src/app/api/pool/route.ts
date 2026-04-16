import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { MASTERS_INFO } from "@/lib/constants";
import { getTournament } from "@/lib/tournaments/config";
import {
  assertStringField,
  checkOrigin,
  getClientIp,
  validatePaymentUrl,
} from "@/lib/security";
import { audit } from "@/lib/audit";

// Generate a unique invite code, retrying on the (extremely rare) collision.
function generateInviteCode(db: ReturnType<typeof getDb>): string {
  for (let i = 0; i < 5; i++) {
    const code = uuid().slice(0, 8).toUpperCase();
    const existing = db
      .prepare("SELECT 1 FROM pools WHERE invite_code = ?")
      .get(code);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique invite code");
}

// Create a new pool
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { name, lockDate, tournament: tournamentSlug } = body as Record<string, unknown>;

    const nameErr = assertStringField(name, "Pool name", { min: 1, max: 80, required: true });
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

    // Validate tournament slug against known config
    const slug = typeof tournamentSlug === "string" && tournamentSlug ? tournamentSlug : "masters";
    try {
      getTournament(slug);
    } catch {
      return NextResponse.json({ error: "Unknown tournament" }, { status: 400 });
    }

    // Validate lock date if provided
    let lock: string;
    if (typeof lockDate === "string" && lockDate) {
      const parsed = new Date(lockDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid lock date" }, { status: 400 });
      }
      lock = parsed.toISOString();
    } else {
      lock = MASTERS_INFO.lockDateISO;
    }

    const db = getDb();
    const id = uuid();
    const inviteCode = generateInviteCode(db);

    db.prepare(
      "INSERT INTO pools (id, name, invite_code, admin_user_id, lock_date, original_lock_date, tournament_slug) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, (name as string).trim(), inviteCode, session.userId, lock, lock, slug);

    // Auto-join the creator via pool_members
    db.prepare("INSERT INTO pool_members (user_id, pool_id) VALUES (?, ?)").run(
      session.userId,
      id
    );
    // Legacy compat: also set users.pool_id if they don't have one
    db.prepare("UPDATE users SET pool_id = ? WHERE id = ? AND pool_id IS NULL").run(
      id,
      session.userId
    );

    audit({
      actorUserId: session.userId,
      action: "pool.create",
      targetType: "pool",
      targetId: id,
      poolId: id,
      after: { name, tournamentSlug: slug, lockDate: lock },
      ip: getClientIp(req),
    });

    return NextResponse.json({ id, name, inviteCode, lockDate: lock });
  } catch (err) {
    console.error("Create pool error:", err);
    return NextResponse.json(
      { error: "Failed to create pool" },
      { status: 500 }
    );
  }
}

// Get current user's pools (multi-pool)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Optional: filter to a specific pool
  const { searchParams } = new URL(req.url);
  const poolIdParam = searchParams.get("poolId");

  interface MembershipRow {
    pool_id: string;
  }
  const memberships = db
    .prepare("SELECT pool_id FROM pool_members WHERE user_id = ?")
    .all(session.userId) as MembershipRow[];

  if (memberships.length === 0) {
    return NextResponse.json({ pool: null, pools: [] });
  }

  interface PoolRow {
    id: string;
    name: string;
    invite_code: string;
    admin_user_id: string;
    lock_date: string;
    payment_link: string | null;
    payment_label: string | null;
    entry_fee: string | null;
    tournament_slug: string | null;
  }

  interface MemberRow {
    id: string;
    name: string;
    email: string;
  }

  interface PaymentRow {
    user_id: string;
    paid: number;
  }

  function buildPool(pool: PoolRow) {
    const members = db
      .prepare(
        "SELECT u.id, u.name, u.email FROM users u JOIN pool_members pm ON pm.user_id = u.id WHERE pm.pool_id = ?"
      )
      .all(pool.id) as MemberRow[];

    const payments = db
      .prepare("SELECT user_id, paid FROM pool_payments WHERE pool_id = ?")
      .all(pool.id) as PaymentRow[];
    const paidMap = new Map(payments.map((p) => [p.user_id, p.paid === 1]));

    return {
      id: pool.id,
      name: pool.name,
      inviteCode: pool.invite_code,
      adminUserId: pool.admin_user_id,
      lockDate: pool.lock_date,
      paymentLink: pool.payment_link || null,
      paymentLabel: pool.payment_label || "Pay Entry Fee",
      entryFee: pool.entry_fee || null,
      tournamentSlug: pool.tournament_slug || "masters",
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        paid: paidMap.get(m.id) ?? false,
      })),
    };
  }

  // If specific pool requested, return just that one
  if (poolIdParam) {
    const pool = db.prepare("SELECT * FROM pools WHERE id = ?").get(poolIdParam) as PoolRow | undefined;
    if (!pool) {
      return NextResponse.json({ pool: null, pools: [] });
    }
    const built = buildPool(pool);
    return NextResponse.json({ pool: built, pools: [built] });
  }

  // Return all pools
  const poolIds = memberships.map((m) => m.pool_id);
  const pools = poolIds
    .map((pid) => db.prepare("SELECT * FROM pools WHERE id = ?").get(pid) as PoolRow | undefined)
    .filter(Boolean)
    .map((p) => buildPool(p!));

  // For backward compat, `pool` returns the first pool
  return NextResponse.json({ pool: pools[0] || null, pools });
}

// Update pool settings (admin only)
export async function PATCH(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { poolId, paymentLink, paymentLabel, entryFee, togglePaidUserId, lockDate } =
      body as Record<string, unknown>;

    if (typeof poolId !== "string" || !poolId) {
      return NextResponse.json({ error: "poolId is required" }, { status: 400 });
    }

    // Fetch current pool state (admin check + tamper baselines)
    interface PoolAdminRow {
      admin_user_id: string;
      lock_date: string;
      original_lock_date: string | null;
      payment_link: string | null;
      payment_label: string | null;
      entry_fee: string | null;
    }
    const pool = db
      .prepare(
        "SELECT admin_user_id, lock_date, original_lock_date, payment_link, payment_label, entry_fee FROM pools WHERE id = ?"
      )
      .get(poolId) as PoolAdminRow | undefined;

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    if (pool.admin_user_id !== session.userId) {
      return NextResponse.json(
        { error: "Only pool admin can update settings" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);

    // ─── Toggle member paid status ───
    if (togglePaidUserId !== undefined) {
      if (typeof togglePaidUserId !== "string" || !togglePaidUserId) {
        return NextResponse.json({ error: "Invalid togglePaidUserId" }, { status: 400 });
      }
      const existing = db
        .prepare("SELECT paid FROM pool_payments WHERE pool_id = ? AND user_id = ?")
        .get(poolId, togglePaidUserId) as { paid: number } | undefined;

      const next = existing ? (existing.paid === 1 ? 0 : 1) : 1;

      if (existing) {
        db.prepare(
          "UPDATE pool_payments SET paid = ?, marked_by = ?, marked_at = datetime('now') WHERE pool_id = ? AND user_id = ?"
        ).run(next, session.userId, poolId, togglePaidUserId);
      } else {
        db.prepare(
          "INSERT INTO pool_payments (pool_id, user_id, paid, marked_by, marked_at) VALUES (?, ?, 1, ?, datetime('now'))"
        ).run(poolId, togglePaidUserId, session.userId);
      }

      audit({
        actorUserId: session.userId,
        action: "pool.togglePaid",
        targetType: "payment",
        targetId: togglePaidUserId,
        poolId,
        before: existing ? { paid: existing.paid === 1 } : { paid: false },
        after: { paid: next === 1 },
        ip,
      });

      return NextResponse.json({ success: true });
    }

    // ─── Settings update: lock date + payment fields ───
    const updates: string[] = [];
    const values: (string | null)[] = [];
    const auditAfter: Record<string, unknown> = {};
    const auditBefore: Record<string, unknown> = {};

    if (paymentLink !== undefined) {
      const check = validatePaymentUrl(paymentLink as string | null);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      updates.push("payment_link = ?");
      values.push(check.url);
      auditBefore.paymentLink = pool.payment_link;
      auditAfter.paymentLink = check.url;
    }

    if (paymentLabel !== undefined) {
      const labelErr = assertStringField(paymentLabel, "Payment label", { max: 60 });
      if (labelErr) return NextResponse.json({ error: labelErr }, { status: 400 });
      const label = typeof paymentLabel === "string" && paymentLabel.trim()
        ? paymentLabel.trim()
        : "Pay Entry Fee";
      updates.push("payment_label = ?");
      values.push(label);
      auditBefore.paymentLabel = pool.payment_label;
      auditAfter.paymentLabel = label;
    }

    if (entryFee !== undefined) {
      const feeErr = assertStringField(entryFee, "Entry fee", { max: 30 });
      if (feeErr) return NextResponse.json({ error: feeErr }, { status: 400 });
      const fee = typeof entryFee === "string" && entryFee.trim() ? entryFee.trim() : null;
      updates.push("entry_fee = ?");
      values.push(fee);
      auditBefore.entryFee = pool.entry_fee;
      auditAfter.entryFee = fee;
    }

    if (lockDate !== undefined) {
      if (typeof lockDate !== "string") {
        return NextResponse.json({ error: "Invalid lock date" }, { status: 400 });
      }
      const parsed = new Date(lockDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid lock date" }, { status: 400 });
      }
      const newLock = parsed.toISOString();

      // Tamper guards:
      //  1. Once the original lock has passed, no further changes — the pool is
      //     live and moving the lock would let the admin (or anyone with admin's
      //     session) replay picks against known live scores.
      //  2. The new lock must not be AFTER the original. Admins can pull in a
      //     lock (e.g. discover picks need to close earlier) but never push it out.
      const now = Date.now();
      const original = new Date(pool.original_lock_date ?? pool.lock_date).getTime();
      if (now >= original) {
        return NextResponse.json(
          { error: "Lock date cannot be changed after the tournament has started." },
          { status: 403 }
        );
      }
      if (parsed.getTime() > original) {
        return NextResponse.json(
          { error: "Lock date cannot be moved later than the original lock." },
          { status: 403 }
        );
      }

      updates.push("lock_date = ?");
      values.push(newLock);
      auditBefore.lockDate = pool.lock_date;
      auditAfter.lockDate = newLock;
    }

    if (updates.length > 0) {
      values.push(poolId);
      db.prepare(`UPDATE pools SET ${updates.join(", ")} WHERE id = ?`).run(...values);

      audit({
        actorUserId: session.userId,
        action: "pool.update",
        targetType: "pool",
        targetId: poolId,
        poolId,
        before: auditBefore,
        after: auditAfter,
        ip,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update pool error:", err);
    return NextResponse.json({ error: "Failed to update pool" }, { status: 500 });
  }
}
