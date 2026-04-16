"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierPicker from "@/components/TierPicker";
import { TargetIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";
import TournamentBar from "@/components/TournamentBar";

export default function PicksPage() {
  const router = useRouter();
  const { tournament } = useTournament();
  const [authorized, setAuthorized] = useState(false);
  const [hasPool, setHasPool] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const [meRes, poolRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/pool"),
        ]);
        const meData = await meRes.json();
        const poolData = await poolRes.json();

        if (!meData.user) {
          router.push("/login");
          return;
        }
        setAuthorized(true);

        if (poolData.pool) {
          setHasPool(true);
        }
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  if (!hasPool) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Join a Pool First
          </h2>
          <p className="text-gray-500 mb-4">
            You need to join or create a pool before making picks.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-t-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-t-primary-dark transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <TournamentBar />
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TargetIcon className="w-6 h-6 text-t-primary" /> Make Your Picks
        </h1>
        <p className="text-gray-500 mt-1">
          Select 6 golfers across 4 tiers for the {tournament.name}. Your worst performer will be dropped.
        </p>
      </div>

      <TierPicker />
    </div>
    </>
  );
}
