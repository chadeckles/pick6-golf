"use client";

import { useState } from "react";
import { CURRENT_YEAR } from "@/lib/constants";
import { TrophyIcon, FlagIcon, CopyIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";

interface PoolManagerProps {
  onPoolReady: () => void;
}

export default function PoolManager({ onPoolReady }: PoolManagerProps) {
  const { tournament } = useTournament();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [poolName, setPoolName] = useState("");
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
      const res = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: poolName, tournament: tournament.slug }),
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
        <div className="w-16 h-16 bg-masters-green rounded-full flex items-center justify-center mx-auto mb-4">
          <TrophyIcon className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Pool Created!</h3>
        <p className="text-gray-600 mb-6">
          Share this invite code with your group:
        </p>
        <div className="bg-masters-cream border-2 border-masters-green rounded-lg p-4 mb-6">
          <span className="text-2xl font-mono font-bold text-masters-green tracking-widest">
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
          className="bg-masters-green text-white px-6 py-2 rounded-lg font-bold hover:bg-masters-green-dark transition-colors"
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
          <div className="w-16 h-16 bg-masters-yellow rounded-full flex items-center justify-center mx-auto mb-4">
            <FlagIcon className="w-8 h-8 text-masters-green" />
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
              className="w-full bg-masters-green text-white py-3 rounded-lg font-bold hover:bg-masters-green-dark transition-colors"
            >
              Join Existing Pool
            </button>
            <button
              onClick={() => setMode("create")}
              className="w-full bg-white border-2 border-masters-green text-masters-green py-3 rounded-lg font-bold hover:bg-masters-cream transition-colors"
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
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-masters-green focus:border-transparent"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-masters-green text-white py-3 rounded-lg font-bold hover:bg-masters-green-dark transition-colors disabled:opacity-50"
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
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-masters-green focus:border-transparent uppercase"
                maxLength={8}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full bg-masters-green text-white py-3 rounded-lg font-bold hover:bg-masters-green-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Pool"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
