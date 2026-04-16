import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { checkOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await destroySession();
  return NextResponse.json({ ok: true });
}
