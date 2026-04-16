import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { checkOrigin, getClientIp, validatePassword } from "@/lib/security";
import { audit } from "@/lib/audit";

/**
 * POST /api/auth/reset
 * Body: { token, password }
 *
 * Verifies the one-time token, updates the password hash, invalidates the
 * token, and starts a new session. Tokens are single-use — once claimed,
 * `used_at` is set so a reuse attempt fails.
 */
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { token, password } = body as Record<string, unknown>;

    if (typeof token !== "string" || token.length < 20 || token.length > 200) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const db = getDb();
    const row = db
      .prepare(
        `SELECT t.user_id, t.expires_at, t.used_at, u.name, u.email
         FROM password_reset_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ?`
      )
      .get(tokenHash) as
      | { user_id: string; expires_at: string; used_at: string | null; name: string; email: string }
      | undefined;

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password as string, 12);

    const tx = db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, row.user_id);
      db.prepare(
        "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token_hash = ?"
      ).run(tokenHash);
      // Invalidate every other outstanding token for this user too
      db.prepare(
        "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"
      ).run(row.user_id);
    });
    tx();

    audit({
      actorUserId: row.user_id,
      action: "auth.resetComplete",
      targetType: "user",
      targetId: row.user_id,
      ip: getClientIp(req),
    });

    // Auto-login after reset for a smooth UX
    await createSession({ userId: row.user_id, name: row.name, email: row.email });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
