import { describe, expect, it } from "vitest";
import { ConcurrencyLimiter, RATE_RULES, TokenBucketLimiter } from "@hm/shared/ratelimit";

describe("token bucket", () => {
  it("allows the burst then blocks, then refills", () => {
    let now = 0;
    const l = new TokenBucketLimiter(RATE_RULES.login, () => now);
    for (let i = 0; i < 5; i++) expect(l.take("ip:alice").ok).toBe(true);
    const blocked = l.take("ip:alice");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(l.take("ip:bob").ok).toBe(true); // keys are independent
    now += 12_000; // one token per 12 s
    expect(l.take("ip:alice").ok).toBe(true);
    expect(l.take("ip:alice").ok).toBe(false);
  });
  it("code runner: 20 runs/min/user", () => {
    const now = 0;
    const l = new TokenBucketLimiter(RATE_RULES.codeRun, () => now);
    let ok = 0;
    for (let i = 0; i < 30; i++) if (l.take("u1").ok) ok++;
    expect(ok).toBe(20);
  });
  it("concurrency limiter: 5 concurrent per user", () => {
    const c = new ConcurrencyLimiter(5);
    for (let i = 0; i < 5; i++) expect(c.acquire("u")).toBe(true);
    expect(c.acquire("u")).toBe(false);
    c.release("u");
    expect(c.acquire("u")).toBe(true);
  });
});
