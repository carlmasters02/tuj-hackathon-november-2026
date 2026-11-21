import { getSettings } from "./store";

const params = new URLSearchParams(location.search);
const domain = (params.get("d") ?? "").toLowerCase();
document.getElementById("site")!.textContent = domain || "an AI";

const TOOLS: [string, string][] = [
  ["Calculator (Desmos)", "https://www.desmos.com/scientific"],
  ["Regex tester", "https://regex101.com/"],
  ["Dictionary", "https://www.merriam-webster.com/"],
  ["MDN Web Docs", "https://developer.mozilla.org/"],
  ["Python docs", "https://docs.python.org/3/"],
];

(async () => {
  const { serverUrl } = await getSettings();
  const tools: [string, string][] = [["StepCheck (math)", `${serverUrl}/tutor/math`], ["Code Dojo", `${serverUrl}/tutor/code`], ...TOOLS];
  const box = document.getElementById("tools")!;
  for (const [label, href] of tools) {
    const a = document.createElement("a");
    a.className = "btn sun";
    a.textContent = label;
    a.href = href;
    a.addEventListener("click", () => void chrome.runtime.sendMessage({ type: "redirected" }));
    box.appendChild(a);
  }
})();

let left = 120;
const timer = document.getElementById("timer")!;
const iv = setInterval(() => {
  left = Math.max(0, left - 1);
  timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  if (left === 0) {
    clearInterval(iv);
    timer.textContent = "✓ thought first";
  }
}, 1000);

document.getElementById("continue")!.addEventListener("click", () => {
  void chrome.runtime.sendMessage({ type: "bypass", domain });
});
