import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAiCrawler } from "@hm/shared/crawlers";

const PROTECTED_PREFIXES = ["/gallery", "/api/media", "/api/gallery", "/verify", "/u/", "/api/audio"];

function nonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

function csp(n: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // nonce'd scripts only; 'strict-dynamic' lets Next's nonce'd loader pull its own chunks.
    // No 'wasm-unsafe-eval' here — that is granted only to /workers/pyodide-worker.js (next.config.ts).
    `script-src 'self' 'nonce-${n}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // KaTeX/TipTap inject inline styles; scripts stay locked down
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent");

  // 1. Known AI crawlers get nothing (robots.txt stays readable so they can see the refusal).
  if (isAiCrawler(ua) && pathname !== "/robots.txt") {
    return new NextResponse("AI crawlers are not permitted on Humagination.\n", {
      status: 403,
      headers: { "Content-Type": "text/plain", "X-Robots-Tag": "noai, noimageai, noindex", "tdm-reservation": "1" },
    });
  }

  // 2. Per-request CSP nonce, forwarded to Next so it can stamp its own scripts.
  const n = nonce();
  const policy = csp(n);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", n);
  reqHeaders.set("Content-Security-Policy", policy);

  let res = NextResponse.next({ request: { headers: reqHeaders } });

  // 3. Refresh the Supabase session cookie (if configured).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          res = NextResponse.next({ request: { headers: reqHeaders } });
          for (const { name, value, options } of list)
            res.cookies.set(name, value, { ...options, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
        },
      },
    });
    // getUser() revalidates the token with Supabase Auth and rotates it when needed.
    const { data } = (await supabase.auth.getUser().catch(() => ({ data: { user: null } }))) as { data: { user: unknown } };
    // DEMO MODE: login is off — any signed-out page visit goes straight to the demo sign-in.
    const isPage = req.method === "GET" && !pathname.startsWith("/api/") && !pathname.startsWith("/auth/") && !/\.[a-z0-9]+$/i.test(pathname);
    if (process.env.HM_DEMO_MODE === "true" && !data.user && isPage) {
      const to = req.nextUrl.clone();
      to.pathname = "/auth/demo";
      to.search = `?next=${encodeURIComponent(pathname === "/login" || pathname === "/signup" ? "/dashboard" : pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(to);
    }
  }

  // 4. Security headers.
  const h = res.headers;
  h.set("Content-Security-Policy", policy);
  h.set("X-Frame-Options", "DENY");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    h.set("X-Robots-Tag", "noai, noimageai, noindex");
    h.set("tdm-reservation", "1");
  }
  return res;
}

export const config = {
  // everything except static assets (those carry no user data)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pyodide/|workers/).*)"],
};
