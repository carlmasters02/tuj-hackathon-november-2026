import type { Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { chainHead, diffRange, genesisHash, pmDocToText, type DocEvent } from "@hm/shared/provenance/index";
import { APP_EDIT_MAX_CHARS } from "@hm/shared/provenance/types";
import { contentFingerprint } from "@hm/shared/contentFingerprint";

/** Transaction meta for edits the app makes on the writer's behalf (Find & Replace). */
export const APP_EDIT = "hmAppEdit";

export type RecorderStatus = "idle" | "saving" | "saved" | "offline" | "conflict";

/**
 * Turns ProseMirror transactions into provenance events and ships them to the server in
 * batches every 2 s, extending the hash chain from the server's last confirmed head.
 */
export class ProvenanceRecorder {
  readonly sessionId = crypto.randomUUID();
  private readonly t0 = performance.now();
  private queue: DocEvent[] = [];
  private nextSeq: number;
  private confirmedHead: string;
  private confirmedContentHash: string;
  private inflight = false;
  private flushKeepalive = false;
  private contentDirty = false;
  private contentVersion = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** the text as of the last recorded event; every new event is diffed against this */
  private lastText: string;
  status: RecorderStatus = "idle";
  error: string | null = null;

  constructor(
    private docId: string,
    lastSeq: number,
    headHash: string | null,
    private getContent: () => unknown,
    private onStatus: (s: RecorderStatus, err: string | null) => void,
    initialText = "",
  ) {
    this.lastText = initialText;
    this.nextSeq = lastSeq + 1;
    this.confirmedHead = headHash ?? genesisHash(docId, this.sessionId);
    this.confirmedContentHash = contentFingerprint(this.getContent());
  }

  private now() {
    return Math.max(0, Math.round(performance.now() - this.t0));
  }

  private push(e: Omit<DocEvent, "seq" | "t">) {
    if (this.status === "conflict") return;
    this.queue.push({ ...e, seq: this.nextSeq++, t: this.now() } as DocEvent);
  }

  focus(kind: "focus" | "blur") {
    this.push({ type: kind, from: 0, to: 0, len: 0 });
  }

  /**
   * Records the change a transaction made. The diff is taken against the last *recorded* text
   * and the editor's final document, so edits appended by plugins (tables, lists) are never
   * missed and the log can't drift from the content.
   */
  record(tr: Transaction, docAfter: PMNode = tr.doc): { externalPaste: boolean; text: string } {
    // Formatting and atom-only changes still need a content save, but they must not create
    // pretend typing events. Versions distinguish edits made while a request is in flight.
    if (tr.docChanged) {
      this.contentDirty = true;
      this.contentVersion++;
      if (this.status === "saved") this.setStatus("idle");
    }
    const before = this.lastText;
    const after = pmDocToText(docAfter);
    if (after === before) return { externalPaste: false, text: after };
    const d = diffRange(before, after);
    this.lastText = after;
    if (!d) return { externalPaste: false, text: after };
    const ui = tr.getMeta("uiEvent") as string | undefined;
    const meta = (tr as any).meta ?? {};
    const historyKey = Object.keys(meta).find((k) => k.startsWith("history") || k.startsWith("undoRedo"));
    const hist = historyKey ? meta[historyKey] : null;
    const text = d.text;
    let type: DocEvent["type"];
    let src: DocEvent["src"];
    if (ui === "paste" || ui === "drop") {
      type = "paste";
      src = text.length > 0 && before.includes(text) ? "internal" : "external";
    } else if (ui === "cut") type = "cut";
    else if (hist && typeof hist === "object" && "redo" in hist) type = hist.redo ? "redo" : "undo";
    else type = d.from === d.to ? "insert" : text.length === 0 ? "delete" : "replace";
    if (tr.getMeta(APP_EDIT) && type !== "paste" && text.length <= APP_EDIT_MAX_CHARS && (type === "insert" || type === "replace" || type === "delete")) src = "app";
    const ev: Omit<DocEvent, "seq" | "t"> = { type, from: d.from, to: d.to, len: text.length };
    if (text.length) (ev as DocEvent).text = text;
    if (src) (ev as DocEvent).src = src;
    this.push(ev);
    return { externalPaste: type === "paste" && src === "external" && text.length > 40, text: after };
  }

  start() {
    this.timer = setInterval(() => void this.flush(), 2000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  get pending() {
    return this.queue.length;
  }

  private get needsFlush() {
    return this.queue.length > 0 || this.contentDirty;
  }

  async flush(keepalive = false): Promise<boolean> {
    if (this.status === "conflict") return false;
    if (!this.needsFlush) return true;
    if (this.inflight) {
      // A page can unload while an earlier save is running. Queue one final keepalive save
      // rather than silently dropping edits that arrived after that request's snapshot.
      if (keepalive) this.flushKeepalive = true;
      return false;
    }
    this.inflight = true;
    // The whole queue: this content snapshot describes the state after its last event. An
    // empty event list is a formatting-only save and leaves the provenance chain unchanged.
    const events = this.queue.slice();
    const content = this.getContent();
    const contentVersion = this.contentVersion;
    const baseContentHash = this.confirmedContentHash;
    const headHash = chainHead(this.confirmedHead, events);
    this.setStatus("saving");
    try {
      const res = await fetch(`/api/docs/${this.docId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive,
        body: JSON.stringify({ sessionId: this.sessionId, events, headHash, content, baseContentHash }),
      });
      if (res.status === 409 || res.status === 400 || res.status === 404) {
        const data = await res.json().catch(() => ({}));
        this.setStatus("conflict", data.error ?? "The server rejected this edit. Reload the document.");
        return false;
      }
      if (!res.ok) throw new Error(String(res.status));
      this.confirmedHead = headHash;
      this.confirmedContentHash = contentFingerprint(content);
      this.queue = this.queue.slice(events.length);
      if (this.contentVersion === contentVersion) this.contentDirty = false;
      this.setStatus(this.needsFlush ? "saving" : "saved");
      return true;
    } catch {
      this.setStatus("offline");
      return false;
    } finally {
      this.inflight = false;
      if (this.flushKeepalive) {
        this.flushKeepalive = false;
        if (this.needsFlush) void this.flush(true);
      }
    }
  }

  /** Flushes all text events and content-only changes (used before Finalize). */
  async drain(): Promise<boolean> {
    for (let i = 0; i < 50 && this.needsFlush; i++) {
      if (this.inflight) await new Promise((r) => setTimeout(r, 100));
      else if (!(await this.flush())) return false;
    }
    return !this.needsFlush;
  }

  private setStatus(s: RecorderStatus, err: string | null = null) {
    this.status = s;
    this.error = err;
    this.onStatus(s, err);
  }
}
