import {
  contentFromSnapshot,
  restoredMessage,
  SkillNotFoundError,
  type Skill,
  type SkillSnapshot,
} from '../domain-model/skill.js';
import type { SkillStore, UnitOfWork } from '../domain-services/ports.js';
import type { SkillsContext } from './context.js';
import { writeNewVersion } from './update-skill.js';

export interface VersionView {
  snapshot: SkillSnapshot;
  current: boolean;
}

export class ListSkillVersions {
  constructor(private skills: SkillStore) {}

  /** Newest first; `current` marks the skill's live version. */
  async execute(ctx: SkillsContext, id: string): Promise<VersionView[]> {
    const skill = await this.skills.getById(ctx.workspaceId, id);
    if (!skill) throw new SkillNotFoundError();
    const rows = await this.skills.listVersions(skill.id);
    return rows.map((snapshot) => ({ snapshot, current: snapshot.version === skill.version }));
  }
}

export class GetSkillVersion {
  constructor(private skills: SkillStore) {}

  async execute(ctx: SkillsContext, id: string, version: number): Promise<VersionView> {
    const skill = await this.skills.getById(ctx.workspaceId, id);
    if (!skill) throw new SkillNotFoundError();
    const snapshot = await this.skills.getVersion(skill.id, version);
    if (!snapshot) throw new SkillNotFoundError('Skill version not found');
    return { snapshot, current: snapshot.version === skill.version };
  }
}

/**
 * Restore vK = new version v(N+1) with vK's content and the note
 * "Restored from vK". History is never rewritten. 409 if vK's name now belongs
 * to another skill.
 */
export class RestoreSkillVersion {
  constructor(
    private skills: SkillStore,
    private uow: UnitOfWork,
  ) {}

  async execute(ctx: SkillsContext, id: string, version: number): Promise<Skill> {
    return this.uow.run(async (tx) => {
      const current = await this.skills.getById(ctx.workspaceId, id, tx, true);
      if (!current) throw new SkillNotFoundError();
      const snapshot = await this.skills.getVersion(current.id, version);
      if (!snapshot) throw new SkillNotFoundError('Skill version not found');
      return writeNewVersion(
        this.skills,
        tx,
        current,
        contentFromSnapshot(snapshot, current),
        restoredMessage(version),
      );
    });
  }
}
