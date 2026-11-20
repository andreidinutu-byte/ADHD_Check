import { createHash } from "node:crypto";

// Rate limit (NFR-13). Fixed window per key, counted in memory: the app runs as one long-lived Node process
// (pm2 on the web server). A restart (every deploy) resets the counters, so long windows such as the weekly
// email slot only hold between deploys. TODO: move long windows to PocketBase if emails are switched on.

// TODO: limit not decided (docs/02 NFR-13, "Limit value: TODO"). Placeholder: 10 posts per minute per
// address, far above one child finishing a session and well below a burst.
export const SESSIONS_RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export type RateLimitRule = { limit: number; windowSeconds: number };

export interface RateLimiter {
  // true when the request may go on, false when the limit is reached. rule: this call's own limit and window
  // instead of the limiter's default (the weekly email allows 1 a week from a limiter set to 10 a minute).
  take(key: string, rule?: RateLimitRule): Promise<boolean>;
}

// Key for one client: scope plus a hash of its address. The address itself is never stored.
// Behind Cloudflare the client address is CF-Connecting-IP; the first x-forwarded-for entry is the fallback.
export function clientKey(request: Request, scope: string): string {
  const address =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${scope}:${createHash("sha256").update(address).digest("hex")}`;
}

export function createMemoryRateLimiter({ limit, windowSeconds }: RateLimitRule, now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { start: number; hits: number; windowMs: number }>();
  return {
    async take(key, rule) {
      const max = rule?.limit ?? limit;
      const windowMs = (rule?.windowSeconds ?? windowSeconds) * 1000;
      const t = now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.start + bucket.windowMs <= t) {
        bucket = { start: t, hits: 0, windowMs };
        buckets.set(key, bucket);
      }
      bucket.hits += 1;
      if (buckets.size > 10_000) {
        for (const [k, v] of buckets) if (v.start + v.windowMs <= t) buckets.delete(k);
      }
      return bucket.hits <= max;
    },
  };
}

// One limiter per process, shared by every route (each call passes its own key, and its own rule if needed).
let shared: RateLimiter | undefined;
export function sharedRateLimiter(): RateLimiter {
  return (shared ??= createMemoryRateLimiter(SESSIONS_RATE_LIMIT));
}
