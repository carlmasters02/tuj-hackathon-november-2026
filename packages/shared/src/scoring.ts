/**
 * Reliance score, Human Points and streaks. Pure functions, unit-tested in test/scoring.test.ts.
 */

/** 0–100, lower is better. */
export function relianceScore(aiMinutes: number, humanMinutes: number): number {
  const a = Math.max(0, aiMinutes);
  const h = Math.max(0, humanMinutes);
  return Math.round((100 * a) / (a + h + 1));
}

export const POINTS = {
  mathSolved: 10,
  mathNoHintBonus: 5,
  codeSolved: 15,
  codeNoHintBonus: 5,
  verifiedDocument: 20,
  thinkFirstRedirect: 2,
} as const;

export const VERIFIED_DOC_MIN_WORDS = 300;
/** Maximum Human Points that can be earned per UTC day, to stop farming. */
export const DAILY_POINTS_CAP = 150;
/** Max Think First redirects that earn points per day. */
export const DAILY_THINK_FIRST_CAP = 10;

export type PointsReason = "math" | "code" | "document" | "think_first";

export function pointsFor(reason: PointsReason, opts: { hintsUsed?: number; words?: number } = {}): number {
  switch (reason) {
    case "math":
      return POINTS.mathSolved + ((opts.hintsUsed ?? 0) === 0 ? POINTS.mathNoHintBonus : 0);
    case "code":
      return POINTS.codeSolved + ((opts.hintsUsed ?? 0) === 0 ? POINTS.codeNoHintBonus : 0);
    case "document":
      return (opts.words ?? 0) >= VERIFIED_DOC_MIN_WORDS ? POINTS.verifiedDocument : 0;
    case "think_first":
      return POINTS.thinkFirstRedirect;
  }
}

/** Points actually granted after applying the daily cap. */
export function applyDailyCap(requested: number, alreadyToday: number, cap = DAILY_POINTS_CAP): number {
  return Math.max(0, Math.min(requested, cap - Math.max(0, alreadyToday)));
}

export interface DayTotals {
  date: string; // YYYY-MM-DD
  aiMinutes: number;
  humanMinutes: number;
}

export const STREAK_MAX_SCORE = 30;
export const STREAK_MIN_HUMAN_MINUTES = 15;

export function dayQualifies(d: DayTotals): boolean {
  return d.humanMinutes >= STREAK_MIN_HUMAN_MINUTES && relianceScore(d.aiMinutes, d.humanMinutes) < STREAK_MAX_SCORE;
}

function addDays(date: string, n: number): string {
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Consecutive qualifying days ending at `today`. If today doesn't qualify *yet*, the streak
 * still counts back from yesterday (the day isn't over).
 */
export function currentStreak(days: DayTotals[], today: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let cursor = today;
  const t = byDate.get(today);
  if (!t || !dayQualifies(t)) cursor = addDays(today, -1);
  let streak = 0;
  for (;;) {
    const d = byDate.get(cursor);
    if (!d || !dayQualifies(d)) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function lastNDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

export function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
