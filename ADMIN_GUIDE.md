# Pick Six Golf — Admin Guide

> **Audience:** you (site owner) and any future maintainer. Everything an
> operator needs to run the site across a season — without reading the
> codebase.

If something here drifts from reality, fix this doc first, *then* the code.

---

## 🏌️ The 30-second cheat sheet

The entire tournament cycle is **two commands**. Memorize these.

```bash
# 🗓️  WEEKLY (Mondays, ~5 sec) — refresh OWGR rankings
npm run sync-owgr

# 🎬  PRE-TOURNAMENT (~T-2 days) — lock the field for picks
npm run build-field -- <slug>      # slug = masters | pga | usopen | theopen
```

Then `git add . && git commit -m "..." && git push` after each. Railway redeploys.

**During the tournament:** nothing. ESPN streams live scoring through the app.

**Post-tournament:** nothing. The locked tier file is the permanent record.

That's it. The rest of this guide is reference material for when things go
sideways or you're onboarding a new admin.

---

## Table of contents

1. [Environment variables](#1-environment-variables)
2. [Yearly setup — before tournament season](#2-yearly-setup--before-tournament-season)
3. [Per-tournament setup — OWGR tiers](#3-per-tournament-setup--owgr-tiers)
4. [Backups & restore](#4-backups--restore)
5. [User support — common requests](#5-user-support--common-requests)
6. [Security & integrity guarantees](#6-security--integrity-guarantees)
7. [Release / deploy checklist](#7-release--deploy-checklist)
8. [Troubleshooting](#8-troubleshooting)
9. [Where things live (file map)](#9-where-things-live-file-map)

---

## 1. Environment variables

Set these on **Railway** (the app host). See [`.env.example`](.env.example) for
the canonical list.

| Variable | Required? | Purpose |
|---|---|---|
| `JWT_SECRET` | **Yes** | Signs session cookies. Must be long + random. Generate with `openssl rand -base64 48`. Rotating it force-logs-out every user. |
| `APP_URL` | Production | Canonical origin, e.g. `https://pick6.app` (no trailing slash). Used for CSRF origin checks and email links. Without it, CSRF will only allow `localhost` and production POSTs will 403. |
| `DATABASE_PATH` | Production | Absolute path to the SQLite file on the Railway persistent volume, e.g. `/data/pick6-golf.db`. Dev falls back to `./pick6-golf.db`. |
| `BACKUP_API_KEY` | **Yes for backups** | Shared secret for the nightly backup job. Min 24 chars. Generate with `openssl rand -base64 32`. Also set as a GitHub repo secret with the SAME value. |
| `EMAIL_PROVIDER` | Optional | Set to `resend` to actually send password-reset emails. Leave unset in dev — the reset link logs to the server console. |
| `EMAIL_FROM` | If sending | e.g. `"Pick 6 Golf <noreply@yourdomain.com>"`. |
| `RESEND_API_KEY` | If sending | Resend API key. |

**GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|---|---|
| `APP_URL` | Same URL as above. Used by the backup workflow. |
| `BACKUP_API_KEY` | Same value as the Railway env var. |

### ⚠️ Resend free-tier gotchas

Running on the free tier with the shared `onboarding@resend.dev` sender? Three things to know:

- **Sandbox recipients only.** The free/unverified-domain mode can only deliver to the email address you used to sign up for Resend. Password-reset emails sent to anyone else will be accepted by the API but never delivered. Verify a custom domain in Resend to unlock arbitrary recipients.
- **Daily/monthly caps.** Free tier = 100 emails/day, 3,000/month. Fine for ~40 users doing the occasional reset; not fine for "email everyone when the pool locks."
- **Spam folder risk.** `resend.dev` isn't your domain, so SPF/DKIM won't align. Gmail is usually OK; Outlook/Yahoo frequently route to spam. Tell first-time testers to check spam.

When you outgrow this, the upgrade path is: buy a domain → add it in Resend → paste the DKIM/SPF records at your DNS host → flip `EMAIL_FROM` to `noreply@yourdomain`. No code changes needed.

---

## 2. Yearly setup — before tournament season

### 2a. Update the tournament schedule

Once per year (ideally a couple weeks before the first major), update
[`tournaments.yaml`](tournaments.yaml):

```yaml
masters:
  2026: { espnId: "401811941", month: 4, start: 9,  end: 12 }
  2027: { espnId: "401845123", month: 4, start: 8,  end: 11 }   # <── add this
```

**Finding ESPN event IDs:**
1. Go to <https://www.espn.com/golf/leaderboard>
2. Click into the specific tournament (Masters, PGA Championship, etc.)
3. Read the URL — it contains `?tournamentId=XXXXXXXXX`
4. That number is the `espnId`

**Course / par overrides** (the US Open moves every year):
```yaml
usopen:
  2027: { espnId: "401...", month: 6, start: 17, end: 20,
          course: "Shinnecock Hills Golf Club", par: 70 }
```

**No restart needed** — `npm run build` (and `npm run dev`) automatically run
`scripts/sync-schedule.js`, which converts the YAML into
`src/lib/tournaments/schedule.json`. Railway picks up the change on next deploy.

### 2b. What you do NOT need to touch each year

- `src/lib/tournaments/config.ts` — tournament branding (colors, tier labels,
  logos, descriptions). Only change when you want to add a new tournament or
  rebrand an existing one.
- `src/lib/tournaments/schedule.json` — generated. Never hand-edit.

### 2c. Commit and deploy

```bash
git add tournaments.yaml
git commit -m "Add 2027 schedule"
git push
```

Railway auto-deploys on push to main. Verify by visiting `/` — the header
tournament dropdown should show all active tournaments.

---

## 3. Per-tournament setup — OWGR tiers

Tier assignments for each major live in `src/lib/<slug>Tiers.ts`
(`mastersTiers.ts`, `pgaTiers.ts`, `usopenTiers.ts`, `theopenTiers.ts`).
These files are **auto-generated and locked** — they are the authoritative
source the picks API uses to validate every pick.

### TL;DR — the only commands you need

```bash
# Weekly (Monday morning, 5 seconds)
npm run sync-owgr

# Per tournament (~2 days before, when ESPN publishes the field)
npm run build-field -- <slug>           # one of: masters | pga | usopen | theopen
```

That's the whole workflow. Commit the resulting file, push, Railway redeploys.
You're done.

### 3a. Weekly OWGR refresh

```bash
npm run sync-owgr
```

What it does:

- Hits ESPN's golf rankings page (`espn.com/golf/rankings`)
- Pulls the server-rendered OWGR top 200, including ESPN athlete IDs
- Writes `src/lib/owgr.json` with `{ rank, name, espnId }` for each player
- Takes about 1 second

What it does **not** do:

- It does **not** modify any `<slug>Tiers.ts` file
- It does **not** affect any tournament that's already been locked
- The freshly-pulled OWGR is only consumed the next time you run `build-field`

Cadence: every Monday morning is plenty. The week of a major, run it again
right before you run `build-field` to get the freshest rankings.

Commit and push:

```bash
git add src/lib/owgr.json
git commit -m "OWGR refresh $(date +%Y-%m-%d)"
git push
```

### 3b. Building a tournament's locked tier file

When ESPN publishes the field for a tournament (typically ~T-2 days), run:

```bash
npm run sync-owgr                      # one final refresh
npm run build-field -- masters         # or pga, usopen, theopen
```

What it does:

1. Looks up the ESPN event id for `<slug>` in `tournaments.yaml`
2. Fetches every competitor from ESPN's leaderboard endpoint
3. Cross-references each player against `src/lib/owgr.json`
4. Assigns tiers using OWGR rank:
   - **Tier 1:** OWGR 1–10 (1 pick)
   - **Tier 2:** OWGR 11–25 (2 picks)
   - **Tier 3:** OWGR 26–50 (2 picks)
   - **Tier 4:** OWGR 51+ / unranked club pros / amateurs (1 pick)
5. Writes `src/lib/<slug>Tiers.ts` with a `LOCKED: <timestamp>` header
6. From this point on, the file refuses to be regenerated without `--force`

Then commit and push:

```bash
git add src/lib/<slug>Tiers.ts
git commit -m "Lock <slug> 2026 field"
git push
```

Railway redeploys. The picks API now accepts picks for that tournament.

### 3c. The lock — why it matters

**Once `<slug>Tiers.ts` exists, `build-field` refuses to overwrite it.**

```text
🔒 src/lib/pgaTiers.ts is already locked (LOCKED: 2026-05-12T10:30:00.000Z).
   Tier tables are frozen at generation time so every pool member
   picks from the same set. Refusing to overwrite.
```

This is intentional. Without the lock, a stray re-run of `build-field` mid-tournament
would shuffle every member's tier options after they've already picked.
Example: Aaron Rai is OWGR #39 (Tier 3) when picks open Monday. He wins the
PGA. By Tuesday he's OWGR #15 (Tier 2). If anyone re-ran `build-field`, every
member who already chose him as their T3 pick would suddenly have an invalid
roster. Locking prevents that.

The weekly OWGR refresh (§3a) is independent — it only affects *future*
tournaments. Locked files never change.

### 3d. Late field change (player WD, special invite)

A player withdraws Wednesday morning, the day before the tournament starts.
You need to add their replacement. **This is the only case for `--force`:**

```bash
npm run build-field -- pga --force
```

- Only do this **before** picks have opened (or before any meaningful number
  of picks have been made — your call).
- The new file gets a new `LOCKED:` timestamp.
- Any pool member who already picked the withdrawn player will need to re-pick
  on the picks page.
- Add an audit note in your commit message:

```bash
git commit -m "Re-lock pga field: <Player> WD, added <Player>"
```

### 3e. Adding the US Open or The Open

The four majors run through the same pipeline. A **brand-new** tournament slug
needs one small code step the first time it's built — registering it in
[`src/lib/tiers.ts`](src/lib/tiers.ts). `build-field` can't pre-wire this because
the import target, `src/lib/<slug>Tiers.ts`, doesn't exist until `build-field`
generates it (a static `import` of a missing module won't compile).

When ESPN publishes the field:

```bash
npm run sync-owgr
npm run build-field -- usopen
```

`build-field` finishes by printing the exact registration snippet. Follow it: in
`src/lib/tiers.ts`, import the new file's getters + `TIER_1`–`TIER_4`, then add a
`CONFIGS["<slug>"]` entry (copy the `masters`/`pga` block and swap the names).
Run `npx tsc --noEmit` to confirm it compiles, then commit **both** files.

**Status:** `masters`, `pga`, and `usopen` are registered. **The Open** is the
only one still needing this step — do it when its field drops in mid-July.

> A *future year's* US Open (or any already-registered tournament) needs **no**
> code change — just `build-field` and commit the regenerated tier file. The
> registration is one-time per tournament slug, not per year.

Same `build-field` flow for The Open in mid-July.

### 3f. What you do NOT need to do anymore

You can ignore these old workflows entirely:

- ❌ Looking up each player's OWGR rank by hand
- ❌ Searching for ESPN athlete IDs one by one
- ❌ Hand-editing `TIER_1`–`TIER_4` arrays
- ❌ Importing `mastersTiers` directly in `espn.ts` (it now uses the generic
      `tiers.ts` registry)

### 3g. Why this is safe

The picks endpoint (`src/app/api/picks/route.ts`) validates every pick
against `tierConfig.getTier(id)`. A user who tampers with the frontend to
submit Scottie Scheffler in Tier 4 gets a 400. Unknown golfers (not in the
locked field) are rejected entirely. Without a tier file, the API returns
*"Picks aren't open yet for this tournament"* — the safe default.

---

## 4. Backups & restore

### How it works

- **Primary:** a GitHub Actions workflow
  ([`.github/workflows/backup.yml`](.github/workflows/backup.yml)) runs
  nightly at **07:15 UTC** (≈ 02:15 ET). It hits `GET /api/admin/backup` on
  the live app, receives a gzipped, transactionally-consistent SQLite
  snapshot, and uploads it as a **private workflow artifact**.
- **Retention:** 14 days on GitHub (configurable via `retention-days` in the
  workflow YAML, up to 90 on the free tier).
- **Authentication:** `Authorization: Bearer $BACKUP_API_KEY`, compared in
  constant-time. Without the env var set on the server, the endpoint returns
  401 for everyone.
- **Manual local backup:** `npm run backup` — writes to `./backups/` on your
  laptop, also keeps 14 days, prunes older.

### Running a backup manually

**GitHub (recommended — same as the nightly run):**
1. Actions tab → **Nightly DB backup** → **Run workflow** → Branch: `main` → **Run**
2. ~30 seconds later, open the run → Artifacts → download
   `pick6-db-backup-<n>` (a zip).

**Local (against your dev DB):**
```bash
npm run backup
# → backups/pick6-2026-04-16_02-15-00.db.gz
```

### Restoring from a backup

This is the "oh no" procedure. Practice it once a quarter so you're not
learning it under pressure.

1. **Download** the artifact (or grab a file from `./backups/`).
2. **Unzip the GitHub artifact** (it's double-zipped — artifact zip contains
   your `.db.gz`):
   ```bash
   unzip pick6-db-backup-42.zip
   gunzip pick6-2026-04-16_07-15-22.db.gz
   # → pick6-2026-04-16_07-15-22.db
   ```
3. **Sanity-check** the file before touching production:
   ```bash
   sqlite3 pick6-2026-04-16_07-15-22.db "SELECT COUNT(*) FROM users;"
   sqlite3 pick6-2026-04-16_07-15-22.db "SELECT COUNT(*) FROM picks;"
   ```
4. **Stop the Railway service** (Service settings → Scale to 0 instances, or
   click "Stop"). **Critical** — never replace a live DB file.
5. **Replace the file** on the Railway volume. Easiest way: add a one-off
   shell command to the service that copies from `/tmp` after you upload via
   `railway run` / SSH. Alternatively SCP the file into the volume mount
   point (the path you set in `DATABASE_PATH`).
6. **Start the service** again. Watch the logs — you should see
   `foreign_keys = ON` and no schema errors.
7. **Verify** by logging in as a test user and confirming pools/picks look
   correct.
8. **Post-mortem:** write a short note about what went wrong in your issue
   tracker so you can prevent it next time.

### Restore-from-dev shortcut (for testing only)

```bash
cp pick6-golf.db pick6-golf.db.bak
gunzip -k backups/pick6-2026-04-16_02-15-00.db.gz
mv backups/pick6-2026-04-16_02-15-00.db pick6-golf.db
npm run dev
```

### Rehearsal schedule

| When | Action |
|---|---|
| Every deploy day | Eyeball the most recent workflow run — is it green? |
| Weekly | Check the Actions run list. One red run = investigate same day. |
| Quarterly | Download a backup, restore locally, log in, verify. This is the only way to know the backup actually works. |

### Upgrading to off-site / longer retention

When you're ready to move past GitHub Actions artifacts:

- **Option A (kept simple):** bump `retention-days` in
  `.github/workflows/backup.yml` up to `90` (free-tier max).
- **Option B (off-site):** use [`scripts/backup.js`](scripts/backup.js) with
  the S3/R2 env vars (`BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`,
  `BACKUP_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) and run
  it as a Railway cron instead. Cloudflare R2 has a generous free tier and
  zero egress fees.

---

## 5. User support — common requests

### "I forgot my password"

Point them at `/forgot`. The link is valid for 1 hour and single-use.

If email isn't configured yet, you can manually extract the link:
```bash
# On the Railway service shell
# Look at recent logs for: "─── [DEV EMAIL] ───"
```
Or, issue a reset token directly:
```sql
-- Generate a token (do this OFF the production server, then INSERT the hash)
-- Easier: just ask the user to request /forgot and read the link from logs
```

### "I need to delete my account"

Self-service at `/account` → Danger Zone → Delete. Requires:
- Current password
- Typing `DELETE` (literal)
- Must not be the sole admin of any multi-member pool (transfer admin first)

### "I'm a pool admin and I need to kick someone"

Dashboard → select the pool → click the tiny `✕` next to the member's name.
**Only works before the pool's lock date.** After lock, member removal is
disabled on the server side to prevent retroactive standings changes.

### "I'm the admin and I want to leave the pool"

Dashboard → Danger Zone → Leave Pool. You must pick a successor admin from
the dropdown. If you're the only member, the pool is **deleted entirely**.

### "Can you fix my picks? I made a mistake and the lock passed"

**No.** The lock is enforced server-side specifically so this can't happen —
and if you override it for one person, you've opened the door to every
future dispute. Point them at the audit log entry and move on.

### "Can you move / reopen the pick lock?" (admin pool config)

Yes — but only *before* it passes. The pick lock is **per pool**:

- **Default:** the selected tournament's first round (8:00 AM, server-local
  time), derived per tournament — a US Open pool gets a June lock, not April.
  (Before mid-2026 every pool wrongly inherited the Masters date; that's fixed
  in [`getDefaultLockISO`](src/lib/tournaments/config.ts).)
- **Set at creation:** the Create Pool form has a **Picks Lock** field,
  prefilled with that default. Change it to run a beta or close entries early.
- **Edit later:** Dashboard → select the pool → **Lock: … → Edit**.

Two server-enforced rules ([`pool/route.ts`](src/app/api/pool/route.ts) PATCH):

1. You can only pull a lock **earlier**, never push it **later** than the
   original `original_lock_date`.
2. Once the original lock has passed, it's **frozen** — no further changes. This
   is what backs the "can't fix my picks" answer above.

**Time zones:** the field shows and accepts **your browser's local time**. It's
stored as a UTC instant, so each member sees the lock in *their own* zone — set
"Sunday 6 PM" your time and a West-Coast member correctly sees 3 PM. (Both the
create and dashboard-edit inputs round-trip through
[`toLocalInputValue`](src/lib/datetime.ts) so they can't drift.)

### "Someone says their picks got changed"

Every picks save writes a row to `audit_log` with `before_json` and
`after_json`. Query it:
```sql
SELECT created_at, before_json, after_json, ip
FROM audit_log
WHERE actor_user_id = '<userId>'
  AND action = 'picks.save'
  AND pool_id = '<poolId>'
ORDER BY created_at;
```

### "I need a report of who's paid"

```sql
SELECT u.name, u.email,
       COALESCE(pp.paid, 0) AS paid,
       pp.marked_at
FROM pool_members pm
JOIN users u ON u.id = pm.user_id
LEFT JOIN pool_payments pp
  ON pp.pool_id = pm.pool_id AND pp.user_id = pm.user_id
WHERE pm.pool_id = '<poolId>';
```

---

## 6. Security & integrity guarantees

Quick reference of what's enforced, so you can answer users with confidence.

| Guarantee | Where |
|---|---|
| **Passwords are hashed** (bcrypt cost 12, async) | `src/app/api/auth/register/route.ts`, `src/app/api/auth/reset/route.ts` |
| **Session cookies are JWTs** — `HttpOnly`, `Secure` in prod, `SameSite=Lax`, 7-day expiry | `src/lib/auth.ts` |
| **Login timing-blind** — unknown emails still run bcrypt, so response time doesn't leak existence | `src/app/api/auth/login/route.ts` |
| **CSRF protected** — every mutating route checks `Origin`/`Referer` against `APP_URL` | `src/lib/security.ts` → `checkOrigin` |
| **Rate-limited** — per-IP AND per-email for logins | `src/lib/rateLimit.ts` |
| **Tier validation server-side** — a user can't submit a Tier 4 player as Tier 1, or an unknown golfer | `src/app/api/picks/route.ts` + `src/lib/tiers.ts` |
| **Lock date cannot be pushed forward** — admins can pull in a lock, never extend it past the original | `src/app/api/pool/route.ts` (PATCH handler) |
| **No member removal after lock** | `src/app/api/pool/member/route.ts` |
| **Payment URLs allowlisted** — only https Venmo/PayPal/CashApp/Stripe/Zelle/Square | `src/lib/security.ts` → `validatePaymentUrl` |
| **Password reset tokens** — SHA-256 hashed before storage, 1-hour TTL, single-use | `src/app/api/auth/forgot/route.ts`, `src/app/api/auth/reset/route.ts` |
| **Audit log** — picks saves, pool updates, joins, kicks, transfers, account deletes, password resets | `src/lib/audit.ts` |

---

## 7. Release / deploy checklist

Before pushing a change that touches auth, picks, or the DB schema:

- [ ] `npm run build` passes locally
- [ ] Smoke test on dev: register → create pool → make picks → view standings
- [ ] If the schema changed: confirm the migration runs on a **copy of prod**
      (`cp prod.db test.db; DATABASE_PATH=./test.db npm run dev`)
- [ ] `git commit` with a descriptive message
- [ ] Watch Railway logs after the deploy — look for schema errors or bcrypt failures
- [ ] If you changed tiers: verify a test pick saves successfully

### Before a tournament weekend

Run this checklist ~T-2 days, when ESPN publishes the field:

- [ ] `npm run sync-owgr` — OWGR snapshot is fresh
- [ ] `npm run build-field -- <slug>` — locked tier file generated
- [ ] Eyeball the new `<slug>Tiers.ts` — do the tier counts look right?
      (Expect ~10 / 15 / 25 / rest. T4 will be bloated with unranked club
      pros for the PGA — that's expected.)
- [ ] `tournaments.yaml` has the correct ESPN event ID for this year
- [ ] Lock dates in active pools point to the right start time
- [ ] `git push` — wait for Railway to redeploy
- [ ] Visit `/picks` for the tournament — picks render, no errors
- [ ] Manually trigger a backup workflow run to confirm it still works
- [ ] Download that backup and spot-check
- [ ] Email delivery tested if you've wired up Resend

---

## 8. Troubleshooting

### Login suddenly returns 403
You probably changed `APP_URL` or deployed to a new domain. Browser sends an
`Origin` that doesn't match, CSRF rejects it. Fix `APP_URL` on Railway.

### "Picks aren't open yet for this tournament"
You created a pool for a tournament slug whose `<slug>Tiers.ts` file doesn't
exist yet (ESPN hasn't published the field, or you haven't run `build-field`).
Run `npm run build-field -- <slug>` when the field is available. See
[§3 — Per-tournament setup](#3-per-tournament-setup--owgr-tiers).

### `build-field` refuses to overwrite a tier file
That's the lock guard working as designed. See
[§3c — The lock](#3c-the-lock--why-it-matters). Pass `--force` only if
you understand the implications.

### `sync-owgr` fails with "Could not find __espnfitt__ blob"
ESPN restructured their rankings page HTML. Rare but possible.
Fallback: skip the weekly refresh until it's fixed — locked tier files
don't depend on it. Open `scripts/sync-owgr.js` and adjust the regex.

### Leaderboard shows no golfers / stale data
ESPN API is the single point of failure. Check:
1. ESPN event ID in `tournaments.yaml` is correct for the current year.
2. Try the URL manually:
   `https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=<eventId>`
3. The app caches for 30 s — restart to force a refresh.
4. Fallback: the Masters has a static field in `mastersTiers.ts` that renders
   even when ESPN is down.

### Backup workflow fails with 401
`BACKUP_API_KEY` in the GitHub secret doesn't match the one on Railway.
They must be **byte-identical** (watch for trailing newlines when pasting).

### Backup workflow fails with "not gzip (header=)" and HTTP 301/302
Your `APP_URL` secret doesn't match the canonical domain the app actually
serves on — something (Railway, Cloudflare, a custom domain) is issuing a
redirect that curl can't safely follow with the auth header attached.

Diagnose:
```bash
curl -I https://<whatever-APP_URL-is-set-to>/api/admin/backup
```
Read the `Location:` header — that's what `APP_URL` should be. Common
causes:
- `http://` instead of `https://`
- trailing slash (`https://pick6.app/`)
- apex vs `www.` mismatch
- stale `*.up.railway.app` after moving to a custom domain

Update the `APP_URL` repo secret (and the Railway env var — keep them in
sync) to the exact final URL with no trailing slash, then re-run the
workflow.

### Backup workflow fails with "not gzip" (no redirect)
The app probably returned a JSON error instead of the binary. Check Railway
logs. Most likely the server is rejecting the auth header (see above).

### Build fails with "JWT_SECRET env var is required"
You're building without `.env.local` (or the CI env isn't set). Add
`JWT_SECRET=build-time-placeholder` just for the build step if needed — it's
only used at request time.

### Database is corrupt
Restore from the most recent backup. See [§4 – Restoring from a backup](#restoring-from-a-backup).

---

## 9. Where things live (file map)

```
├── tournaments.yaml                 ← YEARLY: ESPN IDs + dates per tournament
├── .github/workflows/backup.yml     ← nightly DB backup workflow
├── scripts/
│   ├── sync-schedule.js             ← tournaments.yaml → schedule.json (auto)
│   ├── sync-owgr.js                 ← WEEKLY: ESPN rankings → owgr.json
│   ├── build-field.js               ← PER-TOURNAMENT: ESPN field + OWGR → <slug>Tiers.ts (LOCKED)
│   └── backup.js                    ← local backup script (npm run backup)
├── src/
│   ├── app/
│   │   ├── account/                 ← user-facing account settings
│   │   ├── forgot/, reset/          ← password-reset UI
│   │   └── api/
│   │       ├── admin/backup/        ← protected endpoint GH Actions hits
│   │       ├── account/             ← DELETE /api/account (delete self)
│   │       ├── auth/                ← login/register/me/logout/forgot/reset
│   │       ├── leaderboard/         ← live ESPN proxy (tournament-aware)
│   │       ├── pool/                ← create/list/patch + join/leave/member/transfer
│   │       └── picks/               ← save/get picks (tier validation here)
│   └── lib/
│       ├── auth.ts                  ← JWT session
│       ├── audit.ts                 ← write-only audit log│       ├── datetime.ts               ← datetime-local <input> round-trip helper│       ├── db.ts                    ← SQLite + schema migrations
│       ├── email.ts                 ← Resend stub + dev logger
│       ├── espn.ts                  ← ESPN API integration + caching (tournament-aware)
│       ├── owgr.json                ← GENERATED weekly by sync-owgr (top 200)
│       ├── mastersTiers.ts          ← 🔒 GENERATED per-tournament, LOCKED
│       ├── pgaTiers.ts              ← 🔒 GENERATED per-tournament, LOCKED
│       ├── usopenTiers.ts           ← 🔒 GENERATED per-tournament, LOCKED (when field publishes)
│       ├── theopenTiers.ts          ← 🔒 GENERATED per-tournament, LOCKED (when field publishes)
│       ├── poolOps.ts               ← shared pool-membership mutations
│       ├── rateLimit.ts             ← in-memory rate limiting
│       ├── scoring.ts               ← best-5-of-6 standings calculation
│       ├── security.ts              ← CSRF, URL allowlist, pw policy, timing-safe eq
│       ├── tiers.ts                 ← TierConfig registry (one CONFIGS entry per tournament)
│       └── tournaments/
│           ├── config.ts            ← PERMANENT: branding, colors, tier labels
│           └── schedule.json        ← GENERATED — do not edit
```

---

*Last updated: June 2026. If you change operational behavior, update this
document in the same PR.*
