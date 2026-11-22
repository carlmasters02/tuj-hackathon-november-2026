import { describe, expect, it } from "vitest";
import { DEVELOPERS, LEGAL_LINKS } from "../src/lib/siteInformation";

describe("site information pages", () => {
  it("keeps unique routes for all five footer legal documents", () => {
    expect(LEGAL_LINKS.map((link) => link.href)).toEqual([
      "/legal/terms",
      "/legal/privacy",
      "/legal/cookies",
      "/legal/accessibility",
      "/legal/copyright",
    ]);
    expect(new Set(LEGAL_LINKS.map((link) => link.href)).size).toBe(LEGAL_LINKS.length);
  });

  it("reserves exactly four individually keyed developer slots", () => {
    expect(DEVELOPERS).toHaveLength(4);
    expect(new Set(DEVELOPERS.map((developer) => developer.id)).size).toBe(4);
    for (const developer of DEVELOPERS) {
      expect(developer.name).toBeTruthy();
      expect(developer.role).toBeTruthy();
      expect(developer.bio).toBeTruthy();
    }
  });
});
