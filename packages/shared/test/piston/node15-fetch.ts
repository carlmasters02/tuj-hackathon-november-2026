// Minimal fetch shim for the Piston container's Node 15 (test harness only).
import http from "node:http";

if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = (url: string, init: any = {}) =>
    new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: init.method ?? "GET", headers: init.headers }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ ok: (res.statusCode ?? 0) < 400, status: res.statusCode, json: async () => JSON.parse(body) }));
      });
      req.on("error", reject);
      if (init.body) req.write(init.body);
      req.end();
    });
}
if (!(AbortSignal as any).timeout) (AbortSignal as any).timeout = () => undefined;
