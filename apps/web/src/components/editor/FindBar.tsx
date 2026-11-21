"use client";
import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { APP_EDIT_MAX_CHARS } from "@hm/shared/provenance/types";
import { gotoMatch, replaceAll, replaceCurrent, searchKey, setSearch } from "./clientExtensions";

export function FindBar({ editor, replace: startReplace, onClose }: { editor: Editor; replace: boolean; onClose: () => void }) {
  const [q, setQ] = useState(() => editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").slice(0, 100));
  const [rep, setRep] = useState("");
  const [showRep, setShowRep] = useState(startReplace);
  const [cs, setCs] = useState(false);
  const [note, setNote] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const st = useEditorState({ editor, selector: ({ editor: e }) => { const s = searchKey.getState(e.state)!; return { n: s.matches.length, cur: s.current }; } });
  useEffect(() => setShowRep((r) => r || startReplace), [startReplace]);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  useEffect(() => setSearch(editor, { query: q, caseSensitive: cs, current: 0 }), [q, cs, editor]);
  useEffect(() => () => setSearch(editor, { query: "" }), [editor]);
  const close = () => {
    onClose();
    editor.commands.focus();
  };
  return (
    <div role="search" className="hm-pop flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-soft)]" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="flex min-w-[220px] flex-1 items-center gap-1 rounded-lg border border-line bg-white pr-1 focus-within:ring-4 focus-within:ring-sun/40">
        <input ref={input} aria-label="Find" className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none" placeholder="Find in document" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), gotoMatch(editor, e.shiftKey ? -1 : 1))} />
        <span className="text-xs text-fg-faint tabular-nums" aria-live="polite">{q ? `${st.n ? st.cur + 1 : 0} of ${st.n}` : ""}</span>
        <button type="button" aria-label="Previous match" className="rounded p-1 hover:bg-muted" onClick={() => gotoMatch(editor, -1)}><ChevronUp className="h-4 w-4" /></button>
        <button type="button" aria-label="Next match" className="rounded p-1 hover:bg-muted" onClick={() => gotoMatch(editor, 1)}><ChevronDown className="h-4 w-4" /></button>
      </div>
      <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} />Match case</label>
      {!showRep && <button type="button" className="text-xs font-semibold text-fg-dim hover:text-fg" onClick={() => setShowRep(true)}>Replace…</button>}
      {showRep && (
        <>
          <input aria-label="Replace with" className="input w-48 py-1.5" placeholder="Replace with" value={rep} maxLength={APP_EDIT_MAX_CHARS} onChange={(e) => setRep(e.target.value)} />
          <button type="button" className="btn px-2.5 py-1.5" disabled={!st.n} onClick={() => { replaceCurrent(editor, rep); setNote(""); }}>Replace</button>
          <button type="button" className="btn px-2.5 py-1.5" disabled={!st.n} onClick={() => { const n = replaceAll(editor, rep); setNote(`Replaced ${n}`); }}>Replace all</button>
        </>
      )}
      {note && <span className="text-xs text-fg-dim" aria-live="polite">{note}</span>}
      <button type="button" aria-label="Close find" className="ml-auto rounded p-1 hover:bg-muted" onClick={close}><X className="h-4 w-4" /></button>
      {showRep && <p className="basis-full px-1 text-[11px] text-fg-faint">Replacements are recorded as app edits and don&apos;t count as typed text.</p>}
    </div>
  );
}
