// Copies the Pyodide runtime (wasm + stdlib) out of node_modules into public/pyodide so the
// browser loads it from our own origin — no third-party CDN, and the CSP stays 'self'.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let src;
try {
  src = dirname(require.resolve("pyodide/package.json"));
} catch {
  console.warn("pyodide not installed yet; skipping copy");
  process.exit(0);
}
const dest = join(here, "..", "public", "pyodide");
mkdirSync(dest, { recursive: true });
const wanted = ["pyodide.mjs", "pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
for (const f of readdirSync(src)) {
  if (wanted.includes(f)) cpSync(join(src, f), join(dest, f));
}
console.log(`pyodide runtime copied to public/pyodide (${existsSync(join(dest, "pyodide.asm.wasm")) ? "ok" : "missing wasm!"})`);
