/* useSkillForm — Config draft = saved skill + local edits (derived, so an
   external update such as the card's enabled toggle shows through untouched
   fields). Lives in SkillEditor so Preview can show the unsaved draft. */
"use client";

import React from "react";
import type { Skill } from "@devdigest/shared";
import { changedFields, toDraft, type SkillDraft } from "@/app/skills/_lib/skill-draft";

export interface SkillForm {
  base: SkillDraft;
  values: SkillDraft;
  set: (patch: Partial<SkillDraft>) => void;
  reset: () => void;
  /** Any field differs from the saved skill (incl. `enabled`). */
  dirty: boolean;
  /** name/description/type/body differ (a save creates a version). */
  contentDirty: boolean;
}

export function useSkillForm(skill: Skill | undefined): SkillForm {
  const [edits, setEdits] = React.useState<Partial<SkillDraft>>({});
  const base = toDraft(skill);
  const values: SkillDraft = { ...base, ...edits };
  const changed = changedFields(base, values);
  const set = React.useCallback((patch: Partial<SkillDraft>) => setEdits((e) => ({ ...e, ...patch })), []);
  const reset = React.useCallback(() => setEdits({}), []);
  return {
    base,
    values,
    set,
    reset,
    dirty: changed.length > 0,
    contentDirty: changed.some((f) => f !== "enabled"),
  };
}
