import { describe, expect, it } from "vitest";
import { advance, addCredit, MAX_CREDIT_MS, type TrackState } from "../src/accounting";

const T0 = Date.parse("2026-11-21T10:00:00Z");

describe("extension time accounting", () => {
  it("credits whole 15-second ticks and carries the remainder", () => {
    let s: TrackState = { domain: "chatgpt.com", since: T0, carryMs: {} };
    let r = advance(s, T0 + 20_000, "chatgpt.com");
    expect(r.credit).toEqual({ date: "2026-11-21", domain: "chatgpt.com", seconds: 15 });
    s = r.state;
    r = advance(s, T0 + 30_000, "chatgpt.com"); // 5s carry + 10s = 15s
    expect(r.credit?.seconds).toBe(15);
  });
  it("credits nothing when no AI tab was active", () => {
    const r = advance({ domain: null, since: T0, carryMs: {} }, T0 + 30_000, "claude.ai");
    expect(r.credit).toBeNull();
    expect(r.state.domain).toBe("claude.ai");
  });
  it("caps long gaps (suspended worker / sleep)", () => {
    const r = advance({ domain: "claude.ai", since: T0, carryMs: {} }, T0 + 3_600_000, null);
    expect(r.credit!.seconds).toBeLessThanOrEqual(MAX_CREDIT_MS / 1000);
  });
  it("stores only date → domain → seconds", () => {
    const days = addCredit({}, { date: "2026-11-21", domain: "claude.ai", seconds: 15 });
    expect(days).toEqual({ "2026-11-21": { "claude.ai": 15 } });
  });
});
