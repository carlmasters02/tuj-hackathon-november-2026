import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { inText, type CitationStyle, type Source } from "@hm/shared/citations";
import { newId } from "@hm/shared/docMeta";
import { Citation } from "@/lib/editorExtensions";
import { APP_EDIT } from "./recorder";

// ── shared live settings the node views read (sources, style) ─────────────
export interface LiveMeta {
  sources: Source[];
  style: CitationStyle;
}
const META_EVENT = "hm-meta";
export function setLiveMeta(editor: Editor, meta: LiveMeta) {
  (editor.storage as any).hmLive = meta;
  (editor as any).emit(META_EVENT, meta);
}
const liveMeta = (editor: Editor): LiveMeta => (editor.storage as any).hmLive ?? { sources: [], style: "apa" };

/** Citation with a live label: it re-renders when sources or the style change. */
export const LiveCitation = Citation.extend({
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement("span");
      dom.className = "hm-citation";
      dom.contentEditable = "false";
      let current = node;
      const paint = () => {
        const m = liveMeta(editor);
        const src = m.sources.find((s) => s.id === current.attrs.sourceId);
        dom.textContent = inText(src, m.style, current.attrs.locator);
        dom.classList.toggle("hm-citation-missing", !src);
        dom.title = src ? `${src.title} — click Sources to edit` : "This source was removed from the document";
      };
      paint();
      (editor as any).on(META_EVENT, paint);
      return {
        dom,
        update: (n: PMNode) => {
          if (n.type !== current.type) return false;
          current = n;
          paint();
          return true;
        },
        destroy: () => (editor as any).off(META_EVENT, paint),
      };
    };
  },
});

// ── pagination ────────────────────────────────────────────────────────────
export interface PageGeometry {
  contentH: number; // usable height per page, px
  marginTop: number;
  marginBottom: number;
  gap: number; // space between sheets on screen
}
interface PageState {
  gaps: { pos: number; h: number }[];
}
export const pageKey = new PluginKey<PageState>("hmPages");

/**
 * Lays the document out on pages the way Word does: when a block doesn't fit on the current page,
 * a spacer pushes it to the top of the next one, and page breaks always start a new page.
 * Spacers are decorations, never document content, so they don't touch the recorded text.
 */
export const Pagination = Extension.create<{ geometry: () => PageGeometry; firstPageOffset: () => number; onPages: (n: number) => void }>({
  name: "hmPagination",
  addOptions: () => ({ geometry: () => ({ contentH: 864, marginTop: 96, marginBottom: 96, gap: 28 }), firstPageOffset: () => 0, onPages: () => {} }),
  addProseMirrorPlugins() {
    const opts = this.options;
    let frame = 0;
    const measure = (view: EditorView) => {
      const g = opts.geometry();
      const gaps: { pos: number; h: number }[] = [];
      let used = opts.firstPageOffset();
      let force = false;
      view.state.doc.forEach((node, offset) => {
        if (node.type.name === "pageBreak") {
          force = true;
          return;
        }
        const dom = view.nodeDOM(offset) as HTMLElement | null;
        if (!dom || !(dom instanceof HTMLElement)) return;
        const cs = getComputedStyle(dom);
        const h = dom.offsetHeight + parseFloat(cs.marginTop || "0") + parseFloat(cs.marginBottom || "0");
        if (force || (used > 0 && used + h > g.contentH)) {
          gaps.push({ pos: offset, h: Math.max(0, g.contentH - used) + g.marginBottom + g.gap + g.marginTop });
          used = 0;
          force = false;
        }
        used += h;
        while (used > g.contentH) used -= g.contentH; // a block taller than a page runs on
      });
      const prev = pageKey.getState(view.state)!;
      opts.onPages(gaps.length + 1);
      const same = prev.gaps.length === gaps.length && prev.gaps.every((x, i) => x.pos === gaps[i].pos && Math.abs(x.h - gaps[i].h) < 1);
      if (!same) view.dispatch(view.state.tr.setMeta(pageKey, { gaps }).setMeta("addToHistory", false));
    };
    return [
      new Plugin<PageState>({
        key: pageKey,
        state: {
          init: () => ({ gaps: [] }),
          apply: (tr, s) => {
            const m = tr.getMeta(pageKey) as PageState | undefined;
            if (m) return m;
            if (!tr.docChanged) return s;
            return { gaps: s.gaps.map((x) => ({ ...x, pos: tr.mapping.map(x.pos, -1) })) };
          },
        },
        props: {
          decorations: (state) => {
            const s = pageKey.getState(state)!;
            return DecorationSet.create(
              state.doc,
              s.gaps.map((x) =>
                Decoration.widget(
                  x.pos,
                  () => {
                    const d = document.createElement("div");
                    d.className = "hm-page-gap";
                    d.style.height = `${x.h}px`;
                    d.contentEditable = "false";
                    return d;
                  },
                  { side: -1, key: `gap-${x.pos}-${Math.round(x.h)}`, ignoreSelection: true },
                ),
              ),
            );
          },
        },
        view: (view) => {
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => measure(view));
          };
          schedule();
          const ro = new ResizeObserver(schedule);
          ro.observe(view.dom);
          document.fonts?.ready.then(schedule);
          return {
            update: (v, prevState) => {
              if (v.state.doc !== prevState.doc || pageKey.getState(v.state) === pageKey.getState(prevState)) schedule();
            },
            destroy: () => {
              cancelAnimationFrame(frame);
              ro.disconnect();
            },
          };
        },
      }),
    ];
  },
});

/** Ask the pagination plugin to re-measure (after settings like font or spacing change). */
export function relayout(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta("hmRelayout", Date.now()).setMeta("addToHistory", false));
}

// ── find & replace ────────────────────────────────────────────────────────
export interface SearchState {
  query: string;
  caseSensitive: boolean;
  matches: { from: number; to: number }[];
  current: number;
}
export const searchKey = new PluginKey<SearchState>("hmSearch");

function findMatches(doc: PMNode, query: string, caseSensitive: boolean) {
  const out: { from: number; to: number }[] = [];
  if (!query) return out;
  const q = caseSensitive ? query : query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const t = caseSensitive ? node.text! : node.text!.toLowerCase();
    let i = t.indexOf(q);
    while (i >= 0 && out.length < 2000) {
      out.push({ from: pos + i, to: pos + i + q.length });
      i = t.indexOf(q, i + q.length);
    }
  });
  return out;
}

export const Search = Extension.create({
  name: "hmSearch",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: "", caseSensitive: false, matches: [], current: 0 }),
          apply(tr, s) {
            const m = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (!m && !tr.docChanged) return s;
            const next = { ...s, ...m };
            const matches = findMatches(tr.doc, next.query, next.caseSensitive);
            return { ...next, matches, current: Math.min(next.current, Math.max(0, matches.length - 1)) };
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state)!;
            if (!s.query) return null;
            return DecorationSet.create(state.doc, s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? "hm-find hm-find-current" : "hm-find" })));
          },
        },
      }),
    ];
  },
});

export function setSearch(editor: Editor, s: Partial<SearchState>) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, s).setMeta("addToHistory", false));
}

export function gotoMatch(editor: Editor, dir: 1 | -1) {
  const s = searchKey.getState(editor.state)!;
  if (!s.matches.length) return;
  const current = (s.current + dir + s.matches.length) % s.matches.length;
  const m = s.matches[current];
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { current }).setSelection(TextSelection.create(editor.state.doc, m.from, m.to)).scrollIntoView());
}

/** Replace the current match. Recorded as an app edit (counts as not typed). */
export function replaceCurrent(editor: Editor, replacement: string) {
  const s = searchKey.getState(editor.state)!;
  const m = s.matches[s.current];
  if (!m) return;
  editor.view.dispatch(editor.state.tr.insertText(replacement, m.from, m.to).setMeta(APP_EDIT, true));
}

/** Replace every match, one recorded app edit per match, last to first so positions stay valid. */
export function replaceAll(editor: Editor, replacement: string): number {
  const s = searchKey.getState(editor.state)!;
  const all = [...s.matches].reverse();
  for (const m of all) editor.view.dispatch(editor.state.tr.insertText(replacement, m.from, m.to).setMeta(APP_EDIT, true));
  return all.length;
}

// ── commands for the custom nodes ─────────────────────────────────────────
export function insertFootnote(editor: Editor) {
  const id = newId();
  const { state } = editor;
  const at = state.selection.to;
  // number of footnote markers before the cursor → where the new note goes in the Notes section
  let before = 0;
  state.doc.nodesBetween(0, at, (n) => {
    if (n.type.name === "footnoteRef") before++;
  });
  const schema = state.schema;
  let tr = state.tr.insert(at, schema.nodes.footnoteRef.create({ id }));
  const note = schema.nodes.footnote.create({ id }, schema.nodes.paragraph.create());
  const last = tr.doc.lastChild!;
  let notePos: number;
  if (last.type.name === "footnotes") {
    const sectionStart = tr.doc.content.size - last.nodeSize;
    let p = sectionStart + 1;
    for (let i = 0; i < Math.min(before, last.childCount); i++) p += last.child(i).nodeSize;
    tr = tr.insert(p, note);
    notePos = p;
  } else {
    notePos = tr.doc.content.size + 1;
    tr = tr.insert(tr.doc.content.size, schema.nodes.footnotes.create(null, note));
  }
  tr = tr.setSelection(TextSelection.create(tr.doc, notePos + 2)).scrollIntoView();
  editor.view.dispatch(tr);
  editor.view.focus();
}

export function insertCitation(editor: Editor, sourceId: string, locator = "") {
  editor.chain().focus().insertContent({ type: "citation", attrs: { sourceId, locator } }).run();
}

export function insertPageBreak(editor: Editor) {
  editor.chain().focus().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run();
}

/** Keyboard shortcuts Word users expect. */
export const WriterShortcuts = Extension.create<{ onFind: (replace: boolean) => void }>({
  name: "hmShortcuts",
  addOptions: () => ({ onFind: () => {} }),
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => {
        insertPageBreak(this.editor);
        return true;
      },
      "Mod-f": () => {
        this.options.onFind(false);
        return true;
      },
      "Mod-h": () => {
        this.options.onFind(true);
        return true;
      },
      "Mod-Alt-f": () => {
        insertFootnote(this.editor);
        return true;
      },
    };
  },
});
