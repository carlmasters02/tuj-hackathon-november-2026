"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/useHydrated";
import { postJson, ApiError } from "@/lib/client";

export function ChooseUsername({ suggestion, next }: { suggestion: string; next: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [name, setName] = useState(suggestion.replace(/_[0-9a-f]{5}$/, ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form method="post"
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await postJson("/api/profile/username", { username: name });
          router.push(next);
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Couldn't save that username");
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" className="input" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} pattern="[a-z0-9_]{3,20}" maxLength={20} required autoFocus />
        <p className="mt-1 text-xs text-fg-faint">3–20 characters: a–z, 0–9, underscore.</p>
      </div>
      {error && <p role="alert" className="text-sm text-redpen">{error}</p>}
      <button className="btn btn-primary w-full" disabled={!hydrated || busy}>{busy ? "Saving…" : "Continue"}</button>
    </form>
  );
}
