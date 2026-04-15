/**
 * Pick 6 Golf — Tournament Configuration System
 *
 * Each tournament is a self-contained config: colors, ESPN mapping,
 * course info, dates, tier structure, and branding.
 *
 * To add a new tournament: add a TournamentConfig entry below
 * and (optionally) a tiers file at `src/lib/tournaments/tiers/{slug}.ts`.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface TournamentTheme {
  /** Primary brand color (e.g. Augusta green) */
  primary: string;
  /** Darker shade for headers, dark backgrounds */
  primaryDark: string;
  /** Lighter shade for hover states */
  primaryLight: string;
  /** Accent/highlight color (e.g. yellow, gold) */
  accent: string;
  /** Muted accent for subtle highlights */
  accentMuted: string;
  /** Light background / cream tone */
  cream: string;
  /** Highlight color for alerts, cut indicators */
  highlight: string;
  /** Light sky-blue-ish background for expanded sections */
  sky: string;
}

export interface TournamentConfig {
  /** Unique identifier — used in URLs and storage */
  slug: string;
  /** Short display name */
  name: string;
  /** Full official name */
  fullName: string;
  /** Tagline for hero section */
  tagline: string;
  /** Course name */
  course: string;
  /** Course par (for scoring calculations) */
  par: number;
  /** Path to tournament logo in /public */
  logo: string;
  /** Known ESPN event IDs by year */
  espnEventIds: Record<number, string>;
  /** Theme colors */
  theme: TournamentTheme;
  /** Tournament dates by year { start (Thursday), end (Sunday) } */
  dates: Record<number, { month: number; start: number; end: number }>;
  /** Number of picks (default 6) */
  totalPicks?: number;
  /** Picks per tier { tier: count } — must sum to totalPicks */
  picksPerTier?: Record<number, number>;
  /** Tier labels */
  tierLabels?: Record<number, { name: string; range: string; desc: string }>;
  /** Whether this tournament is currently active/available */
  active: boolean;
  /** Brief description for tournament selector */
  description: string;
  /** Footer disclaimer */
  disclaimer: string;
}

// ─── Tournament Configs ─────────────────────────────────────────────────

export const TOURNAMENTS: Record<string, TournamentConfig> = {
  masters: {
    slug: "masters",
    name: "The Masters",
    fullName: "Masters Tournament",
    tagline: "A Tradition Unlike Any Other",
    course: "Augusta National Golf Club",
    par: 72,
    logo: "/logos/masters.png",
    espnEventIds: {
      2025: "401580344",
      2026: "401811941",
    },
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
    dates: {
      2025: { month: 4, start: 10, end: 13 },
      2026: { month: 4, start: 9, end: 12 },
      2027: { month: 4, start: 8, end: 11 },
      2028: { month: 4, start: 6, end: 9 },
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
    slug: "pga",
    name: "PGA Championship",
    fullName: "PGA Championship",
    tagline: "Glory's Last Shot",
    course: "Quail Hollow Club",
    par: 71,
    logo: "/logos/pga.png",
    espnEventIds: {
      2026: "401811947",
    },
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
    dates: {
      2026: { month: 5, start: 14, end: 17 },
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
    slug: "usopen",
    name: "US Open",
    fullName: "United States Open Championship",
    tagline: "The Toughest Test in Golf",
    course: "Shinnecock Hills Golf Club",
    par: 70,
    logo: "/logos/usopen.png",
    espnEventIds: {
      2026: "401811952",
    },
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
    dates: {
      2026: { month: 6, start: 18, end: 21 },
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
    slug: "theopen",
    name: "The Open",
    fullName: "The Open Championship",
    tagline: "The Original Championship",
    course: "Royal Portrush Golf Club",
    par: 71,
    logo: "/logos/theopen.png",
    espnEventIds: {
      2026: "401811957",
    },
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
    dates: {
      2026: { month: 7, start: 16, end: 19 },
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

  rydercup: {
    slug: "rydercup",
    name: "Ryder Cup",
    fullName: "Ryder Cup",
    tagline: "USA vs Europe",
    course: "Adare Manor",
    par: 72,
    logo: "/logos/rydercup.png",
    espnEventIds: {
      2026: "401824815",
    },
    theme: {
      primary: "#1C2841",
      primaryDark: "#121B2E",
      primaryLight: "#2A3F6B",
      accent: "#C9A84C",
      accentMuted: "#A68C3A",
      cream: "#f6f4ee",
      highlight: "#B22234",
      sky: "#e9ecf3",
    },
    dates: {
      2026: { month: 9, start: 24, end: 27 },
    },
    totalPicks: 6,
    tierLabels: {
      1: { name: "Captains", range: "Top 10", desc: "Automatic qualifiers and team leaders." },
      2: { name: "Veterans", range: "11-25", desc: "Ryder Cup experience counts for everything." },
      3: { name: "Debutants", range: "26-50", desc: "Hungry to prove themselves on the big stage." },
      4: { name: "Captain's Picks", range: "51+", desc: "The wild cards that can change everything." },
    },
    active: false,
    description: "USA vs Europe. Pick your 6 for the greatest team event in golf.",
    disclaimer: "Not affiliated with Ryder Cup Europe or PGA of America",
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────

/** Get all active tournaments as an array, sorted by next date */
export function getActiveTournaments(): TournamentConfig[] {
  return Object.values(TOURNAMENTS).filter((t) => t.active);
}

/** Get a tournament by slug, falling back to Masters */
export function getTournament(slug: string): TournamentConfig {
  return TOURNAMENTS[slug] ?? TOURNAMENTS.masters;
}

/** Get the default (currently active or next upcoming) tournament */
export function getDefaultTournament(): TournamentConfig {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Find the tournament whose dates bracket today, or the next upcoming one
  const tournaments = getActiveTournaments();

  // Check if we're currently in a tournament window (± a few days for pre/post)
  for (const t of tournaments) {
    const dates = t.dates[year];
    if (!dates) continue;
    if (month === dates.month && day >= dates.start - 3 && day <= dates.end + 3) {
      return t;
    }
  }

  // Find next upcoming tournament this year
  const upcoming = tournaments
    .filter((t) => {
      const dates = t.dates[year];
      if (!dates) return false;
      return month < dates.month || (month === dates.month && day < dates.start);
    })
    .sort((a, b) => {
      const ad = a.dates[year]!;
      const bd = b.dates[year]!;
      return ad.month - bd.month || ad.start - bd.start;
    });

  return upcoming[0] ?? TOURNAMENTS.masters;
}

/**
 * Generate CSS custom property assignments for a tournament theme.
 * These get applied to :root or a wrapper element to swap the entire color palette.
 */
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
