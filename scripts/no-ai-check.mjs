#!/usr/bin/env node
// Fails (exit 1) if any banned AI package or model-API hostname appears in the repo.
// Scans: every package.json (deps + devDeps + optional + peer), the pnpm lockfile
// (catches transitive installs) and all source files under apps/, packages/, scripts/.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED_HOSTS, isBannedPackage, isBannedPyPackage } from "./banned-ai.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", "coverage", "pyodide", ".turbo"]);
const SRC_EXT = /\.(m?[jt]sx?|cjs|json|html|css|sql|ya?ml|py)$/;
// These files legitimately contain the banned strings (they define the rules).
const SELF = new Set([join("scripts", "banned-ai.mjs"), join("scripts", "no-ai-check.mjs")]);

const problems = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);

// 1. package.json dependency sections
for (const f of files.filter((f) => f.endsWith(`${sep}package.json`) || f === join(root, "package.json"))) {
  const pkg = JSON.parse(readFileSync(f, "utf8"));
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const dep of Object.keys(pkg[section] ?? {})) {
      if (isBannedPackage(dep)) problems.push(`${relative(root, f)}: ${section} contains banned package "${dep}"`);
    }
  }
}

// 2. lockfile (transitive dependencies)
const lock = join(root, "pnpm-lock.yaml");
if (existsSync(lock)) {
  const text = readFileSync(lock, "utf8");
  const seen = new Set();
  // package keys look like:  "  /name@1.2.3:"  or  "  name@1.2.3:"  or  "  '@scope/name@1.2.3':"
  for (const m of text.matchAll(/^ {2}['"]?\/?((?:@[^/@'"\s]+\/)?[^@'"\s/]+)@[^:\s]+['"]?:\s*$/gm)) {
    const name = m[1];
    if (!seen.has(name) && isBannedPackage(name)) {
      seen.add(name);
      problems.push(`pnpm-lock.yaml: banned package "${name}" is installed (possibly transitively)`);
    }
  }
}

// 2b. Python dependency manifests anywhere in the repo
for (const f of files) {
  const rel = relative(root, f);
  const base = rel.split(/[\\/]/).pop();
  if (/^requirements.*\.txt$/i.test(base) || base === "Pipfile") {
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const name = line.replace(/#.*/, "").trim().split(/[\s=<>!~[;@]/)[0];
      if (name && isBannedPyPackage(name)) problems.push(`${rel}: Python dependency "${name}" is banned`);
    }
  } else if (base === "pyproject.toml") {
    for (const m of readFileSync(f, "utf8").matchAll(/["']([A-Za-z0-9_.-]+)\s*(?:[<>=!~[;].*?)?["']/g))
      if (isBannedPyPackage(m[1])) problems.push(`${rel}: Python dependency "${m[1]}" is banned`);
  }
}

// 3. source files: imports of banned packages + banned hostnames
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"'./][^"']*)["']/g;
for (const f of files) {
  const rel = relative(root, f);
  if (SELF.has(rel) || !SRC_EXT.test(f) || rel === "pnpm-lock.yaml") continue;
  const isPy = rel.endsWith(".py");
  if (!isPy && !/^(apps|packages|scripts|supabase|infra)[\\/]/.test(rel)) continue;
  const text = readFileSync(f, "utf8");
  if (isPy) {
    for (const m of text.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
      const mod = (m[1] ?? m[2]).split(".")[0];
      if (isBannedPyPackage(mod)) problems.push(`${rel}: imports banned Python module "${mod}"`);
    }
  }
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1];
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (isBannedPackage(name) || isBannedPackage(name + "/")) problems.push(`${rel}: imports banned package "${spec}"`);
  }
  const lower = text.toLowerCase();
  for (const host of BANNED_HOSTS) {
    if (lower.includes(host)) problems.push(`${rel}: references model API host "${host}"`);
  }
}

if (problems.length) {
  console.error("✗ no-ai-check FAILED — Humagination must stay AI-free:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`✓ no-ai-check passed — scanned ${files.length} files. Verified AI-free.`);
