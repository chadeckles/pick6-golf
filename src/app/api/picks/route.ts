import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { getTierConfig } from "@/lib/tiers";
import { checkOrigin, getClientIp } from "@/lib/security";
import { audit } from "@/lib/audit";

// Save picks for current user
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
    let { picks, poolId } = body as { picks?: unknown; poolId?: unknown };
    // picks: Array<{ golferId: string; golferName: string; tier: number }>

    if (!Array.isArray(picks)) {
      return NextResponse.json(
        { error: "Picks array is required" },
        { status: 400 }
      );
    }
    if (picks.length !== 6) {
      return NextResponse.json(
        { error: "You must submit exactly 6 picks" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Resolve poolId from pool_members if not provided
    if (!poolId || typeof poolId !== "string") {
      const membership = db
        .prepare("SELECT pool_id FROM pool_members WHERE user_id = ? LIMIT 1")
        .get(session.userId) as { pool_id: string } | undefined;
      poolId = membership?.pool_id;
    }

    if (!poolId || typeof poolId !== "string") {
      return NextResponse.json(
        { error: "You must join a pool first" },
        { status: 400 }
      );
    }

    // Look up the pool so we know (a) lock date and (b) tournament — tier
    // validation has to use the pool's tournament, not a hardcoded one.
    interface PoolRow {
      lock_date: string;
      tournament_slug: string | null;
    }
    const pool = db
      .prepare("SELECT lock_date, tournament_slug FROM pools WHERE id = ?")
      .get(poolId) as PoolRow | undefined;

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    // Verify membership (authorization)
    const membership = db
      .prepare("SELECT user_id FROM pool_members WHERE user_id = ? AND pool_id = ?")
      .get(session.userId, poolId);

    if (!membership) {
      return NextResponse.json(
        { error: "You must join this pool first" },
        { status: 400 }
      );
    }

    // Lock check
    if (new Date(pool.lock_date) <= new Date()) {
      return NextResponse.json(
        { error: "Picks are locked — the tournament has started" },
        { status: 403 }
      );
    }

    // Tier config for the pool's tournament
    const tournamentSlug = pool.tournament_slug || "masters";
    const tierConfig = getTierConfig(tournamentSlug);
    if (!tierConfig) {
      return NextResponse.json(
        { error: `Picks aren't open yet for this tournament (${tournamentSlug}).` },
        { status: 400 }
      );
    }

    // Validate tier counts: 1 from T1, 2 from T2, 2 from T3, 1 from T4
    const expectedCounts: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 1 };
    const tierCounts: Record<number, number> = {};
    const seenGolfers = new Set<string>();

    for (const pick of picks) {
      if (!pick || typeof pick !== "object") {
        return NextResponse.json({ error: "Invalid pick format" }, { status: 400 });
      }
      const p = pick as Record<string, unknown>;
      const golferId = typeof p.golferId === "string" ? p.golferId : null;
      const golferName = typeof p.golferName === "string" ? p.golferName : null;
      const tier = typeof p.tier === "number" ? p.tier : null;
      if (!golferId || !golferName || !tier) {
        return NextResponse.json({ error: "Invalid pick format" }, { status: 400 });
      }
      if (golferId.length > 64 || golferName.length > 120) {
        return NextResponse.json({ error: "Invalid pick format" }, { status: 400 });
      }
      if (seenGolfers.has(golferId)) {
        return NextResponse.json(
          { error: `Duplicate pick: ${golferName}` },
          { status: 400 }
        );
      }
      seenGolfers.add(golferId);
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;

      // Authoritative tier check — reject unknown golfers outright.
      const actualTier = tierConfig.getTier(golferId);
      if (actualTier === null) {
        return NextResponse.json(
          { error: `${golferName} is not in the ${tournamentSlug} field` },
          { status: 400 }
        );
      }
      if (actualTier !== tier) {
        return NextResponse.json(
          { error: `${golferName} is not in Tier ${tier}` },
          { status: 400 }
        );
      }
    }

    for (const [tier, count] of Object.entries(expectedCounts)) {
      if ((tierCounts[Number(tier)] || 0) !== count) {
        return NextResponse.json(
          { error: `Tier ${tier} requires exactly ${count} pick(s)` },
          { status: 400 }
        );
      }
    }

    // Snapshot previous picks for the audit log
    const previous = db
      .prepare(
        "SELECT tier, golfer_id, golfer_name FROM picks WHERE user_id = ? AND pool_id = ? ORDER BY tier"
      )
      .all(session.userId, poolId);

    const deletePicks = db.prepare(
      "DELETE FROM picks WHERE user_id = ? AND pool_id = ?"
    );
    const insertPick = db.prepare(
      "INSERT INTO picks (id, user_id, pool_id, tier, golfer_id, golfer_name) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const transaction = db.transaction(() => {
      deletePicks.run(session.userId, poolId);
      for (const pick of picks as Array<{ golferId: string; golferName: string; tier: number }>) {
        insertPick.run(
          uuid(),
          session.userId,
          poolId,
          pick.tier,
          pick.golferId,
          pick.golferName
        );
      }
    });

    transaction();

    audit({
      actorUserId: session.userId,
      action: "picks.save",
      targetType: "picks",
      targetId: session.userId,
      poolId,
      before: previous,
      after: picks,
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true, count: picks.length });
  } catch (err) {
    console.error("Save picks error:", err);
    return NextResponse.json(
      { error: "Failed to save picks" },
      { status: 500 }
    );
  }
}

// Get current user's picks
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const poolId = searchParams.get("poolId");

  const db = getDb();

  if (!poolId) {
    // Legacy: return picks for first pool
    const membership = db
      .prepare("SELECT pool_id FROM pool_members WHERE user_id = ? LIMIT 1")
      .get(session.userId) as { pool_id: string } | undefined;
    if (!membership) {
      return NextResponse.json({ picks: [] });
    }
    const picks = db
      .prepare("SELECT id, tier, golfer_id, golfer_name FROM picks WHERE user_id = ? AND pool_id = ? ORDER BY tier")
      .all(session.userId, membership.pool_id) as { id: string; tier: number; golfer_id: string; golfer_name: string }[];
    return NextResponse.json({
      picks: picks.map((p) => ({ id: p.id, tier: p.tier, golferId: p.golfer_id, golferName: p.golfer_name })),
    });
  }

  interface PickRow {
    id: string;
    tier: number;
    golfer_id: string;
    golfer_name: string;
  }
  const picks = db
    .prepare(
      "SELECT id, tier, golfer_id, golfer_name FROM picks WHERE user_id = ? AND pool_id = ? ORDER BY tier"
    )
    .all(session.userId, poolId) as PickRow[];

  return NextResponse.json({
    picks: picks.map((p) => ({
      id: p.id,
      tier: p.tier,
      golferId: p.golfer_id,
      golferName: p.golfer_name,
    })),
  });
}
