import { NextResponse } from "next/server";
import { fetchLeaderboard, getTieredGolfers } from "@/lib/espn";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tiered = searchParams.get("tiered");
  const tournament = searchParams.get("tournament") || "masters";

  try {
    if (tiered === "true") {
      const tiers = await getTieredGolfers(tournament);
      return NextResponse.json({ tiers });
    }

    const golfers = await fetchLeaderboard(tournament);
    return NextResponse.json({ golfers });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
