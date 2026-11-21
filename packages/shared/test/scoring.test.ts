import { describe, expect, it } from "vitest";
import { applyDailyCap, currentStreak, pointsFor, relianceScore, lastNDates } from "@hm/shared/scoring";

describe("scoring", () => {
  it("reliance score", () => {
    expect(relianceScore(0, 0)).toBe(0);
    expect(relianceScore(60, 0)).toBe(98);
    expect(relianceScore(30, 89)).toBe(25);
    expect(relianceScore(-5, 10)).toBe(0);
  });
  it("points with no-hint bonus", () => {
    expect(pointsFor("math", { hintsUsed: 0 })).toBe(15);
    expect(pointsFor("math", { hintsUsed: 2 })).toBe(10);
    expect(pointsFor("code", { hintsUsed: 0 })).toBe(20);
    expect(pointsFor("document", { words: 299 })).toBe(0);
    expect(pointsFor("document", { words: 300 })).toBe(20);
    expect(pointsFor("think_first")).toBe(2);
  });
  it("daily cap", () => {
    expect(applyDailyCap(20, 0)).toBe(20);
    expect(applyDailyCap(20, 140)).toBe(10);
    expect(applyDailyCap(20, 200)).toBe(0);
  });
  it("streaks", () => {
    const good = (date: string) => ({ date, aiMinutes: 5, humanMinutes: 30 });
    const days = [good("2026-11-18"), good("2026-11-19"), good("2026-11-20")];
    expect(currentStreak(days, "2026-11-20")).toBe(3);
    // today not finished yet: counts back from yesterday
    expect(currentStreak(days, "2026-11-21")).toBe(3);
    // a heavy-AI day breaks it
    expect(currentStreak([...days, { date: "2026-11-21", aiMinutes: 100, humanMinutes: 20 }].map((d) => (d.date === "2026-11-19" ? { ...d, aiMinutes: 50 } : d)), "2026-11-20")).toBe(1);
    // too few human minutes doesn't qualify
    expect(currentStreak([{ date: "2026-11-20", aiMinutes: 0, humanMinutes: 10 }], "2026-11-20")).toBe(0);
  });
  it("lastNDates", () => {
    expect(lastNDates("2026-03-02", 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});

describe("levels", () => {
  it("thresholds grow by 50 each level", async () => {
    const { levelFor, levelThreshold } = await import("@hm/shared/scoring");
    expect([1, 2, 3, 4, 5].map(levelThreshold)).toEqual([0, 50, 150, 300, 500]);
    expect(levelFor(0)).toMatchObject({ level: 1, name: "Spark", floor: 0, next: 50 });
    expect(levelFor(49).level).toBe(1);
    expect(levelFor(50)).toMatchObject({ level: 2, name: "Glow" });
    expect(levelFor(320)).toMatchObject({ level: 4, name: "Lantern", floor: 300, next: 500 });
    expect(levelFor(99999).name).toBe("Lighthouse");
  });
});
