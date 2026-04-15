import type { GolferInfo, PickWithScore, PoolEntry } from "./types";
import { fetchLeaderboard, calculateGolferTotal } from "./espn";
import { getDb } from "./db";
import { getTournament } from "./tournaments/config";

interface PickRow {
  golfer_id: string;
  golfer_name: string;
  tier: number;
}

interface UserPicksRow {
  user_id: string;
  user_name: string;
  golfer_id: string;
  golfer_name: string;
  tier: number;
}

/**
 * Calculate pool standings with live scores
 */
export async function calculateStandings(poolId: string): Promise<PoolEntry[]> {
  const db = getDb();

  // Look up the tournament for this pool
  const poolRow = db.prepare("SELECT tournament_slug FROM pools WHERE id = ?").get(poolId) as { tournament_slug: string } | undefined;
  const tournamentSlug = poolRow?.tournament_slug || "masters";
  const tournament = getTournament(tournamentSlug);

  const golfers = await fetchLeaderboard(tournamentSlug);
  const golferMap = new Map<string, GolferInfo>();
  golfers.forEach((g) => golferMap.set(g.id, g));

  // Get all picks for this pool with user info
  const rows = db
    .prepare(
      `SELECT p.user_id, u.name as user_name, p.golfer_id, p.golfer_name, p.tier
       FROM picks p
       JOIN users u ON u.id = p.user_id
       WHERE p.pool_id = ?
       ORDER BY p.user_id, p.tier`
    )
    .all(poolId) as UserPicksRow[];

  // Group picks by user
  const userPicksMap = new Map<string, { userName: string; picks: PickRow[] }>();
  for (const row of rows) {
    if (!userPicksMap.has(row.user_id)) {
      userPicksMap.set(row.user_id, { userName: row.user_name, picks: [] });
    }
    userPicksMap.get(row.user_id)!.picks.push({
      golfer_id: row.golfer_id,
      golfer_name: row.golfer_name,
      tier: row.tier,
    });
  }

  const entries: PoolEntry[] = [];

  for (const [userId, { userName, picks }] of userPicksMap) {
    const picksWithScores: PickWithScore[] = picks.map((pick) => {
      const golfer = golferMap.get(pick.golfer_id);
      const totalScore = golfer ? calculateGolferTotal(golfer, tournament.par) : null;

      return {
        golferId: pick.golfer_id,
        golferName: golfer?.name ?? pick.golfer_name,
        tier: pick.tier,
        totalScore,
        thru: golfer?.thru ?? null,
        status: golfer?.status ?? "active",
        currentRound: golfer?.currentRound ?? null,
        rounds: golfer?.rounds ?? [],
        position: golfer?.position ?? null,
        isDropped: false,
      };
    });

    // Sort by total score (lowest first), mark worst as dropped (best 5 of 6)
    const scoredPicks = picksWithScores
      .filter((p) => p.totalScore !== null)
      .sort((a, b) => (a.totalScore ?? 0) - (b.totalScore ?? 0));

    const unscoredPicks = picksWithScores.filter((p) => p.totalScore === null);

    // If all 6 picks have scores, drop the worst
    if (scoredPicks.length === 6) {
      scoredPicks[5].isDropped = true;
    }

    // Best 5 total (lowest combined to-par)
    const countingPicks = scoredPicks.filter((p) => !p.isDropped);
    const best5Total = countingPicks.reduce(
      (sum, p) => sum + (p.totalScore ?? 0),
      0
    );

    entries.push({
      userId,
      userName,
      picks: [...scoredPicks, ...unscoredPicks],
      best5Total,
      rank: 0,
    });
  }

  // Sort by best5Total (lowest wins) and assign ranks
  entries.sort((a, b) => a.best5Total - b.best5Total);
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
    // Handle ties
    if (i > 0 && entry.best5Total === entries[i - 1].best5Total) {
      entry.rank = entries[i - 1].rank;
    }
  });

  return entries;
}
