import katex from "katex";

/** Server-rendered KaTeX for static problem prompts (trusted, author-written LaTeX). */
export function TexServer({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
