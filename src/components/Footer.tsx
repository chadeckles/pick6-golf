"use client";

import { useTournament } from "@/components/TournamentProvider";
import { CURRENT_YEAR } from "@/lib/constants";

export default function Footer() {
  const { tournament } = useTournament();

  return (
    <footer className="bg-t-primary-dark text-white/50 py-6">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <p>Pick Six Golf © {CURRENT_YEAR}</p>
        <p>Live scoring powered by ESPN • Rankings via OWGR</p>
      </div>
      <div className="max-w-5xl mx-auto px-4 mt-2 text-center">
        <p className="text-white/30 text-[10px]">{tournament.disclaimer}</p>
      </div>
    </footer>
  );
}
