"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { pmDocToText, posAtTextOffset } from "@hm/shared/provenance/pmText";
import type { Flag } from "@hm/shared/redpen";
import { editorExtensions } from "@/lib/editorExtensions";
import { postJson, ApiError } from "@/lib/client";
import { PasteHighlight, RedPenFocus, redpenFocusKey } from "./extensions";
import { ProvenanceRecorder, type RecorderStatus } from "./recorder";
import { RedPenPanel } from "./RedPenPanel";
import { DefaultTitleWarning, TitleField } from "@/components/TitleField";
import { GenreCoach } from "./GenreCoach";
import { isDefaultTitle, type Genre } from "@hm/shared/genres";
import { HIDDEN_RULES } from "@hm/shared/genreCoach";
import type { RuleId } from "@hm/shared/redpen";

const NONE: RuleId[] = [];

interface Props {
  docId: string;
  title: string;
  content: unknown;
  lastSeq: number;
  headHash: string | null;
  genre?: Genre;
}

const STATUS_TEXT: Record<RecorderStatus, string> = {
  idle: "Every keystroke is being recorded",
  saving: "Saving…",
  saved: "Saved · log verified by server",
  offline: "Offline — will retry",
  conflict: "Stopped",
};

export function Editor({ docId, title: initialTitle, content, lastSeq, headHash, genre = "free" }: Props) {
  const router = useRouter();
  const recorder = useRef<ProvenanceRecorder | null>(null);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [pasteWarnings, setPasteWarnings] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...editorExtensions(), Placeholder.configure({ placeholder: "Start writing. Everything you type here is recorded, so you can prove you wrote it." }), PasteHighlight, RedPenFocus],
    content: content as any,
    editorProps: { attributes: { class: "focus:outline-none", spellcheck: "true" } },
    onCreate: ({ editor }) => {
      setText(pmDocToText(editor.state.doc));
      recorder.current = new ProvenanceRecorder(docId, lastSeq, headHash, () => editor.getJSON(), (s, err) => {
        setStatus(s);
        setError(err);
        if (s === "conflict") editor.setEditable(false);
      });
      recorder.current.start();
    },
    onTransaction: ({ transaction, editor }) => {
      if (!recorder.current || !transaction.docChanged) return;
      const { externalPaste } = recorder.current.record(transaction);
      if (externalPaste) setPasteWarnings((n) => n + 1);
      setText(pmDocToText(editor.state.doc));
    },
    onFocus: () => recorder.current?.focus("focus"),
    onBlur: () => recorder.current?.focus("blur"),
  });

  useEffect(() => {
    const onHide = () => void recorder.current?.flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      recorder.current?.stop();
      void recorder.current?.flush(true);
    };
  }, []);

  const focusFlag = useCallback(
    (f: Flag | null) => {
      if (!editor) return;
      const meta = f ? { from: posAtTextOffset(editor.state.doc, f.start), to: posAtTextOffset(editor.state.doc, f.end) } : null;
      editor.view.dispatch(editor.state.tr.setMeta(redpenFocusKey, meta).setMeta("addToHistory", false));
    },
    [editor],
  );

  const saveTitle = async () => {
    try {
      await postJson(`/api/docs/${docId}`, { title: title.trim() || "Untitled" }, "PATCH");
    } catch {}
  };

  const finalize = async () => {
    if (!recorder.current) return;
    setFinalizing(true);
    setError(null);
    try {
      await saveTitle();
      const drained = await recorder.current.drain();
      if (!drained) throw new Error(recorder.current.error ?? "Couldn't save the latest edits — check your connection.");
      const r = await postJson<{ certId: string }>(`/api/docs/${docId}/finalize`, {});
      router.push(`/verify/${r.certId}`);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Finalize failed");
      setFinalizing(false);
      setConfirmFinalize(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <TitleField value={title} onChange={setTitle} onBlur={saveTitle} maxLength={200} inputRef={titleRef} />
          {!confirmFinalize && (
            <button className="btn btn-primary h-[3.4rem] px-5" disabled={finalizing || status === "conflict" || !text.trim()} onClick={() => setConfirmFinalize(true)}>
              Finalize & certify
            </button>
          )}
        </div>
        {confirmFinalize && (
          <div className="hm-pop space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
            {isDefaultTitle(title) && (
              <DefaultTitleWarning
                title={title}
                onChange={() => {
                  setConfirmFinalize(false);
                  titleRef.current?.focus();
                  titleRef.current?.select();
                }}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-sm text-fg-dim">This publishes the text and its replay at a public link.</span>
              <button className="btn btn-ghost" onClick={() => setConfirmFinalize(false)} disabled={finalizing}>Cancel</button>
              <button className="btn btn-primary" disabled={finalizing} onClick={finalize}>{finalizing ? "Verifying…" : isDefaultTitle(title) ? "Publish anyway" : "Confirm"}</button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-faint">
          <span className={`inline-block h-2 w-2 rounded-full ${status === "conflict" ? "bg-redpen" : status === "offline" ? "bg-warn" : "bg-ok"}`} />
          <span>{STATUS_TEXT[status]}</span>
          {pasteWarnings > 0 && (
            <span className="chip border-warn/50 text-warn">{pasteWarnings} external paste{pasteWarnings > 1 ? "s" : ""} highlighted — they count against authenticity</span>
          )}
        </div>
        {error && <p role="alert" className="rounded-md border border-redpen/50 bg-redpen-dim p-3 text-sm">{error} {status === "conflict" && <button className="link" onClick={() => location.reload()}>Reload</button>}</p>}
        <Toolbar editor={editor} />
        <div className={`hm-editor card min-h-[60vh] px-6 py-5 sm:px-10 ${genre === "poetry" ? "hm-poem" : ""}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <GenreCoach genre={genre} text={text} />
        <RedPenPanel text={text} onFocusFlag={focusFlag} hide={(HIDDEN_RULES[genre] as RuleId[] | undefined) ?? NONE} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;
  const b = (label: string, active: boolean, run: () => void, title: string) => (
    <button type="button" title={title} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={run} className={`rounded px-2 py-1 text-sm ${active ? "bg-muted text-fg" : "text-fg-dim hover:bg-muted"}`}>
      {label}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {b("H1", editor.isActive("heading", { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), "Heading 1")}
      {b("H2", editor.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), "Heading 2")}
      {b("H3", editor.isActive("heading", { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), "Heading 3")}
      <span className="mx-1 w-px bg-line" />
      {b("B", editor.isActive("bold"), () => c().toggleBold().run(), "Bold")}
      {b("I", editor.isActive("italic"), () => c().toggleItalic().run(), "Italic")}
      <span className="mx-1 w-px bg-line" />
      {b("• List", editor.isActive("bulletList"), () => c().toggleBulletList().run(), "Bulleted list")}
      {b("1. List", editor.isActive("orderedList"), () => c().toggleOrderedList().run(), "Numbered list")}
      {b("❝ Quote", editor.isActive("blockquote"), () => c().toggleBlockquote().run(), "Quote")}
    </div>
  );
}
