import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { getDb } from "@/lib/db";
import { sendEmail, appUrl } from "@/lib/email";
import { resetIpLimit } from "@/lib/rateLimit";
import { checkOrigin, getClientIp, normalizeEmail } from "@/lib/security";
import { audit } from "@/lib/audit";

/**
 * POST /api/auth/forgot
 * Body: { email }
 *
 * Always returns 200 with a generic message. The response MUST NOT leak
 * whether the email exists — that's the whole point of the "if this email
 * exists, we'll send a link" UX pattern.
 *
 * The token is 32 random bytes rendered as url-safe base64. We store only
 * SHA-256(token) in the DB so a leaked DB dump can't be used to impersonate
 * reset links.
 */
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ip = getClientIp(req);
  const limit = resetIpLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: true }, // intentionally generic
      { status: 200 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body && (body as Record<string, unknown>).email);
    if (!email) {
      // Don't reveal validation errors either — just return the generic message
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, name FROM users WHERE email = ?")
      .get(email) as { id: string; name: string } | undefined;

    if (user) {
      // Invalidate any outstanding tokens for this user
      db.prepare(
        "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"
      ).run(user.id);

      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      db.prepare(
        "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
      ).run(tokenHash, user.id, expires);

      const link = `${appUrl()}/reset?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: email,
        subject: "Reset your Pick 6 Golf password",
        text:
          `Hi ${user.name},\n\n` +
          `Someone requested a password reset for your Pick 6 Golf account.\n` +
          `If that was you, click the link below within the next hour:\n\n` +
          `${link}\n\n` +
          `If it wasn't you, you can safely ignore this email — your password won't change.\n`,
      });

      audit({
        actorUserId: user.id,
        action: "auth.resetRequest",
        targetType: "user",
        targetId: user.id,
        ip,
      });
    }

    // Always the same response, whether the email exists or not.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Forgot-password error:", err);
    // Still return generic success so we don't expose anything
    return NextResponse.json({ ok: true });
  }
}
