"use client";
import { useState } from "react";
import { SignedCertificateSchema, verifyCertificateSignature, contentHash, type SignedCertificate } from "@hm/shared/certificate";
import { VERDICT_LABEL } from "@hm/shared/provenance/stats";
import { getJson } from "@/lib/client";

type Result = { sig: boolean; content: boolean; pinned: boolean; cert: SignedCertificate } | { error: string };

export function VerifyTool() {
  const [certText, setCertText] = useState("");
  const [docText, setDocText] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    try {
      const parsed = SignedCertificateSchema.safeParse(JSON.parse(certText));
      if (!parsed.success) return setResult({ error: "That isn't a Humagination certificate (schema mismatch)." });
      const cert = parsed.data as unknown as SignedCertificate;
      const { publicKey } = await getJson<{ publicKey: string }>("/api/cert/public-key");
      const sig = await verifyCertificateSignature(cert, publicKey);
      // Normalize line endings the way the editor's plain-text projection does.
      const content = contentHash(docText.replace(/\r\n/g, "\n")) === cert.payload.contentHash;
      setResult({ sig, content, pinned: cert.publicKey === publicKey, cert });
    } catch {
      setResult({ error: "Couldn't parse the certificate JSON." });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="cert">Certificate JSON</label>
        <textarea id="cert" className="input font-mono text-xs" rows={8} value={certText} onChange={(e) => setCertText(e.target.value)} placeholder='{"payload": {...}, "signature": "...", "publicKey": "..."}' />
      </div>
      <div>
        <label className="label" htmlFor="doc">Text</label>
        <textarea id="doc" className="input font-serif" rows={8} value={docText} onChange={(e) => setDocText(e.target.value)} placeholder="Paste the document text exactly as published." />
      </div>
      <button className="btn btn-primary" onClick={run} disabled={!certText.trim()}>Verify</button>
      {result && "error" in result && <p className="text-sm text-redpen">{result.error}</p>}
      {result && !("error" in result) && (
        <div className="card space-y-2 p-4 text-sm">
          <p className={result.sig && result.pinned ? "text-ok" : "text-redpen"}>{result.sig && result.pinned ? "✓ Signature valid — issued by Humagination." : "✗ Signature invalid or signed by a different key."}</p>
          <p className={result.content ? "text-ok" : "text-redpen"}>{result.content ? "✓ Text matches the certified content exactly." : "✗ Text does not match the certified content (even one character changes the hash)."}</p>
          <p className="text-fg-dim">Verdict in certificate: <strong className="text-fg">{VERDICT_LABEL[result.cert.payload.verdict]}</strong> · @{result.cert.payload.author} · {new Date(result.cert.payload.issuedAt).toLocaleString()}</p>
          <a className="link text-fg-dim" href={`/verify/${result.cert.payload.certId}`}>Open the full certificate and replay ↗</a>
        </div>
      )}
    </div>
  );
}
