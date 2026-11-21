import Link from "next/link";
import { lastNDates, utcDate } from "@hm/shared/scoring";
import { profileOf, requireUserPage } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FriendsPanel } from "./FriendsPanel";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage("/leaderboard");
  const tab = (await searchParams).tab === "friends" ? "friends" : "everyone";
  const week = lastNDates(utcDate(), 7)[0];
  const sb = await supabaseServer(); // RLS: only opted-in rows (plus your own) are readable
  const { data: rows } = await sb.from("leaderboard_weekly").select("user_id, username, reliance_score, streak, points").eq("week_start", week).order("reliance_score", { ascending: true }).order("points", { ascending: false }).limit(100);
  const { data: links } = await sb.from("friends").select("user_id, friend_id, status");
  const accepted = new Set((links ?? []).filter((l) => l.status === "accepted").map((l) => (l.user_id === user.id ? l.friend_id : l.user_id)));
  const ids = [...new Set((links ?? []).flatMap((l) => [l.user_id, l.friend_id]))].filter((id) => id !== user.id);
  const { data: names } = ids.length ? await supabaseAdmin().from("profiles").select("id, username").in("id", ids) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.username]));
  const me = await profileOf(user.id);
  const shown = (rows ?? []).filter((r) => tab === "everyone" || r.user_id === user.id || accepted.has(r.user_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-page">Weekly leaderboard</h1>
        <p className="mt-1 text-sm text-paper-dim">Lowest reliance score wins; ties broken by Human Points. Opt-in only.</p>
        <p className="mt-2 rounded-md border border-warn/40 bg-warn-dim px-3 py-2 text-xs">Self-reported via extension — for motivation, not proof.</p>
      </div>
      {!me?.leaderboard_opt_in && <p className="text-sm text-paper-dim">You&apos;re not on the board. <Link className="link" href="/settings">Opt in from Settings</Link> to appear.</p>}
      <nav className="flex gap-1 border-b border-line">
        {(["everyone", "friends"] as const).map((t) => (
          <Link key={t} href={`/leaderboard?tab=${t}`} className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize ${tab === t ? "border-paper" : "border-transparent text-paper-dim"}`}>{t}</Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-paper-faint"><tr className="border-b border-line"><th className="px-4 py-2 font-normal">#</th><th className="px-4 py-2 font-normal">User</th><th className="px-4 py-2 font-normal">Reliance score</th><th className="px-4 py-2 font-normal">Streak</th><th className="px-4 py-2 font-normal">Points</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-paper-faint">No one here yet this week.</td></tr>}
            {shown.map((r, i) => (
              <tr key={r.user_id} className={`border-b border-line/60 last:border-0 ${r.user_id === user.id ? "bg-ink-2" : ""}`}>
                <td className="px-4 py-2 font-mono text-xs text-paper-faint">{i + 1}</td>
                <td className="px-4 py-2"><Link className="hover:underline" href={`/u/${r.username}`}>@{r.username}</Link></td>
                <td className="px-4 py-2">{r.reliance_score}</td>
                <td className="px-4 py-2">{r.streak}d</td>
                <td className="px-4 py-2">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FriendsPanel
        me={user.id}
        links={(links ?? []).map((l) => ({ other: nameOf.get(l.user_id === user.id ? l.friend_id : l.user_id) ?? "?", incoming: l.friend_id === user.id, status: l.status }))}
      />
    </div>
  );
}
