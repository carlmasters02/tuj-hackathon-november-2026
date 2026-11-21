"use client";
import { useState } from "react";
import type { SignedCertificate } from "@hm/shared/certificate";

export function CertJson({ cert }: { cert: SignedCertificate }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const jsonText = JSON.stringify(cert, null, 2);
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-extrabold">Certificate JSON</h2>
        <button className="btn py-1" onClick={async () => { await navigator.clipboard.writeText(jsonText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
        <button className="btn py-1" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      </div>
      <p className="mt-1 text-xs text-fg-faint">Anyone can verify this offline at <a className="link" href="/verify">/verify</a> with the certificate JSON and the text.</p>
      {open && <pre className="mt-3 max-h-96 overflow-auto rounded bg-canvas p-3 font-mono text-xs">{jsonText}</pre>}
    </section>
  );
}
