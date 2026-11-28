import { describe, it, expect } from "vitest";
import { buildPatch, validateDraft, EMPTY_DRAFT, type SkillDraft } from "./skill-draft";

const BASE: SkillDraft = { name: "rubric", description: "Score it.", type: "rubric", body: "# Body", enabled: true };

describe("skill-draft", () => {
  it("builds a PATCH with only changed fields and a trimmed note", () => {
    expect(buildPatch(BASE, { ...BASE, body: "# New" }, "  Added Tests  ")).toEqual({
      body: "# New",
      change_note: "Added Tests",
    });
    expect(buildPatch(BASE, BASE, "")).toEqual({});
  });

  it("validates against the SkillInput contract", () => {
    expect(validateDraft(BASE)).toEqual({});
    expect(validateDraft({ ...EMPTY_DRAFT, name: "Bad Name" })).toEqual({ name: true, description: true, body: true });
  });
});
