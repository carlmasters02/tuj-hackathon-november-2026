import { buildPayload, getData, getSettings, setSettings, today } from "./store";

const $ = (id: string) => document.getElementById(id)!;

async function render() {
  const [data, settings, payload] = await Promise.all([getData(), getSettings(), buildPayload()]);
  const secs = Object.values(data.days[today()] ?? {}).reduce((a, b) => a + b, 0);
  $("today").textContent = `${Math.round(secs / 60)} min`;
  $("streak").textContent = data.lastSync?.streak != null ? `${data.lastSync.streak}d` : "–";
  $("score").textContent = data.lastSync?.relianceScore != null ? String(data.lastSync.relianceScore) : "–";
  ($("tf") as HTMLInputElement).checked = settings.thinkFirst;
  $("payload").textContent = JSON.stringify(payload, null, 1);
  $("last").textContent = data.lastSync ? `${data.lastSync.ok ? "✓" : "✗"} ${data.lastSync.message} · ${new Date(data.lastSync.at).toLocaleString()}` : "Not synced yet.";
}

($("tf") as HTMLInputElement).addEventListener("change", async (e) => {
  await setSettings({ thinkFirst: (e.target as HTMLInputElement).checked });
});
$("sync").addEventListener("click", async () => {
  $("last").textContent = "Syncing…";
  await chrome.runtime.sendMessage({ type: "sync" });
  await render();
});
void render();
