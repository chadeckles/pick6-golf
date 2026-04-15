"use client";

import { useEffect, useState, useCallback } from "react";
import type { GolferInfo } from "@/lib/types";
import { FlagIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";

export default function Leaderboard() {
  const { tournament } = useTournament();
  const [golfers, setGolfers] = useState<GolferInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard?tournament=${tournament.slug}`);
      const data = await res.json();
      if (data.golfers) {
        setGolfers(data.golfers);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [tournament.slug]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-masters-green green-pattern px-6 py-4 flex items-center justify-between">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <FlagIcon className="w-5 h-5" /> Leaderboard
        </h2>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-masters-yellow text-xs">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-300 text-xs font-medium">LIVE</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-masters-cream border-b border-masters-green/10">
              <th className="px-3 py-2 text-left text-xs font-bold text-masters-green uppercase tracking-wider w-16">
                Pos
              </th>
              <th className="px-3 py-2 text-left text-xs font-bold text-masters-green uppercase tracking-wider">
                Player
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-20">
                To Par
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-16">
                Thru
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-12">
                R1
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-12">
                R2
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-12">
                R3
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-12">
                R4
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold text-masters-green uppercase tracking-wider w-16">
                Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {golfers.map((golfer, idx) => (
              <tr
                key={golfer.id}
                className={`leaderboard-row border-b border-gray-100 transition-colors ${
                  golfer.status === "cut" ? "status-cut bg-red-50/50" : ""
                } ${
                  idx < 3 ? "bg-masters-yellow/5" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                } hover:bg-masters-yellow/10`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <td className="px-3 py-2">
                  <span className="font-bold text-sm text-gray-700">
                    {golfer.position || idx + 1}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {golfer.imageUrl && (
                      <img
                        src={golfer.imageUrl}
                        alt={golfer.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    )}
                    <span className="font-medium text-sm">{golfer.name}</span>
                    {golfer.status === "cut" && (
                      <span className="text-xs text-red-500 font-medium ml-1">
                        CUT
                      </span>
                    )}
                    {golfer.status === "wd" && (
                      <span className="text-xs text-orange-500 font-medium ml-1">
                        WD
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`font-mono font-bold ${
                      (golfer.toPar ?? 0) < 0
                        ? "text-red-600"
                        : (golfer.toPar ?? 0) === 0
                          ? "text-gray-700"
                          : "text-gray-900"
                    }`}
                  >
                    {golfer.toPar !== null
                      ? golfer.toPar === 0
                        ? "E"
                        : golfer.toPar > 0
                          ? `+${golfer.toPar}`
                          : golfer.toPar
                      : "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-sm text-gray-500">
                  {golfer.thru || "—"}
                </td>
                {[0, 1, 2, 3].map((r) => (
                  <td
                    key={r}
                    className="px-3 py-2 text-center text-sm font-mono text-gray-600"
                  >
                    {golfer.rounds[r] ?? "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <span className={`tier-badge tier-${golfer.tier}`}>
                    T{golfer.tier}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {golfers.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <p>No leaderboard data available yet.</p>
          <p className="text-sm mt-1">
            Data will appear once the tournament begins.
          </p>
        </div>
      )}
    </div>
  );
}
