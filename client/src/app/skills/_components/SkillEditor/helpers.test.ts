import { describe, it, expect } from "vitest";
import { parseSkillTab } from "./helpers";

describe("parseSkillTab", () => {
  it("falls back to the config tab", () => {
    expect(parseSkillTab("stats")).toBe("stats");
    expect(parseSkillTab("nope")).toBe("config");
    expect(parseSkillTab(null)).toBe("config");
  });
});
