/**
 * Live end-to-end check of a deployed Humagination, from the user's side.
 *
 *   pnpm --filter web exec tsx test/e2e-live.ts https://humagination.vercel.app
 *
 * Signs up a throwaway account (needs "Confirm email" OFF in Supabase), exercises every feature
 * through the public HTTP API exactly like the browser does, then deletes the account through the
 * app's own "delete account" flow. Prints PASS/FAIL per step; exits non-zero on any failure.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { chainHead, genesisHash, type DocEvent } from "@hm/shared/provenance/index";

const BASE = (process.argv[2] ?? "https://humagination.vercel.app").replace(/\/$/, "");
const jar = new Map<string, string>();
let failures = 0;
const results: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`;
  results.push(line);
  console.log(line);
}

async function req(path: string, init: RequestInit & { json?: unknown; cookies?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookies !== false && jar.size) headers.set("Cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  if (init.method && init.method !== "GET") headers.set("Origin", BASE);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
  // The app rate-limits signup/login (e.g. 3 signups/min per IP). Wait as instructed and retry.
  for (let tries = 0; res.status === 429 && tries < 4; tries++) {
    const wait = Number(res.headers.get("retry-after") ?? 20);
    console.log(`  (rate limited on ${path}; waiting ${wait}s as the server asks)`);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
  }
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const name = pair.slice(0, i);
    const value = pair.slice(i + 1);
    if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || value === "") jar.delete(name);
    else jar.set(name, value);
  }
  return res;
}
const jsonOf = async (r: Response) => r.json().catch(() => ({}) as any);

(async () => {
  const tag = randomBytes(3).toString("hex");
  const username = `e2e_${tag}`;
  const email = `humagination.e2e.${tag}@gmail.com`;
  const password = `parchment lantern ${randomBytes(6).toString("hex")} sunrise`;
  console.log(`Target ${BASE} — throwaway user @${username}\n`);

  // ── accounts ─────────────────────────────────────────────────────────────
  let r = await req("/api/auth/signup", { method: "POST", json: { email, username, password: "password1234" }, cookies: false });
  check("signup rejects a common password", r.status === 400, (await jsonOf(r)).error);
  r = await req("/api/auth/signup", { method: "POST", json: { email, username, password } });
  const su = await jsonOf(r);
  check("signup succeeds and signs in immediately", r.status === 200 && su.signedIn === true, JSON.stringify(su));
  check("session cookie set", [...jar.keys()].some((k) => k.startsWith("sb-")));
  r = await req("/api/auth/signup", { method: "POST", json: { email: `x${email}`, username, password }, cookies: false });
  check("duplicate username rejected", r.status === 409);

  r = await req("/dashboard");
  const dash = await r.text();
  check("dashboard loads as the new user (not demo)", r.status === 200 && dash.includes(username) && !dash.includes("Demo Student"), `status ${r.status}`);

  r = await req("/api/auth/logout", { method: "POST" });
  jar.clear();
  r = await req("/api/docs");
  check("logged out → API refuses", r.status === 401);
  r = await req("/api/auth/login", { method: "POST", json: { email, password: password + "x" } });
  check("wrong password rejected", r.status === 401);
  r = await req("/api/auth/login", { method: "POST", json: { email, password } });
  check("login with email + password", r.status === 200);

  r = await req("/api/profile", { method: "PATCH", json: { bio: "Testing Humagination end to end.", leaderboardOptIn: true } });
  check("profile update", r.status === 200);

  // ── StepCheck ────────────────────────────────────────────────────────────
  r = await req("/api/tutor/math/check", { method: "POST", json: { problemId: "lin-3", lines: ["3x - 6 = 2x + 4", "x = 4 - 6"], activeSeconds: 20 } });
  let m = await jsonOf(r);
  check("StepCheck flags the wrong line", m.firstError === 1, m.lines?.[1]?.message);
  r = await req("/api/tutor/math/check", { method: "POST", json: { problemId: "lin-1", lines: ["x = 12 - 7", "x = 5"], activeSeconds: 30 } });
  m = await jsonOf(r);
  check("StepCheck solve awards Human Points", m.complete === true && m.points === 15, `points ${m.points}`);

  // ── Code Dojo ────────────────────────────────────────────────────────────
  r = await req("/api/code/submit", { method: "POST", json: { exerciseId: "python-01-sum-two", source: "a, b = map(int, input().split())\nprint(a + b)\n", activeSeconds: 10 } });
  const cs = await jsonOf(r);
  check("Code Dojo submit (passes, or 503 if no sandbox is hosted)", (r.status === 200 && cs.passed) || r.status === 503, r.status === 503 ? "no code sandbox configured (expected for now)" : `passed=${cs.passed}`);

  // ── Written Here: provenance → certificate ───────────────────────────────
  r = await req("/api/docs", { method: "POST", json: { title: "E2E essay" } });
  const docId = (await jsonOf(r)).id as string;
  check("create document", !!docId);
  const text = "I wrote this sentence myself, one key at a time, to test the certificate.";
  const sessionId = crypto.randomUUID();
  const events: DocEvent[] = [...text].map((ch, i) => ({ seq: i, t: i * 140, type: "insert", from: i, to: i, text: ch, len: 1 }));
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
  const headHash = chainHead(genesisHash(docId, sessionId), events);
  r = await req(`/api/docs/${docId}/events`, { method: "POST", json: { sessionId, events, headHash, content } });
  check("provenance batch accepted (hash chain + server replay)", r.status === 200, JSON.stringify(await jsonOf(r)));
  const forged = [{ ...events[0], seq: events.length, from: text.length, to: text.length, text: "X" }];
  r = await req(`/api/docs/${docId}/events`, { method: "POST", json: { sessionId, events: forged, headHash: "0".repeat(64), content } });
  check("forged batch rejected", r.status === 409);
  r = await req(`/api/docs/${docId}/finalize`, { method: "POST", json: {} });
  const fin = await jsonOf(r);
  check("finalize issues a signed certificate", r.status === 200 && !!fin.certId, `${fin.label}`);
  r = await req(`/verify/${fin.certId}`, { cookies: false });
  const vp = await r.text();
  check("public certificate page verifies signature, chain and replay", r.status === 200 && vp.includes("matches Humagination") && vp.includes("chain re-computed") && vp.includes("reproduces the certified text"));

  // ── Gallery ──────────────────────────────────────────────────────────────
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 27, g: 43, b: 94 } } })
    .composite([{ input: Buffer.from(`<svg width="320" height="240"><circle cx="${100 + Math.random() * 120}" cy="120" r="70" fill="#fbcb3d"/><rect x="20" y="20" width="${40 + Math.random() * 80}" height="60" fill="#ff9f1c"/></svg>`) }])
    .png()
    .toBuffer();
  const fd = new FormData();
  fd.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "art.png");
  fd.set("title", "E2E artwork");
  fd.set("publish", "true");
  r = await req("/api/gallery/upload", { method: "POST", body: fd });
  const up = await jsonOf(r);
  check("art upload (re-encode, dHash, watermark, encrypt)", r.status === 200 && !!up.id, up.error ?? "");
  const fake = new FormData();
  fake.set("file", new Blob([new TextEncoder().encode("<?php echo 'hi'; ?> pretending to be a png")], { type: "image/png" }), "evil.png");
  fake.set("title", "evil");
  fake.set("publish", "false");
  r = await req("/api/gallery/upload", { method: "POST", body: fake });
  check("non-image disguised as PNG rejected by magic bytes", r.status === 415);
  if (up.id) {
    r = await req(`/gallery/${up.id}`);
    const page = await r.text();
    // the URL appears in HTML (&amp;) and in the RSC payload (\u0026)
    const media = page.match(/\/api\/media\/[0-9a-f-]{36}\?exp=\d+(?:&amp;|\\u0026|&)sig=[0-9a-f]{64}/)?.[0]?.replace(/&amp;|\\u0026/, "&");
    check("work page renders with a signed media URL", r.status === 200 && !!media);
    if (media) {
      r = await req(media);
      const ct = r.headers.get("content-type");
      const img = Buffer.from(await r.arrayBuffer());
      check("viewer-watermarked image served privately", r.status === 200 && ct === "image/webp" && /no-store/.test(r.headers.get("cache-control") ?? "") && img.length > 500, `${ct}, ${img.length} bytes`);
      r = await req(media, { cookies: false });
      check("same media URL refused when signed out", r.status === 401);
      r = await req(media.replace(/sig=[0-9a-f]{4}/, "sig=0000"));
      check("tampered media signature refused", r.status === 403);
    }
    r = await req(`/api/gallery/${up.id}/comments`, { method: "POST", json: { body: "Lovely colours! <script>alert(1)</script>" } });
    const cm = await jsonOf(r);
    check("post a comment", r.status === 200 && !!cm.comment?.id);
    r = await req(`/gallery/${up.id}`);
    const withComment = await r.text();
    check("comment shows on the work page, HTML-escaped", withComment.includes("Lovely colours!") && !withComment.includes("<script>alert(1)</script>"));
    r = await req(`/api/gallery/${up.id}/comments/${cm.comment?.id}`, { method: "DELETE" });
    check("delete own comment", r.status === 200);
    r = await req(`/api/gallery/${up.id}/like`, { method: "POST" });
    check("like a work", r.status === 200);
    r = await req("/gallery", { headers: { "User-Agent": "GPTBot/1.2" }, cookies: false });
    check("GPTBot blocked from gallery", r.status === 403);
  }

  // ── Tracker extension flow ───────────────────────────────────────────────
  r = await req("/api/extension-tokens", { method: "POST", json: { label: "E2E" } });
  const token = (await jsonOf(r)).token as string;
  check("create extension token", !!token && token.startsWith("hm_ext_"));
  const today = new Date().toISOString().slice(0, 10);
  const ingest = (t: string) =>
    fetch(`${BASE}/api/tracker/ingest`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ days: [{ date: today, domain: "chatgpt.com", seconds: 900 }], thinkFirst: [{ date: today, redirected: 1, bypassed: 0 }] }) });
  r = await ingest(token);
  const ing = await jsonOf(r);
  check("extension ingest accepted", r.status === 200 && typeof ing.relianceScore === "number", `reliance ${ing.relianceScore}`);
  r = await req("/api/extension-tokens");
  const tid = (await jsonOf(r)).tokens?.[0]?.id;
  r = await req(`/api/extension-tokens/${tid}`, { method: "DELETE" });
  r = await ingest(token);
  check("revoked token refused", r.status === 401);

  r = await req("/dashboard");
  const d2 = await r.text();
  check("dashboard shows tracked AI time and points", r.status === 200 && d2.includes("chatgpt.com"));
  r = await req("/leaderboard");
  check("leaderboard lists the opted-in user", r.status === 200 && (await r.text()).includes(username));

  // ── clean up: the app's own delete-account flow ──────────────────────────
  r = await req("/api/account", { method: "DELETE", json: { confirmUsername: "wrong" } });
  check("account deletion requires typing the username", r.status === 400);
  r = await req("/api/account", { method: "DELETE", json: { confirmUsername: username } });
  check("account deleted (rows cascade, files removed)", r.status === 200);
  jar.clear();
  r = await req("/api/auth/login", { method: "POST", json: { email, password } });
  check("deleted account can no longer log in", r.status === 401);
  r = await req(`/verify/${fin.certId}`, { cookies: false });
  check("deleted user's certificate is gone too", r.status === 404);

  console.log(`\n${results.length - failures}/${results.length} passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("e2e crashed:", e);
  process.exit(2);
});
