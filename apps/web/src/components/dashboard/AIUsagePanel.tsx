import Link from "next/link";
import type { WeeklyStats } from "@/lib/server/stats";

const displayTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export function AIUsagePanel({ stats }: { stats: WeeklyStats }) {
  const maxDay = Math.max(30, ...stats.days.map((day) => day.aiMinutes));
  const average = stats.days.length ? stats.aiMinutes / stats.days.length : 0;
  const W = 480;
  const H = 152;
  const left = 10;
  const right = 44;
  const top = 12;
  const floor = 122;
  const barStep = (W - left - right) / Math.max(1, stats.days.length);
  const y = (v: number) => floor - Math.min(1, v / maxDay) * (floor - top);

  return (
    <section id="ai-activity" aria-labelledby="ai-activity-heading" className="scroll-mt-20">
      <h2 id="ai-activity-heading" className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#59647C]">02 / AI activity</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-xl border-[1.5px] border-[#E9D68A] bg-white p-4 shadow-[0_5px_16px_rgba(91,77,39,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#1B2B5E]">AI usage</h3>
            <span className="text-xs text-[#656E82]">Past 7 days</span>
          </div>
          <p className="mt-4 text-xs text-[#656E82]">Tracked website usage</p>
          <p className="mt-1 text-[clamp(1.8rem,4vw,2.2rem)] font-medium leading-none tabular-nums text-[#1B2B5E]">{displayTime(stats.aiMinutes)}</p>
          <figure className="mt-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`AI-site minutes by day: ${stats.days.map((day) => `${day.date}: ${displayTime(day.aiMinutes)}`).join("; ")}. Daily average: ${displayTime(Math.round(average))}`}>
              {[0, .25, .5, .75, 1].map((fraction) => (
                <line key={fraction} x1={left} x2={W - right} y1={y(fraction * maxDay)} y2={y(fraction * maxDay)} stroke="#DEDCCA" strokeWidth="1" />
              ))}
              {Array.from({ length: stats.days.length + 1 }, (_, i) => (
                <line key={i} x1={left + i * barStep} x2={left + i * barStep} y1={top} y2={floor} stroke="#E3DFD1" strokeDasharray="2 4" />
              ))}
              {stats.days.map((day, i) => {
                const cx = left + barStep * (i + .5);
                const weekday = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).slice(0, 1);
                return (
                  <g key={day.date}>
                    {day.aiMinutes > 0 && (
                      <rect x={cx - Math.min(14, barStep * .22)} y={y(day.aiMinutes)} width={Math.min(28, barStep * .44)} height={floor - y(day.aiMinutes)} fill="#377CBB">
                        <title>{`${day.date}: ${displayTime(day.aiMinutes)}`}</title>
                      </rect>
                    )}
                    <text x={cx} y={H - 7} fontSize="11" textAnchor="middle" fill="#6D7380">{weekday}</text>
                  </g>
                );
              })}
              <line x1={left} x2={W - right} y1={y(average)} y2={y(average)} stroke="#33985B" strokeWidth="1.5" strokeDasharray="6 5" />
              <text x={W - right + 4} y={y(average) + 3} fontSize="11" fill="#33985B">avg</text>
            </svg>
            <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-[#656E82]">
              <span>Browser extension data</span>
              <span>Daily avg: {displayTime(Math.round(average))}</span>
            </figcaption>
          </figure>
        </div>
        <div className="min-w-0 rounded-xl border-[1.5px] border-[#E9D68A] bg-white p-4 shadow-[0_5px_16px_rgba(91,77,39,0.10)]">
          <div className="flex items-center justify-between gap-2 border-b border-[#EFE8CC] pb-3">
            <h3 className="text-base font-bold text-[#1B2B5E]">Websites</h3>
            <span className="text-xs text-[#656E82]">Time</span>
          </div>
          {stats.domains.length ? (
            <ul className="mt-2">
              {stats.domains.map((site, i) => (
                <li key={site.domain} className={`flex items-center justify-between gap-3 px-2.5 py-2.5 text-xs ${i % 2 === 0 ? "bg-[#FCF8E9]" : "bg-white"}`}>
                  <span className="min-w-0 truncate font-medium text-[#1B2B5E]" title={site.domain}>{site.domain}</span>
                  <span className="shrink-0 font-bold tabular-nums text-[#1B2B5E]">{displayTime(site.minutes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#656E82]">No AI activity recorded. Connect the extension in <Link href="/settings" className="underline font-semibold text-[#1B2B5E]">Settings</Link>.</p>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-[#656E82]">AI websites tracked by the extension only; not Mac-wide Screen Time. Usage is for reflection, not proof.</p>
        </div>
      </div>
    </section>
  );
}
