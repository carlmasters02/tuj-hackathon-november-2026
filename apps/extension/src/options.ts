import { isValidDomain } from "@hm/shared/aiDomains";
import { getSettings, setSettings } from "./store";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

(async () => {
  const s = await getSettings();
  $<HTMLInputElement>("server").value = s.serverUrl;
  $<HTMLInputElement>("token").value = s.token;
  $<HTMLTextAreaElement>("domains").value = s.customDomains.join("\n");
})();

$("save").addEventListener("click", async () => {
  const msg = $("msg");
  let server: URL;
  try {
    server = new URL($<HTMLInputElement>("server").value.trim());
    if (server.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(server.hostname)) throw new Error();
  } catch {
    msg.textContent = "Server must be an https:// URL (or http://localhost).";
    return;
  }
  const token = $<HTMLInputElement>("token").value.trim();
  if (token && !/^hm_ext_[A-Za-z0-9_-]{20,100}$/.test(token)) {
    msg.textContent = "That doesn't look like a Humagination extension token.";
    return;
  }
  const domains = $<HTMLTextAreaElement>("domains").value.split(/\s+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
  const bad = domains.filter((d) => !isValidDomain(d));
  if (bad.length) {
    msg.textContent = `Not a hostname: ${bad.join(", ")}`;
    return;
  }
  // ask Chrome for permission to talk to exactly this origin
  const granted = await chrome.permissions.request({ origins: [`${server.origin}/*`] });
  if (!granted) {
    msg.textContent = "Permission to contact the server was declined.";
    return;
  }
  await setSettings({ serverUrl: server.origin, token, customDomains: domains.slice(0, 50) });
  msg.textContent = "Saved.";
});
