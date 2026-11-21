"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useHydrated } from "@/hooks/useHydrated";
import { postJson, ApiError } from "@/lib/client";

export function LoginForm({ next }: { next: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form method="post"
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        setReason(null);
        try {
          await postJson("/api/auth/login", { email: f.get("email"), password: f.get("password") });
          router.push(next);
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Login failed (couldn't reach the server — check your connection)");
          setReason(err instanceof ApiError ? (err.data?.reason ?? `http_${err.status}`) : "network");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-redpen/40 bg-redpen-dim p-3 text-sm text-redpen">
          <p className="whitespace-pre-line">{error}</p>
          {reason && <p className="mt-1 font-mono text-xs text-fg-faint">Reason code: {reason}</p>}
        </div>
      )}
      <button className="btn btn-primary w-full" disabled={!hydrated || busy}>{busy ? "Checking…" : "Log in"}</button>
      <p className="text-sm text-fg-dim">No account? <Link className="link" href="/signup">Sign up</Link></p>
    </form>
  );
}
