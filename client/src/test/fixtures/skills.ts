import type { Skill, SkillListItem } from "@devdigest/shared";

export const SKILL: Skill = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "pr-quality-rubric",
  description: "When reviewing a PR, score it against the rubric.",
  type: "rubric",
  source: "manual",
  body: "# Rubric\n\n- Tests",
  enabled: true,
  version: 5,
};

export const SKILL_ITEM: SkillListItem = {
  ...SKILL,
  summary: { agents_count: 3, pull_rate: 0.714, accept_rate: 0.74 },
};

export function makeSkill(over: Partial<Skill> & { id: string; name: string }): Skill {
  return { ...SKILL, ...over };
}
