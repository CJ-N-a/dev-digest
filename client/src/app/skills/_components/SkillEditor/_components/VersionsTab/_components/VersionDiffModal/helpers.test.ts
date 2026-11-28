import { describe, it, expect } from "vitest";
import { lineDiff } from "./helpers";

describe("lineDiff", () => {
  it("numbers context, removed and added lines", () => {
    expect(lineDiff("a\nb\nc\n", "a\nB\nc\n")).toEqual([
      { kind: "ctx", oldNo: 1, newNo: 1, text: "a" },
      { kind: "del", oldNo: 2, newNo: null, text: "b" },
      { kind: "add", oldNo: null, newNo: 2, text: "B" },
      { kind: "ctx", oldNo: 3, newNo: 3, text: "c" },
    ]);
  });
});
