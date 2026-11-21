/** User-Agent substrings of known AI training / AI answer-engine crawlers. Matched case-insensitively. */
export const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "CCBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended",
  "PerplexityBot", "Perplexity-User", "Bytespider", "Amazonbot", "Applebot-Extended", "Meta-ExternalAgent",
  "Meta-ExternalFetcher", "FacebookBot", "cohere-ai", "cohere-training-data-crawler", "Diffbot", "omgili", "omgilibot",
  "ImagesiftBot", "YouBot", "AI2Bot", "Ai2Bot-Dolma", "PetalBot", "Timpibot", "Scrapy", "img2dataset", "DuckAssistBot",
] as const;

const RE = new RegExp(AI_CRAWLERS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

export function isAiCrawler(ua: string | null | undefined): boolean {
  return !!ua && RE.test(ua);
}
