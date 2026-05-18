/**
 * Tournament-aware tier lookup. Each registered tournament provides:
 *
 *   - getTier(espnId)      → 1-4 if in field, else null
 *   - getOwgr(espnId)      → OWGR rank if known, else null
 *   - fieldIds             → Set of every ESPN athlete id in the field
 *   - getStaticField()     → ordered list of entries for the pre-tournament
 *                            fallback view (used when ESPN has no live data yet)
 *
 * This module is the single source of truth the API uses to verify a user's
 * declared pick tier matches the authoritative tier for that golfer. Do NOT
 * fall back to "tier 4" silently — if we don't know, we must refuse the pick.
 */
import {
  getTierForGolfer as getMastersTier,
  getOwgrForGolfer as getMastersOwgr,
  getAllMastersPlayerIds,
  TIER_1 as MASTERS_TIER_1,
  TIER_2 as MASTERS_TIER_2,
  TIER_3 as MASTERS_TIER_3,
  TIER_4 as MASTERS_TIER_4,
} from "./mastersTiers";
import {
  getTierForGolfer as getPgaTier,
  getOwgrForGolfer as getPgaOwgr,
  getAllPgaPlayerIds,
  TIER_1 as PGA_TIER_1,
  TIER_2 as PGA_TIER_2,
  TIER_3 as PGA_TIER_3,
  TIER_4 as PGA_TIER_4,
} from "./pgaTiers";

/** Single entry in a tournament's tier table. */
export interface TierEntry {
  espnId: string;
  name: string;
  owgr: number;
}

/** Each entry in a tournament's static field, with its assigned tier. */
export interface StaticFieldEntry extends TierEntry {
  tier: number;
}

export interface TierConfig {
  /** Map golfer ESPN id → tier number (1-4). Returns null if not in field. */
  getTier: (espnId: string) => number | null;
  /** Map golfer ESPN id → OWGR rank. Returns null if unknown. */
  getOwgr: (espnId: string) => number | null;
  /** Set of all ESPN ids in the tournament field. */
  fieldIds: Set<string>;
  /**
   * Ordered list of every player in the field with their tier assignment.
   * Used for the pre-tournament leaderboard view when ESPN has no live data.
   */
  getStaticField: () => StaticFieldEntry[];
}

// ─── Masters ────────────────────────────────────────────────────────────

const MASTERS_FIELD_IDS = getAllMastersPlayerIds();

function buildMastersStaticField(): StaticFieldEntry[] {
  const out: StaticFieldEntry[] = [];
  for (const e of MASTERS_TIER_1) out.push({ ...e, tier: 1 });
  for (const e of MASTERS_TIER_2) out.push({ ...e, tier: 2 });
  for (const e of MASTERS_TIER_3) out.push({ ...e, tier: 3 });
  for (const e of MASTERS_TIER_4) out.push({ ...e, tier: 4 });
  return out;
}

// ─── PGA Championship ───────────────────────────────────────────────────

const PGA_FIELD_IDS = getAllPgaPlayerIds();

function buildPgaStaticField(): StaticFieldEntry[] {
  const out: StaticFieldEntry[] = [];
  for (const e of PGA_TIER_1) out.push({ ...e, tier: 1 });
  for (const e of PGA_TIER_2) out.push({ ...e, tier: 2 });
  for (const e of PGA_TIER_3) out.push({ ...e, tier: 3 });
  for (const e of PGA_TIER_4) out.push({ ...e, tier: 4 });
  return out;
}

const CONFIGS: Record<string, TierConfig> = {
  masters: {
    getTier: (id) => {
      // mastersTiers' getter defaults unknown to tier 4 — we need a strict
      // variant so callers can detect unknown players and refuse picks.
      if (!MASTERS_FIELD_IDS.has(id)) return null;
      return getMastersTier(id);
    },
    getOwgr: (id) => {
      if (!MASTERS_FIELD_IDS.has(id)) return null;
      const rank = getMastersOwgr(id);
      return rank === 999 ? null : rank;
    },
    fieldIds: MASTERS_FIELD_IDS,
    getStaticField: buildMastersStaticField,
  },
  pga: {
    getTier: (id) => {
      if (!PGA_FIELD_IDS.has(id)) return null;
      return getPgaTier(id);
    },
    getOwgr: (id) => {
      if (!PGA_FIELD_IDS.has(id)) return null;
      const rank = getPgaOwgr(id);
      return rank === 999 ? null : rank;
    },
    fieldIds: PGA_FIELD_IDS,
    getStaticField: buildPgaStaticField,
  },
};

/**
 * Get the authoritative tier config for a tournament slug.
 * Returns null when no tier data has been published yet — callers should
 * refuse picks in that case rather than accept anything.
 */
export function getTierConfig(tournamentSlug: string): TierConfig | null {
  return CONFIGS[tournamentSlug] ?? null;
}
