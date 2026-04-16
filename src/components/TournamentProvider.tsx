"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  type TournamentConfig,
  getTournament,
  getDefaultTournament,
} from "@/lib/tournaments/config";

interface TournamentContextValue {
  tournament: TournamentConfig;
  setTournament: (slug: string) => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

const STORAGE_KEY = "pick6-tournament";

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournament, setTournamentState] = useState<TournamentConfig>(
    getDefaultTournament
  );

  // On mount, restore from localStorage (or use default)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const t = getTournament(saved);
      setTournamentState(t);
    }
  }, []);

  function setTournament(slug: string) {
    const t = getTournament(slug);
    setTournamentState(t);
    localStorage.setItem(STORAGE_KEY, slug);
  }

  return (
    <TournamentContext.Provider value={{ tournament, setTournament }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) {
    throw new Error("useTournament must be used within a TournamentProvider");
  }
  return ctx;
}
