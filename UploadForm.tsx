"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { scanUploadedArt, type ArtVerificationResult } from "@/lib/artDetector";
import { ArtVerificationBadge } from "@/components/gallery/ArtVerificationBadge";

export function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<ArtVerificationResult | null>(null);

  async function runImageScan(file: File | null) {
    setScanResult(null);
    if (!file || !file.type.startsWith("image/")) {
      return null;
    }
    setScanning(true);
    try {
      const result = await scanUploadedArt(file);
      setScanResult(result);
      return result;
    } finally {
      setScanning(false);
    }
  }

  return (
    <form
      method="post"
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);

        const fd = new FormData(e.currentTarget);
        fd.set("publish", fd.get("publish") ? "true" : "false");

        const file = (fd.get("file") as File | null) ?? selectedFile;
        let activeScan = scanResult;
        if (file && file.type.startsWith("image/") && !activeScan) {
          activeScan = await runImageScan(file);
        }

        if (activeScan) {
          fd.set("ai_verification_status", activeScan.status);
          if (typeof activeScan.aiProbability === "number") {
            fd.set("ai_probability", String(activeScan.aiProbability));
          }
        }

        try {
          const res = await fetch("/api/gallery/upload", {
            method: "POST",
            body: fd,
            credentials: "same-origin",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
          router.push(`/portfolio/work/${data.id}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="file">File</label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/wav"
          className="block w-full text-sm text-fg-dim file:mr-3 file:rounded-md file:border file:border-line file:bg-muted file:px-3 file:py-1.5 file:text-fg"
          onChange={async (e) => {
            const file = e.target.files?.[0] ?? null;
            setSelectedFile(file);
            await runImageScan(file);
          }}
        />
        <p className="mt-1 text-xs text-fg-faint">
          Images: PNG, JPEG, WebP up to 15 MB. Audio: MP3, OGG, WAV up to 25 MB. Checked by file contents, not extension.
        </p>

        {scanning && (
          <p className="mt-2 text-xs text-fg-dim">Scanning image for AI patterns…</p>
        )}

        {scanResult && !scanning && (
          <div className="mt-2 flex items-center gap-2">
            <ArtVerificationBadge
              status={scanResult.status}
              aiProbability={scanResult.aiProbability}
            />
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" className="input" required maxLength={120} />
      </div>

      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" className="input" rows={3} maxLength={1000} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publish" defaultChecked /> Publish to the gallery now
      </label>

      {error && <p className="text-sm text-redpen">{error}</p>}

      <button className="btn btn-primary" disabled={busy || scanning}>
        {busy ? "Processing… (re-encoding, hashing, watermarking)" : "Upload"}
      </button>
    </form>
  );
}