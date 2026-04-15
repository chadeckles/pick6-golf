"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GolferInfo, TieredGolfers } from "@/lib/types";
import { CheckIcon, GolferIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";

interface PickSelection {
  golferId: string;
  golferName: string;
  tier: number;
}

function getTierConfig(tierLabels?: Record<number, { name: string; range: string; desc: string }>) {
  const labels = tierLabels ?? {
    1: { name: "Elite", range: "Top 10", desc: "" },
    2: { name: "Contenders", range: "11-25", desc: "" },
    3: { name: "Dark Horses", range: "26-50", desc: "" },
    4: { name: "Longshots", range: "51+", desc: "" },
  };
  return [
    { tier: 1, label: `Tier 1 — ${labels[1].name}`, description: `${labels[1].range}. Pick 1.`, maxPicks: 1, color: "masters-green" },
    { tier: 2, label: `Tier 2 — ${labels[2].name}`, description: `${labels[2].range}. Pick 2.`, maxPicks: 2, color: "cyan-600" },
    { tier: 3, label: `Tier 3 — ${labels[3].name}`, description: `${labels[3].range}. Pick 2.`, maxPicks: 2, color: "violet-600" },
    { tier: 4, label: `Tier 4 — ${labels[4].name}`, description: `${labels[4].range}. Pick 1.`, maxPicks: 1, color: "orange-700" },
  ];
}

export default function TierPicker() {
  const router = useRouter();
  const { tournament } = useTournament();
  const TIER_CONFIG = getTierConfig(tournament.tierLabels);
  const [tiers, setTiers] = useState<TieredGolfers | null>(null);
  const [selections, setSelections] = useState<PickSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingPicks, setExistingPicks] = useState<PickSelection[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [tierRes, picksRes] = await Promise.all([
        fetch(`/api/leaderboard?tiered=true&tournament=${tournament.slug}`),
        fetch("/api/picks"),
      ]);
      const tierData = await tierRes.json();
      const picksData = await picksRes.json();

      if (tierData.tiers) setTiers(tierData.tiers);
      if (picksData.picks?.length > 0) {
        const mapped = picksData.picks.map(
          (p: { golferId: string; golferName: string; tier: number }) => ({
            golferId: p.golferId,
            golferName: p.golferName,
            tier: p.tier,
          })
        );
        setSelections(mapped);
        setExistingPicks(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch tier data:", err);
    } finally {
      setLoading(false);
    }
  }, [tournament.slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleGolfer(golfer: GolferInfo, tier: number) {
    const config = TIER_CONFIG.find((t) => t.tier === tier)!;
    const tierSelections = selections.filter((s) => s.tier === tier);
    const isSelected = selections.some((s) => s.golferId === golfer.id);

    if (isSelected) {
      setSelections(selections.filter((s) => s.golferId !== golfer.id));
    } else if (tierSelections.length < config.maxPicks) {
      setSelections([
        ...selections,
        { golferId: golfer.id, golferName: golfer.name, tier },
      ]);
    }
    setError("");
    setSuccess("");
  }

  async function handleSubmit() {
    // Validate all tiers are filled
    for (const config of TIER_CONFIG) {
      const count = selections.filter((s) => s.tier === config.tier).length;
      if (count !== config.maxPicks) {
        setError(
          `${config.label}: Select exactly ${config.maxPicks} player(s)`
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: selections }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save picks");
        return;
      }

      setSuccess("Picks saved successfully!");
      setExistingPicks(selections);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setError("Failed to save picks");
    } finally {
      setSaving(false);
    }
  }

  const totalPicks = selections.length;
  const isComplete = totalPicks === 6;
  const hasChanges =
    JSON.stringify(selections) !== JSON.stringify(existingPicks);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-md p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!tiers) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <p className="text-gray-500">
          Unable to load player data. Please try again later.
        </p>
      </div>
    );
  }

  const tierGolfers: Record<number, GolferInfo[]> = {
    1: tiers.tier1,
    2: tiers.tier2,
    3: tiers.tier3,
    4: tiers.tier4,
  };

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Picks: {totalPicks} / 6
          </span>
          {isComplete && (
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <CheckIcon className="w-4 h-4" /> All picks made
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-masters-green rounded-full h-3 transition-all duration-500"
            style={{ width: `${(totalPicks / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Tier sections */}
      {TIER_CONFIG.map((config) => {
        const golfers = tierGolfers[config.tier] || [];
        const tierSelections = selections.filter(
          (s) => s.tier === config.tier
        );
        const isFull = tierSelections.length >= config.maxPicks;

        return (
          <div
            key={config.tier}
            className="bg-white rounded-xl shadow-md overflow-hidden"
          >
            <div
              className={`px-6 py-4 flex items-center justify-between ${
                config.tier === 1
                  ? "bg-masters-green"
                  : config.tier === 2
                    ? "bg-cyan-600"
                    : config.tier === 3
                      ? "bg-violet-600"
                      : "bg-orange-700"
              }`}
            >
              <div>
                <h3 className="text-white font-bold">{config.label}</h3>
                <p className="text-white/80 text-sm">{config.description}</p>
              </div>
              <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold">
                {tierSelections.length} / {config.maxPicks}
              </span>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {golfers.map((golfer) => {
                const isSelected = selections.some(
                  (s) => s.golferId === golfer.id
                );
                const isDisabled = !isSelected && isFull;

                return (
                  <button
                    key={golfer.id}
                    onClick={() => toggleGolfer(golfer, config.tier)}
                    disabled={isDisabled}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? "border-masters-green bg-masters-green/5 shadow-md"
                        : isDisabled
                          ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                          : "border-gray-200 hover:border-masters-green/50 hover:bg-masters-cream cursor-pointer"
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "border-masters-green bg-masters-green"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {golfer.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Rank #{golfer.rank}
                        {golfer.toPar !== null && (
                          <span className="ml-2">
                            ({golfer.toPar === 0
                              ? "E"
                              : golfer.toPar > 0
                                ? `+${golfer.toPar}`
                                : golfer.toPar}
                            )
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Headshot */}
                    {golfer.imageUrl && (
                      <img
                        src={golfer.imageUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Submit button */}
      <div className="sticky bottom-4 z-10">
        <button
          onClick={handleSubmit}
          disabled={!isComplete || saving || !hasChanges}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
            isComplete && hasChanges
              ? "bg-masters-green text-white hover:bg-masters-green-dark active:scale-[0.98]"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {saving
            ? "Saving..."
            : !hasChanges && existingPicks.length > 0
              ? "Picks Saved"
              : isComplete
                ? "Lock In My Picks"
                : `Select ${6 - totalPicks} more player${6 - totalPicks !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
