/**
 * Skill stats formulas (spec M2 "Stats definitions"). Pure: the store returns
 * raw counters, this file turns them into rates. Attribution is by presence —
 * a finding counts for every skill that was in its run's prompt.
 */

export const STATS_WINDOW_DAYS = 30;

/** Raw 30-day counters for one skill, as aggregated by the store. */
export interface SkillCounters {
  /** Agents with an enabled link to the skill. */
  agentsCount: number;
  /** `done` runs of the currently linked agents that included the skill. */
  runsWithSkill: number;
  /** All `done` runs of the currently linked agents. */
  linkedAgentRuns: number;
  accepted: number;
  dismissed: number;
}

export const EMPTY_COUNTERS: SkillCounters = {
  agentsCount: 0,
  runsWithSkill: 0,
  linkedAgentRuns: 0,
  accepted: 0,
  dismissed: 0,
};

export interface SkillSummaryValues {
  agentsCount: number;
  /** 0..1, null without runs. */
  pullRate: number | null;
  /** 0..1, null without accept/dismiss decisions. */
  acceptRate: number | null;
}

/** `num / den`, or null when the denominator is zero. */
export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export function summarize(c: SkillCounters): SkillSummaryValues {
  return {
    agentsCount: c.agentsCount,
    pullRate: ratio(Math.min(c.runsWithSkill, c.linkedAgentRuns), c.linkedAgentRuns),
    acceptRate: ratio(c.accepted, c.accepted + c.dismissed),
  };
}

export function statsSince(now: Date): Date {
  return new Date(now.getTime() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
