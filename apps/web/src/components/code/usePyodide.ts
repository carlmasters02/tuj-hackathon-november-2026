"use client";
import { useCallback, useEffect, useRef } from "react";

const TIMEOUT_MS = 5000;

/** Runs Python in a Web Worker. A run that exceeds 5 s kills the worker (a fresh one is started next time). */
export function usePyodide() {
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const spawn = () => (worker.current = new Worker("/workers/pyodide-worker.js"));
  useEffect(() => () => worker.current?.terminate(), []);

  const warm = useCallback(() => {
    if (!worker.current) {
      spawn();
      worker.current!.postMessage({ id: -1, source: "pass", stdin: "" });
    }
  }, []);

  const run = useCallback((source: string, stdin: string, firstLoad = false): Promise<{ stdout: string; stderr: string; status: "ok" | "runtime_error" | "timeout" }> => {
    if (!worker.current) spawn();
    const w = worker.current!;
    const id = ++seq.current;
    return new Promise((resolve) => {
      // the very first run also downloads Python (~10 MB, cached afterwards), so allow longer
      const limit = firstLoad ? 60_000 : TIMEOUT_MS;
      const t = setTimeout(() => {
        w.terminate();
        worker.current = null;
        resolve({ stdout: "", stderr: "", status: "timeout" });
      }, limit);
      const onMsg = (e: MessageEvent) => {
        if (e.data?.id !== id) return;
        clearTimeout(t);
        w.removeEventListener("message", onMsg);
        if (e.data.error) resolve({ stdout: "", stderr: e.data.error, status: "runtime_error" });
        else resolve({ stdout: e.data.stdout, stderr: e.data.stderr, status: e.data.stderr ? "runtime_error" : "ok" });
      };
      w.addEventListener("message", onMsg);
      w.postMessage({ id, source, stdin });
    });
  }, []);

  return { run, warm };
}
