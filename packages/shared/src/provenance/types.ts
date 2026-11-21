import { z } from "zod";

export const EVENT_TYPES = ["insert", "delete", "replace", "paste", "cut", "undo", "redo", "focus", "blur"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * One editor change. Positions are offsets into the document's *plain-text projection*
 * (see pmText.ts), not ProseMirror positions, so the server can replay without ProseMirror.
 *  - from/to: replaced range in the text *before* the event
 *  - text:    inserted text (absent for pure deletes / focus / blur)
 *  - len:     length of `text` (0 when absent)
 *  - src:     for paste/drop only: was the pasted text already in this document?
 */
export const DocEventSchema = z
  .object({
    seq: z.number().int().nonnegative(),
    t: z.number().int().nonnegative().max(1000 * 60 * 60 * 24), // ms since session start, ≤ 24h
    type: z.enum(EVENT_TYPES),
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
    text: z.string().max(200_000).optional(),
    len: z.number().int().nonnegative(),
    src: z.enum(["internal", "external"]).optional(),
  })
  .strict()
  .refine((e) => e.to >= e.from, "to < from")
  .refine((e) => (e.text?.length ?? 0) === e.len, "len mismatch");

export type DocEvent = z.infer<typeof DocEventSchema>;

export const EventBatchSchema = z
  .object({
    sessionId: z.string().uuid(),
    events: z.array(DocEventSchema).min(1).max(5000),
    headHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type EventBatch = z.infer<typeof EventBatchSchema>;

/** A stored batch, as the verifier sees it. */
export interface StoredBatch {
  sessionId: string;
  seqStart: number;
  seqEnd: number;
  events: DocEvent[];
  headHash: string;
  receivedAt: string; // ISO, server clock
}
