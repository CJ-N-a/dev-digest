/* skill-draft.ts — the editable skill form model shared by the Config tab and
   the Import modal: diffing against the saved skill, PATCH building, validation. */
import { SkillInput, type Skill, type SkillPatch, type SkillType } from "@devdigest/shared";

/** Editable fields of a skill (the Config form). */
export interface SkillDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
}

export const EMPTY_DRAFT: SkillDraft = { name: "", description: "", type: "rubric", body: "", enabled: true };

export const DRAFT_FIELDS = ["name", "description", "type", "body", "enabled"] as const satisfies readonly (keyof SkillDraft)[];

export type DraftErrorField = "name" | "description" | "body";
export type DraftErrors = Partial<Record<DraftErrorField, true>>;

export function toDraft(skill: Skill | undefined): SkillDraft {
  if (!skill) return EMPTY_DRAFT;
  const { name, description, type, body, enabled } = skill;
  return { name, description, type, body, enabled };
}

/** Fields whose value differs from the saved skill. */
export function changedFields(base: SkillDraft, values: SkillDraft): (keyof SkillDraft)[] {
  return DRAFT_FIELDS.filter((f) => base[f] !== values[f]);
}

/** PATCH body: only the changed fields, plus the change note when given. */
export function buildPatch(base: SkillDraft, values: SkillDraft, changeNote: string): SkillPatch {
  const patch: SkillPatch = {};
  for (const f of changedFields(base, values)) Object.assign(patch, { [f]: values[f] });
  const note = changeNote.trim();
  if (note) patch.change_note = note;
  return patch;
}

/** Client-side validation against the shared `SkillInput` contract. */
export function validateDraft(values: SkillDraft): DraftErrors {
  const res = SkillInput.safeParse(values);
  if (res.success) return {};
  const errors: DraftErrors = {};
  for (const issue of res.error.issues) {
    const f = issue.path[0];
    if (f === "name" || f === "description" || f === "body") errors[f] = true;
  }
  return errors;
}
