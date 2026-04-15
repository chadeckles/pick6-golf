"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MastersLogo from "@/components/MastersLogo";
import { CURRENT_YEAR } from "@/lib/constants";
import { ChartIcon, TargetIcon, FlagIcon } from "@/components/Icons";

interface User {
  userId: string;
  name: string;
  email: string;
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  // Re-fetch on every route change so the header stays in sync after login/logout
  useEffect(() => {
    fetchUser();
    setMenuOpen(false);
    setMobileOpen(false);
  }, [fetchUser, pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="bg-masters-green-dark shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <Link href="/" className="flex items-center gap-2 group">
            <MastersLogo width={64} height={54} showText={false} className="group-hover:scale-105 transition-transform" />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight tracking-wide">
                Masters Pick 6
              </h1>
              <p className="text-masters-yellow text-xs tracking-widest uppercase">
                {CURRENT_YEAR} Office Pool
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-4">
            <Link
              href="/leaderboard"
              className={`text-sm font-medium transition-colors ${
                pathname === "/leaderboard"
                  ? "text-masters-yellow"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Leaderboard
            </Link>

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`text-sm font-medium transition-colors ${
                    pathname === "/dashboard"
                      ? "text-masters-yellow"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/picks"
                  className={`text-sm font-medium transition-colors ${
                    pathname === "/picks"
                      ? "text-masters-yellow"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  My Picks
                </Link>

                {/* User dropdown */}
                <div className="relative ml-2 pl-4 border-l border-white/20">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-1.5"
                  >
                    <div className="w-7 h-7 bg-masters-yellow rounded-full flex items-center justify-center text-masters-green-dark font-bold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm font-medium max-w-[120px] truncate hidden sm:inline">
                      {user.name}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-white/60 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>
                        <Link
                          href="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-masters-cream transition-colors"
                        >
                          <ChartIcon className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link
                          href="/picks"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-masters-cream transition-colors"
                        >
                          <TargetIcon className="w-4 h-4" /> My Picks
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-white/90 hover:text-white text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-masters-yellow text-masters-green-dark px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-300 transition-colors shadow-md"
                >
                  Join Pool
                </Link>
              </>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="sm:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-white/10 py-3 space-y-1">
            <Link
              href="/leaderboard"
              className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <FlagIcon className="w-4 h-4" /> Leaderboard
            </Link>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                >
                  <ChartIcon className="w-4 h-4" /> Dashboard
                </Link>
                <Link
                  href="/picks"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                >
                  <TargetIcon className="w-4 h-4" /> My Picks
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-white/10 rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="block mx-4 mt-2 text-center bg-masters-yellow text-masters-green-dark px-4 py-2 rounded-lg text-sm font-bold"
                >
                  Join Pool
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
