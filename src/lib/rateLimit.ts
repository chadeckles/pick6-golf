/**
 * Simple in-memory rate limiter with per-key sliding windows.
 *
 * IMPORTANT: state is per-Node-process. That's acceptable for a small (<100
 * user) deployment behind a single Railway container. If you ever scale
 * horizontally, swap this for Upstash Redis or Postgres-backed throttling.
 *
 * Use the tightest bucket that still works for humans:
 *   - `authIpLimit(ip)`        — per-IP, generous (accounts for NAT'd families)
 *   - `authEmailLimit(email)`  — per-email, TIGHT (thwarts credential stuffing
 *                                 even when attackers rotate IPs)
 *   - `resetIpLimit(ip)`       — per-IP, one-hour window for reset requests
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** seconds until the window resets (>=1) when blocked, else 0 */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1, retryAfter: 0 };
  }

  if (b.count >= opts.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }

  b.count++;
  return { allowed: true, remaining: opts.max - b.count, retryAfter: 0 };
}

export function authIpLimit(ip: string): RateLimitResult {
  return rateLimit(`authIp:${ip}`, { max: 30, windowMs: 15 * 60 * 1000 });
}

export function authEmailLimit(email: string): RateLimitResult {
  return rateLimit(`authEmail:${email.toLowerCase()}`, {
    max: 8,
    windowMs: 15 * 60 * 1000,
  });
}

export function resetIpLimit(ip: string): RateLimitResult {
  return rateLimit(`reset:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 });
}

// Legacy export (kept so existing imports keep building; new code should use
// authIpLimit/authEmailLimit directly).
export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const r = authIpLimit(ip);
  return { allowed: r.allowed, remaining: r.remaining };
}

// Periodic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
  }
}, 60_000).unref?.();
