/**
 * Pick 6 Golf — Tournament Configuration
 *
 * ── What lives where ─────────────────────────────────────────────
 *  tournaments.yaml  → Stuff that changes every year:
 *                       ESPN event IDs, dates, course/par overrides
 *
 *  This file (config.ts) → Stuff that almost never changes:
 *                       Names, themes, colors, tier labels, logos,
 *                       descriptions, disclaimers
 *
 * ── Yearly maintenance ───────────────────────────────────────────
 *  1. Open  tournaments.yaml  (project root)
 *  2. Add one line per tournament for the new year
 *  3. Run  npm run sync       (or just start dev/build — it's automatic)
 *  4. Done. No TypeScript changes needed.
 * ─────────────────────────────────────────────────────────────────
 */

import schedule from "./schedule.json";

// ─── Types ──────────────────────────────────────────────────────────────

export interface TournamentTheme {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentMuted: string;
  cream: string;
  highlight: string;
  sky: string;
}

export interface TournamentConfig {
  slug: string;
  name: string;
  fullName: string;
  tagline: string;
  course: string;
  par: number;
  logo: string;
  espnEventIds: Record<number, string>;
  theme: TournamentTheme;
  dates: Record<number, { month: number; start: number; end: number }>;
  totalPicks?: number;
  picksPerTier?: Record<number, number>;
  tierLabels?: Record<number, { name: string; range: string; desc: string }>;
  active: boolean;
  description: string;
  disclaimer: string;
}

// ─── Permanent tournament data (rarely changes) ─────────────────────────

interface TournamentBase {
  name: string;
  fullName: string;
  tagline: string;
  course: string;
  par: number;
  logo: string;
  theme: TournamentTheme;
  tierLabels: Record<number, { name: string; range: string; desc: string }>;
  active: boolean;
  description: string;
  disclaimer: string;
}

const TOURNAMENT_BASES: Record<string, TournamentBase> = {
  masters: {
    name: "The Masters",
    fullName: "Masters Tournament",
    tagline: "A Tradition Unlike Any Other",
    course: "Augusta National Golf Club",
    par: 72,
    logo: "/logos/masters.png",
    theme: {
      primary: "#006747",
      primaryDark: "#004d35",
      primaryLight: "#008c5f",
      accent: "#f2c75c",
      accentMuted: "#c8a951",
      cream: "#fdf8f0",
      highlight: "#d23669",
      sky: "#e8f4f8",
    },
    tierLabels: {
      1: { name: "Elite", range: "Top 10", desc: "The favorites. Consistent but everyone wants them." },
      2: { name: "Contenders", range: "11-25", desc: "Strong players who can surprise. Your backbone." },
      3: { name: "Dark Horses", range: "26-50", desc: "This is where pools are won. Find the sleepers." },
      4: { name: "Longshots", range: "51+", desc: "High risk, high reward. Augusta magic happens." },
    },
    active: true,
    description: "A tradition unlike any other. Pick your 6 for the green jacket chase at Augusta National.",
    disclaimer: "Not affiliated with Augusta National Golf Club",
  },

  pga: {
    name: "PGA Championship",
    fullName: "PGA Championship",
    tagline: "Glory's Last Shot",
    course: "Quail Hollow Club",
    par: 71,
    logo: "/logos/pga.png",
    theme: {
      primary: "#00205B",
      primaryDark: "#001740",
      primaryLight: "#003080",
      accent: "#FFC72C",
      accentMuted: "#D4A520",
      cream: "#f8f6f0",
      highlight: "#c8102e",
      sky: "#e8eef8",
    },
    tierLabels: {
      1: { name: "Elite", range: "Top 10", desc: "Major champions and world-beaters." },
      2: { name: "Contenders", range: "11-25", desc: "Battle-tested and dangerous." },
      3: { name: "Dark Horses", range: "26-50", desc: "Value picks with upside." },
      4: { name: "Longshots", range: "51+", desc: "Surprise contenders and local heroes." },
    },
    active: true,
    description: "The PGA's flagship major. Pick your 6 at Quail Hollow.",
    disclaimer: "Not affiliated with the PGA of America",
  },

  usopen: {
    name: "US Open",
    fullName: "United States Open Championship",
    tagline: "The Toughest Test in Golf",
    course: "Shinnecock Hills Golf Club",
    par: 70,
    logo: "/logos/usopen.png",
    theme: {
      primary: "#002855",
      primaryDark: "#001B3A",
      primaryLight: "#003D7A",
      accent: "#C8102E",
      accentMuted: "#9E0C24",
      cream: "#f5f3ee",
      highlight: "#C8102E",
      sky: "#e8ecf4",
    },
    tierLabels: {
      1: { name: "Favorites", range: "Top 10", desc: "The best in the world on the hardest course." },
      2: { name: "Contenders", range: "11-25", desc: "Players built for US Open grinds." },
      3: { name: "Sleepers", range: "26-50", desc: "The thick rough doesn't scare them." },
      4: { name: "Longshots", range: "51+", desc: "Anything can happen at the US Open." },
    },
    active: true,
    description: "Golf's ultimate test. Pick your 6 to survive the US Open grind.",
    disclaimer: "Not affiliated with the USGA",
  },

  theopen: {
    name: "The Open",
    fullName: "The Open Championship",
    tagline: "The Original Championship",
    course: "Royal Portrush Golf Club",
    par: 71,
    logo: "/logos/theopen.png",
    theme: {
      primary: "#1B2A4A",
      primaryDark: "#111D33",
      primaryLight: "#2A4070",
      accent: "#C5A55A",
      accentMuted: "#A88C3F",
      cream: "#f7f5ef",
      highlight: "#8B1A1A",
      sky: "#eaecf2",
    },
    tierLabels: {
      1: { name: "Open Royalty", range: "Top 10", desc: "Links legends and world number ones." },
      2: { name: "Contenders", range: "11-25", desc: "Proven performers on links courses." },
      3: { name: "Wildcards", range: "26-50", desc: "Wind and weather are the great equalizer." },
      4: { name: "Longshots", range: "51+", desc: "Links golf breeds miracles." },
    },
    active: true,
    description: "The oldest major in golf. Pick your 6 for the Claret Jug chase.",
    disclaimer: "Not affiliated with The R&A",
  },
};

// ─── Merge base configs + schedule.json (generated from YAML) ───────

interface ScheduleEntry {
  espnId: string;
  month: number;
  start: number;
  end: number;
  course?: string;
  par?: number;
}

type Schedule = Record<string, Record<string, ScheduleEntry>>;

function buildTournaments(): Record<string, TournamentConfig> {
  const sched = schedule as Schedule;
  const result: Record<string, TournamentConfig> = {};
  const currentYear = new Date().getFullYear();

  for (const [slug, base] of Object.entries(TOURNAMENT_BASES)) {
    const yearEntries = sched[slug] ?? {};

    const espnEventIds: Record<number, string> = {};
    const dates: Record<number, { month: number; start: number; end: number }> = {};

    for (const [yearStr, entry] of Object.entries(yearEntries)) {
      const year = Number(yearStr);
      if (entry.espnId) espnEventIds[year] = entry.espnId;
      dates[year] = { month: entry.month, start: entry.start, end: entry.end };
    }

    // Allow per-year course/par overrides from YAML
    const currentEntry = yearEntries[String(currentYear)] as ScheduleEntry | undefined;
    const course = currentEntry?.course ?? base.course;
    const par = currentEntry?.par ?? base.par;

    result[slug] = {
      slug,
      ...base,
      course,
      par,
      espnEventIds,
      dates,
    };
  }

  return result;
}

export const TOURNAMENTS: Record<string, TournamentConfig> = buildTournaments();

// ─── Helpers ────────────────────────────────────────────────────────────

export function getActiveTournaments(): TournamentConfig[] {
  return Object.values(TOURNAMENTS).filter((t) => t.active);
}

export function getTournament(slug: string): TournamentConfig {
  return TOURNAMENTS[slug] ?? TOURNAMENTS.masters;
}

export function getDefaultTournament(): TournamentConfig {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const tournaments = getActiveTournaments();

  for (const t of tournaments) {
    const d = t.dates[year];
    if (!d) continue;
    if (month === d.month && day >= d.start - 3 && day <= d.end + 3) {
      return t;
    }
  }

  const upcoming = tournaments
    .filter((t) => {
      const d = t.dates[year];
      if (!d) return false;
      return month < d.month || (month === d.month && day < d.start);
    })
    .sort((a, b) => {
      const ad = a.dates[year]!;
      const bd = b.dates[year]!;
      return ad.month - bd.month || ad.start - bd.start;
    });

  return upcoming[0] ?? TOURNAMENTS.masters;
}

export function getThemeCSSVars(theme: TournamentTheme): Record<string, string> {
  return {
    "--t-primary": theme.primary,
    "--t-primary-dark": theme.primaryDark,
    "--t-primary-light": theme.primaryLight,
    "--t-accent": theme.accent,
    "--t-accent-muted": theme.accentMuted,
    "--t-cream": theme.cream,
    "--t-highlight": theme.highlight,
    "--t-sky": theme.sky,
  };
}
