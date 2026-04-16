# Pick Six Golf — Admin Guide

> **Audience:** you (site owner) and any future maintainer. Everything an
> operator needs to run the site across a season — without reading the
> codebase.

If something here drifts from reality, fix this doc first, *then* the code.

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
| `DATABASE_PATH` | Production | Absolute path to the SQLite file on the Railway persistent volume, e.g. `/data/masters-pick6.db`. Dev falls back to `./masters-pick6.db`. |
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

Tier assignments for the Masters live in
[`src/lib/mastersTiers.ts`](src/lib/mastersTiers.ts). They are the
authoritative source — the picks API refuses any pick that doesn't match.

### When to update

- **~1 week before a tournament:** refresh tier lists using the latest OWGR.
- **Day before the tournament:** lock in the final field (commitments, WDs,
  special invites, amateurs).

### How to update

1. Check the Official World Golf Rankings: <https://www.owgr.com/ranking>
2. For each golfer in the field, grab their **ESPN athlete ID** from
   <https://www.espn.com/golf/players> (URL pattern: `/player/_/id/XXXXX`).
3. Edit the `TIER_1`–`TIER_4` arrays in `mastersTiers.ts`:
   - **Tier 1 (1 pick):** OWGR 1–10
   - **Tier 2 (2 picks):** OWGR 11–25
   - **Tier 3 (2 picks):** OWGR 26–50
   - **Tier 4 (1 pick):** OWGR 51+ / past champions / amateurs
4. Commit + push — Railway redeploys.

### Adding tiers for another tournament (PGA / US Open / The Open)

Today only the Masters has a tier table. To enable picks for another
tournament:

1. Create `src/lib/pgaTiers.ts` (or similar) following the Masters file's
   shape.
2. Register it in [`src/lib/tiers.ts`](src/lib/tiers.ts):
   ```typescript
   const CONFIGS: Record<string, TierConfig> = {
     masters: { ... },
     pga: { getTier, fieldIds },   // <── add this
   };
   ```
3. Users can now create pools for that tournament.
   Without a registered tier config, the picks API returns
   *"Picks aren't open yet for this tournament"* — which is the safe default.

### Why this matters

The picks endpoint validates every pick against `tierConfig.getTier(id)`. A
user who tampers with the frontend to submit Scottie Scheffler in Tier 4
gets a 400. Unknown golfers (not in the field) are rejected entirely.

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
   `mp6-db-backup-<n>` (a zip).

**Local (against your dev DB):**
```bash
npm run backup
# → backups/mp6-2026-04-16_02-15-00.db.gz
```

### Restoring from a backup

This is the "oh no" procedure. Practice it once a quarter so you're not
learning it under pressure.

1. **Download** the artifact (or grab a file from `./backups/`).
2. **Unzip the GitHub artifact** (it's double-zipped — artifact zip contains
   your `.db.gz`):
   ```bash
   unzip mp6-db-backup-42.zip
   gunzip mp6-2026-04-16_07-15-22.db.gz
   # → mp6-2026-04-16_07-15-22.db
   ```
3. **Sanity-check** the file before touching production:
   ```bash
   sqlite3 mp6-2026-04-16_07-15-22.db "SELECT COUNT(*) FROM users;"
   sqlite3 mp6-2026-04-16_07-15-22.db "SELECT COUNT(*) FROM picks;"
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
cp masters-pick6.db masters-pick6.db.bak
gunzip -k backups/mp6-2026-04-16_02-15-00.db.gz
mv backups/mp6-2026-04-16_02-15-00.db masters-pick6.db
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

- [ ] Field is finalized in `mastersTiers.ts` (or equivalent)
- [ ] `tournaments.yaml` has the correct ESPN event ID for this year
- [ ] Lock dates in active pools point to the right start time
- [ ] Manually trigger a backup workflow run to confirm it still works
- [ ] Download that backup and spot-check
- [ ] Email delivery tested if you've wired up Resend

---

## 8. Troubleshooting

### Login suddenly returns 403
You probably changed `APP_URL` or deployed to a new domain. Browser sends an
`Origin` that doesn't match, CSRF rejects it. Fix `APP_URL` on Railway.

### "Picks aren't open yet for this tournament"
You created a pool for a tournament slug that doesn't have a registered tier
config. See [§3 – Adding tiers for another tournament](#adding-tiers-for-another-tournament-pga--us-open--the-open).

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

### Backup workflow fails with "not gzip"
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
├── tournaments.yaml                 ← YEARLY: ESPN IDs + dates
├── .github/workflows/backup.yml     ← nightly DB backup workflow
├── scripts/
│   ├── sync-schedule.js             ← builds schedule.json from YAML
│   └── backup.js                    ← local backup script (npm run backup)
├── src/
│   ├── app/
│   │   ├── account/                 ← user-facing account settings
│   │   ├── forgot/, reset/          ← password-reset UI
│   │   └── api/
│   │       ├── admin/backup/        ← protected endpoint GH Actions hits
│   │       ├── account/             ← DELETE /api/account (delete self)
│   │       ├── auth/                ← login/register/me/logout/forgot/reset
│   │       ├── pool/                ← create/list/patch + join/leave/member/transfer
│   │       └── picks/               ← save/get picks (tier validation here)
│   └── lib/
│       ├── auth.ts                  ← JWT session
│       ├── audit.ts                 ← write-only audit log
│       ├── db.ts                    ← SQLite + schema migrations
│       ├── email.ts                 ← Resend stub + dev logger
│       ├── mastersTiers.ts          ← PER-TOURNAMENT: tier assignments
│       ├── poolOps.ts               ← shared pool-membership mutations
│       ├── rateLimit.ts             ← in-memory rate limiting
│       ├── scoring.ts               ← best-5-of-6 standings calculation
│       ├── security.ts              ← CSRF, URL allowlist, pw policy, timing-safe eq
│       ├── tiers.ts                 ← tier lookup registry (add tournaments here)
│       └── tournaments/
│           ├── config.ts            ← PERMANENT: branding, colors, tier labels
│           └── schedule.json        ← GENERATED — do not edit
```

---

*Last updated: April 2026. If you change operational behavior, update this
document in the same PR.*
