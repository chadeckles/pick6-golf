# Pick Six Golf — Maintainer Notes

> **Status:** archived portfolio project. Not deployed to a live host.
> These notes explain how the moving parts fit together for anyone (including
> future-me) reading the code or running it locally.

---

## 1. Environment variables

See [.env.example](.env.example) for the canonical list. Only `JWT_SECRET` is
required to run locally.

| Variable | Required? | Purpose |
|---|---|---|
| `JWT_SECRET` | **Yes** | Signs session cookies. Long + random. Generate with `openssl rand -base64 48`. Rotating it force-logs-out every user. |
| `APP_URL` | For deploys | Canonical origin, e.g. `https://example.com` (no trailing slash). Used for CSRF origin checks and email links. Without it, CSRF only allows `localhost`. |
| `DATABASE_PATH` | Optional | Path to the SQLite file. Dev falls back to `./pick6-golf.db`. On a host, point at a persistent disk. |
| `EMAIL_PROVIDER` | Optional | Set to `resend` to actually send password-reset emails. Leave unset in dev — the reset link logs to the server console. |
| `EMAIL_FROM` / `RESEND_API_KEY` | If sending email | Sender identity + Resend API key. |

---

## 2. The data pipeline (how tiers get built)

Tier assignments for each major live in `src/lib/<slug>Tiers.ts`
(`mastersTiers.ts`, `pgaTiers.ts`, `usopenTiers.ts`, `theopenTiers.ts`). These
files are **auto-generated and locked** — they're the authoritative source the
picks API validates every pick against.

The whole workflow is two commands:

```bash
# Refresh the OWGR snapshot (fast, safe to run anytime)
npm run sync-owgr

# When ESPN publishes a field, lock that tournament's tiers
npm run build-field -- <slug>       # masters | pga | usopen | theopen
```

### What `sync-owgr` does
- Scrapes ESPN's rankings page for the OWGR top 200 (rank, name, ESPN athlete ID)
- Writes `src/lib/owgr.json`
- Does **not** touch any locked tier file — it only affects the *next* `build-field` run

### What `build-field` does
1. Looks up the ESPN event id for `<slug>` in [tournaments.yaml](tournaments.yaml)
2. Fetches every competitor from ESPN's leaderboard endpoint
3. Cross-references each player against `owgr.json`
4. Assigns tiers by OWGR rank: **T1** 1–10 (1 pick), **T2** 11–25 (2), **T3** 26–50 (2), **T4** 51+/unranked/amateurs (1)
5. Writes `src/lib/<slug>Tiers.ts` with a `LOCKED: <timestamp>` header
6. Refuses to regenerate an existing file without `--force`

### Why the lock matters
Once a tier file exists, `build-field` won't overwrite it. This is intentional:
rankings shift during a tournament, and re-running the build mid-event would
shuffle everyone's tier options *after* they'd already picked. The weekly OWGR
refresh is independent and only affects future tournaments.

### Adding a new tournament slug (one-time)
A brand-new slug needs one manual step the first time: registering it in
[src/lib/tiers.ts](src/lib/tiers.ts). `build-field` can't pre-wire this because
the import target doesn't exist until the file is generated. `build-field`
prints the exact snippet to paste. `masters`, `pga`, and `usopen` are already
registered; The Open is the outstanding one.

---

## 3. Yearly schedule updates

Update [tournaments.yaml](tournaments.yaml) once a year with each event's ESPN
id and dates:

```yaml
masters:
  2027: { espnId: "401845123", month: 4, start: 8, end: 11 }
```

Find the ESPN event id from the leaderboard URL (`?tournamentId=XXXXXXXXX`).
`npm run dev`/`npm run build` auto-sync the YAML into
`src/lib/tournaments/schedule.json` (generated — never hand-edit). Branding
(colors, tier labels, logos) lives in `src/lib/tournaments/config.ts` and rarely
changes.

---

## 4. Security & integrity guarantees

A quick reference of what's enforced server-side.

| Guarantee | Where |
|---|---|
| Passwords hashed (bcrypt cost 12, async) | `api/auth/register`, `api/auth/reset` |
| Session cookies are JWTs — `HttpOnly`, `Secure` in prod, `SameSite=Lax`, 7-day expiry | `src/lib/auth.ts` |
| Login timing-blind — unknown emails still run bcrypt so response time doesn't leak existence | `api/auth/login` |
| CSRF protected — mutating routes check `Origin`/`Referer` against `APP_URL` | `src/lib/security.ts` → `checkOrigin` |
| Rate-limited — per-IP and per-email for logins | `src/lib/rateLimit.ts` |
| Tier validation server-side — can't submit a T4 player as T1, or an unknown golfer | `api/picks` + `src/lib/tiers.ts` |
| Picks can't be reopened once locked — freely adjustable while open, frozen once it passes | `api/pool` (PATCH) |
| No member removal after lock | `api/pool/member` |
| Payment URLs allowlisted — https Venmo/PayPal/CashApp/Stripe/Zelle/Square only | `src/lib/security.ts` → `validatePaymentUrl` |
| Password reset tokens — SHA-256 hashed, 1-hour TTL, single-use | `api/auth/forgot`, `api/auth/reset` |
| Audit log — picks saves, pool updates, joins, kicks, transfers, deletes, resets | `src/lib/audit.ts` |

---

## 5. Scoring model

- **To-par** — lower is better, just like real golf
- **Missed-cut penalty** — 80 strokes for each missed round
- **Best 5 of 6** — the worst of your six golfers is dropped
- **Tiebreaker** — lowest single-golfer score wins

Implemented in [src/lib/scoring.ts](src/lib/scoring.ts); standings are computed
server-side from the live ESPN feed.

---

## 6. Troubleshooting

**Login suddenly returns 403** — `APP_URL` doesn't match the origin the browser
is sending; CSRF rejects it. Fix `APP_URL`.

**"Picks aren't open yet for this tournament"** — the `<slug>Tiers.ts` file
doesn't exist yet. Run `npm run build-field -- <slug>` once ESPN publishes the
field.

**`build-field` refuses to overwrite** — the lock guard working as designed.
Only pass `--force` before picks open.

**`sync-owgr` fails ("Could not find __espnfitt__ blob")** — ESPN changed their
rankings page HTML. Locked tier files don't depend on it; adjust the regex in
`scripts/sync-owgr.js` when convenient.

**Leaderboard shows no golfers / stale data** — ESPN is the single dependency.
Check the event id in `tournaments.yaml`, try the endpoint manually
(`https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=<id>`),
and note the app caches for ~30 s.

**Build fails with "JWT_SECRET env var is required"** — you're building without
`.env.local`. Set any placeholder value; it's only used at request time.

---

## 7. File map

```
├── tournaments.yaml                 ← YEARLY: ESPN IDs + dates per tournament
├── scripts/
│   ├── sync-schedule.js             ← tournaments.yaml → schedule.json (auto)
│   ├── sync-owgr.js                 ← ESPN rankings → owgr.json
│   └── build-field.js               ← ESPN field + OWGR → <slug>Tiers.ts (LOCKED)
├── docs/index.html                  ← GitHub Pages showcase landing page
├── src/
│   ├── app/
│   │   ├── account/                 ← account settings UI
│   │   ├── forgot/, reset/          ← password-reset UI
│   │   └── api/
│   │       ├── account/             ← DELETE /api/account (delete self)
│   │       ├── auth/                ← login/register/me/logout/forgot/reset
│   │       ├── leaderboard/         ← live ESPN proxy (tournament-aware)
│   │       ├── pool/                ← create/list/patch + join/leave/member/transfer
│   │       └── picks/               ← save/get picks (tier validation here)
│   └── lib/
│       ├── auth.ts                  ← JWT session
│       ├── audit.ts                 ← write-only audit log
│       ├── datetime.ts              ← datetime-local <input> round-trip helper
│       ├── db.ts                    ← SQLite + schema migrations
│       ├── email.ts                 ← Resend stub + dev logger
│       ├── espn.ts                  ← ESPN API integration + caching
│       ├── owgr.json                ← GENERATED by sync-owgr (top 200)
│       ├── <slug>Tiers.ts           ← 🔒 GENERATED per-tournament, LOCKED
│       ├── poolOps.ts               ← shared pool-membership mutations
│       ├── rateLimit.ts             ← in-memory rate limiting
│       ├── scoring.ts               ← best-5-of-6 standings calculation
│       ├── security.ts              ← CSRF, URL allowlist, pw policy, timing-safe eq
│       ├── tiers.ts                 ← TierConfig registry (one entry per tournament)
│       └── tournaments/
│           ├── config.ts            ← PERMANENT: branding, colors, tier labels
│           └── schedule.json        ← GENERATED — do not edit
```
