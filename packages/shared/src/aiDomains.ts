/** Sites whose *active* time the extension counts. Only the hostname is ever matched or stored. */
export const AI_DOMAINS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "perplexity.ai",
  "poe.com",
  "character.ai",
  "chat.deepseek.com",
  "chat.mistral.ai",
  "grok.com",
  "meta.ai",
  "you.com",
] as const;

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function isValidDomain(d: string): boolean {
  return DOMAIN_RE.test(d);
}

/** Returns the matching tracked domain for a hostname (exact or subdomain match), else null. */
export function matchAiDomain(hostname: string, extra: readonly string[] = []): string | null {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  for (const d of [...AI_DOMAINS, ...extra]) {
    if (h === d || h.endsWith("." + d)) return d;
  }
  return null;
}
