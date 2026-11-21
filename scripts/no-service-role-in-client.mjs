#!/usr/bin/env node
// Fails if the Supabase service-role key (or its env var) can reach a browser:
//  - any file in apps/extension
//  - any "use client" module in apps/web
//  - any built client chunk in apps/web/.next/static
//  - any NEXT_PUBLIC_ variable that looks like a service/secret key
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const SKIP = new Set(["node_modules", ".git", "pyodide"]);
const NEEDLES = [/SERVICE_ROLE/, /sb_secret_/];
const problems = [];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const scan = (f, why) => {
  const t = readFileSync(f, "utf8");
  for (const n of NEEDLES) if (n.test(t)) problems.push(`${relative(root, f)} (${why}) contains ${n}`);
};

for (const f of walk(join(root, "apps", "extension"))) {
  if (f.includes(`${join("extension", "dist")}`) || /\.(m?[jt]sx?|json|html)$/.test(f)) scan(f, "extension");
}
for (const f of walk(join(root, "apps", "web", "src"))) {
  if (!/\.[jt]sx?$/.test(f)) continue;
  const t = readFileSync(f, "utf8");
  if (/^\s*["']use client["']/.test(t)) scan(f, "client component");
  if (/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET)/.test(t)) problems.push(`${relative(root, f)} exposes a secret via NEXT_PUBLIC_`);
}
for (const f of walk(join(root, "apps", "web", ".next", "static"))) {
  if (/\.js$/.test(f)) scan(f, "client bundle");
}
for (const f of walk(join(root, "packages", "shared", "src"))) {
  if (/\.[jt]sx?$/.test(f)) scan(f, "shared (bundled into browser)");
}

if (problems.length) {
  console.error("✗ service-role check FAILED:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("✓ service-role key is not referenced by any client-side code.");
