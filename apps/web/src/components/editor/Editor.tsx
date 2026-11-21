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

interface Props {
  docId: string;
  title: string;
  content: unknown;
  lastSeq: number;
  headHash: string | null;
}

const STATUS_TEXT: Record<RecorderStatus, string> = {
  idle: "Every keystroke is being recorded",
  saving: "Saving…",
  saved: "Saved · log verified by server",
  offline: "Offline — will retry",
  conflict: "Stopped",
};

export function Editor({ docId, title: initialTitle, content, lastSeq, headHash }: Props) {
  const router = useRouter();
  const recorder = useRef<ProvenanceRecorder | null>(null);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [pasteWarnings, setPasteWarnings] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="min-w-0 flex-1 bg-transparent font-serif text-3xl tracking-tight outline-none placeholder:text-paper-faint"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            aria-label="Title"
          />
          {!confirmFinalize ? (
            <button className="btn btn-primary" disabled={finalizing || status === "conflict" || !text.trim()} onClick={() => setConfirmFinalize(true)}>
              Finalize & certify
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-paper-dim">This publishes the text and its replay at a public link.</span>
              <button className="btn btn-primary" disabled={finalizing} onClick={finalize}>{finalizing ? "Verifying…" : "Confirm"}</button>
              <button className="btn btn-ghost" onClick={() => setConfirmFinalize(false)}>Cancel</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-paper-faint">
          <span className={`inline-block h-2 w-2 rounded-full ${status === "conflict" ? "bg-redpen" : status === "offline" ? "bg-warn" : "bg-ok"}`} />
          <span>{STATUS_TEXT[status]}</span>
          {pasteWarnings > 0 && (
            <span className="chip border-warn/50 text-warn">{pasteWarnings} external paste{pasteWarnings > 1 ? "s" : ""} highlighted — they count against authenticity</span>
          )}
        </div>
        {error && <p role="alert" className="rounded-md border border-redpen/50 bg-redpen-dim p-3 text-sm">{error} {status === "conflict" && <button className="link" onClick={() => location.reload()}>Reload</button>}</p>}
        <Toolbar editor={editor} />
        <div className="hm-editor card min-h-[60vh] px-6 py-5 sm:px-10">
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <RedPenPanel text={text} onFocusFlag={focusFlag} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;
  const b = (label: string, active: boolean, run: () => void, title: string) => (
    <button type="button" title={title} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={run} className={`rounded px-2 py-1 text-sm ${active ? "bg-ink-3 text-paper" : "text-paper-dim hover:bg-ink-3"}`}>
      {label}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-ink-2 p-1">
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
