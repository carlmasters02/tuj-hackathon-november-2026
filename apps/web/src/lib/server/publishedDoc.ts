import "server-only";
import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { inText, SourceSchema, type CitationStyle, type Source } from "@hm/shared/citations";
import { SetupSchema, type DocMeta, type Setup } from "@hm/shared/docMeta";
import { pmDocToText } from "@hm/shared/provenance/pmText";
import { contentNode } from "./pm";

/** Public, finalized writing. Private comments and the draft word goal are deliberately absent. */
const PublishedDocSchema = z.object({
  content: z.unknown(),
  setup: SetupSchema,
  citationStyle: z.enum(["apa", "mla"]),
  sources: z.array(SourceSchema).max(300),
}).strict();

export interface PublishedDoc {
  content: JSONContent;
  setup: Setup;
  citationStyle: CitationStyle;
  sources: Source[];
}

export interface PreparedPublishedDoc {
  snapshot: PublishedDoc;
  text: string;
}

/** Parse, canonicalize and project a publication envelope using the real editor schema. */
export function parsePublishedDoc(raw: unknown): PreparedPublishedDoc {
  const parsed = PublishedDocSchema.parse(raw);
  const node = contentNode(parsed.content);
  return {
    snapshot: {
      content: node.toJSON() as JSONContent,
      setup: parsed.setup,
      citationStyle: parsed.citationStyle,
      sources: parsed.sources,
    },
    text: pmDocToText(node),
  };
}

/**
 * Freeze the exact content/settings associated with one certificate. This never mutates the
 * draft: comments are stripped from a deep copy and visible citation labels are baked in.
 */
export function preparePublishedDoc(content: unknown, meta: DocMeta): PreparedPublishedDoc {
  const copy = structuredClone(content) as JSONContent;
  const visit = (node: JSONContent) => {
    if (node.marks) {
      node.marks = node.marks.filter((mark) => mark.type !== "comment");
      if (node.marks.length === 0) delete node.marks;
    }
    if (node.type === "citation") {
      const source = meta.sources.find((s) => s.id === node.attrs?.sourceId);
      node.attrs = { ...node.attrs, label: inText(source, meta.citationStyle, node.attrs?.locator ?? "") };
    }
    for (const child of node.content ?? []) visit(child);
  };
  visit(copy);
  return parsePublishedDoc({ content: copy, setup: meta.setup, citationStyle: meta.citationStyle, sources: meta.sources });
}

/** Display is fail-safe: old, malformed, private, or mismatched snapshots use replayed text. */
export function publishedDocForDisplay(raw: unknown, replayedText: string): PublishedDoc | null {
  try {
    const prepared = parsePublishedDoc(raw);
    const hasComments = (node: JSONContent): boolean => node.marks?.some((mark) => mark.type === "comment") || (node.content ?? []).some(hasComments);
    return prepared.text === replayedText && !hasComments(prepared.snapshot.content) ? prepared.snapshot : null;
  } catch {
    return null;
  }
}
