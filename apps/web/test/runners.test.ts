import { describe, expect, it } from "vitest";
import { withJavaLauncher } from "@/lib/code/runners";

describe("Piston Java launcher", () => {
  it("keeps line numbers and puts a launcher before the first class", () => {
    const src = "import java.util.*;\n\nclass Helper {}\npublic class Main { public static void main(String[] a) {} }\n";
    const out = withJavaLauncher(src);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out.indexOf("class HmLauncher")).toBeLessThan(out.indexOf("class Helper"));
    expect(out.startsWith("import java.util.*;")).toBe(true);
    expect(out.split("\n")[2]).toMatch(/^class HmLauncher .* class Helper \{\}$/);
  });
  it("handles code with no imports", () => {
    expect(withJavaLauncher("public class Main {}").startsWith("class HmLauncher")).toBe(true);
  });
});
