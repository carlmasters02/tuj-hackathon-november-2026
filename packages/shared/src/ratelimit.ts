/**
 * In-memory token bucket. `capacity` tokens refill continuously over `windowMs`.
 * Single-process only (documented limitation) — fine for a single Next.js server.
 */
export interface BucketRule {
  capacity: number;
  windowMs: number;
}

export class TokenBucketLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(
    private rule: BucketRule,
    private now: () => number = Date.now,
    private maxKeys = 50_000,
  ) {}

  /** Consumes one token. Returns remaining tokens, or -1 (with retryAfterMs) when limited. */
  take(key: string, cost = 1): { ok: boolean; remaining: number; retryAfterMs: number } {
    const t = this.now();
    const ratePerMs = this.rule.capacity / this.rule.windowMs;
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) this.evict(t);
      b = { tokens: this.rule.capacity, updated: t };
      this.buckets.set(key, b);
    } else {
      b.tokens = Math.min(this.rule.capacity, b.tokens + (t - b.updated) * ratePerMs);
      b.updated = t;
    }
    if (b.tokens >= cost) {
      b.tokens -= cost;
      return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
    }
    return { ok: false, remaining: 0, retryAfterMs: Math.ceil((cost - b.tokens) / ratePerMs) };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private evict(t: number) {
    // drop buckets that have fully refilled (they carry no state)
    for (const [k, b] of this.buckets) {
      if (b.tokens + (t - b.updated) * (this.rule.capacity / this.rule.windowMs) >= this.rule.capacity) this.buckets.delete(k);
    }
    if (this.buckets.size >= this.maxKeys) this.buckets.clear();
  }
}

/** Caps concurrent in-flight operations per key (e.g. 5 code runs per user). */
export class ConcurrencyLimiter {
  private inflight = new Map<string, number>();
  constructor(private max: number) {}
  acquire(key: string): boolean {
    const n = this.inflight.get(key) ?? 0;
    if (n >= this.max) return false;
    this.inflight.set(key, n + 1);
    return true;
  }
  release(key: string) {
    const n = (this.inflight.get(key) ?? 1) - 1;
    if (n <= 0) this.inflight.delete(key);
    else this.inflight.set(key, n);
  }
  count(key: string) {
    return this.inflight.get(key) ?? 0;
  }
}

export const RATE_RULES = {
  login: { capacity: 5, windowMs: 60_000 },
  signup: { capacity: 3, windowMs: 60_000 },
  upload: { capacity: 10, windowMs: 60_000 },
  api: { capacity: 120, windowMs: 60_000 },
  media: { capacity: 60, windowMs: 60_000 },
  codeRun: { capacity: 20, windowMs: 60_000 },
  ingest: { capacity: 30, windowMs: 60_000 },
} as const satisfies Record<string, BucketRule>;
