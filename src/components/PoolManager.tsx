"use client";

import { useState } from "react";
import { CURRENT_YEAR } from "@/lib/constants";
import { TrophyIcon, FlagIcon, CopyIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";
import type { TournamentConfig } from "@/lib/tournaments/config";
import { toLocalInputValue } from "@/lib/datetime";

interface PoolManagerProps {
  onPoolReady: () => void;
}

// Default pick-lock for a tournament: first round, 8:00 AM local. Mirrors the
// server default in src/lib/tournaments/config.ts (getDefaultLockISO).
function defaultLockInputValue(t: TournamentConfig): string {
  const d = t.dates[CURRENT_YEAR];
  const base = d
    ? new Date(CURRENT_YEAR, d.month - 1, d.start, 8, 0, 0)
    : new Date();
  return toLocalInputValue(base);
}

export default function PoolManager({ onPoolReady }: PoolManagerProps) {
  const { tournament } = useTournament();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [poolName, setPoolName] = useState("");
  const [lockAt, setLockAt] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");

  async function handleCreate() {
    if (!poolName.trim()) {
      setError("Pool name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: poolName,
        tournament: tournament.slug,
      };
      if (lockAt) {
        const parsed = new Date(lockAt); // datetime-local is interpreted as local time
        if (!Number.isNaN(parsed.getTime())) {
          payload.lockDate = parsed.toISOString();
        }
      }
      const res = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setCreatedCode(data.inviteCode);
    } catch {
      setError("Failed to create pool");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pool/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onPoolReady();
    } catch {
      setError("Failed to join pool");
    } finally {
      setLoading(false);
    }
  }

  if (createdCode) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-t-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <TrophyIcon className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Pool Created!</h3>
        <p className="text-gray-600 mb-6">
          Share this invite code with your group:
        </p>
        <div className="bg-t-cream border-2 border-t-primary rounded-lg p-4 mb-6">
          <span className="text-2xl font-mono font-bold text-t-primary tracking-widest">
            {createdCode}
          </span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(createdCode);
          }}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors mb-4 mr-2"
        >
          <CopyIcon className="w-4 h-4 inline-block mr-1" /> Copy Code
        </button>
        <button
          onClick={onPoolReady}
          className="bg-t-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-t-primary-dark transition-colors"
        >
          Continue to Picks →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {mode === "choose" && (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-t-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <FlagIcon className="w-8 h-8 text-t-primary" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Join or Create a Pool
          </h3>
          <p className="text-gray-600 mb-6">
            Get in on the action for the {CURRENT_YEAR} {tournament.name}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setMode("join")}
              className="w-full bg-t-primary text-white py-3 rounded-lg font-bold hover:bg-t-primary-dark transition-colors"
            >
              Join Existing Pool
            </button>
            <button
              onClick={() => {
                setLockAt(defaultLockInputValue(tournament));
                setMode("create");
              }}
              className="w-full bg-white border-2 border-t-primary text-t-primary py-3 rounded-lg font-bold hover:bg-t-cream transition-colors"
            >
              Create New Pool
            </button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="bg-white rounded-xl shadow-md p-8">
          <button
            onClick={() => setMode("choose")}
            className="text-gray-500 text-sm hover:text-gray-700 mb-4"
          >
            ← Back
          </button>
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Create a Pool
          </h3>
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pool Name
              </label>
              <input
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder={`e.g. ${tournament.name} Pool ${CURRENT_YEAR}`}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-t-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Picks Lock
              </label>
              <input
                type="datetime-local"
                value={lockAt}
                onChange={(e) => setLockAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-t-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                When picks freeze. Defaults to the first round — change it to run
                a beta or close entries early.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-t-primary text-white py-3 rounded-lg font-bold hover:bg-t-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Pool"}
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="bg-white rounded-xl shadow-md p-8">
          <button
            onClick={() => setMode("choose")}
            className="text-gray-500 text-sm hover:text-gray-700 mb-4"
          >
            ← Back
          </button>
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Join a Pool
          </h3>
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-t-primary focus:border-transparent uppercase"
                maxLength={8}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full bg-t-primary text-white py-3 rounded-lg font-bold hover:bg-t-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Pool"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
