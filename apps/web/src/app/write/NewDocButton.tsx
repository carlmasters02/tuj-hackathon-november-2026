"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";

export function NewDocButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await postJson<{ id: string }>("/api/docs", { title: "Untitled" });
          router.push(`/write/${id}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      New document
    </button>
  );
}
