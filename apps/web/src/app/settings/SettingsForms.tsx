"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJson, postJson, ApiError } from "@/lib/client";
import type { Profile } from "@/lib/auth";

interface Token { id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-xl font-extrabold">{title}</h2>
        {desc && <p className="mt-1 text-sm text-fg-dim">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsForms({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [p, setP] = useState({ displayName: profile.display_name ?? "", bio: profile.bio ?? "", isPublic: profile.is_public, leaderboardOptIn: profile.leaderboard_opt_in });
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const loadTokens = () => getJson<{ tokens: Token[] }>("/api/extension-tokens").then((r) => setTokens(r.tokens)).catch(() => {});
  useEffect(() => {
    loadTokens();
  }, []);

  const save = async (patch: Partial<typeof p>) => {
    const next = { ...p, ...patch };
    setP(next);
    try {
      await postJson("/api/profile", next, "PATCH");
      setMsg("Saved.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Couldn't save. Check your connection and try again.");
    }
    setTimeout(() => setMsg(null), 2000);
  };

  return (
    <div className="space-y-6">
      {msg && <p className="fixed bottom-4 right-4 z-50 rounded-md border border-line bg-muted px-3 py-2 text-sm">{msg}</p>}

      <Section title="Profile" desc={`@${profile.username} · ${email}`}>
        <div>
          <label className="label" htmlFor="dn">Display name</label>
          <input id="dn" className="input" maxLength={50} value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} onBlur={() => save({})} />
        </div>
        <div>
          <label className="label" htmlFor="bio">Bio</label>
          <textarea id="bio" className="input" rows={3} maxLength={280} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} onBlur={() => save({})} />
        </div>
      </Section>

      <Section title="Privacy">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={p.isPublic} onChange={(e) => save({ isPublic: e.target.checked })} />
          <span><strong>Public profile.</strong> <span className="text-fg-dim">Others can see your profile page and published works.</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={p.leaderboardOptIn} onChange={(e) => save({ leaderboardOptIn: e.target.checked })} />
          <span><strong>Show me on the weekly leaderboard.</strong> <span className="text-fg-dim">Off by default. Shares your username, reliance score and streak — never per-site minutes.</span></span>
        </label>
      </Section>

      <Section title="Extension tokens" desc="The Chrome extension uses a token to send daily totals. It can only post to the tracker endpoint, and you can revoke it any time. We store only a hash.">
        {newToken && (
          <div className="rounded-md border border-warn/50 bg-warn-dim p-3 text-sm">
            <p className="mb-2">Copy this into the extension&apos;s options page now — it won&apos;t be shown again.</p>
            <code className="block break-all rounded bg-canvas p-2 font-mono text-xs">{newToken}</code>
          </div>
        )}
        <button
          className="btn"
          onClick={async () => {
            try {
              const r = await postJson<{ token: string }>("/api/extension-tokens", { label: "Chrome extension" });
              setNewToken(r.token);
              loadTokens();
            } catch (e) {
              setMsg(e instanceof ApiError ? e.message : "That didn't work. Check your connection and try again.");
            }
          }}
        >
          Generate token
        </button>
        <ul className="divide-y divide-line text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {t.label} <span className="text-fg-faint">· created {new Date(t.created_at).toLocaleDateString()}{t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleDateString()}` : ""}</span>
              </span>
              {t.revoked_at ? (
                <span className="chip">revoked</span>
              ) : (
                <button className="btn btn-danger py-1" onClick={async () => { await postJson(`/api/extension-tokens/${t.id}`, {}, "DELETE"); loadTokens(); }}>Revoke</button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Delete account" desc="Permanently deletes your profile, documents, certificates, uploads (including encrypted originals), tracker data and points. This can't be undone.">
        <label className="label" htmlFor="confirm">Type your username to confirm</label>
        <input id="confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={profile.username} />
        <button
          className="btn btn-danger"
          disabled={confirm !== profile.username}
          onClick={async () => {
            try {
              await postJson("/api/account", { confirmUsername: confirm }, "DELETE");
              router.push("/");
              router.refresh();
            } catch (e) {
              setMsg(e instanceof ApiError ? e.message : "That didn't work. Check your connection and try again.");
            }
          }}
        >
          Delete my account and everything in it
        </button>
      </Section>
    </div>
  );
}
