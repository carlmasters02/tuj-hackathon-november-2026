/**
 * The fingerprint motif from the logo: concentric, slightly irregular loops that open at the base.
 * Deterministic (no randomness) so server and client render the same SVG.
 */
export function Whorl({ className = "", rings = 11 }: { className?: string; rings?: number }) {
  const paths: string[] = [];
  for (let i = 0; i < rings; i++) {
    const rx = 18 + i * 9;
    const ry = 24 + i * 11;
    const cx = 100 + Math.sin(i * 1.7) * 2;
    const cy = 112 - i * 1.5;
    const gap = Math.max(6, 22 - i * 1.4); // the open end at the bottom
    const a0 = (90 + gap) * (Math.PI / 180);
    const a1 = (90 - gap + 360) * (Math.PI / 180);
    const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
    const x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
    paths.push(`M${x0.toFixed(1)} ${y0.toFixed(1)}A${rx} ${ry} 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 200 240" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className={`hm-whorl ${className}`} aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
