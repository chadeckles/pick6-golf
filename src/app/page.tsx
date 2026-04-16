"use client";

import Link from "next/link";
import Image from "next/image";
import { CURRENT_YEAR } from "@/lib/constants";
import {
  UserIcon,
  TargetIcon,
  ChartIcon,
  TrophyIcon,
  FlagIcon,
  ClipboardIcon,
  ClickIcon,
} from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";
import { getActiveTournaments } from "@/lib/tournaments/config";

export default function Home() {
  const { tournament, setTournament } = useTournament();
  const allTournaments = getActiveTournaments();

  const tierLabels = tournament.tierLabels ?? {
    1: { name: "Elite", range: "Top 10", desc: "The favorites." },
    2: { name: "Contenders", range: "11-25", desc: "Strong players." },
    3: { name: "Dark Horses", range: "26-50", desc: "Find the sleepers." },
    4: { name: "Longshots", range: "51+", desc: "High risk, high reward." },
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative hero-gradient overflow-hidden">
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-28 text-center">
          <Image
            src="/logos/pick-six-golf.png"
            alt="Pick Six Golf"
            width={220}
            height={186}
            className="mx-auto mb-4 drop-shadow-lg"
            priority
            style={{ width: "auto", height: "auto" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />

          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            Pick Six Golf
          </h1>
          <p className="text-xl sm:text-2xl text-t-accent font-medium mb-2">
            Your Major Championship Pool
          </p>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-10">
            Pick 6 golfers across 4 tiers. Best 5 of 6 combined to-par scores
            wins. Play with friends for any major championship.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-t-accent text-t-primary-dark px-8 py-4 rounded-xl text-lg font-bold hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <ClickIcon className="w-5 h-5" /> Join a Pool
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white border border-white/30 px-8 py-4 rounded-xl text-lg font-bold hover:bg-white/20 transition-all"
            >
              <FlagIcon className="w-5 h-5" /> View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Tournament Selector */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">
          Choose Your Tournament
        </h2>
        <p className="text-center text-gray-500 mb-10 max-w-2xl mx-auto">
          Pick Six Golf runs pools for every major championship. Select a tournament to get started.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {allTournaments.map((t) => {
            const isActive = t.slug === tournament.slug;
            const dates = t.dates[CURRENT_YEAR];
            const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const dateStr = dates
              ? `${monthNames[dates.month]} ${dates.start}–${dates.end}, ${CURRENT_YEAR}`
              : `${CURRENT_YEAR}`;

            // Distinct card header colors so the tiles aren't all blue
            const cardColors: Record<string, string> = {
              masters: t.theme.primary,
              pga: t.theme.accent,        // gold
              usopen: t.theme.accent,      // red
              theopen: t.theme.primary,
              rydercup: t.theme.primary,
            };
            const headerColor = cardColors[t.slug] ?? t.theme.primary;

            return (
              <button
                key={t.slug}
                onClick={() => setTournament(t.slug)}
                className={`text-left rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all card-hover border-2 flex flex-col h-full ${
                  isActive ? "border-current ring-2 ring-offset-2" : "border-transparent"
                }`}
                style={{
                  borderColor: isActive ? t.theme.primary : "transparent",
                  ...(isActive ? { ringColor: t.theme.primary } : {}),
                }}
              >
                <div
                  className="px-5 py-4"
                  style={{
                    backgroundColor: headerColor,
                    color: t.slug === "pga" ? t.theme.primaryDark : "#ffffff",
                  }}
                >
                  <h3 className="font-bold text-lg">{t.name}</h3>
                  <p className="text-sm" style={{ opacity: 0.7 }}>{dateStr}</p>
                </div>
                <div className="bg-white p-4 flex flex-col flex-1">
                  <p className="text-sm text-gray-600 mb-2 flex-1">{t.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{t.course}</span>
                    {isActive && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: t.theme.primary }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 stagger-children">
            {[
              {
                step: "1",
                title: "Register",
                desc: "Create your account and join or create a pool with friends.",
                icon: <UserIcon className="w-7 h-7 text-t-primary" />,
              },
              {
                step: "2",
                title: "Pick Your 6",
                desc: "Draft one golfer per tier — see the tier breakdown below.",
                icon: <TargetIcon className="w-7 h-7 text-t-primary" />,
              },
              {
                step: "3",
                title: "Watch & Track",
                desc: "Follow live scoring on the dashboard as the tournament unfolds.",
                icon: <ChartIcon className="w-7 h-7 text-t-primary" />,
              },
              {
                step: "4",
                title: "Win!",
                desc: "Lowest combined to-par score from your best 5 of 6 picks wins.",
                icon: <TrophyIcon className="w-7 h-7 text-t-primary" />,
              },
            ].map((item, idx) => (
              <div
                key={item.step}
                className="text-center bg-t-cream rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 bg-t-primary text-white rounded-full text-sm font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tier Breakdown */}
      <section className="pt-16 pb-8">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Tier System
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            Players are divided into 4 tiers based on the Official World Golf
            Rankings (OWGR). Pick strategically — your worst golfer is dropped!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {[
              { tier: 1, picks: 1, color: "bg-t-primary" },
              { tier: 2, picks: 2, color: "bg-cyan-600" },
              { tier: 3, picks: 2, color: "bg-violet-600" },
              { tier: 4, picks: 1, color: "bg-orange-700" },
            ].map((t) => {
              const label = tierLabels[t.tier];
              return (
                <div
                  key={t.tier}
                  className="rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow card-hover"
                >
                  <div className={`${t.color} px-4 py-3 text-center`}>
                    <span className="text-white font-bold text-lg">
                      Tier {t.tier}
                    </span>
                    <span className="text-white/80 text-sm block">
                      {label?.name}
                    </span>
                  </div>
                  <div className="bg-white p-4 text-center">
                    <p className="font-bold text-gray-900 mb-1">
                      Ranked {label?.range}
                    </p>
                    <p className="text-t-primary font-bold mb-2">
                      Pick {t.picks}
                    </p>
                    <p className="text-gray-500 text-xs">{label?.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Scoring Rules */}
      <section className="max-w-5xl mx-auto px-4 pt-8 pb-16">
        <div className="bg-t-cream rounded-2xl p-8 sm:p-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <ClipboardIcon className="w-6 h-6 text-t-primary" /> Scoring Rules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-t-primary mb-3">
                Basic Scoring
              </h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex gap-2">
                  <span className="text-t-primary font-bold">•</span>
                  6 picks across 4 OWGR-based tiers (1-2-2-1)
                </li>
                <li className="flex gap-2">
                  <span className="text-t-primary font-bold">•</span>
                  Your worst golfer&apos;s score is dropped (best 5 of 6 count)
                </li>
                <li className="flex gap-2">
                  <span className="text-t-primary font-bold">•</span>
                  Lowest combined to-par score wins
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-t-primary mb-3">
                Special Rules
              </h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex gap-2">
                  <span className="text-t-highlight font-bold">•</span>
                  Missed cut: Golfer receives 80 strokes per remaining round
                </li>
                <li className="flex gap-2">
                  <span className="text-t-highlight font-bold">•</span>
                  Withdrawals treated same as missed cuts
                </li>
                <li className="flex gap-2">
                  <span className="text-t-highlight font-bold">•</span>
                  Tiebreaker: Total strokes across all 4 rounds
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="hero-gradient py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Play?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Picks lock when Round 1 tee times begin. Don&apos;t miss out!
          </p>
          <Link
            href="/register"
            className="inline-block bg-t-accent text-t-primary-dark px-10 py-4 rounded-xl text-lg font-bold hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            Create Your Account →
          </Link>
        </div>
      </section>
    </div>
  );
}
