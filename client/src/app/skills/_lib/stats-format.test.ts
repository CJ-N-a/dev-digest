import { describe, it, expect } from "vitest";
import { acceptColor, formatRate } from "./stats-format";

describe("stats-format", () => {
  it("formats rates as rounded percents and null as a dash", () => {
    expect(formatRate(0.714)).toBe("71%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(null)).toBe("—");
  });

  it("colours the accept rate by threshold", () => {
    expect(acceptColor(0.7)).toBe("var(--ok)");
    expect(acceptColor(0.5)).toBe("var(--warn)");
    expect(acceptColor(0.49)).toBe("var(--crit)");
    expect(acceptColor(null)).toBe("var(--text-muted)");
  });
});
