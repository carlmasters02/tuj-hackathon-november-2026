import { matchAiDomain } from "@hm/shared/aiDomains";
import { advance, addCredit, type TrackState } from "./accounting";
import { getData, getSettings, sync, today } from "./store";

const HEARTBEAT = "hm-tick";
const SYNC = "hm-sync";
const ALLOW_MINUTES = 20;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(HEARTBEAT, { periodInMinutes: 0.5 });
  chrome.alarms.create(SYNC, { periodInMinutes: 60 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT, { periodInMinutes: 0.5 });
  chrome.alarms.create(SYNC, { periodInMinutes: 60 });
});
chrome.idle.setDetectionInterval(60);

/** Hostname of the focused tab in the focused window, if it's an AI domain and the user is active. */
async function activeAiDomain(): Promise<string | null> {
  const [win, idle, settings] = await Promise.all([chrome.windows.getLastFocused().catch(() => null), chrome.idle.queryState(60), getSettings()]);
  if (!win?.focused || idle !== "active") return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab?.url) return null;
  try {
    const u = new URL(tab.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return matchAiDomain(u.hostname, settings.customDomains);
  } catch {
    return null;
  }
}

let running: Promise<void> = Promise.resolve();
/** Serialized so overlapping events can't double-credit. */
function tick(): Promise<void> {
  running = running.then(async () => {
    const now = Date.now();
    const s = (await chrome.storage.session.get("track")).track as TrackState | undefined;
    const state: TrackState = s ?? { domain: null, since: now, carryMs: {} };
    const next = await activeAiDomain();
    const { state: ns, credit } = advance(state, now, next);
    await chrome.storage.session.set({ track: ns });
    if (credit) {
      const { days } = await getData();
      await chrome.storage.local.set({ days: addCredit(days, credit) });
    }
  });
  return running;
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === HEARTBEAT) void tick();
  if (a.name === SYNC) void sync();
});
chrome.tabs.onActivated.addListener(() => void tick());
chrome.windows.onFocusChanged.addListener(() => void tick());
chrome.idle.onStateChanged.addListener(() => void tick());

// Think First: intercept navigations to AI sites with an interstitial. Only the hostname is used;
// the URL is never stored, and "Continue" goes to the site's home page.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.url || info.status === "complete") void tick();
  if (!info.url || !tab.active) return;
  let host: string;
  try {
    const u = new URL(info.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return;
    host = u.hostname;
  } catch {
    return;
  }
  const settings = await getSettings();
  if (!settings.thinkFirst) return;
  const domain = matchAiDomain(host, settings.customDomains);
  if (!domain) return;
  const allow = ((await chrome.storage.session.get("allow")).allow ?? {}) as Record<string, number>;
  if ((allow[domain] ?? 0) > Date.now()) return;
  await chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`thinkfirst.html?d=${encodeURIComponent(domain)}`) });
});

async function bumpThinkFirst(kind: "redirected" | "bypassed") {
  const { thinkFirst } = await getData();
  const d = today();
  const cur = thinkFirst[d] ?? { redirected: 0, bypassed: 0 };
  cur[kind]++;
  await chrome.storage.local.set({ thinkFirst: { ...thinkFirst, [d]: cur } });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // only our own extension pages may message the worker
  if (sender.id !== chrome.runtime.id || sender.url?.startsWith("http")) return;
  (async () => {
    if (msg?.type === "bypass" && typeof msg.domain === "string") {
      const settings = await getSettings();
      const domain = matchAiDomain(msg.domain, settings.customDomains);
      if (!domain) return reply({ ok: false });
      const allow = ((await chrome.storage.session.get("allow")).allow ?? {}) as Record<string, number>;
      allow[domain] = Date.now() + ALLOW_MINUTES * 60_000;
      await chrome.storage.session.set({ allow });
      await bumpThinkFirst("bypassed");
      if (sender.tab?.id) await chrome.tabs.update(sender.tab.id, { url: `https://${domain}/` });
      reply({ ok: true });
    } else if (msg?.type === "redirected") {
      await bumpThinkFirst("redirected");
      reply({ ok: true });
    } else if (msg?.type === "sync") {
      reply(await sync());
    }
  })();
  return true;
});
