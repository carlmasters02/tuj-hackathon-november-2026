import Link from "next/link";
import { requireUserPage, profileOf } from "@/lib/auth";
import { refreshLeaderboard, weeklyStats } from "@/lib/server/stats";
import { WeekChart } from "@/components/WeekChart";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUserPage("/dashboard");
  const [s, profile] = await Promise.all([weeklyStats(user.id), profileOf(user.id)]);
  if (profile) await refreshLeaderboard(user.id, profile.username, s).catch(() => null);
  const scoreTone = s.relianceScore < 30 ? "text-ok" : s.relianceScore < 60 ? "text-warn" : "text-redpen";
  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-page">Hi, {profile?.display_name || profile?.username}</h1>
        <p className="mt-1 text-sm text-fg-dim">Your last 7 days.</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className={`text-4xl ${scoreTone}`}>{s.relianceScore}</div>
          <div className="text-xs uppercase tracking-wide text-fg-faint">Reliance score</div>
          <p className="mt-1 text-xs text-fg-dim">0–100, lower is better. AI ÷ (AI + human) minutes.</p>
        </div>
        <div className="card p-5">
          <div className="text-4xl">{s.streak}<span className="text-lg text-fg-faint"> days</span></div>
          <div className="text-xs uppercase tracking-wide text-fg-faint">Streak</div>
          <p className="mt-1 text-xs text-fg-dim">Days with score &lt; 30 and ≥ 15 human minutes.</p>
        </div>
        <div className="card p-5">
          <div className="text-4xl">{s.pointsWeek}</div>
          <div className="text-xs uppercase tracking-wide text-fg-faint">Human Points this week</div>
          <p className="mt-1 text-xs text-fg-dim">{s.pointsTotal} all time · capped daily</p>
        </div>
        <div className="card p-5">
          <div className="text-4xl">{s.humanMinutes}<span className="text-lg text-fg-faint"> / {s.aiMinutes}</span></div>
          <div className="text-xs uppercase tracking-wide text-fg-faint">Human / AI minutes</div>
          <p className="mt-1 text-xs text-fg-dim">Think First: {s.thinkFirst.redirected} redirected, {s.thinkFirst.bypassed} continued</p>
        </div>
      </section>
      <section className="card p-5">
        <WeekChart days={s.days} />
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-extrabold">AI sites this week</h2>
          {s.domains.length === 0 ? (
            <p className="mt-2 text-sm text-fg-dim">No AI time recorded. {s.aiMinutes === 0 && <>Install the extension and add a token in <Link className="link" href="/settings">Settings</Link> to track it.</>}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {s.domains.map((d) => (
                <li key={d.domain} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate text-fg-dim">{d.domain}</span>
                  <span className="h-2 flex-1 rounded bg-muted"><span className="block h-2 rounded bg-flame" style={{ width: `${Math.min(100, (100 * d.minutes) / Math.max(1, s.domains[0].minutes))}%` }} /></span>
                  <span className="w-14 text-right font-mono text-xs">{d.minutes}m</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-fg-faint">Self-reported via your browser extension — for motivation, not proof.</p>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="text-lg font-extrabold">Earn human minutes</h2>
          <Link href="/tutor/math" className="block rounded-lg border border-line p-3 text-sm hover:border-fg-faint">StepCheck a math problem →</Link>
          <Link href="/tutor/code" className="block rounded-lg border border-line p-3 text-sm hover:border-fg-faint">Solve a Code Dojo exercise →</Link>
          <Link href="/write" className="block rounded-lg border border-line p-3 text-sm hover:border-fg-faint">Write and certify something →</Link>
        </div>
      </section>
    </div>
  );
}
