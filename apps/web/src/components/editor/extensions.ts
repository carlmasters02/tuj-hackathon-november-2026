import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const pasteHighlightKey = new PluginKey<DecorationSet>("hmPasteHighlight");
export const redpenFocusKey = new PluginKey<DecorationSet>("hmRedpenFocus");

/** Highlights external pastes longer than 40 characters, and keeps the highlight mapped through edits. */
export const PasteHighlight = Extension.create({
  name: "hmPasteHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pasteHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const ui = tr.getMeta("uiEvent");
            if ((ui === "paste" || ui === "drop") && tr.docChanged) {
              const start = tr.before.content.findDiffStart(tr.doc.content);
              const end = tr.before.content.findDiffEnd(tr.doc.content);
              if (start != null && end) {
                const inserted = tr.doc.textBetween(start, end.b, "\n");
                const beforeText = tr.before.textBetween(0, tr.before.content.size, "\n");
                if (inserted.length > 40 && !beforeText.includes(inserted)) {
                  next = next.add(tr.doc, [Decoration.inline(start, end.b, { class: "hm-paste-external", title: "Pasted from outside this document — counted against authenticity" })]);
                }
              }
            }
            return next;
          },
        },
        props: { decorations: (state) => pasteHighlightKey.getState(state) },
      }),
    ];
  },
});

/** Shows a single RedPen focus highlight, set via a transaction meta. */
export const RedPenFocus = Extension.create({
  name: "hmRedpenFocus",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: redpenFocusKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const m = tr.getMeta(redpenFocusKey) as { from: number; to: number } | null | undefined;
            if (m === null) return DecorationSet.empty;
            if (m) return DecorationSet.create(tr.doc, [Decoration.inline(m.from, m.to, { class: "hm-redpen-focus" })]);
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => redpenFocusKey.getState(state) },
      }),
    ];
  },
});
