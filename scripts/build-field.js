/**
 * build-field — Generate src/lib/<slug>Tiers.ts from a live ESPN field
 *
 * Pulls the ESPN field for a tournament's configured event id and assigns
 * each player to a tier using the OWGR snapshot in src/lib/owgr.json.
 *
 * Tier rules:
 *   T1: OWGR  1–10
 *   T2: OWGR 11–25
 *   T3: OWGR 26–50
 *   T4: OWGR 51+ (or unranked: club pros, special invites, etc.)
 *
 * Usage:
 *   npm run build-field -- <slug>
 *   npm run build-field -- pga
 *   npm run build-field -- usopen
 *
 * Prereqs:
 *   - tournaments.yaml has espnId set for <slug> in CURRENT_YEAR
 *   - src/lib/owgr.json is reasonably fresh (run `npm run sync-owgr` first)
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const SCHEDULE_PATH = path.join(ROOT, "src", "lib", "tournaments", "schedule.json");
const OWGR_PATH = path.join(ROOT, "src", "lib", "owgr.json");

const SUPPORTED = new Set(["masters", "pga", "usopen", "theopen"]);

// ─── Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const force = args.includes("--force");
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) {
  console.error("Usage: npm run build-field -- <slug> [--force]");
  console.error("       (slug ∈ {masters, pga, usopen, theopen})");
  console.error("");
  console.error("Tier tables are LOCKED at generation time so every pool member");
  console.error("picks from the same pool. Pass --force only if you really mean");
  console.error("to overwrite an already-locked tier file (use case: late field");
  console.error("change before the tournament starts).");
  process.exit(1);
}
if (!SUPPORTED.has(slug)) {
  console.error(`❌ Unsupported slug "${slug}". Expected one of: ${[...SUPPORTED].join(", ")}`);
  process.exit(1);
}

// ─── Resolve event id ────────────────────────────────────────────────────

const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, "utf-8"));
const currentYear = new Date().getFullYear();
const entry = schedule[slug]?.[String(currentYear)];
if (!entry?.espnId) {
  console.error(`❌ No ESPN event id for ${slug} ${currentYear} in tournaments.yaml`);
  process.exit(1);
}
const eventId = entry.espnId;
console.log(`→ ${slug} ${currentYear} → ESPN event ${eventId}`);

// ─── OWGR lookup ─────────────────────────────────────────────────────────

let owgrByEspnId = new Map();
let owgrGenerated = "unknown";
try {
  const owgrJson = JSON.parse(fs.readFileSync(OWGR_PATH, "utf-8"));
  owgrGenerated = owgrJson.generated || "unknown";
  for (const p of owgrJson.players || []) {
    owgrByEspnId.set(p.espnId, p.rank);
  }
  console.log(`→ Loaded ${owgrByEspnId.size} OWGR entries (generated ${owgrGenerated})`);
} catch {
  console.warn(`⚠️  ${OWGR_PATH} missing — every player will land in T4. Run \`npm run sync-owgr\` first.`);
}

// ─── Fetch ESPN field ────────────────────────────────────────────────────

function fetchField(id) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=${id}`,
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              const data = JSON.parse(body);
              const comps =
                data?.events?.[0]?.competitions?.[0]?.competitors ?? [];
              resolve(
                comps.map((c) => ({
                  id: c.athlete?.id ?? c.id,
                  name:
                    c.athlete?.displayName ?? c.athlete?.fullName ?? "Unknown",
                })),
              );
            } catch (e) {
              reject(e);
            }
          });
        },
      )
      .on("error", reject);
  });
}

// ─── Tier assignment ─────────────────────────────────────────────────────

function tierFromOwgr(owgr) {
  if (owgr == null) return 4;
  if (owgr <= 10) return 1;
  if (owgr <= 25) return 2;
  if (owgr <= 50) return 3;
  return 4;
}

function formatEntry(p) {
  const espnId = `"${p.id}"`.padEnd(10);
  const name = `"${p.name}"`.padEnd(36);
  return `  { espnId: ${espnId}, name: ${name}, owgr: ${p.owgr} },`;
}

// ─── Slug-specific identifiers ───────────────────────────────────────────

const slugMeta = {
  masters: { display: "Masters Tournament", varName: "Masters", fnSuffix: "MastersPlayerIds" },
  pga: { display: "PGA Championship", varName: "Pga", fnSuffix: "PgaPlayerIds" },
  usopen: { display: "U.S. Open", varName: "UsOpen", fnSuffix: "UsOpenPlayerIds" },
  theopen: { display: "The Open Championship", varName: "TheOpen", fnSuffix: "TheOpenPlayerIds" },
}[slug];

const outPath = path.join(ROOT, "src", "lib", `${slug}Tiers.ts`);

// ─── Lock guard ──────────────────────────────────────────────────────────
// Tier tables freeze at generation time. Once locked, refuse to overwrite
// without an explicit --force so a stray re-run can't shuffle tiers under
// pool members who've already picked.
function readLockedAt(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const head = fs.readFileSync(filePath, "utf-8").slice(0, 2000);
  const m = head.match(/LOCKED:\s*(\S+)/);
  return m ? m[1] : null;
}

const existingLock = readLockedAt(outPath);
if (existingLock && !force) {
  console.error(`\n🔒 ${path.relative(ROOT, outPath)} is already locked (LOCKED: ${existingLock}).`);
  console.error(`   Tier tables are frozen at generation time so every pool member`);
  console.error(`   picks from the same set. Refusing to overwrite.`);
  console.error(`\n   If you really need to regenerate (e.g. late field change`);
  console.error(`   BEFORE the tournament starts), re-run with --force:`);
  console.error(`     npm run build-field -- ${slug} --force`);
  process.exit(2);
}

// ─── Main ────────────────────────────────────────────────────────────────

(async () => {
  console.log(`→ Fetching ESPN field for event ${eventId}...`);
  const field = await fetchField(eventId);
  console.log(`  Fetched ${field.length} competitors.`);
  if (field.length === 0) {
    console.error("❌ ESPN returned no competitors. Field may not be published yet.");
    process.exit(1);
  }

  const enriched = field.map((p) => ({
    id: p.id,
    name: p.name,
    owgr: owgrByEspnId.get(p.id) ?? null,
  }));

  const tiers = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of enriched) {
    tiers[tierFromOwgr(p.owgr)].push({ ...p, owgr: p.owgr ?? 999 });
  }
  for (const t of [1, 2, 3, 4]) {
    tiers[t].sort((a, b) => a.owgr - b.owgr || a.name.localeCompare(b.name));
  }

  const counts = { 1: tiers[1].length, 2: tiers[2].length, 3: tiers[3].length, 4: tiers[4].length };
  console.log("  Tier distribution:", counts);
  const unranked = enriched.filter((p) => p.owgr == null).length;
  console.log(`  ${unranked} player(s) unranked (sent to T4).`);

  const lockedAt = new Date().toISOString();
  const ts = `/**
 * ${currentYear} ${slugMeta.display} — Pre-set Tier Assignments
 *
 * LOCKED: ${lockedAt}
 *
 * Auto-generated by scripts/build-field.js from ESPN event ${eventId}
 * and the OWGR snapshot in src/lib/owgr.json (generated ${owgrGenerated}).
 *
 * ⚠️  Tier tables are LOCKED at generation time. Once this file exists,
 *     re-running build-field will refuse unless you pass --force. This
 *     keeps every pool member picking from the same set of options, no
 *     matter when they make their picks.
 *
 *     Refresh OWGR weekly with \`npm run sync-owgr\` — that's separate
 *     from this lock and only affects FUTURE build-field runs.
 *
 * Tier 1 (pick 1): OWGR  1–10   — Elite
 * Tier 2 (pick 2): OWGR 11–25   — Contenders
 * Tier 3 (pick 2): OWGR 26–50   — Mid-tier
 * Tier 4 (pick 1): OWGR 51+ / unranked (club pros, invites, etc.)
 */

import type { TierEntry } from "./tiers";

// ─── TIER 1 — OWGR 1-10 ────────────────────────────────────────────────
export const TIER_1: TierEntry[] = [
${tiers[1].map(formatEntry).join("\n")}
];

// ─── TIER 2 — OWGR 11-25 ───────────────────────────────────────────────
export const TIER_2: TierEntry[] = [
${tiers[2].map(formatEntry).join("\n")}
];

// ─── TIER 3 — OWGR 26-50 ───────────────────────────────────────────────
export const TIER_3: TierEntry[] = [
${tiers[3].map(formatEntry).join("\n")}
];

// ─── TIER 4 — OWGR 51+ / unranked ──────────────────────────────────────
export const TIER_4: TierEntry[] = [
${tiers[4].map(formatEntry).join("\n")}
];

// ─── Lookup helpers ─────────────────────────────────────────────────────

const tierLookup: Map<string, number> = new Map();
for (const g of TIER_1) tierLookup.set(g.espnId, 1);
for (const g of TIER_2) tierLookup.set(g.espnId, 2);
for (const g of TIER_3) tierLookup.set(g.espnId, 3);
for (const g of TIER_4) tierLookup.set(g.espnId, 4);

const owgrLookup: Map<string, number> = new Map();
for (const tier of [TIER_1, TIER_2, TIER_3, TIER_4]) {
  for (const g of tier) owgrLookup.set(g.espnId, g.owgr);
}

export function getTierForGolfer(espnId: string): number {
  return tierLookup.get(espnId) ?? 4;
}

export function getOwgrForGolfer(espnId: string): number {
  return owgrLookup.get(espnId) ?? 999;
}

export function getAll${slugMeta.fnSuffix}(): Set<string> {
  return new Set(
    [...TIER_1, ...TIER_2, ...TIER_3, ...TIER_4].map((g) => g.espnId)
  );
}
`;

  fs.writeFileSync(outPath, ts);
  console.log(`✅ Wrote ${outPath}`);

  // Reminder for the registration step
  console.log(`\nNext steps:`);
  console.log(`  1. Register the new file in src/lib/tiers.ts if not already done:`);
  console.log(`       import { getTierForGolfer as get${slugMeta.varName}Tier, ... } from "./${slug}Tiers";`);
  console.log(`       Add CONFIGS["${slug}"] = { getTier, getOwgr, fieldIds, getStaticField }`);
  console.log(`  2. Eyeball the T4 list for late club-pro adds / OWGR drift.`);
  console.log(`  3. Commit src/lib/${slug}Tiers.ts.`);
})().catch((err) => {
  console.error("❌ build-field failed:", err);
  process.exit(1);
});
