import { describe, expect, it } from 'vitest';
import type { NewSkill, Skill, SkillContent, SkillSnapshot } from '../src/modules/skills/domain-model/skill.js';
import type { SkillStore, TxHandle, UnitOfWork } from '../src/modules/skills/domain-services/ports.js';
import { CreateSkill } from '../src/modules/skills/application-services/create-skill.js';
import { UpdateSkill } from '../src/modules/skills/application-services/update-skill.js';
import { RestoreSkillVersion } from '../src/modules/skills/application-services/skill-versions.js';
import { ImportSkill } from '../src/modules/skills/application-services/import-skill.js';

/** In-memory fake of the SkillStore port. */
class InMemorySkillStore implements SkillStore {
  skills: Skill[] = [];
  versions: SkillSnapshot[] = [];
  async list(ws: string) {
    return this.skills.filter((s) => s.workspaceId === ws);
  }
  async getById(ws: string, id: string) {
    return this.skills.find((s) => s.workspaceId === ws && s.id === id);
  }
  async findByName(ws: string, name: string) {
    return this.skills.find((s) => s.workspaceId === ws && s.name === name);
  }
  async insert(n: NewSkill) {
    const s: Skill = { ...n, id: `s${this.skills.length + 1}`, version: 1, evidenceFiles: null, createdAt: new Date() };
    this.skills.push(s);
    return s;
  }
  async update(ws: string, id: string, f: Partial<SkillContent> & { enabled?: boolean; version?: number }) {
    const i = this.skills.findIndex((s) => s.workspaceId === ws && s.id === id);
    if (i < 0) return undefined;
    const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
    this.skills[i] = { ...this.skills[i]!, ...clean };
    return this.skills[i];
  }
  async delete() {
    return true;
  }
  async insertVersion(s: Omit<SkillSnapshot, 'createdAt'>) {
    this.versions.push({ ...s, createdAt: new Date() });
  }
  async listVersions(id: string) {
    return this.versions.filter((v) => v.skillId === id).sort((a, b) => b.version - a.version);
  }
  async getVersion(id: string, version: number) {
    return this.versions.find((v) => v.skillId === id && v.version === version);
  }
}
const uow: UnitOfWork = { run: (fn) => fn({} as TxHandle) };
const ctx = { workspaceId: 'w1' };
const input = { name: 'rubric', description: 'Score the PR.', type: 'rubric' as const, body: 'v1 body' };

function setup() {
  const store = new InMemorySkillStore();
  return {
    store,
    create: new CreateSkill(store, uow),
    update: new UpdateSkill(store, uow),
    restore: new RestoreSkillVersion(store, uow),
  };
}

describe('skills use cases', () => {
  it('create writes v1 "Initial version"; a duplicate name is 409 skill_name_taken', async () => {
    const { store, create } = setup();
    const s = await create.execute(ctx, input);
    expect(s).toMatchObject({ version: 1, source: 'manual', enabled: true });
    expect(store.versions).toEqual([expect.objectContaining({ version: 1, message: 'Initial version', name: 'rubric' })]);
    await expect(create.execute(ctx, input)).rejects.toMatchObject({ code: 'skill_name_taken', statusCode: 409 });
    // other workspace may reuse the name
    await expect(create.execute({ workspaceId: 'w2' }, input)).resolves.toBeDefined();
  });

  it('toggling enabled creates no version; a content edit creates one with an auto note', async () => {
    const { store, create, update } = setup();
    const s = await create.execute(ctx, input);
    const off = await update.execute(ctx, s.id, { enabled: false });
    expect(off).toMatchObject({ enabled: false, version: 1 });
    expect(store.versions).toHaveLength(1);

    const edited = await update.execute(ctx, s.id, { body: 'v2 body', description: 'New.', change_note: '' });
    expect(edited.version).toBe(2);
    expect(store.versions.at(-1)).toMatchObject({
      version: 2,
      message: 'Edited body, Edited description',
      body: 'v2 body',
      description: 'New.',
      name: 'rubric',
      type: 'rubric',
    });

    const same = await update.execute(ctx, s.id, { body: 'v2 body' });
    expect(same.version).toBe(2);
  });

  it('rename onto a taken name is refused', async () => {
    const { create, update } = setup();
    await create.execute(ctx, { ...input, name: 'other' });
    const s = await create.execute(ctx, input);
    await expect(update.execute(ctx, s.id, { name: 'other' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('restore vK creates v(N+1) with vK content and keeps history', async () => {
    const { store, create, update, restore } = setup();
    const s = await create.execute(ctx, input);
    await update.execute(ctx, s.id, { body: 'v2 body', name: 'rubric-2' });
    const restored = await restore.execute(ctx, s.id, 1);
    expect(restored).toMatchObject({ version: 3, body: 'v1 body', name: 'rubric' });
    expect(store.versions.map((v) => [v.version, v.message])).toEqual([
      [1, 'Initial version'],
      [2, 'Edited body, Renamed'],
      [3, 'Restored from v1'],
    ]);
  });

  it('restore is refused when the old name now belongs to another skill', async () => {
    const { create, update, restore } = setup();
    const s = await create.execute(ctx, input);
    await update.execute(ctx, s.id, { name: 'renamed' });
    await create.execute(ctx, { ...input, name: 'rubric' });
    await expect(restore.execute(ctx, s.id, 1)).rejects.toMatchObject({ code: 'skill_name_taken' });
  });

  it('unknown skill / version → 404', async () => {
    const { create, update, restore } = setup();
    await expect(update.execute(ctx, 'nope', { body: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    const s = await create.execute(ctx, input);
    await expect(restore.execute(ctx, s.id, 9)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('import saves source imported_url with "Imported from <file>"', async () => {
    const { store, create } = setup();
    const s = await new ImportSkill(create).execute(ctx, input, 'gate.zip');
    expect(s.source).toBe('imported_url');
    expect(store.versions[0]!.message).toBe('Imported from gate.zip');
  });
});
