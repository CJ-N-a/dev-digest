import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import * as t from '../src/db/schema.js';
import { ReviewRepository } from '../src/modules/reviews/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[reviews-run-skills] Docker not available — skipping integration tests.');
}

/** M2 — which skills go into an agent's prompt, and the per-run snapshot. */
d('review prompt skills (M2)', () => {
  let pg: PgFixture;
  let repo: ReviewRepository;
  let ws: string;
  let otherWs: string;
  let agentId: string;

  beforeAll(async () => {
    pg = await startPg();
    const db = pg.handle.db;
    repo = new ReviewRepository(db);
    const [w1, w2] = await db
      .insert(t.workspaces)
      .values([{ name: 'ws-a' }, { name: 'ws-b' }])
      .returning();
    ws = w1!.id;
    otherWs = w2!.id;
    const [agent] = await db
      .insert(t.agents)
      .values({ workspaceId: ws, name: 'sec', provider: 'openai', model: 'm', systemPrompt: 's' })
      .returning();
    agentId = agent!.id;
    const mk = (workspaceId: string, name: string, enabled = true, version = 1) => ({
      workspaceId,
      name,
      description: `${name} desc`,
      type: 'convention' as const,
      source: 'manual' as const,
      body: `${name} body`,
      enabled,
      version,
    });
    const rows = await db
      .insert(t.skills)
      .values([
        mk(ws, 'second', true, 2),
        mk(ws, 'first'),
        mk(ws, 'skill-off', false),
        mk(ws, 'link-off'),
        mk(otherWs, 'foreign'),
      ])
      .returning();
    const id = (n: string) => rows.find((r) => r.name === n)!.id;
    await db.insert(t.agentSkills).values([
      { agentId, skillId: id('second'), order: 2 },
      { agentId, skillId: id('first'), order: 1 },
      { agentId, skillId: id('skill-off'), order: 0 },
      { agentId, skillId: id('link-off'), order: 3, enabled: false },
      { agentId, skillId: id('foreign'), order: 4 },
    ]);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('returns only skills with both flags on, workspace-scoped, in link order', async () => {
    const skills = await repo.listPromptSkillsForAgent(ws, agentId);
    expect(skills.map((s) => [s.name, s.version])).toEqual([
      ['first', 1],
      ['second', 2],
    ]);
    expect(await repo.listPromptSkillsForAgent(otherWs, agentId)).toEqual([
      expect.objectContaining({ name: 'foreign' }),
    ]);
  });

  it('insertRunSkills writes the snapshot and is idempotent per (run, order)', async () => {
    const runId = await repo.createAgentRun({ workspaceId: ws, agentId, prId: null as never, provider: 'openai', model: 'm' });
    const rows = [
      { skillId: null, skillName: 'first', skillVersion: 1, order: 0, tokens: 10 },
      { skillId: null, skillName: 'second', skillVersion: 2, order: 1, tokens: 12 },
    ];
    await repo.insertRunSkills(runId, rows);
    await repo.insertRunSkills(runId, rows);
    const saved = await pg.handle.db
      .select()
      .from(t.agentRunSkills)
      .where(eq(t.agentRunSkills.runId, runId));
    expect(saved.map((r) => [r.skillName, r.skillVersion, r.order, r.tokens]).sort()).toEqual([
      ['first', 1, 0, 10],
      ['second', 2, 1, 12],
    ]);
  });
});
