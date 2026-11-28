import { SkillNotFoundError } from '../domain-model/skill.js';
import { EMPTY_COUNTERS, statsSince, summarize, type SkillSummaryValues } from '../domain-model/skill-stats.js';
import type { SkillStatsDetail, SkillStatsReader, SkillStore } from '../domain-services/ports.js';
import { systemClock, type Clock, type SkillsContext } from './context.js';

export type SkillStatsView = SkillSummaryValues & SkillStatsDetail;

/** Stats tab: summary + findings (30d), agents using the skill, findings by category. */
export class GetSkillStats {
  constructor(
    private skills: SkillStore,
    private stats: SkillStatsReader,
    private clock: Clock = systemClock,
  ) {}

  async execute(ctx: SkillsContext, id: string): Promise<SkillStatsView> {
    const skill = await this.skills.getById(ctx.workspaceId, id);
    if (!skill) throw new SkillNotFoundError();
    const since = statsSince(this.clock());
    const [counters, detail] = await Promise.all([
      this.stats.counters(ctx.workspaceId, since, [skill.id]),
      this.stats.detail(ctx.workspaceId, skill.id, since),
    ]);
    return { ...summarize(counters.get(skill.id) ?? EMPTY_COUNTERS), ...detail };
  }
}
