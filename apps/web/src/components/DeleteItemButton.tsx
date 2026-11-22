"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, ApiError } from "@/lib/client";

/**
 * A trash button that asks for confirmation inline, then DELETEs `endpoint` and refreshes the list.
 * `finished` items also lose their published portfolio piece, so the confirmation says so.
 */
export function DeleteItemButton({ endpoint, name, finished = false }: { endpoint: string; name: string; finished?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}`}
        title="Delete"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fg-faint transition hover:bg-redpen-dim hover:text-redpen"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    );

  return (
    <span role="group" aria-label={`Delete ${name}?`} className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
      <span className="text-fg-dim">{finished ? "Delete it and its published piece?" : "Delete permanently?"}</span>
      <button
        type="button"
        className="btn btn-danger px-2.5 py-1 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await postJson(endpoint, {}, "DELETE");
            router.refresh();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn't delete it. Try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button type="button" className="btn btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {error && <span role="alert" className="w-full text-redpen">{error}</span>}
    </span>
  );
}
