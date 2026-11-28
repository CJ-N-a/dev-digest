/**
 * Skills (M2) — reusable, text-only review instructions linked to agents.
 * See specs/M2-skills.md. Reuses Skill / SkillType / SkillSource from
 * ./knowledge (not reshaped).
 */
import { z } from 'zod';
import { Skill, SkillType } from './knowledge.js';

/** Token estimate shared by the editor counter and the run trace (`skills_tokens`). */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
export const SKILL_LIMITS = {
  name: 64,
  description: 500,
  body: 20_000,
  changeNote: 120,
} as const;

export const SkillInput = z.object({
  name: z.string().min(1).max(SKILL_LIMITS.name).regex(SKILL_NAME_RE),
  description: z.string().min(1).max(SKILL_LIMITS.description),
  type: SkillType,
  body: z.string().min(1).max(SKILL_LIMITS.body),
  enabled: z.boolean().optional(),
});
export type SkillInput = z.infer<typeof SkillInput>;

export const SkillPatch = SkillInput.partial().extend({
  change_note: z.string().max(SKILL_LIMITS.changeNote).optional(),
});
export type SkillPatch = z.infer<typeof SkillPatch>;

export const SkillSummary = z.object({
  agents_count: z.number().int(),
  /** 0..1, null when there were no runs. */
  pull_rate: z.number().nullable(),
  /** 0..1, null when no finding was accepted/dismissed. */
  accept_rate: z.number().nullable(),
});
export type SkillSummary = z.infer<typeof SkillSummary>;

export const SkillListItem = Skill.extend({ summary: SkillSummary });
export type SkillListItem = z.infer<typeof SkillListItem>;

export const SkillStats = SkillSummary.extend({
  findings_30d: z.number().int(),
  agents: z.array(z.object({ id: z.string(), name: z.string() })),
  by_category: z.array(z.object({ category: z.string(), count: z.number().int() })),
});
export type SkillStats = z.infer<typeof SkillStats>;

export const SkillVersion = z.object({
  version: z.number().int(),
  message: z.string(),
  created_at: z.string(),
  current: z.boolean(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/** Full snapshot; name/description/type are null for rows written before M2. */
export const SkillVersionFull = SkillVersion.extend({
  name: z.string().nullable(),
  description: z.string().nullable(),
  type: SkillType.nullable(),
  body: z.string(),
});
export type SkillVersionFull = z.infer<typeof SkillVersionFull>;

export const AgentSkillItem = z.object({
  skill: Skill,
  order: z.number().int(),
  enabled: z.boolean(),
});
export type AgentSkillItem = z.infer<typeof AgentSkillItem>;

/** Replace an agent's ordered skill set; array index = order. */
export const SetAgentSkills = z.object({
  items: z.array(z.object({ skill_id: z.string().uuid(), enabled: z.boolean() })),
});
export type SetAgentSkills = z.infer<typeof SetAgentSkills>;

export const ImportPreview = z.object({
  draft: SkillInput,
  source_files: z.array(z.string()),
  ignored_files: z.array(z.object({ path: z.string(), reason: z.string() })),
  warnings: z.array(z.string()),
  name_conflict: z.boolean(),
});
export type ImportPreview = z.infer<typeof ImportPreview>;

/** One skill that went into a run's prompt (trace + agent_run_skills). */
export const SkillUsed = z.object({
  name: z.string(),
  version: z.number().int(),
  tokens: z.number().int(),
});
export type SkillUsed = z.infer<typeof SkillUsed>;
