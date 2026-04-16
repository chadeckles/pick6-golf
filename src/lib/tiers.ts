/**
 * Tournament-aware tier lookup. Today only the Masters has a canonical tier
 * table in the repo; other tournaments need one added before picks are safe.
 *
 * This module is the single source of truth the API uses to verify a user's
 * declared pick tier matches the authoritative tier for that golfer. Do NOT
 * fall back to "tier 4" silently — if we don't know, we must refuse the pick.
 */
import {
  getTierForGolfer as getMastersTier,
  getAllMastersPlayerIds,
} from "./mastersTiers";

export interface TierConfig {
  /** Map golfer ESPN id → tier number (1-4). Returns null if unknown. */
  getTier: (espnId: string) => number | null;
  /** Set of all ESPN ids in the tournament field. */
  fieldIds: Set<string>;
}

const MASTERS_FIELD_IDS = getAllMastersPlayerIds();

const CONFIGS: Record<string, TierConfig> = {
  masters: {
    getTier: (id) => {
      // mastersTiers defaults unknown to tier 4 — we need a strict variant
      if (!MASTERS_FIELD_IDS.has(id)) return null;
      return getMastersTier(id);
    },
    fieldIds: MASTERS_FIELD_IDS,
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
