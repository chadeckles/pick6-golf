"use client";

import { useTournament } from "@/components/TournamentProvider";
import { CURRENT_YEAR } from "@/lib/constants";

/**
 * A subtle tournament identity strip for inner pages.
 * Shows the tournament name, course, and dates so users always
 * know which tournament context they're in.
 */
export default function TournamentBar() {
  const { tournament } = useTournament();

  const dates = tournament.dates[CURRENT_YEAR];
  const monthNames = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dateStr = dates
    ? `${monthNames[dates.month]} ${dates.start}–${dates.end}, ${CURRENT_YEAR}`
    : String(CURRENT_YEAR);

  return (
    <div className="bg-t-primary/5 border-b border-t-primary/10">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: tournament.theme.primary }}
          />
          <span className="font-bold text-t-primary">{tournament.name}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">{tournament.course}</span>
        </div>
        <span className="text-gray-400 hidden sm:inline">{dateStr}</span>
      </div>
    </div>
  );
}
