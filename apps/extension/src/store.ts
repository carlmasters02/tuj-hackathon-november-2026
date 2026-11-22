/**
 * Everything the extension keeps. Note what is NOT here: no URLs, page titles, page content,
 * prompts or keystrokes. Only {date → domain → seconds} and Think First counters.
 */
export interface Settings {
  serverUrl: string;
  token: string;
  thinkFirst: boolean;
  customDomains: string[];
}

export interface LocalData {
  days: Record<string, Record<string, number>>; // date → domain → seconds
  thinkFirst: Record<string, { redirected: number; bypassed: number }>;
  lastSync: { at: string; ok: boolean; message: string; relianceScore?: number; streak?: number } | null;
}

export const DEFAULT_SETTINGS: Settings = { serverUrl: "http://localhost:3000", token: "", thinkFirst: false, customDomains: [] };

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) };
}
export async function setSettings(s: Partial<Settings>) {
  await chrome.storage.local.set({ settings: { ...(await getSettings()), ...s } });
}
export async function getData(): Promise<LocalData> {
  const r = await chrome.storage.local.get(["days", "thinkFirst", "lastSync"]);
  return { days: (r.days ?? {}) as LocalData["days"], thinkFirst: (r.thinkFirst ?? {}) as LocalData["thinkFirst"], lastSync: (r.lastSync ?? null) as LocalData["lastSync"] };
}

export const today = () => new Date().toISOString().slice(0, 10);

/** The exact JSON body the sync sends — also rendered verbatim in the popup. */
export async function buildPayload() {
  const { days, thinkFirst } = await getData();
  const cutoff = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  return {
    days: Object.entries(days)
      .filter(([d]) => d >= cutoff)
      .flatMap(([date, doms]) => Object.entries(doms).map(([domain, seconds]) => ({ date, domain, seconds }))),
    thinkFirst: Object.entries(thinkFirst)
      .filter(([d]) => d >= cutoff)
      .map(([date, v]) => ({ date, ...v })),
  };
}

export async function sync(): Promise<LocalData["lastSync"]> {
  const s = await getSettings();
  let result: LocalData["lastSync"];
  if (!s.token) result = { at: new Date().toISOString(), ok: false, message: "Not connected yet. Open Options and paste your token from Settings → Extension tokens." };
  else {
    try {
      const res = await fetch(new URL("/api/tracker/ingest", s.serverUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.token}` },
        body: JSON.stringify(await buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      result = res.ok
        ? { at: new Date().toISOString(), ok: true, message: `Synced ${data.accepted} ${data.accepted === 1 ? "entry" : "entries"}`, relianceScore: data.relianceScore, streak: data.streak }
        : { at: new Date().toISOString(), ok: false, message: data.error ?? `Couldn't sync (error ${res.status}). Try again later.` };
    } catch {
      result = { at: new Date().toISOString(), ok: false, message: "Couldn't reach Humagination. Check your connection and the server address in Options." };
    }
  }
  await chrome.storage.local.set({ lastSync: result });
  return result;
}
