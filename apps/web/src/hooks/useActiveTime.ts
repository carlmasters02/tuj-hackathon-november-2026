"use client";
import { useEffect, useRef } from "react";

const IDLE_MS = 60_000;

/**
 * Counts seconds the student is actively working: the tab is visible and there was input in the
 * last 60 s. Returns `take()`, which reports and resets the accumulated seconds.
 */
export function useActiveTime() {
  const acc = useRef(0);
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const bump = () => (lastInput.current = Date.now());
    const evs = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInput.current < IDLE_MS) acc.current += 1;
    }, 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, []);
  return {
    take: () => {
      const s = acc.current;
      acc.current = 0;
      return s;
    },
    peek: () => acc.current,
  };
}
