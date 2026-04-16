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
import TournamentBar from "@/components/TournamentBar";

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
  const { tournament } = useTournament();
  const [user, setUser] = useState<{ userId: string; name: string } | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [activePoolId, setActivePoolId] = useState<string | null>(null);
  const [picks, setPicks] = useState<UserPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentLabel, setPaymentLabel] = useState("Pay Entry Fee");
  const [entryFee, setEntryFee] = useState("");
  const [editingLockDate, setEditingLockDate] = useState(false);
  const [lockDateInput, setLockDateInput] = useState("");
  const [showCreateJoin, setShowCreateJoin] = useState(false);

  // Admin actions
  const [transferTo, setTransferTo] = useState("");
  const [leaveTransferTo, setLeaveTransferTo] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // Derive active pool from state
  const pool = pools.find((p) => p.id === activePoolId) || null;

  async function fetchAll(selectedPoolId?: string) {
    try {
      const [meRes, poolRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/pool"),
      ]);

      const meData = await meRes.json();
      if (!meData.user) {
        router.push("/login");
        return;
      }
      setUser(meData.user);

      const poolData = await poolRes.json();
      const allPools: PoolInfo[] = poolData.pools || (poolData.pool ? [poolData.pool] : []);
      setPools(allPools);

      // Determine which pool to show
      const targetId = selectedPoolId || activePoolId || allPools[0]?.id || null;
      setActivePoolId(targetId);

      if (targetId) {
        const targetPool = allPools.find((p) => p.id === targetId);
        if (targetPool) {
          setPaymentLink(targetPool.paymentLink || "");
          setPaymentLabel(targetPool.paymentLabel || "Pay Entry Fee");
          setEntryFee(targetPool.entryFee || "");
          const ld = new Date(targetPool.lockDate);
          setLockDateInput(ld.toISOString().slice(0, 16));
        }

        const picksRes = await fetch(`/api/picks?poolId=${targetId}`);
        const picksData = await picksRes.json();
        setPicks(picksData.picks || []);
      } else {
        setPicks([]);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.slug]);

  async function savePaymentSettings() {
    try {
      await fetch("/api/pool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: pool?.id, paymentLink, paymentLabel, entryFee }),
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
        body: JSON.stringify({ poolId: pool?.id, togglePaidUserId: userId }),
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
        body: JSON.stringify({ poolId: pool?.id, lockDate: new Date(lockDateInput).toISOString() }),
      });
      setEditingLockDate(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to save lock date:", err);
    }
  }

  async function handleTransferAdmin() {
    if (!pool || !transferTo) return;
    setActionBusy(true);
    setActionError("");
    try {
      const res = await fetch("/api/pool/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: pool.id, newAdminUserId: transferTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to transfer admin");
        return;
      }
      setTransferTo("");
      fetchAll();
    } catch {
      setActionError("Network error");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!pool) return;
    if (!confirm(`Remove ${memberName} from ${pool.name}? Their picks will be wiped.`)) return;
    setActionBusy(true);
    setActionError("");
    try {
      const res = await fetch("/api/pool/member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: pool.id, userId: memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to remove member");
        return;
      }
      fetchAll();
    } catch {
      setActionError("Network error");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleLeavePool() {
    if (!pool) return;
    const isAdmin = user?.userId === pool.adminUserId;
    const otherMembers = pool.members.filter((m) => m.id !== user?.userId);
    const needsTransfer = isAdmin && otherMembers.length > 0;

    if (needsTransfer && !leaveTransferTo) {
      setActionError("Choose a member to transfer admin to before leaving.");
      return;
    }

    const msg =
      otherMembers.length === 0
        ? `You're the only member of ${pool.name}. Leaving will DELETE the pool and all its data. Continue?`
        : `Leave ${pool.name}? Your picks for this pool will be removed.`;
    if (!confirm(msg)) return;

    setActionBusy(true);
    setActionError("");
    try {
      const res = await fetch("/api/pool/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId: pool.id,
          ...(needsTransfer ? { transferToUserId: leaveTransferTo } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to leave pool");
        return;
      }
      // Reset active pool so we don't try to render a stale one
      setActivePoolId(null);
      setLeaveTransferTo("");
      setConfirmLeave(false);
      fetchAll();
    } catch {
      setActionError("Network error");
    } finally {
      setActionBusy(false);
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
    <>
    <TournamentBar />
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome banner */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user.name}!
            </h1>
            <p className="text-gray-500 mt-1">
              {pools.length > 0
                ? `${pools.length} pool${pools.length > 1 ? "s" : ""} active`
                : "Join or create a pool to get started"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pool && !isLocked && (
              <Link
                href={`/picks?poolId=${pool.id}`}
                className="bg-t-primary text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-t-primary-dark transition-colors"
              >
                {picks.length > 0 ? "Edit Picks" : "Make Picks"}
              </Link>
            )}
            <Link
              href="/leaderboard"
              className="bg-t-cream text-t-primary px-5 py-2 rounded-lg font-bold text-sm hover:bg-t-accent/30 transition-colors border border-t-primary/20"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* My Pools list — always visible */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-white font-bold flex items-center gap-2">🏌️ My Pools</h2>
          <button
            onClick={() => setShowCreateJoin(!showCreateJoin)}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg transition-colors"
          >
            + Join / Create
          </button>
        </div>
        <div className="p-4">
          {pools.length === 0 && !showCreateJoin ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-3">You&apos;re not in any pools yet.</p>
              <button
                onClick={() => setShowCreateJoin(true)}
                className="bg-t-primary text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-t-primary-dark transition-colors"
              >
                Join or Create a Pool
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {pools.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePoolId(p.id);
                    setShowCreateJoin(false);
                    fetchAll(p.id);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                    p.id === activePoolId && !showCreateJoin
                      ? "bg-t-primary/10 border border-t-primary/30"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-t-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-t-primary font-bold text-xs">{p.members.length}</span>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-400 block">{p.members.length} member{p.members.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {p.id === activePoolId && !showCreateJoin && (
                    <span className="text-xs font-bold text-t-primary bg-t-cream px-2 py-0.5 rounded">Active</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Join form (shown inline) */}
      {showCreateJoin && (
        <PoolManager onPoolReady={() => { setShowCreateJoin(false); fetchAll(); }} />
      )}

      {/* Pool info or empty state */}
      {!pool && !showCreateJoin ? (
        pools.length === 0 ? null : (
          <p className="text-center text-gray-400">Select a pool above to view details.</p>
        )
      ) : pool && !showCreateJoin ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Pool details + My picks */}
          <div className="space-y-6">
            {/* Pool card */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-t-primary px-6 py-3">
                <h3 className="text-white font-bold">Pool Details</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                    Invite Code
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-t-cream px-3 py-1 rounded font-mono font-bold text-t-primary text-lg tracking-widest">
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
                        <div className="w-6 h-6 bg-t-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-t-primary">
                          {m.name.charAt(0)}
                        </div>
                        <span className="text-gray-700 flex-1">{m.name}</span>
                        {m.id === pool.adminUserId && (
                          <span className="text-xs bg-t-accent/30 text-t-accent-muted px-1.5 py-0.5 rounded font-bold">
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
                        {/* Admin kick button (pre-lock only, can't kick self) */}
                        {user?.userId === pool.adminUserId &&
                          m.id !== user?.userId &&
                          !isLocked && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.name)}
                              disabled={actionBusy}
                              className="text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded px-1.5 py-0.5 font-bold transition-colors disabled:opacity-50"
                              title={`Remove ${m.name} from pool`}
                            >
                              ✕
                            </button>
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
                      className="block w-full text-center bg-t-primary text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-t-primary-dark transition-colors"
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
                        className="text-sm text-t-primary font-bold hover:underline flex items-center gap-1"
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-t-primary focus:border-transparent"
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-t-primary focus:border-transparent"
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-t-primary focus:border-transparent"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={savePaymentSettings}
                            className="flex-1 bg-t-primary text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-t-primary-dark transition-colors"
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
                            className="text-xs text-t-primary hover:underline"
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
                          className="text-xs bg-t-primary text-white px-2 py-1 rounded font-bold"
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

            {/* Danger zone — transfer admin + leave pool */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-red-100">
              <div className="bg-red-50 px-6 py-3 border-b border-red-100">
                <h3 className="text-red-700 font-bold text-sm">Danger Zone</h3>
              </div>
              <div className="p-6 space-y-4 text-sm">
                {actionError && (
                  <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded text-xs">
                    {actionError}
                  </div>
                )}

                {/* Transfer admin — admin only, while >1 member */}
                {user?.userId === pool.adminUserId && pool.members.length > 1 && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">
                      Transfer Admin
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Hand off pool-admin rights to another member. You&apos;ll remain in the pool.
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-t-primary focus:border-transparent"
                      >
                        <option value="">Choose a member…</option>
                        {pool.members
                          .filter((m) => m.id !== user?.userId)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={handleTransferAdmin}
                        disabled={!transferTo || actionBusy}
                        className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                      >
                        Transfer
                      </button>
                    </div>
                  </div>
                )}

                {/* Leave pool */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">
                    Leave Pool
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {pool.members.length === 1
                      ? "You're the only member — leaving will delete this pool permanently."
                      : "Your picks for this pool will be removed."}
                  </p>

                  {/* Admin with other members must pick a successor */}
                  {user?.userId === pool.adminUserId && pool.members.length > 1 && (
                    <select
                      value={leaveTransferTo}
                      onChange={(e) => setLeaveTransferTo(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-2 focus:ring-2 focus:ring-t-primary focus:border-transparent"
                    >
                      <option value="">Transfer admin to…</option>
                      {pool.members
                        .filter((m) => m.id !== user?.userId)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  )}

                  <button
                    onClick={handleLeavePool}
                    disabled={
                      actionBusy ||
                      (user?.userId === pool.adminUserId &&
                        pool.members.length > 1 &&
                        !leaveTransferTo)
                    }
                    className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {pool.members.length === 1 ? "Delete Pool" : "Leave Pool"}
                  </button>
                </div>
              </div>
            </div>

            {/* My picks summary */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-t-primary px-6 py-3 flex items-center justify-between">
                <h3 className="text-white font-bold">My Picks</h3>
                <span className="text-t-accent text-xs font-bold">
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
                        href={`/picks?poolId=${pool.id}`}
                        className="text-t-primary font-bold text-sm hover:underline"
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
            <PoolStandings poolId={pool.id} />
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}
