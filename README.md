# 🏌️ Masters Pick 6

> *"I'm not saying my golf game is bad, but if I grew tomatoes, they'd come up sliced."* — Lee Trevino

The ultimate office pool app for The Masters Tournament. Pick 6 golfers across 4 tiers, and your best 5 of 6 combined to-par scores determine the winner. Live scoring. Zero spreadsheets. Finally, an excuse to watch golf at work. ⛳

## 🌲 What Is This?

Masters Pick 6 is a self-hosted web app for running a Masters Tournament office pool with your friends, coworkers, or anyone who thinks they know more about golf than they actually do.

**How it works:**

1. 🏠 **Create a pool** — get an invite code to share
2. 👥 **Friends join** — register an account and enter the code
3. 🎯 **Pick 6 golfers** across 4 OWGR-ranked tiers (1-2-2-1 format)
4. 📊 **Live leaderboard** — powered by ESPN, updates throughout the tournament
5. 🏆 **Best 5 of 6** — your top 5 golfers' scores count (one mulligan built in, because we all need one)

## ✨ Features

- **🎯 4-Tier Draft System** — golfers ranked by Official World Golf Rankings (OWGR), not vibes
- **📡 Live ESPN Scoring** — real-time leaderboard, no manual score entry
- **💰 Payment Tracking** — pool admins can add Venmo/PayPal/CashApp links and track who's paid
- **🔒 Lock Date** — picks lock before Round 1 tees off (no mid-tournament "adjustments")
- **📱 Mobile Friendly** — works on your phone because that's where you'll be checking it every 5 minutes
- **🛡️ Security** — bcrypt passwords, JWT sessions, rate limiting, input validation

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS v4 |
| Database | SQLite via better-sqlite3 |
| Auth | JWT (jose) + bcrypt |
| Scoring | ESPN public scoreboard API |
| Rankings | OWGR-based tier system |

## 🚀 Quick Start (Local Development)

```bash
# Clone it
git clone https://github.com/chadeckles/masters-pick-6.git
cd masters-pick-6

# Install dependencies
npm install

# Create your environment file
echo "JWT_SECRET=$(node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")" > .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're on the tee box. 🏌️‍♂️

## 🚂 Deploy on Railway (Recommended)

This app uses SQLite, so it needs a **persistent filesystem** — that rules out serverless platforms like Vercel. [Railway](https://railway.app) is the easiest option.

### Step-by-step:

1. **Fork this repo** (or push your own copy to GitHub)

2. **Create a new project on [Railway](https://railway.app)** → Deploy from GitHub repo

3. **Add a persistent volume:**
   - Go to your service → **Settings** → **Volumes**
   - Mount path: `/data`
   - This is where your SQLite database lives (survives redeploys)

4. **Set environment variables** (Settings → Variables):

   | Variable | Value |
   |----------|-------|
   | `JWT_SECRET` | Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `DATABASE_PATH` | `/data/masters-pick6.db` |
   | `NODE_ENV` | `production` |

5. **Deploy** — Railway auto-detects Next.js, runs `npm run build` and `npm start`

6. **You're live!** Share the Railway URL (or add a custom domain) with your pool members.

> ☝️ **Important:** Each deployment starts with a fresh database. First person to register and create a pool becomes the admin. Choose wisely — or just be fast.

## 📁 Project Structure

```
src/
├── app/                  # Next.js App Router pages & API routes
│   ├── api/              # REST endpoints (auth, picks, pool, standings, leaderboard)
│   ├── dashboard/        # Pool dashboard (admin controls, standings, payment tracking)
│   ├── picks/            # Golfer selection UI
│   └── leaderboard/      # Live tournament leaderboard
├── components/           # React components (Header, TierPicker, Leaderboard, etc.)
└── lib/                  # Core logic
    ├── db.ts             # SQLite database (auto-creates tables)
    ├── espn.ts           # ESPN API integration + caching
    ├── mastersTiers.ts   # OWGR-based tier assignments (91 golfers)
    ├── scoring.ts        # Best-5-of-6 scoring engine
    ├── auth.ts           # JWT session management
    └── constants.ts      # Tournament dates & config
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

MIT — use it, fork it, host your own pool. Just don't blame us when your Tier 4 pick misses the cut and your coworker won't stop talking about it until next April.

---

*Not affiliated with Augusta National Golf Club or the Masters Tournament. But we do dream about Amen Corner.* 🌸
