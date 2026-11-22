import Link from "next/link";
import type { WeeklyStats } from "@/lib/server/stats";

const displayTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export function AIUsagePanel({ stats }: { stats: WeeklyStats }) {
  const maxDay = Math.max(30, ...stats.days.map((day) => day.aiMinutes));
  const maxDomain = Math.max(1, ...stats.domains.map((domain) => domain.minutes));
  const start = stats.days[0]?.date;
  const end = stats.days[stats.days.length - 1]?.date;
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const dateLabel = start && end
    ? `${dateFormat.format(new Date(`${start}T00:00:00Z`))} – ${dateFormat.format(new Date(`${end}T00:00:00Z`))}`
    : "Past 7 days";

  return (
    <section aria-labelledby="usage-heading" className="border-t border-line pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-dim">Browser extension</p>
          <h2 id="usage-heading" className="mt-2 text-2xl font-semibold text-fg">AI usage</h2>
          <p className="mt-1 text-sm text-fg-dim">Tracked AI websites · {dateLabel}</p>
        </div>
        <span className="border-b border-line pb-1 text-sm font-semibold text-fg-dim">Past 7 days</span>
      </div>

      <div className="mt-7">
        <p className="text-sm text-fg-dim">Total usage</p>
        <p className="mt-1 text-[clamp(2.8rem,7vw,4.2rem)] font-semibold leading-none tracking-tight tabular-nums text-fg">
          {displayTime(stats.aiMinutes)}
        </p>
        <p className="mt-2 text-xs text-fg-faint">Only activity reported by the connected browser extension</p>
      </div>

      <figure className="mt-8">
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between">
            {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-line" />)}
          </div>
          <div className="relative grid grid-cols-7 gap-2 sm:gap-4" role="img" aria-label="AI-site minutes recorded each day during the past seven days">
            {stats.days.map((day) => {
              const h = Math.max(0, Math.min(100, 100 * day.aiMinutes / maxDay));
              const weekday = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
              return (
                <div key={day.date} className="min-w-0 text-center">
                  <div className="flex h-44 items-end justify-center border-b border-line sm:h-52">
                    <div
                      className="w-full max-w-12 rounded-t-sm bg-flame/85 transition-[height]"
                      style={{ height: `${h}%` }}
                      title={`${day.date}: ${displayTime(day.aiMinutes)} on tracked AI sites`}
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-fg-dim">{weekday}</p>
                  <p className="mt-1 text-[11px] tabular-nums text-fg-faint">{day.aiMinutes ? displayTime(day.aiMinutes) : "—"}</p>
                </div>
              );
            })}
          </div>
        </div>
        <figcaption className="mt-4 flex items-center gap-2 text-xs text-fg-dim">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-flame" /> AI-site activity by day
        </figcaption>
      </figure>

      <div className="mt-9 border-t border-line pt-5">
        <div className="flex items-end justify-between gap-3">
          <h3 className="text-lg font-semibold text-fg">Websites</h3>
          <span className="text-xs text-fg-dim">{stats.domains.length} tracked {stats.domains.length === 1 ? "site" : "sites"}</span>
        </div>
        {stats.domains.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[300px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-line text-xs font-semibold text-fg-dim">
                  <th scope="col" className="py-3 pr-3">Website</th>
                  <th scope="col" className="py-3 pr-3">Usage</th>
                  <th scope="col" className="py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.domains.map((domain) => (
                  <tr key={domain.domain} className="border-b border-line/70">
                    <th scope="row" className="max-w-40 truncate py-3 pr-4 font-medium text-fg">{domain.domain}</th>
                    <td className="w-[36%] py-3 pr-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full bg-flame" style={{ width: `${Math.min(100, 100 * domain.minutes / maxDomain)}%` }} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-semibold tabular-nums text-fg">{displayTime(domain.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-fg-dim">
            No AI websites recorded yet. To start tracking, connect the browser extension in <Link href="/settings" className="link">Settings</Link>.
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-fg-faint">
          This is not Mac Screen Time. It shows tracked AI-site activity, not all device apps or hourly screen usage.
          Data is reported by your browser extension and is meant for reflection, not verification.
        </p>
      </div>
    </section>
  );
}
