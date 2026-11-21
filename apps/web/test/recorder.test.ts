import { afterEach, describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode, type Node as PMNodeType } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { editorExtensions } from "../src/lib/editorExtensions";
import { ProvenanceRecorder } from "../src/components/editor/recorder";
import { contentFingerprint } from "@hm/shared/contentFingerprint";

const schema = getSchema(editorExtensions());
const doc = (text: string, bold = false) => PMNode.fromJSON(schema, {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text, ...(bold ? { marks: [{ type: "bold" }] } : {}) }] }],
});
const transaction = (node: PMNodeType, docChanged = true) => ({ doc: node, docChanged, meta: {}, getMeta: () => undefined }) as unknown as Transaction;
const ok = { ok: true, status: 200 } as Response;

function recorderFor(initial: PMNodeType, onStatus = vi.fn()) {
  return {
    recorder: new ProvenanceRecorder("doc-1", 0, null, () => current.toJSON(), onStatus, initial.textBetween(0, initial.content.size, "\n", () => "")),
    onStatus,
  };
}

// The content callback normally closes over the editor. Tests update it alongside each transaction.
let current: PMNodeType;

afterEach(() => vi.unstubAllGlobals());

describe("ProvenanceRecorder content-only saves", () => {
  it("drains formatting without inventing a provenance event", async () => {
    current = doc("Careful revision");
    const { recorder, onStatus } = recorderFor(current);
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    current = doc("Careful revision", true);
    recorder.record(transaction(current), current);
    expect(recorder.pending).toBe(0);

    await expect(recorder.drain()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toEqual([]);
    expect(body.baseContentHash).toBe(contentFingerprint(doc("Careful revision").toJSON()));
    expect(body.content.content[0].content[0].marks).toEqual([{ type: "bold" }]);
    expect(onStatus).toHaveBeenLastCalledWith("saved", null);
  });

  it("keeps a newer formatting change dirty while an event save is in flight", async () => {
    current = doc("a");
    const { recorder } = recorderFor(current);
    let finishFirst!: (value: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => { finishFirst = resolve; });
    const fetchMock = vi.fn().mockImplementationOnce(() => firstResponse).mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);

    current = doc("ab");
    recorder.record(transaction(current), current);
    const firstFlush = recorder.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    current = doc("ab", true);
    recorder.record(transaction(current), current);
    finishFirst(ok);
    await expect(firstFlush).resolves.toBe(true);
    await expect(recorder.drain()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.events).toHaveLength(1);
    expect(first.content.content[0].content[0].text).toBe("ab");
    expect(second.events).toEqual([]);
    expect(second.baseContentHash).toBe(contentFingerprint(first.content));
    expect(second.content.content[0].content[0].marks).toEqual([{ type: "bold" }]);
  });
});
