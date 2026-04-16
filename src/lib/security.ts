/**
 * Shared security primitives: CSRF origin checks, URL allowlisting,
 * input length caps, and a constant-time string comparison.
 */
import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Return the list of hostnames allowed to originate mutating requests.
 * In prod, set APP_URL to your canonical origin (e.g. https://pick6.app).
 * Localhost is always allowed so `npm run dev` works.
 */
function allowedOrigins(): string[] {
  const list: string[] = [];
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      list.push(new URL(appUrl).host);
    } catch {
      /* ignore malformed APP_URL */
    }
  }
  // Dev convenience
  list.push("localhost:3000", "127.0.0.1:3000", "localhost:3001");
  return list;
}

/**
 * CSRF defence: for any mutating request (POST/PATCH/PUT/DELETE) require that
 * the browser-set Origin (or Referer as fallback) matches a known host.
 * Returns null when OK, or an error string when the request should be rejected.
 */
export function checkOrigin(req: NextRequest): string | null {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const source = origin ?? referer;
  if (!source) {
    // No Origin and no Referer is suspicious for a browser form; block.
    return "Missing Origin/Referer";
  }

  let host: string;
  try {
    host = new URL(source).host;
  } catch {
    return "Invalid Origin/Referer";
  }

  const allowed = allowedOrigins();
  if (!allowed.includes(host)) {
    return `Origin ${host} not allowed`;
  }
  return null;
}

/**
 * Best-effort client IP that ignores spoofed XFF hops. Railway/Vercel put the
 * true client IP in the LEFTMOST hop, but only one hop is trustworthy — everything
 * else can be forged. Combine with other keys (email/userId) for real throttling.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Validate a payment URL supplied by a pool admin.
 * Accepts https:// links to a short list of known processors. Never accepts
 * javascript:, data:, or arbitrary http://.
 */
const PAYMENT_HOST_ALLOWLIST = new Set([
  "venmo.com",
  "account.venmo.com",
  "paypal.com",
  "www.paypal.com",
  "paypal.me",
  "cash.app",
  "cashapp.com",
  "stripe.com",
  "buy.stripe.com",
  "checkout.stripe.com",
  "zellepay.com",
  "square.link",
]);

export function validatePaymentUrl(raw: string | null | undefined): {
  ok: boolean;
  url: string | null;
  error?: string;
} {
  if (!raw) return { ok: true, url: null };
  if (typeof raw !== "string") return { ok: false, url: null, error: "Payment link must be a string" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, url: null };
  if (trimmed.length > 500) return { ok: false, url: null, error: "Payment link is too long" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, url: null, error: "Payment link must be a valid URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, url: null, error: "Payment link must use https://" };
  }
  const host = parsed.host.toLowerCase();
  const allowed = [...PAYMENT_HOST_ALLOWLIST].some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
  if (!allowed) {
    return {
      ok: false,
      url: null,
      error: `Payment host not allowed (${host}). Use Venmo, PayPal, Cash App, Stripe, Zelle, or Square.`,
    };
  }
  return { ok: true, url: parsed.toString() };
}

/**
 * Guard: reject request bodies above a generous cap. Call after JSON parse
 * on fields whose size you want to bound. Prevents accidentally enormous payloads
 * without having to touch every field individually.
 */
export function assertStringField(
  value: unknown,
  label: string,
  opts: { min?: number; max: number; required?: boolean } = { max: 1000 }
): string | null {
  if (value === undefined || value === null || value === "") {
    if (opts.required) return `${label} is required`;
    return null;
  }
  if (typeof value !== "string") return `${label} must be text`;
  if (opts.min !== undefined && value.length < opts.min)
    return `${label} must be at least ${opts.min} characters`;
  if (value.length > opts.max) return `${label} is too long`;
  return null;
}

/** Constant-time equality for secrets/tokens to avoid timing side-channels. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Very lightweight password policy. 10+ chars, not all identical, not a tiny
 * dictionary of obvious trash. For 40 users we don't need Pwned Passwords.
 */
const OBVIOUS_BAD = new Set([
  "password",
  "password1",
  "password123",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmeinnow",
]);

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== "string") return "Password is required";
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (pw.length > 128) return "Password is too long";
  if (/^(.)\1+$/.test(pw)) return "Password is too simple";
  if (OBVIOUS_BAD.has(pw.toLowerCase())) return "Password is too common";
  return null;
}

/** Lowercase + trim + length-check an email; returns null if invalid. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;
  return trimmed;
}
