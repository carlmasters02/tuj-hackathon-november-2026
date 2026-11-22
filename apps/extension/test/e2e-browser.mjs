/**
 * Real-browser E2E for the AI Reliance Tracker extension.
 *
 *   pnpm --filter web dev                     # a local server on :3000 (or pass another URL)
 *   pnpm --filter extension e2e:browser [http://localhost:3000]
 *
 * Builds the extension, loads it unpacked in headless Chromium, signs up a throwaway account,
 * configures the extension through its real Options page and popup, then checks Think First
 * interception and bypass, 15 s time accounting, that no URLs are stored, and that sync is
 * accepted by the server. The throwaway account is deleted at the end.
 *
 * Headless Chrome can't click a permission prompt, so the test loads a copy of the build whose
 * manifest pre-grants localhost — the one deviation from what a user installs.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const work = mkdtempSync(join(tmpdir(), "hm-ext-e2e-"));
const EXT = join(work, "ext");
const PROFILE = join(work, "profile");
cpSync(new URL("../dist", import.meta.url), EXT, { recursive: true });
const manifestPath = join(EXT, "manifest.json");
writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(readFileSync(manifestPath, "utf8")), host_permissions: ["http://localhost/*", "http://127.0.0.1/*"] }, null, 2));
const BROWSER = process.env.CHROME_BIN ?? "chromium-browser";
const chrome = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9224", `--user-data-dir=${PROFILE}`, `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--window-size=1200,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); };
let ws, page, sw, cleanup = async () => {};
try {
  let ver;
  for (let i = 0; i < 40 && !ver; i++) { try { ver = await (await fetch("http://127.0.0.1:9224/json/version")).json(); } catch { await sleep(250); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const evalIn = async (sid, expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }, sid); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };

  // 1. the unpacked extension loads and its service worker starts
  let swTarget;
  const tried = new Set();
  for (let i = 0; i < 60 && !swTarget; i++) {
    const { result } = await send("Target.getTargets");
    for (const t of result.targetInfos.filter((t) => t.type === "service_worker" && t.url.startsWith("chrome-extension://") && !tried.has(t.targetId))) {
      const sid = (await send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).result?.sessionId;
      if (!sid) continue;
      const name = await evalIn(sid, "chrome.runtime.getManifest().name").catch(() => "");
      if (name) tried.add(t.targetId);
      if (name.startsWith("Humagination")) { swTarget = t; sw = sid; break; }
    }
    if (!swTarget) await sleep(250);
  }
  check("unpacked extension loads and its background worker starts", !!swTarget, swTarget?.url);
  const extId = new URL(swTarget.url).host;
  const manifest = await evalIn(sw, "chrome.runtime.getManifest()");
  check("manifest is MV3 with only alarms, idle, storage and tabs permissions", manifest.manifest_version === 3 && (manifest.permissions ?? []).every((p) => ["alarms", "idle", "storage", "tabs"].includes(p)), `permissions: ${manifest.permissions.join(", ")}`);
  const alarms = await evalIn(sw, "chrome.alarms.getAll().then(a => a.map(x => x.name).sort())");
  check("install registers heartbeat and hourly sync alarms", JSON.stringify(alarms) === JSON.stringify(["hm-sync", "hm-tick"]), JSON.stringify(alarms));

  // 2. throwaway account + extension token, made from a normal page on the server
  const { result: pt } = await send("Target.createTarget", { url: `${BASE}/login` });
  page = (await send("Target.attachToTarget", { targetId: pt.targetId, flatten: true })).result.sessionId;
  await send("Page.enable", {}, page);
  for (let i = 0; i < 160; i++) { if ((await evalIn(page, "location.origin + document.readyState").catch(() => "")) === `${BASE}complete`) break; await sleep(250); }
  const tag = randomBytes(3).toString("hex");
  const username = `e2e_ext_${tag}`;
  const acct = await evalIn(page, `fetch("/api/auth/signup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"humagination.e2e.ext.${tag}@gmail.com",username:"${username}",password:"parchment lantern ${randomBytes(6).toString("hex")} sunrise"})}).then(async r=>({status:r.status,body:await r.json().catch(()=>({}))}))`);
  check("throwaway account created", acct.status === 200, `@${username}`);
  cleanup = async () => {
    await send("Page.navigate", { url: `${BASE}/login` }, page);
    for (let i = 0; i < 80; i++) { if ((await evalIn(page, "location.origin + document.readyState").catch(() => "")) === `${BASE}complete`) break; await sleep(250); }
    const del = await evalIn(page, `fetch("/api/account",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({confirmUsername:"${username}"})}).then(r=>r.status)`);
    check("throwaway account deleted", del === 200, `status ${del}`);
  };
  const tok = await evalIn(page, `fetch("/api/extension-tokens",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({label:"Extension browser E2E"})}).then(r=>r.json())`);
  const token = tok.token ?? tok.plaintext ?? Object.values(tok).find((v) => typeof v === "string" && v.startsWith("hm_ext_"));
  check("extension token issued", typeof token === "string" && token.startsWith("hm_ext_"));

  // 3. configure through the real Options page, then switch Think First on in the popup
  const { result: ot } = await send("Target.createTarget", { url: `chrome-extension://${extId}/options.html` });
  const opts = (await send("Target.attachToTarget", { targetId: ot.targetId, flatten: true })).result.sessionId;
  await sleep(1000);
  const setField = (fid, v) => evalIn(opts, `(()=>{const e=document.getElementById("${fid}"); e.value=${JSON.stringify(v)}; return true})()`);
  await setField("server", "https://example.com/"); await setField("token", "not-a-token");
  await evalIn(opts, `document.getElementById("save").click()`); await sleep(400);
  const badMsg = await evalIn(opts, `document.getElementById("msg").textContent`);
  check("Options rejects a malformed token", /doesn't look like/.test(badMsg), badMsg);
  await setField("server", `${BASE}/some/path`); await setField("token", token);
  await evalIn(opts, `document.getElementById("msg").textContent = ""`);
  await evalIn(opts, `document.getElementById("save").click()`);
  let optMsg = "";
  for (let i = 0; i < 20 && !optMsg; i++) { optMsg = await evalIn(opts, `document.getElementById("msg").textContent`); await sleep(200); }
  const saved = await evalIn(sw, `chrome.storage.local.get("settings").then(r=>r.settings)`);
  check("Options saves the server origin (path dropped) and token", optMsg === "Saved." && saved?.serverUrl === BASE && saved?.token === token, `${optMsg} ${saved?.serverUrl}`);
  const { result: pt0 } = await send("Target.createTarget", { url: `chrome-extension://${extId}/popup.html` });
  const pop0 = (await send("Target.attachToTarget", { targetId: pt0.targetId, flatten: true })).result.sessionId;
  await sleep(800);
  await evalIn(pop0, `document.getElementById("tf").click()`); await sleep(400);
  check("popup toggle turns Think First on", (await evalIn(sw, `chrome.storage.local.get("settings").then(r=>r.settings.thinkFirst)`)) === true);
  await send("Target.closeTarget", { targetId: pt0.targetId });
  await send("Target.closeTarget", { targetId: ot.targetId });
  await send("Target.activateTarget", { targetId: pt.targetId });

  // 4. Think First intercepts an AI site and shows the interstitial
  await send("Page.navigate", { url: "https://chatgpt.com/c/some-private-chat?q=secret" }, page);
  let url = "";
  for (let i = 0; i < 40; i++) { url = await evalIn(page, "location.href").catch(() => ""); if (url.startsWith("chrome-extension://")) break; await sleep(250); }
  check("Think First redirects an AI site to the interstitial", url === `chrome-extension://${extId}/thinkfirst.html?d=chatgpt.com`, url);
  check("interstitial keeps only the hostname (no path or query)", !url.includes("secret") && !url.includes("private-chat"));
  await sleep(500);
  const tools = await evalIn(page, `[...document.querySelectorAll('#tools a')].map(a=>a.textContent+'|'+a.href)`);
  check("interstitial offers the in-app tutors on the configured server", tools.some((t) => t.startsWith("StepCheck") && t.includes(`${BASE}/tutor/math`)), tools.slice(0, 2).join("; "));

  // 5. "Continue anyway" records a bypass, allows the site for 20 minutes and opens its home page only
  await evalIn(page, `document.getElementById("continue").click()`);
  for (let i = 0; i < 40; i++) { url = await evalIn(page, "location.href").catch(() => ""); if (url.startsWith("https://chatgpt.com")) break; await sleep(250); }
  check("bypass continues to the site's home page only", url === "https://chatgpt.com/", url);
  const store = await evalIn(sw, `Promise.all([chrome.storage.local.get("thinkFirst"), chrome.storage.session.get("allow")]).then(([l,s])=>({tf:l.thinkFirst, allow:s.allow}))`);
  const todayKey = new Date().toISOString().slice(0, 10);
  check("bypass is counted and a 20-minute allowance is stored", store.tf?.[todayKey]?.bypassed === 1 && store.allow?.["chatgpt.com"] > Date.now() + 19 * 60_000, JSON.stringify(store.tf?.[todayKey]));
  await send("Page.navigate", { url: "https://chatgpt.com/again" }, page);
  await sleep(1500);
  url = await evalIn(page, "location.href").catch(() => "");
  check("allowed site is not intercepted again", !url.startsWith("chrome-extension://"), url);

  // 6. time on the AI tab is credited by domain only, in whole 15 s ticks
  const env = await evalIn(sw, `Promise.all([chrome.windows.getLastFocused(), chrome.idle.queryState(60)]).then(([w,i])=>({focused:w.focused, idle:i}))`);
  console.log(`info  browser reports window focused=${env.focused}, idle=${env.idle}`);
  await evalIn(sw, "chrome.tabs.query({active:true}).then(([t])=>chrome.tabs.update(t.id,{active:true}))");
  await sleep(17000);
  await evalIn(sw, "chrome.tabs.query({active:true}).then(([t])=>chrome.tabs.update(t.id,{active:true}))");
  let days;
  for (let i = 0; i < 30; i++) { days = await evalIn(sw, `chrome.storage.local.get("days").then(r=>r.days)`); if (days?.[todayKey]?.["chatgpt.com"]) break; await sleep(250); }
  const stored = JSON.stringify(await evalIn(sw, "chrome.storage.local.get(null)"));
  const credited = days?.[todayKey]?.["chatgpt.com"] ?? 0;
  if (env.focused && env.idle === "active") check("active time on the AI tab is credited to its domain in 15 s ticks", credited >= 15 && credited % 15 === 0, `${credited}s`);
  else console.log(`info  skipped time-credit check: headless window not focused/active (tracked: ${JSON.stringify(days)})`);
  check("storage holds no URLs, paths or queries", !stored.includes("/again") && !stored.includes("secret") && !stored.includes("https://chatgpt"));

  // 7. sync from the popup sends the exact payload to the server
  const { result: pp } = await send("Target.createTarget", { url: `chrome-extension://${extId}/popup.html` });
  const popup = (await send("Target.attachToTarget", { targetId: pp.targetId, flatten: true })).result.sessionId;
  await sleep(1200);
  const payloadShown = await evalIn(popup, `document.getElementById("payload").textContent`);
  check("popup shows the exact JSON that will be sent", payloadShown.includes('"thinkFirst"') && payloadShown.includes('"bypassed": 1') && (credited === 0 || payloadShown.includes('"chatgpt.com"')), payloadShown.replace(/\s+/g, " ").slice(0, 120));
  await evalIn(popup, `document.getElementById("sync").click()`);
  let last;
  for (let i = 0; i < 40; i++) { last = await evalIn(sw, `chrome.storage.local.get("lastSync").then(r=>r.lastSync)`); if (last) break; await sleep(250); }
  check("sync reaches the server and is accepted", last?.ok === true && typeof last.relianceScore === "number", JSON.stringify(last));
  const lastText = await evalIn(popup, `document.getElementById("last").textContent`);
  console.log(`info  popup status line: ${lastText}`);

} catch (e) {
  failures++;
  console.log("FAIL  extension E2E crashed —", e.message);
} finally {
  try { await cleanup(); } catch (e) { console.log("FAIL  cleanup —", e.message); failures++; }
  try { ws?.close(); } catch {}
  chrome.kill();
  rmSync(work, { recursive: true, force: true });
  console.log(failures ? `\n${failures} failure(s)` : "\nall extension checks passed");
  process.exit(failures ? 1 : 0);
}
