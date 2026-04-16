# 🏌️ Pick Six Golf

> *"I'm not saying my golf game is bad, but if I grew tomatoes, they'd come up sliced."* — Lee Trevino

The ultimate pick'em pool app for **every major championship in golf**. Pick 6 golfers across 4 tiers, and your best 5 of 6 combined to-par scores determine the winner. Live scoring. Zero spreadsheets. Finally, an excuse to watch golf at work. ⛳

## 🌲 What Is This?

Pick Six Golf is a self-hosted web app for running golf major championship pools with friends, family, coworkers, or anyone who thinks they know more about golf than they actually do.

**Supported Tournaments:**

| Tournament | When | Course (2026) |
|------------|------|---------------|
| 🟢 **The Masters** | April | Augusta National Golf Club |
| 🔵 **PGA Championship** | May | Quail Hollow Club |
| 🔴 **US Open** | June | Shinnecock Hills Golf Club |
| 🏴 **The Open** | July | Royal Portrush Golf Club |

**How it works:**

1. 🏠 **Create a pool** — get an invite code to share
2. 👥 **Friends join** — register an account and enter the code
3. 🎯 **Pick 6 golfers** across 4 OWGR-ranked tiers (1-2-2-1 format)
4. 📊 **Live leaderboard** — powered by ESPN, updates throughout the tournament
5. 🏆 **Best 5 of 6** — your top 5 golfers' scores count (one mulligan built in, because we all need one)

## ✨ Features

- **🎯 4-Tier Draft System** — golfers ranked by Official World Golf Rankings (OWGR), not vibes
- **⛳ Multi-Tournament** — switch between The Masters, PGA, US Open, and The Open from one app
- **🎨 Dynamic Theming** — each tournament gets its own color palette and branding, automatically
- **📡 Live ESPN Scoring** — real-time leaderboard, no manual score entry
- **💰 Payment Tracking** — pool admins can add Venmo/PayPal/CashApp links and track who's paid
- **🔒 Lock Date** — picks lock before Round 1 tees off (no mid-tournament "adjustments")
- **📱 Mobile Friendly** — works on your phone because that's where you'll be checking it every 5 minutes
- **🛡️ Security** — bcrypt passwords, JWT sessions, rate limiting, input validation
- **♿ Accessible** — focus-visible styles, reduced-motion support

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS v4 |
| Database | SQLite via better-sqlite3 |
| Auth | JWT (jose) + bcrypt |
| Scoring | ESPN public scoreboard API |
| Rankings | OWGR-based tier system |
| Config | YAML schedule → auto-generated JSON |

## 🚀 Quick Start (Local Development)

```bash
# Clone it
git clone https://github.com/chadeckles/masters-pick-6.git
cd masters-pick-6

# Install dependencies
npm install

# Create your environment file
echo "JWT_SECRET=$(node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")" > .env.local

# Start the dev server (auto-syncs tournaments.yaml → schedule.json)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're on the tee box. 🏌️‍♂️

## 📅 Yearly Maintenance

Tournament dates, courses, and ESPN event IDs change every year. Updating is dead simple — edit **one file**:

### `tournaments.yaml` (project root)

```yaml
# ── THE MASTERS ────────────────────────────────────────
masters:
  2026: { espnId: "401811941", month: 4, start: 9,  end: 12 }
  2027: { espnId: "",          month: 4, start: 8,  end: 11 }  # espnId TBD

# ── PGA CHAMPIONSHIP ──────────────────────────────────
pga:
  2026: { espnId: "401811947", month: 5, start: 14, end: 17 }
  2027: { espnId: "", month: 5, start: 13, end: 16, course: "Aronimink GC", par: 70 }
```

**That's it.** One line per tournament per year. If a course changes (like the PGA does annually), add `course:` and `par:` to that year's line.

**How to find ESPN event IDs:**
1. Go to [espn.com/golf/leaderboard](https://www.espn.com/golf/leaderboard)
2. Click the tournament
3. The URL contains `?tournamentId=XXXXXXX` — that's your ID

When you run `npm run dev` or `npm run build`, the YAML is automatically synced to JSON. You can also run `npm run sync` manually.

> 💡 **Colors, themes, tier labels, logos, and branding** live in `src/lib/tournaments/config.ts` — you almost never need to touch that file.

## 🚂 Deploy on Railway (Recommended)

This app uses SQLite, so it needs a **persistent filesystem** — that rules out serverless platforms like Vercel. [Railway](https://railway.app) is the easiest option.

### Step 1: Connect Your Repo

1. Sign up at [railway.app](https://railway.app) (free trial includes $5 credit — plenty for a pool)
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `masters-pick-6` repository
4. Railway will immediately start building — let it run while you do the next steps

### Step 2: Set Environment Variables

Click into your service → **Variables** tab → add these **4 variables**:

| Variable | Value | Why |
|----------|-------|-----|
| `JWT_SECRET` | *(see below)* | Signs auth tokens — keeps sessions secure |
| `DATABASE_PATH` | `/data/masters-pick6.db` | Points to the persistent volume |
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `3000` | Railway defaults to 8080, but Next.js listens on 3000 |

**🔑 Generating your JWT_SECRET:**

Run this in any terminal (VS Code, macOS Terminal, etc.):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the output and paste it as the `JWT_SECRET` value. Use a **different** secret for production vs. local development.

### Step 3: Add a Persistent Volume ⚠️ Critical

Without a volume, your database (all users, pools, picks) gets **wiped on every redeploy**. This is the most important step.

> ⚠️ Volumes are **NOT** in the service settings — they're added from the **project canvas**.

1. Go back to the **main project view** (click your project name at the top)
2. Click the **"+ New"** button on the canvas (or right-click on the canvas)
3. Select **"Volume"**
4. Set **Mount Path** to `/data`
5. Click **"Attach volume to service"** → select `masters-pick-6`
6. Save — Railway will redeploy automatically

### Step 4: Set Up Public Networking

1. Click into your service → **Settings** tab
2. Scroll to **Networking** → **Public Networking**
3. Click **"Generate Domain"** — Railway gives you a free HTTPS URL like:
   ```
   masters-pick-6-production.up.railway.app
   ```
4. ⚡ **Port:** Make sure the port is set to **3000** (or whatever you set in the `PORT` variable). Railway may default to 8080 — update it to match.

That's your shareable link! Send it to your pool members.

### Step 5 (Optional): Custom Domain

If you own a domain (e.g., `picksixgolf.com`):

1. In **Settings → Networking**, click **"Custom Domain"** and enter your domain
2. Railway shows you **2 DNS records** to add (a CNAME and a TXT record)
3. Go to your domain registrar (Namecheap, GoDaddy, etc.) → DNS settings → add both records
4. Wait ~10 minutes for DNS propagation
5. Done — your custom domain now points to your app with automatic HTTPS

> 💡 Not required — the free `.up.railway.app` URL works perfectly for a pool with friends.

### 🎬 You're Live!

Once deployed, visit your Railway URL. The first person to **register and create a pool** becomes the admin. Share the **invite code** with friends and start picking golfers.

> ☝️ **Remember:** The production database is separate from your local dev database. Everyone starts fresh on the live site.

## 📁 Project Structure

```
tournaments.yaml              ← Edit this yearly (dates, ESPN IDs, courses)
scripts/
└── sync-schedule.js          ← Converts YAML → JSON (runs automatically)
src/
├── app/                      # Next.js App Router pages & API routes
│   ├── api/                  # REST endpoints (auth, picks, pool, standings, leaderboard)
│   ├── dashboard/            # Pool dashboard (admin controls, standings, payment tracking)
│   ├── picks/                # Golfer selection UI
│   └── leaderboard/          # Live tournament leaderboard
├── components/               # React components
│   ├── Header.tsx            # Nav bar with tournament switcher dropdown
│   ├── Footer.tsx            # Dynamic footer with tournament disclaimer
│   ├── TournamentBar.tsx     # Subtle context bar (tournament • course • dates)
│   ├── TournamentLogo.tsx    # Swaps logo per tournament
│   ├── TournamentProvider.tsx # React context for active tournament + theme
│   ├── TierPicker.tsx        # Golfer draft UI
│   ├── Leaderboard.tsx       # Live ESPN leaderboard table
│   ├── PoolStandings.tsx     # Pool member rankings
│   └── PoolManager.tsx       # Create/join pool flow
└── lib/                      # Core logic
    ├── db.ts                 # SQLite database (auto-creates tables)
    ├── espn.ts               # ESPN API integration + caching
    ├── mastersTiers.ts       # OWGR-based tier assignments
    ├── scoring.ts            # Best-5-of-6 scoring engine
    ├── auth.ts               # JWT session management
    ├── constants.ts          # Current year
    └── tournaments/
        ├── config.ts         # Tournament definitions (themes, tiers, branding) + YAML merge
        └── schedule.json     # Auto-generated from tournaments.yaml (gitignored)
```

## 🎯 Tier System

Golfers are assigned to tiers based on Official World Golf Rankings:

| Tier | OWGR Range | Picks | Description |
|------|-----------|-------|-------------|
| ⭐ Tier 1 | 1–10 | 1 pick | The cream of the crop |
| 🔥 Tier 2 | 11–25 | 2 picks | Contenders who can heat up |
| 💪 Tier 3 | 26–50 | 2 picks | Dangerous mid-range talent |
| 🎲 Tier 4 | 51+ / Past Champs / Amateurs | 1 pick | Your wildcard — glory or heartbreak |

Your best 5 of 6 scores count. That Tier 4 gamble on a past champion could win it all... or it might be the one you're glad doesn't count. 😅

## 🧮 Scoring

- **To-par scoring** — lower is better (just like real golf)
- **Cut penalty** — if your golfer misses the cut, they get 80 strokes for each missed round
- **Best 5 of 6** — your worst golfer's score is dropped
- **Tiebreaker** — lowest individual golfer score wins the tie

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Secret key for signing auth tokens. Generate a strong one. |
| `DATABASE_PATH` | No | Path to SQLite file. Defaults to `./masters-pick6.db` |
| `NODE_ENV` | No | Set to `production` for deployed environments |

## 🤝 Contributing

Found a bug? Want to add a feature? PRs welcome. Just remember:

> *"The most important shot in golf is the next one."* — Ben Hogan

So don't worry about the last commit — focus on the next one.

## 📜 License

MIT — use it, fork it, host your own pool. Just don't blame us when your Tier 4 pick misses the cut and your coworker won't stop talking about it until the next major.

---

*Not affiliated with Augusta National, the PGA of America, the USGA, or The R&A. But we do dream about Sunday back nines at the majors.* ⛳
