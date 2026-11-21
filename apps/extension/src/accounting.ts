/**
 * Pure time-accounting logic (unit-tested). The background worker calls `advance()` on every
 * focus/tab/idle change and on a 30 s alarm heartbeat (Chrome's minimum alarm period).
 * Time is credited only while the AI tab is focused, its window is focused, and the user is
 * active; it is stored in whole 15-second ticks.
 */
export const TICK_SECONDS = 15;
/** A gap longer than this means the worker was suspended (sleep, closed laptop): don't trust it. */
export const MAX_CREDIT_MS = 60_000;

export interface TrackState {
  domain: string | null; // AI domain that was active since `since`, or null
  since: number; // ms epoch
  carryMs: Record<string, number>; // sub-tick remainder per domain
}

export interface Credit {
  date: string;
  domain: string;
  seconds: number;
}

export function advance(state: TrackState, now: number, nextDomain: string | null): { state: TrackState; credit: Credit | null } {
  let credit: Credit | null = null;
  const carry = { ...state.carryMs };
  if (state.domain && now > state.since) {
    const elapsed = Math.min(now - state.since, MAX_CREDIT_MS);
    const total = (carry[state.domain] ?? 0) + elapsed;
    const ticks = Math.floor(total / (TICK_SECONDS * 1000));
    carry[state.domain] = total - ticks * TICK_SECONDS * 1000;
    if (ticks > 0) credit = { date: new Date(now).toISOString().slice(0, 10), domain: state.domain, seconds: ticks * TICK_SECONDS };
  }
  return { state: { domain: nextDomain, since: now, carryMs: carry }, credit };
}

export function addCredit(days: Record<string, Record<string, number>>, c: Credit): Record<string, Record<string, number>> {
  const day = { ...(days[c.date] ?? {}) };
  day[c.domain] = Math.min(86400, (day[c.domain] ?? 0) + c.seconds);
  return { ...days, [c.date]: day };
}
