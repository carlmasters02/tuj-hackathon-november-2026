"use client";
import { useState } from "react";

export function OwnershipChecker() {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch("/api/gallery/verify-ownership", { method: "POST", body: new FormData(e.currentTarget), credentials: "same-origin" });
        setResult(await res.json().catch(() => ({ error: "failed" })));
        setBusy(false);
      }}
    >
      <h2 className="font-serif text-lg">Check an image for an ownership watermark</h2>
      <p className="text-xs text-paper-dim">Every uploaded master carries an invisible, HMAC-signed watermark (work, owner, time). It survives exact copies — not resizing or heavy re-compression.</p>
      <input name="file" type="file" accept="image/png,image/jpeg,image/webp" required className="block text-sm text-paper-dim" />
      <button className="btn" disabled={busy}>{busy ? "Reading…" : "Check"}</button>
      {result && (
        <div className="text-sm">
          {result.error && <p className="text-redpen">{result.error}</p>}
          {result.found === false && <p className="text-paper-dim">{result.message}</p>}
          {result.found && (
            <p className={result.matchesRecord ? "text-ok" : "text-warn"}>
              Watermark found: “{result.title ?? "deleted work"}” by @{result.owner ?? "unknown"}, embedded {new Date(result.embeddedAt).toLocaleString()} (confidence {result.confidence}).
            </p>
          )}
        </div>
      )}
    </form>
  );
}
