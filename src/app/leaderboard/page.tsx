"use client";

import LeaderboardComponent from "@/components/Leaderboard";
import { FlagIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";
import TournamentBar from "@/components/TournamentBar";

export default function LeaderboardPage() {
  const { tournament } = useTournament();

  return (
    <>
    <TournamentBar />
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FlagIcon className="w-6 h-6 text-t-primary" /> {tournament.name} Leaderboard
        </h1>
        <p className="text-gray-500 mt-1">
          Live scores from the {tournament.fullName} at {tournament.course}.
          Auto-refreshes every 30 seconds.
        </p>
      </div>

      <LeaderboardComponent />
    </div>
    </>
  );
}
