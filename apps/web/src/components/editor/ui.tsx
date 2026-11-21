"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Toolbar button: icon-sized, with a visible pressed state and a tooltip-style label. */
export function TB({ label, onClick, active, disabled, children, wide }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 shrink-0 place-items-center rounded-lg text-fg-dim transition-colors hover:bg-muted hover:text-fg disabled:pointer-events-none disabled:opacity-35 ${wide ? "px-2 text-[13px] font-semibold" : "w-8"} ${active ? "bg-sun-soft text-fg ring-1 ring-sun" : ""}`}
    >
      {children}
    </button>
  );
}

export const Sep = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />;

/** A small popover anchored under its trigger. Closes on outside click and Escape. */
export function Pop({ label, trigger, children, width = 240, active, align = "left" }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; width?: number; active?: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btn}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-0.5 rounded-lg px-1.5 text-fg-dim transition-colors hover:bg-muted hover:text-fg ${open || active ? "bg-muted text-fg" : ""}`}
      >
        {trigger}
        <ChevronDown aria-hidden className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div role="dialog" aria-label={label} className={`hm-pop absolute top-full z-50 mt-1.5 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-lift)] ${align === "right" ? "right-0" : "left-0"}`} style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Compact select styled for the toolbar. */
export function TSelect<T extends string | number>({ label, value, options, onChange, width = 128 }: { label: string; value: T | ""; options: { value: T; label: string; style?: React.CSSProperties }[]; onChange: (v: T) => void; width?: number }) {
  return (
    <label className="relative shrink-0" title={label}>
      <span className="sr-only">{label}</span>
      <select
        value={value as string | number}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => String(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
        className="h-8 appearance-none truncate rounded-lg border border-transparent bg-transparent py-0 pr-6 pl-2 text-[13px] font-semibold text-fg hover:border-line hover:bg-surface focus:border-fg/30 focus:outline-none"
        style={{ width }}
      >
        {value === "" && <option value="">Mixed</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} style={o.style}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-1.5 h-3 w-3 -translate-y-1/2 text-fg-faint" />
    </label>
  );
}

export const SWATCHES = ["#1b2b5e", "#2b2142", "#000000", "#48537a", "#646985", "#c0392b", "#d35400", "#9a5a00", "#2a7247", "#1f6f8b", "#3f6fb5", "#7d3c98"];
export const HIGHLIGHTS = [
  { c: "#fdf1c7", n: "Yellow" },
  { c: "#d8f0d2", n: "Green" },
  { c: "#d6e9f8", n: "Blue" },
  { c: "#f9d9e3", n: "Pink" },
  { c: "#fde2c8", n: "Orange" },
  { c: "#e7dcf5", n: "Purple" },
];
