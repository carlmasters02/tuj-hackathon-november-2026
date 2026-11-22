import { creationGenesis, creationHead, type CreationEvent } from "@hm/shared/creation";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "conflict";
type Draft<E> = E extends unknown ? Omit<E, "seq" | "t"> : never;

/**
 * Records studio/composer events and ships them every 2 s, extending the hash chain from the
 * server's last confirmed head. Same protocol as the writing editor, smaller event vocabulary.
 */
export class CreationRecorder<E extends CreationEvent> {
  readonly sessionId = crypto.randomUUID();
  private readonly t0 = performance.now();
  private queue: E[] = [];
  private nextSeq: number;
  private confirmedHead: string;
  private inflight = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  status: SaveStatus = "idle";

  constructor(
    private id: string,
    lastSeq: number,
    headHash: string | null,
    private onStatus: (s: SaveStatus, err: string | null) => void,
  ) {
    this.nextSeq = lastSeq + 1;
    this.confirmedHead = headHash ?? creationGenesis(id, this.sessionId);
  }

  /** ms since this session started — also what the server compares against its receipt times */
  now() {
    return Math.max(0, Math.round(performance.now() - this.t0));
  }

  push(e: Draft<E>, t = this.now()) {
    if (this.status === "conflict") return;
    this.queue.push({ ...e, seq: this.nextSeq++, t } as E);
  }

  /** Replace the last queued event if it hasn't been sent yet (coalesces tempo drags). */
  replaceLast(match: (e: E) => boolean, e: Draft<E>) {
    const last = this.queue[this.queue.length - 1];
    if (last && !this.inflight && match(last)) this.queue[this.queue.length - 1] = { ...e, seq: last.seq, t: this.now() } as E;
    else this.push(e);
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

  async flush(keepalive = false): Promise<boolean> {
    if (this.inflight || this.status === "conflict" || this.queue.length === 0) return this.queue.length === 0;
    this.inflight = true;
    const events = this.queue.slice(0, 500);
    const headHash = creationHead(this.confirmedHead, events);
    this.setStatus("saving");
    try {
      const res = await fetch(`/api/creations/${this.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive,
        body: JSON.stringify({ sessionId: this.sessionId, events, headHash }),
      });
      if (res.status === 409 || res.status === 400 || res.status === 404) {
        const data = await res.json().catch(() => ({}));
        this.setStatus("conflict", data.error ?? "The server rejected this change. Reload the page.");
        return false;
      }
      if (!res.ok) throw new Error(String(res.status));
      this.confirmedHead = headHash;
      this.queue = this.queue.slice(events.length);
      this.setStatus(this.queue.length ? "saving" : "saved");
      return true;
    } catch {
      this.setStatus("offline");
      return false;
    } finally {
      this.inflight = false;
    }
  }

  async drain(): Promise<boolean> {
    for (let i = 0; i < 50 && this.queue.length; i++) {
      if (this.inflight) await new Promise((r) => setTimeout(r, 100));
      else if (!(await this.flush())) return false;
    }
    return this.queue.length === 0;
  }

  private setStatus(s: SaveStatus, err: string | null = null) {
    this.status = s;
    this.onStatus(s, err);
  }
}

export const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "Recording",
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline, will retry",
  conflict: "Not saving: reload the page",
};
