/// <reference lib="webworker" />
import { analyze } from "@hm/shared/redpen";

// Runs RedPen off the main thread. Input: { id, text }. Output: { id, flags, scores }.
self.onmessage = async (e: MessageEvent<{ id: number; text: string }>) => {
  const { id, text } = e.data;
  try {
    const result = await analyze(text);
    (self as unknown as Worker).postMessage({ id, ...result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
