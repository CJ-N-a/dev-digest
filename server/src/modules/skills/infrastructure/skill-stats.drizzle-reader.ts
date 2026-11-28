import { and, asc, desc, eq, gte, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { EMPTY_COUNTERS, type SkillCounters } from '../domain-model/skill-stats.js';
import type { SkillStatsDetail, SkillStatsReader } from '../domain-services/ports.js';

const DONE = 'done';

/**
 * Stats over the last N days (spec "Stats definitions"), workspace-scoped via
 * `agents.workspace_id` / `agent_runs.workspace_id`. Findings reach a run through
 * `reviews.run_id` (reviews has no FK to agent_runs, only the column).
 */
export class DrizzleSkillStatsReader implements SkillStatsReader {
  constructor(private db: Db) {}

  async counters(workspaceId: string, since: Date, skillIds?: string[]): Promise<Map<string, SkillCounters>> {
    const out = new Map<string, SkillCounters>();
    if (skillIds && skillIds.length === 0) return out;
    const get = (id: string) => {
      let c = out.get(id);
      if (!c) out.set(id, (c = { ...EMPTY_COUNTERS }));
      return c;
    };
    const onlyLinks: SQL | undefined = skillIds ? inArray(t.agentSkills.skillId, skillIds) : undefined;
    const onlyRunSkills: SQL | undefined = skillIds ? inArray(t.agentRunSkills.skillId, skillIds) : undefined;

    const [agents, pulls, decisions] = await Promise.all([
      // Used by: enabled links of agents in this workspace.
      this.db
        .select({ skillId: t.agentSkills.skillId, n: sql<number>`count(*)::int` })
        .from(t.agentSkills)
        .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agentSkills.enabled, true), onlyLinks))
        .groupBy(t.agentSkills.skillId),
      // Pull: done runs of the linked agents, and how many of them had the skill.
      this.db
        .select({
          skillId: t.agentSkills.skillId,
          total: sql<number>`count(distinct ${t.agentRuns.id})::int`,
          withSkill: sql<number>`(count(distinct ${t.agentRuns.id}) filter (where ${t.agentRunSkills.runId} is not null))::int`,
        })
        .from(t.agentSkills)
        .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
        .innerJoin(t.agentRuns, eq(t.agentRuns.agentId, t.agentSkills.agentId))
        .leftJoin(
          t.agentRunSkills,
          and(eq(t.agentRunSkills.runId, t.agentRuns.id), eq(t.agentRunSkills.skillId, t.agentSkills.skillId)),
        )
        .where(
          and(
            eq(t.agents.workspaceId, workspaceId),
            eq(t.agentRuns.workspaceId, workspaceId),
            eq(t.agentRuns.status, DONE),
            gte(t.agentRuns.ranAt, since),
            onlyLinks,
          ),
        )
        .groupBy(t.agentSkills.skillId),
      // Accept rate: decisions on findings of runs that included the skill.
      this.db
        .select({
          skillId: t.agentRunSkills.skillId,
          accepted: sql<number>`(count(distinct ${t.findings.id}) filter (where ${t.findings.acceptedAt} is not null))::int`,
          dismissed: sql<number>`(count(distinct ${t.findings.id}) filter (where ${t.findings.dismissedAt} is not null and ${t.findings.acceptedAt} is null))::int`,
        })
        .from(t.agentRunSkills)
        .innerJoin(t.agentRuns, eq(t.agentRuns.id, t.agentRunSkills.runId))
        .innerJoin(t.reviews, eq(t.reviews.runId, t.agentRuns.id))
        .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
        .where(
          and(
            eq(t.agentRuns.workspaceId, workspaceId),
            eq(t.reviews.workspaceId, workspaceId),
            gte(t.agentRuns.ranAt, since),
            isNotNull(t.agentRunSkills.skillId),
            onlyRunSkills,
          ),
        )
        .groupBy(t.agentRunSkills.skillId),
    ]);

    for (const r of agents) get(r.skillId).agentsCount = Number(r.n);
    for (const r of pulls) {
      const c = get(r.skillId);
      c.linkedAgentRuns = Number(r.total);
      c.runsWithSkill = Number(r.withSkill);
    }
    for (const r of decisions) {
      if (!r.skillId) continue;
      const c = get(r.skillId);
      c.accepted = Number(r.accepted);
      c.dismissed = Number(r.dismissed);
    }
    return out;
  }

  async detail(workspaceId: string, skillId: string, since: Date): Promise<SkillStatsDetail> {
    const findingsOfSkillRuns = and(
      eq(t.agentRunSkills.skillId, skillId),
      eq(t.agentRuns.workspaceId, workspaceId),
      eq(t.reviews.workspaceId, workspaceId),
      gte(t.agentRuns.ranAt, since),
    );
    const n = sql<number>`count(distinct ${t.findings.id})::int`;

    const [agents, byCategory] = await Promise.all([
      this.db
        .select({ id: t.agents.id, name: t.agents.name })
        .from(t.agentSkills)
        .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
        .where(
          and(
            eq(t.agents.workspaceId, workspaceId),
            eq(t.agentSkills.skillId, skillId),
            eq(t.agentSkills.enabled, true),
          ),
        )
        .orderBy(asc(t.agents.name)),
      this.db
        .select({ category: t.findings.category, count: n })
        .from(t.agentRunSkills)
        .innerJoin(t.agentRuns, eq(t.agentRuns.id, t.agentRunSkills.runId))
        .innerJoin(t.reviews, eq(t.reviews.runId, t.agentRuns.id))
        .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
        .where(findingsOfSkillRuns)
        .groupBy(t.findings.category)
        .orderBy(desc(n), asc(t.findings.category)),
    ]);

    const rows = byCategory.map((r) => ({ category: r.category, count: Number(r.count) }));
    return {
      // A finding has exactly one category, so the per-category counts add up.
      findings: rows.reduce((sum, r) => sum + r.count, 0),
      agents,
      byCategory: rows,
    };
  }
}
