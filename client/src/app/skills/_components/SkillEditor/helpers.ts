import { SKILL_TAB_KEYS, type SkillTab } from "./constants";

/** `?tab=` → a known tab (fallback: config). */
export function parseSkillTab(raw: string | null | undefined): SkillTab {
  return SKILL_TAB_KEYS.includes(raw as SkillTab) ? (raw as SkillTab) : "config";
}
