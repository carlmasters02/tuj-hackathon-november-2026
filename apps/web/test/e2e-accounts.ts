/**
 * Two-account end-to-end check for real logins (demo mode OFF).
 *
 *   pnpm --filter web exec tsx test/e2e-accounts.ts https://humagination.vercel.app
 *
 * Signs up two throwaway accounts, checks that signed-out visitors are sent to /login (not the demo),
 * that each person can log out and back in, that each person's drafts, documents and portfolio
 * pieces are private to them and can't be changed or deleted by the other, and that published work is
 * still visible, likeable and commentable by others. Both accounts are deleted at the end through the
 * app's own delete-account flow. Prints PASS/FAIL per step; exits non-zero on any failure.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { creationGenesis, creationHead, type CreationEvent } from "@hm/shared/creation";

const BASE = (process.argv[2] ?? "https://humagination.vercel.app").replace(/\/$/, "");
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** A browser-like client with its own cookie jar. */
function client() {
  const jar = new Map<string, string>();
  async function req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("Cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    if (init.method && init.method !== "GET") headers.set("Origin", BASE);
    let body = init.body;
    if (init.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.json);
    }
    let res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
    for (let tries = 0; res.status === 429 && tries < 5; tries++) {
      const wait = Number(res.headers.get("retry-after") ?? 20);
      console.log(`  (rate limited on ${path}; waiting ${wait}s as the server asks)`);
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
    }
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || pair.slice(i + 1) === "") jar.delete(pair.slice(0, i));
      else jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  }
  return { req, jar };
}
const json = async (r: Response) => r.json().catch(() => ({}) as any);

interface Person { name: string; username: string; email: string; password: string; c: ReturnType<typeof client>; alive: boolean }
function person(name: string): Person {
  const tag = randomBytes(3).toString("hex");
  return { name, username: `e2e_${name.toLowerCase()}_${tag}`, email: `humagination.e2e.${name.toLowerCase()}.${tag}@gmail.com`, password: `parchment lantern ${randomBytes(6).toString("hex")} sunrise`, c: client(), alive: false };
}

/** Records and finishes a short drawing as `p`; returns the creation id (and work/cert ids when finished). */
async function drawing(p: Person, title: string, finish: boolean) {
  const r = await p.c.req("/api/creations", { method: "POST", json: { kind: "art", title } });
  const id = (await json(r)).id as string;
  const sid = randomUUID();
  const events = Array.from({ length: 4 }, (_, i) => ({ seq: i, t: i * 700, type: "stroke", tool: "pen", color: "#1b2b5e", size: 6, pts: Array.from({ length: 25 }, (_, k) => [100 + i * 80 + k * 6, 300 + Math.round(Math.sin(k / 3) * 30)]).flat(), dur: 500 })) as CreationEvent[];
  const ev = await p.c.req(`/api/creations/${id}/events`, { method: "POST", json: { sessionId: sid, events, headHash: creationHead(creationGenesis(id, sid), events) } });
  if (!finish) return { id, saved: ev.status === 200 };
  const done = await json(await p.c.req(`/api/creations/${id}/finalize`, { method: "POST", json: { title, publish: true } }));
  return { id, saved: ev.status === 200, workId: done.workId as string | undefined, certId: done.certId as string | undefined };
}

async function main() {
  console.log(`Target ${BASE}\n`);
  const anon = client();
  const A = person("Ana");
  const B = person("Ben");
  try {
    // ── signed out: real logins, no shared demo account ─────────────────────
    let r = await anon.req("/auth/demo");
    check("demo sign-in is switched off", r.status === 404, `status ${r.status}`);
    r = await anon.req("/dashboard");
    check("signed-out visitor is sent to the login page", r.status === 307 && (r.headers.get("location") ?? "").startsWith("/login"), r.headers.get("location") ?? `status ${r.status}`);
    r = await anon.req("/login");
    const loginHtml = await r.text();
    check("login page renders a real login form", r.status === 200 && /password/i.test(loginHtml) && !loginHtml.includes("Skip login"));
    r = await anon.req("/signup");
    check("sign-up page is open", r.status === 200);
    r = await anon.req("/");
    check("site no longer shows the demo-mode banner", r.status === 200 && !(await r.text()).includes("everyone shares one demo account"));

    // ── two people sign up, each signed in to their own account ─────────────
    for (const p of [A, B]) {
      r = await p.c.req("/api/auth/signup", { method: "POST", json: { email: p.email, username: p.username, password: p.password } });
      const su = await json(r);
      p.alive = r.status === 200;
      check(`${p.name}: signs up and is signed in`, r.status === 200 && su.signedIn === true, su.error ?? "");
    }
    for (const p of [A, B]) {
      r = await p.c.req("/dashboard");
      const html = await r.text();
      const other = p === A ? B : A;
      check(`${p.name}: dashboard belongs to them`, r.status === 200 && html.includes(p.username) && !html.includes(other.username));
    }

    // ── log out and back in ─────────────────────────────────────────────────
    r = await A.c.req("/api/auth/logout", { method: "POST" });
    r = await A.c.req("/dashboard");
    check("Ana: logging out ends the session", r.status === 307 && (r.headers.get("location") ?? "").startsWith("/login"));
    r = await A.c.req("/api/auth/login", { method: "POST", json: { email: A.email, password: `${A.password}x` } });
    check("Ana: wrong password is refused", r.status >= 400 && r.status < 500, `status ${r.status}`);
    r = await A.c.req("/api/auth/login", { method: "POST", json: { email: A.email, password: A.password } });
    check("Ana: logs back in with her password", r.status === 200, (await json(r)).error ?? "");
    r = await A.c.req("/dashboard");
    check("Ana: signed in again after login", r.status === 200 && (await r.text()).includes(A.username));

    // ── each person's work is theirs ────────────────────────────────────────
    const aDone = await drawing(A, "Ana's finished drawing", true);
    check("Ana: finishes and publishes a drawing with a certificate", aDone.saved && !!aDone.workId && !!aDone.certId);
    const aDraft = await drawing(A, "Ana's private draft", false);
    check("Ana: saves a private draft", aDraft.saved);
    const bDone = await drawing(B, "Ben's finished drawing", true);
    check("Ben: finishes and publishes his own drawing", bDone.saved && !!bDone.workId && !!bDone.certId);

    r = await A.c.req("/api/docs", { method: "POST", json: { title: "Ana's essay" } });
    const aDoc = (await json(r)).id as string;
    check("Ana: creates a private document", r.status === 200 && !!aDoc);

    // Ben tries to read, change or delete Ana's things
    r = await B.c.req(`/portfolio/art/studio/${aDraft.id}`);
    check("Ben can't open Ana's draft in the studio", r.status === 404 || (r.status >= 300 && r.status < 400), `status ${r.status}`);
    const sid = randomUUID();
    const evil = [{ seq: 4, t: 9000, type: "clear" }] as CreationEvent[];
    r = await B.c.req(`/api/creations/${aDraft.id}/events`, { method: "POST", json: { sessionId: sid, events: evil, headHash: creationHead(creationGenesis(aDraft.id, sid), evil) } });
    check("Ben can't add strokes to Ana's draft", r.status === 403 || r.status === 404, `status ${r.status}`);
    r = await B.c.req(`/api/creations/${aDraft.id}/finalize`, { method: "POST", json: { title: "stolen", publish: true } });
    check("Ben can't finish or publish Ana's draft", r.status === 403 || r.status === 404, `status ${r.status}`);
    r = await B.c.req(`/api/docs/${aDoc}`);
    check("Ben can't read Ana's document", r.status === 403 || r.status === 404, `status ${r.status}`);
    r = await B.c.req(`/api/gallery/${aDone.workId}`, { method: "PATCH", json: { title: "renamed by Ben" } });
    check("Ben can't rename Ana's portfolio piece", r.status >= 400, `status ${r.status}`);
    r = await B.c.req(`/api/gallery/${aDone.workId}`, { method: "DELETE" });
    r = await A.c.req(`/portfolio/work/${aDone.workId}`);
    const workHtml = r.status === 200 ? await r.text() : "";
    check("Ben can't delete or rename Ana's portfolio piece (Ana still sees it as she named it)", workHtml.includes("Ana&#x27;s finished drawing") || workHtml.includes("Ana's finished drawing"), `status ${r.status}`);

    r = await anon.req(`/portfolio/work/${aDone.workId}`);
    check("portfolio pages ask signed-out visitors to log in", r.status === 307 && (r.headers.get("location") ?? "").startsWith("/login"), `status ${r.status}`);

    r = await B.c.req(`/api/creations/${aDraft.id}`, { method: "DELETE" });
    check("Ben can't delete Ana's drawing", r.status === 403 || r.status === 404, `status ${r.status}`);
    r = await B.c.req(`/api/docs/${aDoc}`, { method: "DELETE" });
    check("Ben can't delete Ana's document", r.status === 403 || r.status === 404, `status ${r.status}`);

    // …but published work is visible to other people and social
    r = await B.c.req(`/api/gallery/${aDone.workId}/like`, { method: "POST" });
    check("Ben can like Ana's published piece", r.status === 200, `status ${r.status}`);
    r = await B.c.req(`/api/gallery/${aDone.workId}/comments`, { method: "POST", json: { body: "Lovely lines, Ana!" } });
    check("Ben can comment on Ana's published piece", r.status === 200 || r.status === 201, `status ${r.status}`);
    r = await A.c.req(`/portfolio/work/${aDone.workId}`);
    check("Ana sees Ben's comment on her piece", r.status === 200 && (await r.text()).includes("Lovely lines, Ana!"));
    r = await anon.req(`/verify/${aDone.certId}`);
    const cert = r.status === 200 ? await r.text() : "";
    check("Ana's certificate names her as the author", cert.includes(A.username) && !cert.includes(B.username), `status ${r.status}`);

    // Ana's own draft is untouched by Ben's attempts, and she can delete her own things
    r = await A.c.req(`/portfolio/art/studio/${aDraft.id}`);
    check("Ana can still open her draft", r.status === 200);
    r = await A.c.req(`/api/creations/${aDraft.id}`, { method: "DELETE" });
    const gone = await A.c.req(`/portfolio/art/studio/${aDraft.id}`);
    check("Ana can delete her own draft", r.status === 200 && gone.status === 404, `${r.status}/${gone.status}`);
    r = await A.c.req(`/api/docs/${aDoc}`, { method: "DELETE" });
    check("Ana can delete her own document", r.status === 200, `status ${r.status}`);
  } finally {
    // ── clean up both accounts through the app's own delete flow ────────────
    for (const p of [A, B]) {
      if (!p.alive) continue;
      let r = await p.c.req("/api/account", { method: "DELETE", json: { confirmUsername: p.username } });
      if (r.status === 401 || r.status === 307) {
        await p.c.req("/api/auth/login", { method: "POST", json: { email: p.email, password: p.password } });
        r = await p.c.req("/api/account", { method: "DELETE", json: { confirmUsername: p.username } });
      }
      check(`${p.name}: account deleted`, r.status === 200, `status ${r.status}`);
      r = await client().req("/api/auth/login", { method: "POST", json: { email: p.email, password: p.password } });
      check(`${p.name}: can't log in after deletion`, r.status >= 400, `status ${r.status}`);
    }
  }
  console.log(failures ? `\n${failures} failure(s)` : "\nall two-account checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("e2e crashed:", e);
  process.exit(1);
});
