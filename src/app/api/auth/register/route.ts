import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { hash } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { authIpLimit } from "@/lib/rateLimit";
import {
  assertStringField,
  checkOrigin,
  getClientIp,
  normalizeEmail,
  validatePassword,
} from "@/lib/security";
import { audit } from "@/lib/audit";

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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { name: rawName, email: rawEmail, password: rawPassword } = body as Record<string, unknown>;

    const nameErr = assertStringField(rawName, "Name", { min: 1, max: 50, required: true });
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

    const email = normalizeEmail(rawEmail);
    if (!email) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const pwErr = validatePassword(rawPassword);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    // React escapes output; we just trim whitespace here. Keeping this simple
    // is safer than ad-hoc regex scrubbing that misses edge cases.
    const cleanName = (rawName as string).trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = getDb();

    // Lowercase-compare for both the existence check AND the insert to avoid
    // race-conditions against the UNIQUE(email) index producing a 500.
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const id = uuid();
    const passwordHash = await hash(rawPassword as string, 12);

    try {
      db.prepare(
        "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)"
      ).run(id, cleanName, email, passwordHash);
    } catch (err) {
      // Likely UNIQUE collision between the check and the insert. Treat as 409.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE") || msg.includes("constraint")) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
      throw err;
    }

    audit({
      actorUserId: id,
      action: "user.register",
      targetType: "user",
      targetId: id,
      ip,
    });

    await createSession({ userId: id, name: cleanName, email });

    return NextResponse.json({ id, name: cleanName, email });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
