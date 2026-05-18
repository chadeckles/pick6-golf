/**
 * Pulls the live OWGR top 200 from ESPN's golf rankings page and writes
 * src/lib/owgr.json.
 *
 * ESPN server-renders the entire OWGR list (with their athlete IDs) directly
 * into the page HTML inside `window['__espnfitt__']`. No copy/paste, no CSV,
 * no fuzzy name matching — just one fetch.
 *
 * Run:  npm run sync-owgr
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const RANKINGS_URL = "https://www.espn.com/golf/rankings";
const OUT_PATH = path.join(__dirname, "..", "src", "lib", "owgr.json");

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

(async () => {
  console.log(`→ Fetching ${RANKINGS_URL}...`);
  const html = await fetchHtml(RANKINGS_URL);

  // ESPN embeds the full payload in window['__espnfitt__'] = {...};
  const match = html.match(/window\['__espnfitt__'\]\s*=\s*(\{.+?\});/s);
  if (!match) throw new Error("Could not find __espnfitt__ blob in HTML");

  const blob = JSON.parse(match[1]);
  const parsed = blob?.page?.content?.rankings?.parsedRanks;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No parsedRanks found in ESPN rankings payload");
  }

  console.log(`  Parsed ${parsed.length} ranked players.`);

  const players = parsed
    .map((r) => {
      const a = r?.rank?.athlete;
      if (!a) return null;
      return {
        rank: r.rankPosition,
        name: a.displayName ?? a.fullName,
        espnId: String(a.id),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  const out = {
    generated: new Date().toISOString(),
    source: RANKINGS_URL,
    players,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`✅ Wrote ${OUT_PATH} (${players.length} players)`);
  console.log(
    `   Top 3: ${players.slice(0, 3).map((p) => `#${p.rank} ${p.name}`).join(", ")}`,
  );
})().catch((err) => {
  console.error("❌ sync-owgr failed:", err.message);
  process.exit(1);
});
