"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";

export function NewDocButton({ genre = "free", title = "Untitled", label = "New document" }: { genre?: string; title?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-primary px-5 py-2.5"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await postJson<{ id: string }>("/api/docs", { title, genre });
          router.push(`/write/${id}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Opening…" : label}
    </button>
  );
}
