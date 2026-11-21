"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";

export function NewCreationButton({ kind, label }: { kind: "art" | "music"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        className="btn btn-primary px-5 py-2.5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const { id } = await postJson<{ id: string }>("/api/creations", { kind, title: "Untitled" });
            router.push(kind === "art" ? `/portfolio/art/studio/${id}` : `/portfolio/music/composer/${id}`);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't start a new piece");
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening…" : label}
      </button>
      {err && <span role="alert" className="text-sm text-redpen">{err}</span>}
    </span>
  );
}
