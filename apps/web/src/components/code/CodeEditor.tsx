"use client";
import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import type { Lang } from "@hm/shared/code/types";

const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value === null || e.value < 1 || e.value > tr.state.doc.lines) deco = Decoration.none;
        else deco = Decoration.set([Decoration.line({ attributes: { style: "background: rgba(229,83,61,0.18)" } }).range(tr.state.doc.line(e.value).from)]);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--color-ink-2)", color: "var(--color-paper)", borderRadius: "0.75rem", border: "1px solid var(--color-line)" },
    ".cm-content": { fontFamily: "var(--font-mono)", caretColor: "var(--color-paper)", padding: "12px 0" },
    ".cm-gutters": { backgroundColor: "transparent", color: "var(--color-paper-faint)", border: "none" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.03)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-paper)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "rgba(143,163,184,0.25) !important" },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

const LANG_EXT = { python: () => python(), c: () => cpp(), java: () => java() };

export function CodeEditor({ lang, initial, onChange, errorLine }: { lang: Lang; initial: string; onChange: (s: string) => void; errorLine: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          LANG_EXT[lang](),
          theme,
          errorLineField,
          EditorState.tabSize.of(4),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
  }, [lang]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine]);

  return <div ref={host} className="min-h-[340px] text-sm [&_.cm-editor]:min-h-[340px]" />;
}
