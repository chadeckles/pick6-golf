"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import type { PoolEntry } from "@/lib/types";
import { TrophyIcon } from "@/components/Icons";

export default function PoolStandings() {
  const [standings, setStandings] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStandings = useCallback(async () => {
    try {
      const res = await fetch("/api/standings");
      const data = await res.json();
      if (data.standings) {
        setStandings(data.standings);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch standings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandings();
    // Auto-refresh every 60 seconds during tournament
    const interval = setInterval(fetchStandings, 60_000);
    return () => clearInterval(interval);
  }, [fetchStandings]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <p className="text-gray-500">
          No entries yet. Invite friends to join and make their picks!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-masters-green green-pattern px-6 py-4 flex items-center justify-between">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <TrophyIcon className="w-5 h-5" /> Pool Standings
        </h2>
        {lastUpdate && (
          <span className="text-masters-yellow text-xs">
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-masters-cream border-b border-masters-green/10">
              <th className="px-4 py-3 text-left text-xs font-bold text-masters-green uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-masters-green uppercase tracking-wider">
                Player
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-masters-green uppercase tracking-wider">
                Best 5 Total
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-masters-green uppercase tracking-wider">
                Picks
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry, idx) => (
              <Fragment key={entry.userId}>
                <tr
                  className={`leaderboard-row border-b border-gray-100 cursor-pointer transition-colors ${
                    idx === 0
                      ? "bg-masters-yellow/10"
                      : idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/50"
                  } hover:bg-masters-yellow/5`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() =>
                    setExpandedUser(
                      expandedUser === entry.userId ? null : entry.userId
                    )
                  }
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        entry.rank === 1
                          ? "bg-masters-yellow text-masters-green-dark"
                          : entry.rank === 2
                            ? "bg-gray-200 text-gray-700"
                            : entry.rank === 3
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">
                      {entry.userName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`font-mono font-bold text-lg ${
                        entry.best5Total < 0
                          ? "text-red-600"
                          : entry.best5Total === 0
                            ? "text-gray-700"
                            : "text-gray-900"
                      }`}
                    >
                      {entry.best5Total === 0
                        ? "E"
                        : entry.best5Total > 0
                          ? `+${entry.best5Total}`
                          : entry.best5Total}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-500 text-sm">
                      {expandedUser === entry.userId ? "▲" : "▼"}{" "}
                      {entry.picks.length} picks
                    </span>
                  </td>
                </tr>

                {/* Expanded picks */}
                {expandedUser === entry.userId && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 bg-masters-sky/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {entry.picks.map((pick) => (
                          <div
                            key={pick.golferId}
                            className={`flex items-center gap-2 p-2 rounded-lg ${
                              pick.isDropped
                                ? "bg-red-50 opacity-50"
                                : "bg-white"
                            } ${pick.status === "cut" ? "status-cut" : ""}`}
                          >
                            <span
                              className={`tier-badge tier-${pick.tier}`}
                            >
                              T{pick.tier}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {pick.golferName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {pick.position && `Pos: ${pick.position}`}
                                {pick.thru && ` • Thru ${pick.thru}`}
                                {pick.isDropped && " (dropped)"}
                              </p>
                            </div>
                            <span
                              className={`font-mono font-bold text-sm ${
                                (pick.totalScore ?? 0) < 0
                                  ? "text-red-600"
                                  : (pick.totalScore ?? 0) === 0
                                    ? "text-gray-600"
                                    : "text-gray-900"
                              }`}
                            >
                              {pick.totalScore !== null
                                ? pick.totalScore === 0
                                  ? "E"
                                  : pick.totalScore > 0
                                    ? `+${pick.totalScore}`
                                    : pick.totalScore
                                : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
