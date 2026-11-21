/**
 * Minimal Markdown → HTML for our own exercise text (fenced code, inline code, bold, italics,
 * lists, paragraphs, hard line breaks). Everything is HTML-escaped first; no links, no raw HTML.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, "$1<em>$2</em>")
    .replace(/ {2}$/gm, "<br/>");
}

export function renderMarkdown(md: string): string {
  const out: string[] = [];
  const blocks = md.replace(/\r\n/g, "\n").split(/```/);
  blocks.forEach((block, i) => {
    if (i % 2 === 1) {
      const body = block.replace(/^\w*\n/, "");
      out.push(`<pre class="overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-xs leading-relaxed">${esc(body.replace(/\n$/, ""))}</pre>`);
      return;
    }
    for (const para of block.split(/\n{2,}/)) {
      const t = para.trim();
      if (!t) continue;
      const lines = t.split("\n");
      if (lines.every((l) => /^\s*- /.test(l))) out.push(`<ul class="list-disc space-y-1 pl-5">${lines.map((l) => `<li>${inline(l.replace(/^\s*- /, ""))}</li>`).join("")}</ul>`);
      else out.push(`<p>${lines.map(inline).join("<br/>").replace(/<br\/><br\/>/g, "<br/>")}</p>`);
    }
  });
  return out.join("\n");
}
