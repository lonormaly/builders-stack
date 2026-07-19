// Fixed-window, in-memory, per-key rate limiter for the money paths (/checkout).
// In-memory is deliberate: the payment service is one small process today. If you
// scale it horizontally, swap the Map for a shared store (Redis) behind the same
// check() signature — call sites don't change.
export interface RateLimiter {
  /** True if this call is within budget, false if the key is over the limit. */
  check(key: string, now?: number): boolean;
}

export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || now >= entry.resetAt) {
        // Opportunistic GC so the map can't grow unbounded under IP churn.
        if (hits.size > 10_000) {
          for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
        }
        hits.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= opts.limit;
    },
  };
}
