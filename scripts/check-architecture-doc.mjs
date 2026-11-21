import fs from "node:fs";
import { execFileSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
try {
  const doc = fs.readFileSync("ARCHITECTURE.md", "utf8");
  const readme = fs.readFileSync("README.md", "utf8");
  const required = [
    "## 1. The product contract", "## 2. Repository and runtime map", "## 3. How a request works",
    "## 4. Data, RLS and trust-sensitive writes", "## 5. Tutor implementation", "## 6. Portfolio and authenticity",
    "## 7. Dashboard and browser extension", "## 8. UI, typography and brand conventions",
    "## 9. Environment and external services", "## 10. Tests and delivery workflow",
    "## 11. Common reasons contributions are deflected", "## 12. Known limitations and future-work boundaries",
    "AI-free at runtime", "requireUser()", "assertSameOrigin", "parseJson", "rateLimit", "publicProblem()",
    "397 unique ids", "72 instructional units", "service-role", "RLS", "hash-chained events", "Ed25519",
    "/portfolio/words", "/tutor/writing", "Uploads may be shared", "grid-cols-1", "pnpm e2e:live",
    "stop development servers", "Do not commit or push unless the owner has authorized"
  ];
  for (const text of required) assert(doc.includes(text), `ARCHITECTURE.md is missing current contract detail: ${text}`);
  assert(doc.length > 12000, "architecture guide is not substantive enough for coding-agent onboarding");
  assert(readme.includes("[`ARCHITECTURE.md`](ARCHITECTURE.md)"), "README must point contributors to the guide");
  assert(!fs.readFileSync(".gitignore", "utf8").split(/\r?\n/).some((line) => line.trim() === "ARCHITECTURE.md"), "architecture guide must not be ignored");
  execFileSync("git", ["ls-files", "--error-unmatch", "ARCHITECTURE.md"], { stdio: "ignore" });
  console.log("architecture onboarding guide verified: tracked, linked, current implementation and rejection rules documented");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
