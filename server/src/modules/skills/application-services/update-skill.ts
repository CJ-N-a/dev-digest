import {
  changedFields,
  changeMessage,
  SkillNameTakenError,
  SkillNotFoundError,
  type Skill,
  type SkillContent,
} from '../domain-model/skill.js';
import type { SkillStore, TxHandle, UnitOfWork } from '../domain-services/ports.js';
import type { SkillsContext } from './context.js';

export interface SkillPatchInput extends Partial<SkillContent> {
  enabled?: boolean;
  change_note?: string;
}

/**
 * Write `content` as version N+1 of a locked skill: update the row and insert
 * the full snapshot. Must run inside the caller's transaction.
 */
export async function writeNewVersion(
  store: SkillStore,
  tx: TxHandle,
  current: Skill,
  content: SkillContent,
  message: string,
  extra: { enabled?: boolean } = {},
): Promise<Skill> {
  if (content.name !== current.name) {
    const other = await store.findByName(current.workspaceId, content.name, tx);
    if (other && other.id !== current.id) throw new SkillNameTakenError(content.name);
  }
  const version = current.version + 1;
  const updated = await store.update(
    current.workspaceId,
    current.id,
    { ...content, ...extra, version },
    tx,
  );
  if (!updated) throw new SkillNotFoundError();
  await store.insertVersion({ skillId: current.id, version, message, ...content }, tx);
  return updated;
}

/**
 * PATCH: a content change (name/description/type/body) is a new version with a
 * snapshot + note, in one transaction. Toggling `enabled` alone creates none.
 */
export class UpdateSkill {
  constructor(
    private skills: SkillStore,
    private uow: UnitOfWork,
  ) {}

  async execute(ctx: SkillsContext, id: string, patch: SkillPatchInput): Promise<Skill> {
    return this.uow.run(async (tx) => {
      const current = await this.skills.getById(ctx.workspaceId, id, tx, true);
      if (!current) throw new SkillNotFoundError();

      const fields = changedFields(current, patch);
      const enabledChanged = patch.enabled !== undefined && patch.enabled !== current.enabled;

      if (fields.length === 0) {
        if (!enabledChanged) return current;
        const toggled = await this.skills.update(ctx.workspaceId, id, { enabled: patch.enabled }, tx);
        if (!toggled) throw new SkillNotFoundError();
        return toggled;
      }

      const content: SkillContent = {
        name: patch.name ?? current.name,
        description: patch.description ?? current.description,
        type: patch.type ?? current.type,
        body: patch.body ?? current.body,
      };
      return writeNewVersion(
        this.skills,
        tx,
        current,
        content,
        changeMessage(fields, patch.change_note),
        enabledChanged ? { enabled: patch.enabled } : {},
      );
    });
  }
}
