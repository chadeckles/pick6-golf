"use client";

import Link from "next/link";
import MastersLogo from "@/components/MastersLogo";
import { CURRENT_YEAR } from "@/lib/constants";
import {
  UserIcon,
  TargetIcon,
  ChartIcon,
  TrophyIcon,
  FlagIcon,
  ClipboardIcon,
  GolferIcon,
} from "@/components/Icons";

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-masters-green green-pattern overflow-hidden">
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
            <div className="w-2 h-2 bg-masters-yellow rounded-full animate-pulse" />
            <span className="text-masters-yellow text-sm font-medium">
              The Masters — April {CURRENT_YEAR}
            </span>
          </div>

          <MastersLogo width={260} height={220} className="mx-auto mb-4 drop-shadow-lg" />

          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            Masters Pick 6
          </h1>
          <p className="text-xl sm:text-2xl text-masters-yellow font-medium mb-2">
            The Ultimate Office Pool
          </p>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-10">
            Pick 6 golfers across 4 tiers. Best 5 of 6 combined to-par scores
            wins.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-masters-yellow text-masters-green-dark px-8 py-4 rounded-xl text-lg font-bold hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <GolferIcon className="w-5 h-5" /> Join the Pool
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

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 stagger-children">
          {[
            {
              step: "1",
              title: "Register",
              desc: "Create your account and join or create a pool with friends.",
              icon: <UserIcon className="w-7 h-7 text-masters-green" />,
            },
            {
              step: "2",
              title: "Pick Your 6",
              desc: "Draft one golfer per tier — see the tier breakdown below.",
              icon: <TargetIcon className="w-7 h-7 text-masters-green" />,
            },
            {
              step: "3",
              title: "Watch & Track",
              desc: "Follow live scoring on the dashboard as the Masters unfolds.",
              icon: <ChartIcon className="w-7 h-7 text-masters-green" />,
            },
            {
              step: "4",
              title: "Win!",
              desc: "Lowest combined to-par score from your best 5 of 6 picks wins.",
              icon: <TrophyIcon className="w-7 h-7 text-masters-green" />,
            },
          ].map((item, idx) => (
            <div
              key={item.step}
              className="text-center bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="w-14 h-14 bg-masters-cream rounded-full flex items-center justify-center mx-auto mb-4">
                {item.icon}
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 bg-masters-green text-white rounded-full text-sm font-bold mb-3">
                {item.step}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tier Breakdown */}
      <section className="bg-white py-16">
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
              {
                tier: 1,
                name: "Elite",
                range: "Top 10",
                picks: 1,
                color: "bg-masters-green",
                desc: "The favorites. Consistent but everyone wants them.",
              },
              {
                tier: 2,
                name: "Contenders",
                range: "11-25",
                picks: 2,
                color: "bg-cyan-600",
                desc: "Strong players who can surprise. Your backbone.",
              },
              {
                tier: 3,
                name: "Dark Horses",
                range: "26-50",
                picks: 2,
                color: "bg-violet-600",
                desc: "This is where pools are won. Find the sleepers.",
              },
              {
                tier: 4,
                name: "Longshots",
                range: "51+",
                picks: 1,
                color: "bg-orange-700",
                desc: "High risk, high reward. Augusta magic happens.",
              },
            ].map((tier) => (
              <div
                key={tier.tier}
                className="rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow card-hover"
              >
                <div className={`${tier.color} px-4 py-3 text-center`}>
                  <span className="text-white font-bold text-lg">
                    Tier {tier.tier}
                  </span>
                  <span className="text-white/80 text-sm block">
                    {tier.name}
                  </span>
                </div>
                <div className="bg-white p-4 text-center">
                  <p className="font-bold text-gray-900 mb-1">
                    Ranked {tier.range}
                  </p>
                  <p className="text-masters-green font-bold mb-2">
                    Pick {tier.picks}
                  </p>
                  <p className="text-gray-500 text-xs">{tier.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring Rules */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="bg-masters-cream rounded-2xl p-8 sm:p-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <ClipboardIcon className="w-6 h-6 text-masters-green" /> Scoring Rules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-masters-green mb-3">
                Basic Scoring
              </h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex gap-2">
                  <span className="text-masters-green font-bold">•</span>
                  6 picks across 4 OWGR-based tiers (1-2-2-1)
                </li>
                <li className="flex gap-2">
                  <span className="text-masters-green font-bold">•</span>
                  Your worst golfer&apos;s score is dropped (best 5 of 6 count)
                </li>
                <li className="flex gap-2">
                  <span className="text-masters-green font-bold">•</span>
                  Lowest combined to-par score wins
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-masters-green mb-3">
                Special Rules
              </h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex gap-2">
                  <span className="text-masters-azalea font-bold">•</span>
                  Missed cut: Golfer receives 80 strokes per remaining round
                </li>
                <li className="flex gap-2">
                  <span className="text-masters-azalea font-bold">•</span>
                  Withdrawals treated same as missed cuts
                </li>
                <li className="flex gap-2">
                  <span className="text-masters-azalea font-bold">•</span>
                  Tiebreaker: Total strokes across all 4 rounds
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-masters-green green-pattern py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Play?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Picks lock when Round 1 tee times begin. Don&apos;t miss out!
          </p>
          <Link
            href="/register"
            className="inline-block bg-masters-yellow text-masters-green-dark px-10 py-4 rounded-xl text-lg font-bold hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            Create Your Account →
          </Link>
        </div>
      </section>
    </div>
  );
}
