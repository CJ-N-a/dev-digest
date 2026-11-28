import type { Skill } from '../domain-model/skill.js';
import { EMPTY_COUNTERS, statsSince, summarize, type SkillSummaryValues } from '../domain-model/skill-stats.js';
import type { SkillStatsReader, SkillStore } from '../domain-services/ports.js';
import { systemClock, type Clock, type SkillsContext } from './context.js';

export interface SkillWithSummary {
  skill: Skill;
  summary: SkillSummaryValues;
}

/** Left-list cards: skills (optionally filtered by `q`) + their 30-day summary. */
export class ListSkills {
  constructor(
    private skills: SkillStore,
    private stats: SkillStatsReader,
    private clock: Clock = systemClock,
  ) {}

  async execute(ctx: SkillsContext, q?: string): Promise<SkillWithSummary[]> {
    const skills = await this.skills.list(ctx.workspaceId, q?.trim() || undefined);
    if (skills.length === 0) return [];
    const counters = await this.stats.counters(
      ctx.workspaceId,
      statsSince(this.clock()),
      skills.map((s) => s.id),
    );
    return skills.map((skill) => ({
      skill,
      summary: summarize(counters.get(skill.id) ?? EMPTY_COUNTERS),
    }));
  }
}
