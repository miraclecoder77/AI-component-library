/**
 * Per-visitor rate limiting.
 *
 * Deliberately tighter than Gemini's own ceiling (~10 requests/minute on the
 * free tier) so that our limiter trips first. When it does, we control the
 * message and the countdown; when Google's trips first, the whole key is cold
 * for everyone including the next visitor.
 *
 * The store is in-memory, which is correct in development and best-effort on
 * serverless, where each instance keeps its own counters. That is an accepted
 * limitation rather than an oversight: the recorded-response fallback already
 * guarantees the demos work regardless, so the limiter is a quota-preservation
 * measure and not a security control. `Limiter` is an interface so a Redis
 * implementation can replace it without touching the routes.
 */

export interface LimitResult {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window frees up. Only meaningful when `ok` is false. */
  retryAfterS: number;
}

export interface Limiter {
  check(key: string): LimitResult;
}

interface Window {
  /** Timestamps of requests inside the window, oldest first. */
  hits: number[];
}

export class SlidingWindowLimiter implements Limiter {
  private windows = new Map<string, Window>();
  private lastSweep = Date.now();
  private readonly limit: number;
  private readonly windowMs: number;

  // Explicit fields rather than TypeScript parameter properties: the unit
  // tests run under Node's type-stripping, which erases types but cannot
  // emit the assignments a parameter property implies.
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string): LimitResult {
    const now = Date.now();
    this.sweep(now);

    const window = this.windows.get(key) ?? { hits: [] };
    const cutoff = now - this.windowMs;

    // Drop hits that have aged out of the window.
    const hits = window.hits.filter((at) => at > cutoff);

    if (hits.length >= this.limit) {
      const oldest = hits[0];
      this.windows.set(key, { hits });
      return {
        ok: false,
        remaining: 0,
        retryAfterS: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      };
    }

    hits.push(now);
    this.windows.set(key, { hits });

    return {
      ok: true,
      remaining: this.limit - hits.length,
      retryAfterS: 0,
    };
  }

  /** Drop idle keys so a long-lived instance does not grow without bound. */
  private sweep(now: number) {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;

    const cutoff = now - this.windowMs;
    for (const [key, window] of this.windows) {
      if (window.hits.every((at) => at <= cutoff)) this.windows.delete(key);
    }
  }
}

/**
 * Two windows per visitor: a burst limit and a daily budget.
 *
 * Module scope so the counters survive between requests on a warm instance.
 * Both are configurable because the end-to-end suite runs many requests from
 * a single address in seconds and would otherwise trip the burst limit and
 * test the error path instead of the demos. The limiter itself is covered
 * directly in tests/rate-limit.test.ts.
 */
const perMinute = new SlidingWindowLimiter(
  positiveInt(process.env.RATE_LIMIT_PER_MINUTE, 6),
  60_000,
);
const perDay = new SlidingWindowLimiter(
  positiveInt(process.env.RATE_LIMIT_PER_DAY, 60),
  24 * 60 * 60_000,
);

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function checkRateLimit(key: string): LimitResult {
  const minute = perMinute.check(key);
  if (!minute.ok) return minute;
  return perDay.check(key);
}

/**
 * Best-effort visitor identity.
 *
 * Vercel sets `x-forwarded-for`; the leftmost entry is the client. This is
 * trivially spoofable, which is fine for quota preservation and would not be
 * fine for anything security-relevant.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
