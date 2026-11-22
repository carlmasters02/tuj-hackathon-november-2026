import Link from "next/link";
import { requireUserPage, profileOf } from "@/lib/auth";
import { refreshLeaderboard, weeklyStats } from "@/lib/server/stats";
import { dashboardExtras } from "@/lib/server/dashboard";
import { WeekChart } from "@/components/WeekChart";
import { AIUsagePanel } from "@/components/dashboard/AIUsagePanel";
import { LEVEL_NAMES } from "@hm/shared/scoring";

export const metadata = { title: "Dashboard" };

const REASONS = [
  { key: "math", label: "Math" },
  { key: "code", label: "Code" },
  { key: "document", label: "Writing" },
  { key: "think_first", label: "Think First" },
] as const;

const fmtRange = (from: string, to: string) => {
  const f = new Date(from + "T00:00:00Z");
  const t = new Date(to + "T00:00:00Z");
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  return `${f.toLocaleDateString("en-GB", o)} – ${t.toLocaleDateString("en-GB", o)}`;
};

export default async function Dashboard() {
  const user = await requireUserPage("/dashboard");
  const [s, x, profile] = await Promise.all([weeklyStats(user.id), dashboardExtras(user.id), profileOf(user.id)]);
  if (profile) await refreshLeaderboard(user.id, profile.username, s).catch(() => null);
  const name = profile?.display_name || profile?.username;
  const total = s.humanMinutes + s.aiMinutes;
  const humanShare = total ? Math.round((100 * s.humanMinutes) / total) : null;
  const tone = s.relianceScore < 30 ? "text-ok" : s.relianceScore < 60 ? "text-warn" : "text-redpen";
  const lv = x.points.level;
  const nextName = LEVEL_NAMES[Math.min(lv.level, LEVEL_NAMES.length - 1)];
  const toNext = lv.next - x.points.total;
  const maxReason = Math.max(1, ...REASONS.map((r) => x.points.byReason[r.key]));

  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
        <div>
          <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-semibold tracking-[-0.035em]">Hi, {name}.</h1>
          <p className="mt-2 text-fg-dim">Your week, {fmtRange(s.days[0].date, s.days[s.days.length - 1].date)}.</p>
        </div>
        <span className="border-l border-line pl-4 text-sm font-medium text-fg-dim">{lv.name} · level {lv.level}</span>
      </header>

      {/* the one number this app is about */}
      <section className="grid grid-cols-1 gap-0 border-b border-line pb-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:divide-x lg:divide-line">
        <div className="relative min-w-0 py-4 lg:pr-10">
          {humanShare === null ? (
            <>
              <p className="text-[clamp(3rem,8vw,5rem)] leading-none font-semibold tracking-[-0.05em] text-fg-faint">—</p>
              <p className="mt-3 max-w-md text-lg text-fg-dim">Nothing tracked yet this week. Solve a problem, write a paragraph or draw something, and your week fills in here.</p>
            </>
          ) : (
            <>
              <p className="flex items-baseline gap-1 leading-none">
                <span className="text-[clamp(3.5rem,9vw,5.5rem)] font-semibold tracking-[-0.06em] tabular-nums">{humanShare}</span>
                <span className="text-[clamp(1.7rem,4vw,2.4rem)] font-medium text-fg-dim">%</span>
              </p>
              <p className="mt-2 max-w-md text-lg text-fg-dim">of your thinking this week was your own.</p>
              <div className="mt-6 flex h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${s.humanMinutes} minutes your own work, ${s.aiMinutes} minutes on AI sites`}>
                <div className="h-full bg-fg" style={{ width: `${humanShare}%` }} />
                <div className="h-full bg-flame" style={{ width: `${100 - humanShare}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-fg align-middle" />{s.humanMinutes} min yours</span>
                <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-flame align-middle" />{s.aiMinutes} min on AI sites</span>
              </div>
            </>
          )}
          <dl className="mt-7 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-fg-dim">Reliance score</dt>
              <dd className={`text-2xl font-semibold tabular-nums ${tone}`}>{s.relianceScore}</dd>
              <dd className="text-xs text-fg-faint">0–100, lower is better</dd>
            </div>
            <div>
              <dt className="text-sm text-fg-dim">Streak</dt>
              <dd className="text-2xl font-semibold tabular-nums">{s.streak} <span className="text-base font-semibold text-fg-faint">{s.streak === 1 ? "day" : "days"}</span></dd>
              <dd className="text-xs text-fg-faint">score under 30, 15+ min of your own work</dd>
            </div>
            <div>
              <dt className="text-sm text-fg-dim">Think First</dt>
              <dd className="text-2xl font-semibold tabular-nums">{s.thinkFirst.redirected}</dd>
              <dd className="text-xs text-fg-faint">times you tried it yourself first{s.thinkFirst.bypassed ? `, ${s.thinkFirst.bypassed} skipped` : ""}</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0 border-t border-line py-6 lg:border-t-0 lg:py-4 lg:pl-10">
          <p className="text-sm font-semibold text-fg-dim">Human Points</p>
          <p className="mt-1 text-[2.8rem] leading-none font-semibold tracking-[-0.04em] tabular-nums">{x.points.total}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-fg" style={{ width: `${Math.min(100, ((x.points.total - lv.floor) / (lv.next - lv.floor)) * 100)}%` }} /></div>
          <p className="mt-1.5 text-sm text-fg-dim">{toNext} to {nextName}, level {lv.level + 1}</p>
          <p className="mt-4 text-sm"><strong className="tabular-nums">{x.points.today}</strong> <span className="text-fg-dim">of {x.points.cap} today · </span><strong className="tabular-nums">{s.pointsWeek}</strong> <span className="text-fg-dim">this week</span></p>
          <ul className="mt-5 space-y-2">
            {REASONS.map((r) => (
              <li key={r.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
                <span className="text-fg-dim">{r.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-fg/80" style={{ width: `${(x.points.byReason[r.key] / maxReason) * 100}%` }} /></span>
                <span className="text-right font-semibold tabular-nums">{x.points.byReason[r.key]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-fg-dim">Earned by solving without the answer handed to you. Fewer hints, more points.</p>
        </div>
      </section>

      {x.next.length > 0 && (
        <section aria-labelledby="continue-h">
          <h2 id="continue-h" className="mb-4 text-xl font-semibold tracking-tight">Pick up where you left off</h2>
          <ul>
            {x.next.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hm-index-row">
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-bold tracking-tight">{n.title}</span>
                    <span className="text-sm text-fg-dim">{n.note}</span>
                  </span>
                  <span className="text-sm font-semibold text-fg-dim">Continue</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Activity details" className="grid grid-cols-1 gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-12">
        <div className="min-w-0 border-t border-line pt-5">
          <h2 className="mb-4 text-xl font-semibold">Day by day</h2>
          <WeekChart days={s.days} />
        </div>
        <AIUsagePanel stats={s} />
      </section>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Link href="/tutor" className="group block space-y-4 border-t border-line pt-5 transition hover:border-fg">
          <h2 className="text-lg font-semibold">Tutor</h2>
          <Meter done={x.tutor.mathSolved} total={x.tutor.mathTotal} label="Math problems solved" />
          <Meter done={x.tutor.codeSolved} total={x.tutor.codeTotal} label="Code exercises solved" />
          <p className="text-sm text-fg-dim"><strong className="text-fg tabular-nums">{x.tutor.certified}</strong> {x.tutor.certified === 1 ? "piece" : "pieces"} of writing with a verified creation record</p>
        </Link>
        <Link href="/portfolio" className="group block border-t border-line pt-5 transition hover:border-fg">
          <h2 className="text-lg font-semibold">Portfolio</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-4">
            {[
              ["Works shared", x.portfolio.works],
              ["Carry the seal", x.portfolio.sealed],
              ["Likes received", x.portfolio.likes],
              ["Comments received", x.portfolio.comments],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col-reverse">
                <dt className="text-sm text-fg-dim">{k}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Link>
      </section>
    </div>
  );
}

function Meter({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-fg-dim">{label}</span>
        <span className="font-semibold tabular-nums">{done}<span className="text-fg-faint"> / {total}</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-full bg-fg" style={{ width: `${total ? (100 * done) / total : 0}%` }} />
      </div>
    </div>
  );
}
