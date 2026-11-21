import { Mark, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";

/** Only plain web and email links; never javascript:, data: or file:. */
export const SAFE_URL = /^(https?:\/\/|mailto:)[^\s<>"]+$/i;

/** The document: body blocks, then an optional notes section that always stays at the end. */
const Document = Node.create({ name: "doc", topNode: true, content: "block+ footnotes?" });

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-type="page-break"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "page-break", class: "hm-page-break" })],
});

/** An in-text citation. The visible label is computed from the document's sources and style. */
export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    sourceId: { default: null, parseHTML: (el) => el.getAttribute("data-source"), renderHTML: (a) => ({ "data-source": a.sourceId }) },
    locator: { default: "", parseHTML: (el) => el.getAttribute("data-locator") ?? "", renderHTML: (a) => (a.locator ? { "data-locator": a.locator } : {}) },
    // frozen label, filled in only when a certified document is published
    label: { default: "", parseHTML: (el) => el.textContent ?? "", renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: "span[data-citation]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-citation": "", class: "hm-citation" }), node.attrs.label || "(citation)"],
});

/** A numbered reference to a note in the Notes section (numbered by CSS counters, in order). */
export const FootnoteRef = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ id: { default: null, parseHTML: (el) => el.getAttribute("data-footnote-ref"), renderHTML: (a) => ({ "data-footnote-ref": a.id }) } }),
  parseHTML: () => [{ tag: "sup[data-footnote-ref]" }],
  renderHTML: ({ HTMLAttributes }) => ["sup", mergeAttributes(HTMLAttributes, { class: "hm-fn-ref" })],
});

export const Footnotes = Node.create({
  name: "footnotes",
  content: "footnote+",
  isolating: true,
  parseHTML: () => [{ tag: "section[data-footnotes]" }],
  renderHTML: ({ HTMLAttributes }) => ["section", mergeAttributes(HTMLAttributes, { "data-footnotes": "", class: "hm-footnotes" }), 0],
});

export const Footnote = Node.create({
  name: "footnote",
  content: "paragraph+",
  isolating: true,
  addAttributes: () => ({ id: { default: null, parseHTML: (el) => el.getAttribute("data-footnote"), renderHTML: (a) => ({ "data-footnote": a.id }) } }),
  parseHTML: () => [{ tag: "div[data-footnote]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { class: "hm-footnote" }), 0],
});

/** A private margin comment anchored to a range. The comment text lives in the document settings. */
export const Comment = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes: () => ({ id: { default: null, parseHTML: (el) => el.getAttribute("data-comment"), renderHTML: (a) => ({ "data-comment": a.id }) } }),
  parseHTML: () => [{ tag: "span[data-comment]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { class: "hm-comment" }), 0],
});

/**
 * The one editor schema, shared by the browser editor and the server validator so their
 * plain-text projections agree. Formatting, citations, footnote markers, page breaks and
 * comments add nothing to the recorded text; only what the writer types does.
 */
export function editorExtensions() {
  return [
    StarterKit.configure({
      document: false,
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: false,
      code: false,
      horizontalRule: false,
      trailingNode: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"], isAllowedUri: (url) => SAFE_URL.test(url), HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
    }),
    Document,
    TextStyleKit.configure({ backgroundColor: false }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    PageBreak,
    Citation,
    FootnoteRef,
    Footnotes,
    Footnote,
    Comment,
  ];
}
