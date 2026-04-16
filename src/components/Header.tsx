"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import TournamentLogo from "@/components/TournamentLogo";
import { ChartIcon, TargetIcon, FlagIcon } from "@/components/Icons";
import { useTournament } from "@/components/TournamentProvider";
import { getActiveTournaments } from "@/lib/tournaments/config";

interface User {
  userId: string;
  name: string;
  email: string;
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tournamentDropdown, setTournamentDropdown] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { tournament, setTournament } = useTournament();
  const allTournaments = getActiveTournaments();

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
    setTournamentDropdown(false);
  }, [fetchUser, pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="bg-t-primary-dark/95 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <TournamentLogo width={64} height={54} className="group-hover:scale-105 transition-transform" />
              <div>
                <h1 className="text-white font-bold text-lg leading-tight tracking-wide">
                  Pick Six Golf
                </h1>
              </div>
            </Link>
            {/* Tournament selector */}
            <div className="relative">
              <button
                onClick={() => setTournamentDropdown(!tournamentDropdown)}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-colors rounded px-2 py-0.5 ml-1"
              >
                <span className="text-t-accent text-xs tracking-widest uppercase font-bold">
                  {tournament.name}
                </span>
                <svg
                  className={`w-3 h-3 text-t-accent/60 transition-transform ${tournamentDropdown ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {tournamentDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTournamentDropdown(false)} />
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                    <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Switch Tournament
                    </p>
                    {allTournaments.map((t) => (
                      <button
                        key={t.slug}
                        onClick={() => {
                          setTournament(t.slug);
                          setTournamentDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                          t.slug === tournament.slug
                            ? "bg-t-cream font-bold text-gray-900"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: t.theme.primary }}
                        />
                        {t.name}
                        {t.slug === tournament.slug && (
                          <span className="ml-auto text-xs text-t-primary">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-4">
            <Link
              href="/leaderboard"
              className={`text-sm font-medium transition-colors ${
                pathname === "/leaderboard"
                  ? "text-t-accent"
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
                      ? "text-t-accent"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/picks"
                  className={`text-sm font-medium transition-colors ${
                    pathname === "/picks"
                      ? "text-t-accent"
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
                    <div className="w-7 h-7 bg-t-accent rounded-full flex items-center justify-center text-t-primary-dark font-bold text-sm">
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
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-t-cream transition-colors"
                        >
                          <ChartIcon className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link
                          href="/picks"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-t-cream transition-colors"
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
                  className="bg-t-accent text-t-primary-dark px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-300 transition-colors shadow-md"
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
                  className="block mx-4 mt-2 text-center bg-t-accent text-t-primary-dark px-4 py-2 rounded-lg text-sm font-bold"
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
