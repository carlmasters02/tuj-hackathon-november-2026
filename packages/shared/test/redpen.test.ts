import { describe, expect, it } from "vitest";
import { analyze, readability } from "@hm/shared/redpen";
import { isCommonPassword, passwordProblem } from "@hm/shared/passwords";

describe("RedPen", () => {
  it("flags the expected rules and never suggests replacement text", async () => {
    const text =
      "The report was written by the committee. It is very important to utilize the the data. At the end of the day, the results were extremely good. " +
      "This sentence keeps going and going with clause after clause and idea after idea until the reader has completely forgotten where it started and why it matters at all to anyone reading it today.";
    const { flags, scores } = await analyze(text);
    const rules = new Set(flags.map((f) => f.rule));
    for (const r of ["passive", "repeated", "cliche", "long-sentence", "simpler", "intensifier"]) expect(rules, r).toContain(r);
    for (const f of flags) expect(Object.keys(f).sort()).toEqual(["end", "excerpt", "message", "rule", "start"]);
    for (const f of flags.filter((f) => f.rule === "simpler")) expect(f.message).not.toMatch(/instead/i);
    expect(scores.sentences).toBe(4);
  });
  it("Flesch scores are in a sensible range", () => {
    const easy = readability("The cat sat. The dog ran. We had fun.");
    const hard = readability("Institutional characteristics fundamentally determine organizational effectiveness through multidimensional interdependencies.");
    expect(easy.fleschReadingEase).toBeGreaterThan(hard.fleschReadingEase);
    expect(hard.fleschKincaidGrade).toBeGreaterThan(easy.fleschKincaidGrade);
  });
});

describe("password policy", () => {
  it("rejects short and common passwords", () => {
    expect(passwordProblem("short")).toMatch(/12/);
    expect(isCommonPassword("password")).toBe(true);
    expect(isCommonPassword("Password1234!")).toBe(true); // derived from "password"
    expect(isCommonPassword("dragondragon")).toBe(true);
    expect(passwordProblem("correct horse battery staple")).toBeNull();
    expect(passwordProblem("alice-secret-phrase", "alice")).toMatch(/username/);
  });
});
