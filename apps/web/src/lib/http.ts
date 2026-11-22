import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { createHash } from "node:crypto";
import { RATE_RULES, TokenBucketLimiter } from "@hm/shared/ratelimit";
import { supabaseAdmin } from "./supabase/admin";

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
      if (e instanceof ZodError) return json({ error: "Some of the information sent wasn't valid. Check it and try again.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
      if (e instanceof Error && e.message.startsWith("Humagination is missing configuration")) {
        console.error("[api] missing configuration");
        const show = process.env.NODE_ENV !== "production" || process.env.HM_DETAILED_AUTH_ERRORS === "true";
        return json(
          { error: show ? `${e.message}\nThe server can't run without these. They live in apps/web/.env.local, which is NOT in git — get it from a teammate or run: node scripts/setup-env.mjs` : "The server is misconfigured.", reason: "server.missing_config" },
          { status: 500 },
        );
      }
      console.error("[api] unhandled error:", e instanceof Error ? e.message : "unknown");
      return json({ error: "Something went wrong on our side. Please try again in a moment." }, { status: 500 });
    }
  };
}

const memLimiters = new Map<string, TokenBucketLimiter>();
export type RateRule = keyof typeof RATE_RULES;

/**
 * Throws 429 when the bucket for (rule, key) is empty. Buckets live in Postgres
 * (`hm_take_token`) so every serverless instance shares them; keys are hashed so no raw IPs or
 * emails are stored. If the database can't be reached we fall back to a per-instance bucket.
 */
export async function rateLimit(rule: RateRule, key: string, message?: (retrySeconds: number) => string): Promise<void> {
  const r = RATE_RULES[rule];
  let retryMs: number;
  try {
    const { data, error } = await supabaseAdmin().rpc("hm_take_token", {
      p_key: createHash("sha256").update(`${rule}|${key}`).digest("hex"),
      p_capacity: r.capacity,
      p_window_seconds: r.windowMs / 1000,
    });
    if (error || typeof data !== "number") throw error ?? new Error("bad rate-limit response");
    retryMs = data;
  } catch {
    let l = memLimiters.get(rule);
    if (!l) memLimiters.set(rule, (l = new TokenBucketLimiter(r)));
    const t = l.take(key);
    retryMs = t.ok ? 0 : t.retryAfterMs;
  }
  if (retryMs > 0) {
    const secs = Math.ceil(retryMs / 1000);
    throw new HttpError(429, message ? message(secs) : "Too many requests — slow down a little.", { retryAfter: secs, reason: `rate_limit.${rule}` });
  }
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
  if (!origin || !host)
    throw new HttpError(403, "For your security, this request was blocked because your browser didn't say where it came from. Open Humagination directly in an up-to-date browser and try again.", { reason: "csrf.missing_origin" });
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    throw new HttpError(403, "For your security, this request was blocked. Open Humagination directly and try again.", { reason: "csrf.bad_origin" });
  }
  const allowed = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : host;
  if (o.host !== allowed && o.host !== host)
    throw new HttpError(403, `For your security, this request was blocked because it came from another website (${o.host}). Open Humagination directly at https://${host} and try again.`, { reason: "csrf.cross_origin" });
}

/** Reads and validates a JSON body with a hard size cap. */
export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = 1_000_000): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "That's too much to send at once. Try a smaller file or shorter text.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "That's too much to send at once. Try a smaller file or shorter text.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "That request couldn't be read. Reload the page and try again.");
  }
  return schema.parse(data);
}

export const UUID = z.string().uuid();
