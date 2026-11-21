/** Hand-rolled SVG bar chart: AI minutes vs human minutes per day. Server component, no chart library. */
export function WeekChart({ days }: { days: { date: string; aiMinutes: number; humanMinutes: number }[] }) {
  const W = 640;
  const H = 220;
  const pad = { l: 36, r: 8, t: 12, b: 28 };
  const max = Math.max(30, ...days.flatMap((d) => [d.aiMinutes, d.humanMinutes]));
  const step = (W - pad.l - pad.r) / days.length;
  const bw = Math.min(22, step / 3);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  const dayName = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="Minutes per day: AI versus human work">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t ? "3 4" : undefined} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-fg-faint)">{t}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = pad.l + step * i + step / 2;
            return (
              <g key={d.date}>
                <rect x={cx - bw - 2} y={y(d.humanMinutes)} width={bw} height={Math.max(0, y(0) - y(d.humanMinutes))} rx="3" fill="var(--color-fg)">
                  <title>{`${d.date}: ${d.humanMinutes} human minutes`}</title>
                </rect>
                <rect x={cx + 2} y={y(d.aiMinutes)} width={bw} height={Math.max(0, y(0) - y(d.aiMinutes))} rx="3" fill="var(--color-flame)">
                  <title>{`${d.date}: ${d.aiMinutes} AI minutes`}</title>
                </rect>
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-fg-dim)">{dayName(d.date)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex gap-4 text-xs text-fg-dim">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-fg" /> Human minutes (tutor + verified writing)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-flame" /> AI minutes (extension)</span>
      </figcaption>
    </figure>
  );
}
