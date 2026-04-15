"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PoolStandings from "@/components/PoolStandings";
import PoolManager from "@/components/PoolManager";
import Link from "next/link";
import {
  LockIcon,
  UnlockIcon,
  DollarIcon,
  GearIcon,
  CopyIcon,
  CheckIcon,
} from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";

interface PoolInfo {
  id: string;
  name: string;
  inviteCode: string;
  adminUserId: string;
  lockDate: string;
  paymentLink: string | null;
  paymentLabel: string;
  entryFee: string | null;
  tournamentSlug: string;
  members: { id: string; name: string; email: string; paid: boolean }[];
}

interface UserPick {
  id: string;
  tier: number;
  golferId: string;
  golferName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { tournament, setTournament } = useTournament();
  const [user, setUser] = useState<{ userId: string; name: string } | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [picks, setPicks] = useState<UserPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentLabel, setPaymentLabel] = useState("Pay Entry Fee");
  const [entryFee, setEntryFee] = useState("");
  const [editingLockDate, setEditingLockDate] = useState(false);
  const [lockDateInput, setLockDateInput] = useState("");

  async function fetchAll() {
    try {
      const [meRes, poolRes, picksRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/pool"),
        fetch("/api/picks"),
      ]);

      const meData = await meRes.json();
      if (!meData.user) {
        router.push("/login");
        return;
      }
      setUser(meData.user);

      const poolData = await poolRes.json();
      setPool(poolData.pool);
      if (poolData.pool) {
        setPaymentLink(poolData.pool.paymentLink || "");
        setPaymentLabel(poolData.pool.paymentLabel || "Pay Entry Fee");
        setEntryFee(poolData.pool.entryFee || "");
        // Auto-switch tournament context to match the pool's tournament
        if (poolData.pool.tournamentSlug) {
          setTournament(poolData.pool.tournamentSlug);
        }
        // Format lock date for datetime-local input
        const ld = new Date(poolData.pool.lockDate);
        setLockDateInput(ld.toISOString().slice(0, 16));
      }

      const picksData = await picksRes.json();
      setPicks(picksData.picks || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePaymentSettings() {
    try {
      await fetch("/api/pool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentLink, paymentLabel, entryFee }),
      });
      setShowPaymentSetup(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to save payment settings:", err);
    }
  }

  async function togglePaid(userId: string) {
    try {
      await fetch("/api/pool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ togglePaidUserId: userId }),
      });
      fetchAll();
    } catch (err) {
      console.error("Failed to toggle paid:", err);
    }
  }

  async function saveLockDate() {
    try {
      await fetch("/api/pool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockDate: new Date(lockDateInput).toISOString() }),
      });
      setEditingLockDate(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to save lock date:", err);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isLocked = pool ? new Date(pool.lockDate) <= new Date() : false;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome banner */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user.name}!
            </h1>
            <p className="text-gray-500 mt-1">
              {pool
                ? `Pool: ${pool.name}`
                : "Join or create a pool to get started"}
            </p>
          </div>
          {pool && (
            <div className="flex items-center gap-3">
              {!isLocked && (
                <Link
                  href="/picks"
                  className="bg-masters-green text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-masters-green-dark transition-colors"
                >
                  {picks.length > 0 ? "Edit Picks" : "Make Picks"}
                </Link>
              )}
              <Link
                href="/leaderboard"
                className="bg-masters-cream text-masters-green px-5 py-2 rounded-lg font-bold text-sm hover:bg-masters-yellow/30 transition-colors border border-masters-green/20"
              >
                Leaderboard
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pool info or Pool Manager */}
      {!pool ? (
        <PoolManager onPoolReady={fetchAll} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Pool details + My picks */}
          <div className="space-y-6">
            {/* Pool card */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-masters-green px-6 py-3">
                <h3 className="text-white font-bold">Pool Details</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                    Invite Code
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-masters-cream px-3 py-1 rounded font-mono font-bold text-masters-green text-lg tracking-widest">
                      {pool.inviteCode}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pool.inviteCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                      {copied ? <CheckIcon className="w-4 h-4 text-green-600" /> : <CopyIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                    Members ({pool.members.length})
                  </span>
                  <div className="mt-1 space-y-1">
                    {pool.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="w-6 h-6 bg-masters-green/10 rounded-full flex items-center justify-center text-xs font-bold text-masters-green">
                          {m.name.charAt(0)}
                        </div>
                        <span className="text-gray-700 flex-1">{m.name}</span>
                        {m.id === pool.adminUserId && (
                          <span className="text-xs bg-masters-yellow/30 text-masters-gold px-1.5 py-0.5 rounded font-bold">
                            Admin
                          </span>
                        )}
                        {pool.entryFee && (
                          user?.userId === pool.adminUserId ? (
                            <button
                              onClick={() => togglePaid(m.id)}
                              className={`text-xs px-2 py-0.5 rounded font-bold transition-colors ${
                                m.paid
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-red-100 text-red-600 hover:bg-red-200"
                              }`}
                              title={m.paid ? "Click to mark unpaid" : "Click to mark paid"}
                            >
                              {m.paid ? "✓ Paid" : "$ Unpaid"}
                            </button>
                          ) : (
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-bold ${
                                m.paid
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-600"
                              }`}
                            >
                              {m.paid ? "✓ Paid" : "Unpaid"}
                            </span>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment link for members */}
                {pool.paymentLink && pool.entryFee && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                        Entry Fee
                      </span>
                      <span className="text-sm font-bold text-gray-900">{pool.entryFee}</span>
                    </div>
                    <a
                      href={pool.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-masters-green text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-masters-green-dark transition-colors"
                    >
                      <DollarIcon className="w-4 h-4 inline-block mr-1" /> {pool.paymentLabel}
                    </a>
                  </div>
                )}

                {/* Admin: Payment setup */}
                {user?.userId === pool.adminUserId && (
                  <div className="border-t border-gray-100 pt-4">
                    {!showPaymentSetup ? (
                      <button
                        onClick={() => setShowPaymentSetup(true)}
                        className="text-sm text-masters-green font-bold hover:underline flex items-center gap-1"
                      >
                        <GearIcon className="w-4 h-4" /> {pool.paymentLink ? "Edit Payment Settings" : "Set Up Payment Link"}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 font-bold block mb-1">
                            Entry Fee (e.g. &quot;$20&quot;)
                          </label>
                          <input
                            type="text"
                            value={entryFee}
                            onChange={(e) => setEntryFee(e.target.value)}
                            placeholder="$20"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-masters-green focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-bold block mb-1">
                            Payment Link (Venmo, PayPal, CashApp, etc.)
                          </label>
                          <input
                            type="url"
                            value={paymentLink}
                            onChange={(e) => setPaymentLink(e.target.value)}
                            placeholder="https://venmo.com/yourname"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-masters-green focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-bold block mb-1">
                            Button Label
                          </label>
                          <input
                            type="text"
                            value={paymentLabel}
                            onChange={(e) => setPaymentLabel(e.target.value)}
                            placeholder="Pay via Venmo"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-masters-green focus:border-transparent"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={savePaymentSettings}
                            className="flex-1 bg-masters-green text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-masters-green-dark transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setShowPaymentSetup(false)}
                            className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                    Status
                  </span>
                  <p className={`text-sm font-medium mt-1 flex items-center gap-1.5 ${isLocked ? "text-red-600" : "text-green-600"}`}>
                    {isLocked ? <><LockIcon className="w-4 h-4" /> Picks Locked</> : <><UnlockIcon className="w-4 h-4" /> Picks Open</>}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {!editingLockDate ? (
                      <>
                        <p className="text-xs text-gray-500">
                          Lock: {new Date(pool.lockDate).toLocaleString()}
                        </p>
                        {user?.userId === pool.adminUserId && (
                          <button
                            onClick={() => setEditingLockDate(true)}
                            className="text-xs text-masters-green hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={lockDateInput}
                          onChange={(e) => setLockDateInput(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                        />
                        <button
                          onClick={saveLockDate}
                          className="text-xs bg-masters-green text-white px-2 py-1 rounded font-bold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLockDate(false)}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* My picks summary */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-masters-green px-6 py-3 flex items-center justify-between">
                <h3 className="text-white font-bold">My Picks</h3>
                <span className="text-masters-yellow text-xs font-bold">
                  {picks.length}/6
                </span>
              </div>
              <div className="p-4">
                {picks.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-3">
                      No picks made yet
                    </p>
                    {!isLocked && (
                      <Link
                        href="/picks"
                        className="text-masters-green font-bold text-sm hover:underline"
                      >
                        Make your picks →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {picks.map((pick) => (
                      <div
                        key={pick.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                      >
                        <span className={`tier-badge tier-${pick.tier}`}>
                          T{pick.tier}
                        </span>
                        <span className="text-sm font-medium text-gray-800">
                          {pick.golferName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: Pool Standings */}
          <div className="lg:col-span-2">
            <PoolStandings />
          </div>
        </div>
      )}
    </div>
  );
}
