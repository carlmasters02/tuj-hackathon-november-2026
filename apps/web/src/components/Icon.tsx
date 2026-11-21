/** Small line icons (24×24, stroke = currentColor) so they render identically on every platform. */
const PATHS = {
  sigma: "M18 5H6l6 7-6 7h12",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  pilcrow: "M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  frame: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
