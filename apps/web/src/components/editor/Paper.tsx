"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { FONTS, MARGINS, PAGE_SIZES, type Setup } from "@hm/shared/docMeta";
import { listHeading, reference, sortedSources, type CitationStyle, type Source } from "@hm/shared/citations";
import type { PageGeometry } from "./clientExtensions";

const DPI = 96;
export const GAP = 28;

export function geometry(setup: Setup) {
  const size = PAGE_SIZES[setup.page];
  const m = MARGINS[setup.margins].in * DPI;
  const w = Math.round(size.w * DPI);
  const h = Math.round(size.h * DPI);
  return { w, h, m, geo: { contentH: h - 2 * m, marginTop: m, marginBottom: m, gap: GAP } as PageGeometry };
}

const surname = (author: string) => author.trim().split(/\s+/).pop() ?? "";

/**
 * The page view: white sheets on a desk, page numbers in the margins, the MLA heading or APA
 * title page, and a References / Works Cited page generated from the document's sources.
 */
export function Paper({
  setup, title, pages, sources, style, zoom, children, onFirstOffset,
}: {
  setup: Setup; title: string; pages: number; sources: Source[]; style: CitationStyle; zoom: number; children: ReactNode; onFirstOffset: (px: number) => void;
}) {
  const { w, h, m } = geometry(setup);
  const apaTitle = setup.template === "apa";
  const lead = apaTitle ? 1 : 0; // the APA title page comes first
  const refs = sources.length > 0;
  const total = lead + pages + (refs ? 1 : 0);
  const head = useRef<HTMLDivElement>(null);
  const fontPx = (setup.fontSize * 4) / 3;

  useLayoutEffect(() => {
    const el = head.current;
    if (!el) return onFirstOffset(0);
    const ro = new ResizeObserver(() => onFirstOffset(el.offsetHeight));
    ro.observe(el);
    onFirstOffset(el.offsetHeight);
    return () => ro.disconnect();
  }, [setup.template, setup.author, setup.instructor, setup.course, setup.date, title, onFirstOffset]);

  const runningHead = (n: number) => {
    if (!setup.pageNumbers) return null;
    const label = setup.template === "mla" ? `${surname(setup.author)} ${n}`.trim() : String(n);
    const top = setup.template === "mla" || setup.template === "apa";
    return (
      <div className="pointer-events-none absolute right-0 left-0 px-[var(--m)] text-[var(--fs)]" style={top ? { top: m / 2 - fontPx / 2, textAlign: "right" } : { bottom: m / 2 - fontPx / 2, textAlign: "center" }}>
        {label}
      </div>
    );
  };

  const sheetTop = (i: number) => i * (h + GAP);
  const docStyle = {
    "--m": `${m}px`,
    "--fs": `${fontPx}px`,
    "--lh": String(setup.lineSpacing === 1 ? 1.15 : setup.lineSpacing === 1.15 ? 1.35 : setup.lineSpacing === 1.5 ? 1.7 : 2.25),
    "--font": FONTS[setup.font].css,
    width: w,
    height: total * (h + GAP) - GAP,
  } as React.CSSProperties;

  return (
    <div className="hm-desk" style={{ height: (total * (h + GAP) - GAP) * zoom + 48 }}>
      <div className="hm-paper" data-template={setup.template} style={{ ...docStyle, transform: `scale(${zoom})` }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="hm-sheet" style={{ top: sheetTop(i), height: h }} aria-hidden>
            {runningHead(i + 1)}
          </div>
        ))}

        {apaTitle && (
          <div className="hm-title-sheet hm-doc" style={{ top: 0, height: h, padding: m }}>
            <div style={{ paddingTop: h * 0.22 }} className="text-center">
              <p className="font-bold">{title || "Title of the paper"}</p>
              <p className="mt-[1.2em]">{setup.author || "Your name"}</p>
              <p>{setup.affiliation || "Department, University"}</p>
              <p>{setup.course || "Course number and name"}</p>
              <p>{setup.instructor || "Instructor"}</p>
              <p>{setup.date || "Due date"}</p>
            </div>
          </div>
        )}

        <div className="hm-page-content hm-doc" style={{ paddingTop: sheetTop(lead) + m, paddingLeft: m, paddingRight: m }}>
          {setup.template === "mla" && (
            <div ref={head} className="hm-mla-head">
              <p>{setup.author || "Your name"}</p>
              <p>{setup.instructor || "Instructor's name"}</p>
              <p>{setup.course || "Course"}</p>
              <p>{setup.date || "Date"}</p>
              <p className="text-center">{title}</p>
            </div>
          )}
          {setup.template === "apa" && (
            <div ref={head} className="hm-mla-head">
              <p className="text-center font-bold">{title}</p>
            </div>
          )}
          {children}
        </div>

        {refs && (
          <div className="hm-refs-sheet hm-doc" style={{ top: sheetTop(lead + pages), minHeight: h, padding: m }}>
            <p className={`hm-refs-title ${style === "apa" ? "font-bold" : ""}`}>{listHeading(style)}</p>
            {sortedSources(sources).map((src) => (
              <p key={src.id} className="hm-ref">
                {reference(src, style).map((seg, i) => (seg.italic ? <em key={i}>{seg.text}</em> : <span key={i}>{seg.text}</span>))}
              </p>
            ))}
          </div>
        )}
      </div>
      <PrintStyles setup={setup} />
    </div>
  );
}

/** Print / Save as PDF: real pages with the chosen size and margins, page numbers in the margin. */
function PrintStyles({ setup }: { setup: Setup }) {
  const size = setup.page === "a4" ? "A4" : "letter";
  const m = `${MARGINS[setup.margins].in}in`;
  const num = setup.pageNumbers ? (setup.template === "mla" ? `"${surname(setup.author).replace(/["\\\n\r<>{}]/g, "")} " counter(page)` : "counter(page)") : "none";
  const box = setup.template === "none" ? "@bottom-center" : "@top-right";
  return <style>{`@media print { @page { size: ${size}; margin: ${m}; ${box} { content: ${num}; font: ${setup.fontSize}pt ${FONTS[setup.font].css.replace(/"/g, "'")}; } } }`}</style>;
}
