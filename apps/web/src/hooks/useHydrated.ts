"use client";
import { useEffect, useState } from "react";

/**
 * false during server render and until React has hydrated on the client. Use it to disable inputs
 * and submit buttons so nothing typed or submitted before the JavaScript is ready gets lost (or,
 * for forms, natively submitted).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
