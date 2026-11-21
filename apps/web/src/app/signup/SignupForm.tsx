"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/useHydrated";
import { postJson, ApiError } from "@/lib/client";
import { passwordProblem, MIN_PASSWORD_LENGTH } from "@hm/shared/passwords";

export function SignupForm() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");
  const [username, setUsername] = useState("");
  const pwIssue = useMemo(() => (pw ? passwordProblem(pw, username) : null), [pw, username]);

  if (done)
    return (
      <div className="card space-y-2 p-5">
        <h2 className="text-xl font-extrabold">Check your inbox</h2>
        <p className="text-sm text-fg-dim">Click the confirmation link we sent, then log in. Already have an account? <Link className="link" href="/login">Log in</Link></p>
      </div>
    );

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
          const r = await postJson<{ signedIn: boolean }>("/api/auth/signup", { email: f.get("email"), username, password: pw });
          if (r.signedIn) {
            router.push("/dashboard");
            router.refresh();
            return;
          }
          setDone(true);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Signup failed (couldn\'t reach the server — check your connection)");
          setReason(err instanceof ApiError ? (err.data?.reason ?? `http_${err.status}`) : "network");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input className="input" id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} pattern="[a-z0-9_]{3,20}" required maxLength={20} autoComplete="username" />
        <p className="mt-1 text-xs text-fg-faint">3–20 characters: a–z, 0–9, underscore. Shown publicly.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PASSWORD_LENGTH} maxLength={128} required autoComplete="new-password" />
        <p className={`mt-1 text-xs ${pwIssue ? "text-warn" : "text-fg-faint"}`}>{pwIssue ?? `At least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well.`}</p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-redpen/40 bg-redpen-dim p-3 text-sm text-redpen">
          <p className="whitespace-pre-line">{error}</p>
          {reason && <p className="mt-1 font-mono text-xs text-fg-faint">Reason code: {reason}</p>}
        </div>
      )}
      <button className="btn btn-primary w-full" disabled={!hydrated || busy || !!pwIssue}>{busy ? "Creating…" : "Sign up"}</button>
      <p className="text-sm text-fg-dim">Have an account? <Link className="link" href="/login">Log in</Link></p>
    </form>
  );
}
