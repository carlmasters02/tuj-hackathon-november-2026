"use client";
import { useState } from "react";
import Link from "next/link";
import { postJson, ApiError } from "@/lib/client";

export function PublishCertButton({ certId, publishedId }: { certId: string; publishedId: string | null }) {
  const [id, setId] = useState(publishedId);
  const [err, setErr] = useState<string | null>(null);
  if (id) return <Link className="link text-sm" href={`/portfolio/work/${id}`}>Published in your writing portfolio ↗</Link>;
  return (
    <div className="flex items-center gap-3">
      <button
        className="btn"
        onClick={async () => {
          try {
            const r = await postJson<{ id: string }>("/api/gallery/writing", { certId });
            setId(r.id);
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Failed");
          }
        }}
      >
        Publish to the writing gallery
      </button>
      {err && <span className="text-sm text-redpen">{err}</span>}
    </div>
  );
}
