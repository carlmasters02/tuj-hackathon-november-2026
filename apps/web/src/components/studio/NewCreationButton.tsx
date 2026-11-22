"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";

export function NewCreationButton({ kind, label, mode = "digital" }: { kind: "art" | "music"; label: string; mode?: "digital" | "pixel" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        className="inline-flex items-center justify-center rounded-lg border border-[#E9D68A] bg-white px-4 py-2.5 text-sm font-semibold text-fg shadow-sm transition hover:bg-[#FFF8DC] disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const { id } = await postJson<{ id: string }>("/api/creations", { kind, title: "Untitled" });
            router.push(kind === "art" ? `/portfolio/art/studio/${id}${mode === "pixel" ? "?mode=pixel" : ""}` : `/portfolio/music/composer/${id}`);
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
