/**
 * Creation-record seal — shown only when replay and integrity checks pass.
 * A sun-yellow stamp with the fingerprint whorl and the words set on a circle.
 */
export function HumanSeal({ size = 56, title = "Creation record verified" }: { size?: number; title?: string }) {
  const rings = [10, 16, 22, 28];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title} className="shrink-0 drop-shadow-sm">
      <title>{title}</title>
      <defs>
        <path id="hm-seal-arc" d="M 50 50 m -37 0 a 37 37 0 1 1 74 0 a 37 37 0 1 1 -74 0" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="var(--color-sun)" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-fg)" strokeWidth="1.5" strokeDasharray="1 3" />
      <text fontSize="11.5" fontWeight="800" letterSpacing="3" fill="var(--color-fg)" style={{ fontFamily: "var(--font-sans)" }}>
        <textPath href="#hm-seal-arc" startOffset="2%">HUMAN-MADE · HUMAGINATION ·</textPath>
      </text>
      <g fill="none" stroke="var(--color-fg)" strokeWidth="2.6" strokeLinecap="round">
        {rings.map((r, i) => (
          <path key={r} d={`M ${50 - r * 0.62} ${58 + i} A ${r * 0.62} ${r * 0.78} 0 1 1 ${50 + r * 0.62 - 2} ${58 + i}`} />
        ))}
      </g>
    </svg>
  );
}

/** Small inline badge version for lists. */
export function HumanBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-fg" title="Creation record verified">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M6 14a5 6 0 1 1 8 0M8 15.5a3 4 0 1 1 4 0M10 16v-4" />
      </svg>
      Creation record verified
    </span>
  );
}
