import React from "react";
import { generateHTML } from "@tiptap/html/server";
import { listHeading, reference, sortedSources } from "@hm/shared/citations";
import { FONTS } from "@hm/shared/docMeta";
import { editorExtensions } from "@/lib/editorExtensions";
import type { PublishedDoc } from "@/lib/server/publishedDoc";

/** Server-rendered, schema-generated HTML for a certified publication snapshot. */
export function WritingDocument({ doc }: { doc: PublishedDoc }) {
  const html = generateHTML(doc.content, editorExtensions());
  const style = {
    "--font": FONTS[doc.setup.font].css,
    "--fs": `${(doc.setup.fontSize * 4) / 3}px`,
    "--lh": String(doc.setup.lineSpacing === 1 ? 1.15 : doc.setup.lineSpacing === 1.15 ? 1.35 : doc.setup.lineSpacing === 1.5 ? 1.7 : 2.25),
  } as React.CSSProperties;

  return (
    <div className="hm-published hm-doc relative mx-auto max-w-[74ch]" data-template={doc.setup.template} style={style}>
      <div className="hm-published-body break-words" dangerouslySetInnerHTML={{ __html: html }} />
      {doc.sources.length > 0 && (
        <section className="hm-published-refs mt-12 border-t border-line pt-8" aria-label={listHeading(doc.citationStyle)}>
          <h2 className={`hm-refs-title ${doc.citationStyle === "apa" ? "font-bold" : ""}`}>{listHeading(doc.citationStyle)}</h2>
          {sortedSources(doc.sources).map((source) => (
            <p key={source.id} className="hm-ref break-words">
              {reference(source, doc.citationStyle).map((segment, i) => segment.italic ? <em key={i}>{segment.text}</em> : <span key={i}>{segment.text}</span>)}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
