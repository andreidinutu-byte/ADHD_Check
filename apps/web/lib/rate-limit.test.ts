import { describe, expect, it } from "vitest";
import { clientKey, createMemoryRateLimiter, sharedRateLimiter } from "./rate-limit";

function requestFrom(forwardedFor?: string) {
  const headers: Record<string, string> = forwardedFor ? { "x-forwarded-for": forwardedFor } : {};
  return new Request("http://localhost/api/sessions", { method: "POST", headers });
}

describe("clientKey (NFR-13)", () => {
  it("keys on a hash of the first forwarded address, never the address itself", () => {
    const key = clientKey(requestFrom("203.0.113.7, 10.0.0.1"), "sessions");

    expect(key).toMatch(/^sessions:[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(key).toBe(clientKey(requestFrom("203.0.113.7"), "sessions"));
    expect(key).not.toBe(clientKey(requestFrom("203.0.113.8"), "sessions"));
  });

  it("gives every request without an address the same key", () => {
    expect(clientKey(requestFrom(), "sessions")).toBe(clientKey(requestFrom(), "sessions"));
  });
});

describe("createMemoryRateLimiter (NFR-13)", () => {
  const RULE = { limit: 2, windowSeconds: 60 };

  it("allows up to the limit in a window, then refuses", async () => {
    const limiter = createMemoryRateLimiter(RULE);
    expect(await limiter.take("k")).toBe(true);
    expect(await limiter.take("k")).toBe(true);
    expect(await limiter.take("k")).toBe(false);
  });

  it("counts each key on its own", async () => {
    const limiter = createMemoryRateLimiter(RULE);
    await limiter.take("a");
    await limiter.take("a");
    expect(await limiter.take("a")).toBe(false);
    expect(await limiter.take("b")).toBe(true);
  });

  it("starts a new window once the window has passed", async () => {
    let t = 0;
    const limiter = createMemoryRateLimiter(RULE, () => t);
    await limiter.take("k");
    await limiter.take("k");
    expect(await limiter.take("k")).toBe(false);
    t = 60_000;
    expect(await limiter.take("k")).toBe(true);
  });

  it("uses the rule of the call instead of the default (weekly email: 1 in 8 days)", async () => {
    let t = 0;
    const limiter = createMemoryRateLimiter(RULE, () => t);
    const weekly = { limit: 1, windowSeconds: 8 * 86_400 };
    expect(await limiter.take("w", weekly)).toBe(true);
    expect(await limiter.take("w", weekly)).toBe(false);
    t = 7 * 86_400_000;
    expect(await limiter.take("w", weekly)).toBe(false);
    t = 8 * 86_400_000;
    expect(await limiter.take("w", weekly)).toBe(true);
  });

  it("keeps a long window when another call with a short window comes in", async () => {
    let t = 0;
    const limiter = createMemoryRateLimiter(RULE, () => t);
    const daily = { limit: 1, windowSeconds: 86_400 };
    await limiter.take("cap", daily);
    t = 120_000;
    await limiter.take("other");
    expect(await limiter.take("cap", daily)).toBe(false);
  });
});

describe("sharedRateLimiter", () => {
  it("is one limiter for the whole process", () => {
    expect(sharedRateLimiter()).toBe(sharedRateLimiter());
  });
});
