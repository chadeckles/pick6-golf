import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { compare, hash } from "bcryptjs";
import { authIpLimit, authEmailLimit } from "@/lib/rateLimit";
import { checkOrigin, getClientIp, normalizeEmail } from "@/lib/security";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}

// Pre-computed throwaway hash so we still do bcrypt work when the email
// doesn't exist. This blinds the response-time side-channel that would
// otherwise leak whether an account is registered. Cost must match the one
// used on registration so timing is indistinguishable.
let DUMMY_HASH: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) DUMMY_HASH = await hash("not-a-real-password", 12);
  return DUMMY_HASH;
}

export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ip = getClientIp(req);
    const ipLimit = authIpLimit(ip);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipLimit.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const rawEmail = (body && typeof body === "object" ? (body as Record<string, unknown>).email : null);
    const rawPassword = (body && typeof body === "object" ? (body as Record<string, unknown>).password : null);

    const email = normalizeEmail(rawEmail);
    if (!email || typeof rawPassword !== "string" || rawPassword.length === 0 || rawPassword.length > 128) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Per-email bucket: attackers who rotate IPs still hit this.
    const emailLimit = authEmailLimit(email);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts for this account. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(emailLimit.retryAfter) },
        }
      );
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;

    // Always run a bcrypt compare — either against the real hash or a dummy —
    // so the response time doesn't reveal whether the email exists.
    const hashToCompare = user?.password_hash ?? (await getDummyHash());
    const passwordOk = await compare(rawPassword, hashToCompare);

    if (!user || !passwordOk) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      name: user.name,
      email: user.email,
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
