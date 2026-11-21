"use client";
import katex from "katex";
import { useMemo } from "react";

/** Renders LaTeX with KaTeX (trust: false, so no \href / \url / raw HTML). */
export function Tex({ tex, display = false, className = "" }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", maxExpand: 200, maxSize: 20 });
    } catch {
      return null;
    }
  }, [tex, display]);
  if (html === null) return <span className={className}>{tex}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
