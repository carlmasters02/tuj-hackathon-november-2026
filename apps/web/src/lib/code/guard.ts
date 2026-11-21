import "server-only";
import { ConcurrencyLimiter } from "@hm/shared/ratelimit";
import { HttpError, rateLimit } from "../http";

// 20 runs per minute per user (token bucket) and at most 5 in flight per user.
const inflight = new ConcurrencyLimiter(5);

export async function withRunSlot<T>(userId: string, cost: number, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < cost; i++) await rateLimit("codeRun", userId);
  if (!inflight.acquire(userId)) throw new HttpError(429, "You already have 5 runs in progress — wait for them to finish.");
  try {
    return await fn();
  } finally {
    inflight.release(userId);
  }
}
