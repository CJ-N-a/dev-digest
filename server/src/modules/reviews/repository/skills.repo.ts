import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';

/** A skill linked to an agent, as it goes into the review prompt (M2). */
export type AgentPromptSkill = {
  id: string;
  name: string;
  description: string;
  type: string;
  body: string;
  version: number;
  order: number;
};

/** One `agent_run_skills` row: what a run actually had in its prompt. */
export type RunSkillRow = {
  skillId: string | null;
  skillName: string;
  skillVersion: number;
  order: number;
  tokens: number;
};

/**
 * The agent's skills that go into the prompt: BOTH the skill itself
 * (`skills.enabled`) and the agent link (`agent_skills.enabled`) must be on.
 * Workspace-scoped via the skill row; ordered by `agent_skills.order`.
 */
export async function listPromptSkillsForAgent(
  db: Db,
  workspaceId: string,
  agentId: string,
): Promise<AgentPromptSkill[]> {
  return db
    .select({
      id: t.skills.id,
      name: t.skills.name,
      description: t.skills.description,
      type: t.skills.type,
      body: t.skills.body,
      version: t.skills.version,
      order: t.agentSkills.order,
    })
    .from(t.agentSkills)
    .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
    .where(
      and(
        eq(t.agentSkills.agentId, agentId),
        eq(t.skills.workspaceId, workspaceId),
        eq(t.skills.enabled, true),
        eq(t.agentSkills.enabled, true),
      ),
    )
    .orderBy(asc(t.agentSkills.order), asc(t.skills.name));
}

/** Snapshot the skills a run used. Idempotent per (run, order). */
export async function insertRunSkills(db: Db, runId: string, rows: RunSkillRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(t.agentRunSkills)
    .values(rows.map((r) => ({ runId, ...r })))
    .onConflictDoNothing();
}
