"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  userId: string;
  name: string;
  email: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.push("/login");
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete account");
        return;
      }
      // Account gone — send them home
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse h-8 bg-gray-200 rounded w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/dashboard" className="text-t-primary text-sm hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Account Settings</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-t-primary px-6 py-3">
          <h2 className="text-white font-bold">Your Profile</h2>
        </div>
        <div className="p-6 space-y-3 text-sm">
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Name</span>
            <span className="text-gray-900">{user.name}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Email</span>
            <span className="text-gray-900">{user.email}</span>
          </div>
          <p className="text-xs text-gray-500 pt-2">
            Need to change your password?{" "}
            <Link href="/forgot" className="text-t-primary hover:underline">
              Request a reset link
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-red-100">
        <div className="bg-red-50 px-6 py-3 border-b border-red-100">
          <h2 className="text-red-700 font-bold">Delete Account</h2>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <p className="text-gray-700">
            Deleting your account is permanent. All of your picks and payment
            records across every pool will be removed.
          </p>
          <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
            <li>Pools where you are the sole member will be deleted entirely.</li>
            <li>
              Pools where you are admin and other members remain will block the
              deletion until you transfer admin to someone else.
            </li>
          </ul>

          {!showDeleteForm ? (
            <button
              onClick={() => setShowDeleteForm(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
            >
              Delete my account…
            </button>
          ) : (
            <form onSubmit={handleDelete} className="space-y-3 border-t border-gray-100 pt-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Current password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || confirmText !== "DELETE" || !password}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Deleting…" : "Delete account permanently"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteForm(false);
                    setPassword("");
                    setConfirmText("");
                    setError("");
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
