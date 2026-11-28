/* skill-type.ts — presentation of a SkillType shared by /skills and the agent
   editor's Skills tab (pill colour + list icon). */
import type { IconName } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

export const SKILL_TYPE_META: Record<SkillType, { color: string; bg: string; icon: IconName }> = {
  rubric: { color: "var(--accent-text)", bg: "var(--accent-bg)", icon: "ListChecks" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg)", icon: "Code" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)", icon: "Shield" },
  custom: { color: "var(--text-secondary)", bg: "var(--bg-hover)", icon: "Sparkles" },
};

/** Selectable types, in display order. */
export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];
