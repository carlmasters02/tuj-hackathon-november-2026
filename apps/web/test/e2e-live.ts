/**
 * Live end-to-end check of a deployed Humagination, from the user's side.
 *
 *   pnpm --filter web exec tsx test/e2e-live.ts https://humagination.vercel.app
 *
 * Signs up a throwaway account (needs "Confirm email" OFF in Supabase), exercises every feature
 * through the public HTTP API exactly like the browser does, then deletes the account through the
 * app's own "delete account" flow. Prints PASS/FAIL per step; exits non-zero on any failure.
 */
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { chainHead, genesisHash, type DocEvent } from "@hm/shared/provenance/index";
import { creationGenesis, creationHead, type CreationEvent } from "@hm/shared/creation";
import { contentFingerprint } from "@hm/shared/contentFingerprint";
import { MATH_COURSES } from "@hm/shared/math/courses";

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

/**
 * A public page as a signed-out visitor sees it. With demo mode on, signed-out page visits are first
 * sent through the demo sign-in, so follow that like a browser would (in a separate cookie jar).
 */
async function publicPage(path: string) {
  const saved = new Map(jar);
  jar.clear();
  try {
    let r = await req(path);
    const loc = r.headers.get("location") ?? "";
    if (r.status === 307 && loc.includes("/auth/demo")) {
      const u = new URL(loc, BASE);
      for (let hop = await req(u.pathname + u.search), n = 0; hop.status >= 300 && hop.status < 400 && n < 3; n++) {
        const next = new URL(hop.headers.get("location") ?? "/", BASE);
        if (next.pathname === path) break;
        hop = await req(next.pathname + next.search);
      }
      r = await req(path);
    }
    return r;
  } finally {
    jar.clear();
    for (const [k, v] of saved) jar.set(k, v);
  }
}

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
  const wrong = await jsonOf(r);
  check("wrong password rejected", r.status === 401, wrong.reason ? `${wrong.reason}: ${wrong.error}` : wrong.error);
  r = await req("/api/auth/login", { method: "POST", json: { email: `nobody.${tag}@gmail.com`, password } });
  const none = await jsonOf(r);
  check("unknown email gets a clear reason (detailed mode) or the generic message", r.status === 401, none.reason ? `${none.reason}: ${none.error}` : none.error);
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
  for (const course of MATH_COURSES) {
    const unit = course.units[0];
    const example = unit.problems[0];
    r = await req("/api/tutor/math/check", { method: "POST", json: { problemId: example.id, lines: [example.answer], activeSeconds: 30 } });
    m = await jsonOf(r);
    check(`${course.title} semester problem works through StepCheck`, m.complete === true, example.id);
    r = await req(`/tutor/math/${course.slug}`);
    const coursePage = await r.text();
    check(`${course.title} renders its complete semester pathway`, r.status === 200 && (coursePage.match(/data-course-unit=/g) ?? []).length === 12 && coursePage.includes(unit.id) && coursePage.includes("By the end of this unit") && coursePage.includes("Extra practice"));
  }

  // ── Code Dojo ────────────────────────────────────────────────────────────
  r = await req("/api/code/submit", { method: "POST", json: { exerciseId: "python-01-sum-two", source: "a, b = map(int, input().split())\nprint(a + b)\n", activeSeconds: 10 } });
  const cs = await jsonOf(r);
  check("Code Dojo submit (passes, or 503 if no sandbox is hosted)", (r.status === 200 && cs.passed) || r.status === 503, r.status === 503 ? "no code sandbox configured (expected for now)" : `passed=${cs.passed}`);

  // ── Written Here: provenance → certificate ───────────────────────────────
  r = await req("/api/docs", { method: "POST", json: { title: "E2E essay" } });
  const docId = (await jsonOf(r)).id as string;
  check("create document", !!docId);
  const privateComment = "E2E_PRIVATE_COMMENT_NEVER_PUBLISH";
  const citationSource = {
    id: "e2esource", type: "book", authors: [{ given: "Matthew", family: "Walker" }], title: "Why We Sleep",
    container: "", publisher: "Scribner", year: "2017", volume: "", issue: "", pages: "", url: "", accessed: "",
  };
  const docSettings = {
    setup: {
      page: "a4", margins: "normal", template: "none", font: "times", fontSize: 12, lineSpacing: 2,
      pageNumbers: true, author: "E2E Writer", instructor: "", course: "", affiliation: "", date: "",
    },
    citationStyle: "apa", sources: [citationSource],
    comments: [{ id: "e2ecmt", body: privateComment, createdAt: new Date().toISOString(), resolved: false }],
    wordGoal: 500,
  };
  r = await req(`/api/docs/${docId}`, { method: "PATCH", json: { meta: docSettings } });
  check("document settings PATCH", r.status === 200, JSON.stringify(await jsonOf(r)));
  r = await req(`/api/docs/${docId}`);
  const settingsRoundTrip = await jsonOf(r);
  check("document settings round-trip", r.status === 200 && settingsRoundTrip.meta?.setup?.page === "a4" && settingsRoundTrip.meta?.sources?.[0]?.id === citationSource.id && settingsRoundTrip.meta?.wordGoal === 500);

  const text = "I wrote <b>this sentence myself</b>, one key at a time, to test the certificate.";
  const sessionId = crypto.randomUUID();
  const events: DocEvent[] = [...text].map((ch, i) => ({ seq: i, t: i * 140, type: "insert", from: i, to: i, text: ch, len: 1 }));
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
  const headHash = chainHead(genesisHash(docId, sessionId), events);
  r = await req(`/api/docs/${docId}/events`, { method: "POST", json: { sessionId, events, headHash, content, baseContentHash: contentFingerprint(settingsRoundTrip.content) } });
  check("provenance batch accepted (hash chain + server replay)", r.status === 200, JSON.stringify(await jsonOf(r)));

  const richContent = {
    type: "doc",
    content: [{ type: "paragraph", content: [
      { type: "text", text, marks: [{ type: "bold" }, { type: "comment", attrs: { id: "e2ecmt" } }] },
      { type: "citation", attrs: { sourceId: citationSource.id, locator: "", label: "" } },
    ] }],
  };
  r = await req(`/api/docs/${docId}/events`, { method: "POST", json: { sessionId, events: [], headHash, content: richContent, baseContentHash: contentFingerprint(content) } });
  check("formatting-only content save preserves the chain", r.status === 200, JSON.stringify(await jsonOf(r)));
  r = await req(`/api/docs/${docId}/events`, { method: "POST", json: { sessionId, events: [], headHash, content: richContent, baseContentHash: contentFingerprint(content) } });
  check("stale formatting-only content save rejected", r.status === 409);
  r = await req(`/api/docs/${docId}/history`);
  const history = await jsonOf(r);
  const savedBatch = history.batches?.[0];
  check("owner history returns the one real provenance batch", r.status === 200 && history.batches?.length === 1 && savedBatch?.sessionId === sessionId && savedBatch?.seqStart === 0 && savedBatch?.seqEnd === events.length - 1 && savedBatch?.events?.length === events.length && savedBatch?.headHash === headHash && !!savedBatch?.receivedAt);

  const forged = [{ ...events[0], seq: events.length, from: text.length, to: text.length, text: "X" }];
  r = await req(`/api/docs/${docId}/events`, { method: "POST", json: { sessionId, events: forged, headHash: "0".repeat(64), content: richContent, baseContentHash: contentFingerprint(richContent) } });
  check("forged batch rejected", r.status === 409);
  r = await req(`/api/docs/${docId}/finalize`, { method: "POST", json: {} });
  const fin = await jsonOf(r);
  check("finalize issues a signed certificate", r.status === 200 && !!fin.certId, `${fin.label}`);
  r = await req(`/api/docs/${docId}`, { method: "PATCH", json: { meta: docSettings } });
  check("finalized document settings are frozen", r.status === 409);
  r = await publicPage(`/verify/${fin.certId}`);
  const vp = await r.text();
  check("public certificate page verifies signature, chain and replay", r.status === 200 && vp.includes("matches Humagination") && vp.includes("chain re-computed") && vp.includes("reproduces the certified text"));
  r = await req("/api/gallery/writing", { method: "POST", json: { certId: fin.certId } });
  const publishedWriting = await jsonOf(r);
  check("publish certified writing", r.status === 200 && !!publishedWriting.id, publishedWriting.error ?? "");
  if (publishedWriting.id) {
    r = await req(`/portfolio/work/${publishedWriting.id}`);
    const writingPage = await r.text();
    check("work page renders certified formatting and frozen references", r.status === 200 && writingPage.includes("<strong>") && writingPage.includes("(Walker, 2017)") && writingPage.includes("Why We Sleep") && writingPage.includes("References"));
    check("published writing escapes typed HTML and keeps comments private", writingPage.includes("&lt;b&gt;") && !writingPage.includes(privateComment) && !writingPage.includes("data-comment"));
    check("published work links back to Words", writingPage.includes("/portfolio/words"));
  }
  r = await req("/portfolio/writing");
  check("legacy portfolio Writing route redirects to Words", r.status === 307 && r.headers.get("location") === "/portfolio/words");
  r = await req("/portfolio/words");
  const wordsPage = await r.text();
  check("Words gallery is publishing-only, not a Tutor coach", r.status === 200 && wordsPage.includes("Start a draft in Tutor") && !wordsPage.includes("Research paper coach"));

  // ── Gallery ──────────────────────────────────────────────────────────────
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 27, g: 43, b: 94 } } })
    .composite([{ input: Buffer.from(`<svg width="320" height="240"><circle cx="${100 + Math.random() * 120}" cy="120" r="70" fill="#fbcb3d"/><rect x="20" y="20" width="${40 + Math.random() * 80}" height="60" fill="#ff9f1c"/></svg>`) }])
    .png()
    .toBuffer();
  const fd = new FormData();
  fd.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "art.png");
  fd.set("title", "E2E artwork");
  fd.set("description", "E2E artist story: a window after rain.\nSecond line <b>stays text</b>");
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
    r = await req(`/portfolio/work/${up.id}`);
    const page = await r.text();
    // the URL appears in HTML (&amp;) and in the RSC payload (\u0026)
    const media = page.match(/\/api\/media\/[0-9a-f-]{36}\?exp=\d+(?:&amp;|\\u0026|&)sig=[0-9a-f]{64}/)?.[0]?.replace(/&amp;|\\u0026/, "&");
    check("work page renders with a signed media URL", r.status === 200 && !!media);
    check("artist story is formatted, escaped and explicitly not verification evidence", page.includes("Behind the Creation") && page.includes("E2E artist story: a window after rain.") && page.includes("&lt;b&gt;stays text&lt;/b&gt;") && !page.includes("<b>stays text</b>") && page.includes("not evidence for a Human-made seal"));
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
    r = await req(`/portfolio/work/${up.id}`);
    const withComment = await r.text();
    check("comment shows on the work page, HTML-escaped", withComment.includes("Lovely colours!") && !withComment.includes("<script>alert(1)</script>"));
    r = await req(`/api/gallery/${up.id}/comments/${cm.comment?.id}`, { method: "DELETE" });
    check("delete own comment", r.status === 200);
    r = await req(`/api/gallery/${up.id}/like`, { method: "POST" });
    check("like a work", r.status === 200);
    r = await req("/portfolio/art", { headers: { "User-Agent": "GPTBot/1.2" }, cookies: false });
    check("GPTBot blocked from the portfolio", r.status === 403);
  }

  // ── Drawing studio & composer: recorded, chained, server-rendered, certified ─
  const mediaOf = (html: string) => html.match(/\/api\/media\/[0-9a-f-]{36}\?exp=\d+(?:&amp;|\\u0026|&)sig=[0-9a-f]{64}/)?.[0]?.replace(/&amp;|\\u0026/, "&");
  for (const kind of ["art", "music"] as const) {
    r = await req("/api/creations", { method: "POST", json: { kind, title: `E2E ${kind}` } });
    const cid = (await jsonOf(r)).id as string;
    check(`${kind}: start a new studio piece`, r.status === 200 && !!cid);
    if (!cid) continue;
    const sid = randomUUID();
    const t0 = Date.now();
    let head = creationGenesis(cid, sid);
    let seq = 0;
    const send = async (events: Omit<CreationEvent, "seq" | "t">[], tamper = false) => {
      const evs = events.map((e) => ({ ...e, seq: seq + events.indexOf(e), t: Date.now() - t0 })) as CreationEvent[];
      const h = creationHead(head, evs);
      const res = await req(`/api/creations/${cid}/events`, { method: "POST", json: { sessionId: sid, events: evs, headHash: tamper ? "0".repeat(64) : h } });
      if (res.ok) {
        head = h;
        seq += evs.length;
      }
      return res;
    };
    const stroke = (i: number) => ({ type: "stroke", tool: i % 3 === 0 ? "marker" : "pen", color: "#1b2b5e", size: 6 + i, pts: Array.from({ length: 30 }, (_, k) => [100 + i * 60 + k * 4, 200 + Math.round(Math.sin(k / 3) * 40) + i * 30]).flat(), dur: 450 });
    for (let b = 0; b < 7; b++) {
      const evs = kind === "art" ? [stroke(b * 2), stroke(b * 2 + 1)] : [{ type: "toggle", step: b * 2, row: b }, { type: "toggle", step: b * 2 + 1, row: (b + 4) % 12 }];
      r = await send(evs as any);
      if (!r.ok) break;
      await new Promise((res) => setTimeout(res, 1000));
    }
    check(`${kind}: 7 batches of events accepted`, r.status === 200 && seq === 14, `seq ${seq}`);
    if (kind === "music") await send([{ type: "tempo", bpm: 128 }] as any);
    r = await send([kind === "art" ? { type: "undo" } : { type: "clear" }] as any, true);
    check(`${kind}: tampered hash chain rejected`, r.status === 409);
    seq += 5;
    r = await send([kind === "art" ? { type: "undo" } : { type: "clear" }] as any);
    check(`${kind}: sequence gap rejected`, r.status === 409);
    seq -= 5;
    r = await req(`/api/creations/${cid}/finalize`, { method: "POST", json: { title: `E2E ${kind} piece`, publish: true } });
    const done = await jsonOf(r);
    check(`${kind}: finish signs a certificate and publishes`, r.status === 200 && !!done.workId && !!done.certId, `verdict ${done.verdict} (too short for the seal by design)`);
    check(`${kind}: short piece is not sealed`, done.verdict !== "human_verified");
    r = await send([{ type: "clear" }] as any);
    check(`${kind}: finished piece is locked`, r.status === 409);
    r = await req(`/api/creations/${cid}/finalize`, { method: "POST", json: { title: "again" } });
    check(`${kind}: can't finish twice`, r.status === 409);
    if (!done.workId) continue;
    r = await req(`/portfolio/work/${done.workId}`);
    const html = await r.text();
    check(`${kind}: work page renders with likes and comments`, r.status === 200 && html.includes("Comments") && html.includes("See the record"));
    if (kind === "art") {
      const m = mediaOf(html);
      if (m) r = await req(m);
      const img = m ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
      const meta = img.length ? await sharp(img).metadata().catch(() => null) : null;
      check("art: server-rendered drawing served as a watermarked preview", !!m && r.status === 200 && meta?.format === "webp" && (meta?.width ?? 0) >= 800, `${meta?.width}x${meta?.height}`);
    } else check("music: score player on the work page", html.includes("Watch it being written"));
    r = await publicPage(`/verify/${done.certId}`);
    const cert = await r.text();
    check(`${kind}: public certificate re-verifies signature, chain and replay`, r.status === 200 && cert.includes("Ed25519 signature matches") && cert.includes("chain re-computed") && cert.includes("reproduces the certified"));
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
  r = await publicPage(`/verify/${fin.certId}`);
  check("deleted user's certificate is gone too", r.status === 404);

  console.log(`\n${results.length - failures}/${results.length} passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("e2e crashed:", e);
  process.exit(2);
});
