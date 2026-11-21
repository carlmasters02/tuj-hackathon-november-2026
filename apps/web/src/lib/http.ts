import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { RATE_RULES, TokenBucketLimiter } from "@hm/shared/ratelimit";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });

/** Wraps a route handler: converts thrown HttpError / ZodError into JSON responses, hides internals. */
export function api<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, { status: e.status, headers: e.status === 429 && e.extra?.retryAfter ? { "Retry-After": String(e.extra.retryAfter) } : undefined });
      if (e instanceof ZodError) return json({ error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
      console.error("[api] unhandled error:", e instanceof Error ? e.message : "unknown");
      return json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

const limiters = new Map<string, TokenBucketLimiter>();
export type RateRule = keyof typeof RATE_RULES;

/** Throws 429 when the bucket for (rule, key) is empty. */
export function rateLimit(rule: RateRule, key: string) {
  let l = limiters.get(rule);
  if (!l) limiters.set(rule, (l = new TokenBucketLimiter(RATE_RULES[rule])));
  const r = l.take(key);
  if (!r.ok) throw new HttpError(429, "Too many requests — slow down a little.", { retryAfter: Math.ceil(r.retryAfterMs / 1000) });
}

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  // x-forwarded-for is only trustworthy behind a proxy you control; first hop otherwise
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim().slice(0, 64);
}

/** CSRF defence for cookie-authenticated, state-changing requests: Origin must be our own. */
export function assertSameOrigin(req: NextRequest | Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Missing origin");
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    throw new HttpError(403, "Bad origin");
  }
  const allowed = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : host;
  if (o.host !== allowed && o.host !== host) throw new HttpError(403, "Cross-origin request blocked");
}

/** Reads and validates a JSON body with a hard size cap. */
export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = 1_000_000): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Request too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  return schema.parse(data);
}

export const UUID = z.string().uuid();
