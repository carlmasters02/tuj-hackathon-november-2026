/* Pyodide worker: runs student Python locally for the instant "Run" button.
 * - Served with its own CSP (next.config.ts): the ONLY place 'wasm-unsafe-eval' is allowed,
 *   and connect-src 'self' so code can't reach the network.
 * - The page kills this worker after 5 s (timeout) and starts a fresh one.
 * - "Submit" never uses this: grading always happens on the server. */
/* global importScripts, loadPyodide */
importScripts("/pyodide/pyodide.js");

let pyodideReady = null;
function ready() {
  if (!pyodideReady) pyodideReady = loadPyodide({ indexURL: "/pyodide/", fullStdLib: false });
  return pyodideReady;
}

/** Drops Pyodide's own frames (/lib/python3*.zip/_pyodide/…, eval_code_async, CodeRunner, run_async)
 * from a traceback, keeping the header, the student's main.py frames and the final error line. */
function studentTraceback(text) {
  if (!text.includes("Traceback (most recent call last):")) return text;
  const out = [];
  let keep = true;
  for (const line of text.split("\n")) {
    const frame = /^ {2}File "([^"]+)"/.exec(line);
    if (frame) keep = /(^|\/)main\.py$|^<exec>$|^<string>$/.test(frame[1]);
    else if (!/^ {4}/.test(line)) keep = true; // header and the final "XyzError: …" lines
    if (keep) out.push(line);
  }
  return out.join("\n");
}

self.onmessage = async (e) => {
  const { id, source, stdin } = e.data || {};
  if (typeof source !== "string" || source.length > 20480) return self.postMessage({ id, error: "bad request" });
  let stdout = "";
  let stderr = "";
  try {
    const py = await ready();
    let given = false;
    py.setStdin({ stdin: () => (given ? null : ((given = true), String(stdin ?? ""))) });
    py.setStdout({ batched: (s) => { if (stdout.length < 65536) stdout += s + "\n"; } });
    py.setStderr({ batched: (s) => { if (stderr.length < 65536) stderr += s + "\n"; } });
    const ns = py.globals.get("dict")();
    ns.set("__name__", "__main__");
    try {
      await py.runPythonAsync(source, { globals: ns, filename: "main.py" });
    } catch (err) {
      stderr += studentTraceback(String(err && err.message ? err.message : err));
    } finally {
      ns.destroy();
    }
    self.postMessage({ id, stdout, stderr });
  } catch (err) {
    self.postMessage({ id, error: "Python failed to start: " + String(err) });
  }
};
