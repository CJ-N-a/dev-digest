import type { SkillSource } from '@devdigest/shared';
import {
  INITIAL_VERSION,
  INITIAL_VERSION_MESSAGE,
  SkillNameTakenError,
  type Skill,
  type SkillContent,
} from '../domain-model/skill.js';
import type { SkillStore, UnitOfWork } from '../domain-services/ports.js';
import type { SkillsContext } from './context.js';

export interface CreateSkillOptions {
  source?: SkillSource;
  /** Note of v1; defaults to "Initial version". */
  message?: string;
}

/** Create = skill row + v1 snapshot, in one transaction. */
export class CreateSkill {
  constructor(
    private skills: SkillStore,
    private uow: UnitOfWork,
  ) {}

  async execute(
    ctx: SkillsContext,
    input: SkillContent & { enabled?: boolean },
    opts: CreateSkillOptions = {},
  ): Promise<Skill> {
    return this.uow.run(async (tx) => {
      if (await this.skills.findByName(ctx.workspaceId, input.name, tx)) {
        throw new SkillNameTakenError(input.name);
      }
      const skill = await this.skills.insert(
        {
          workspaceId: ctx.workspaceId,
          name: input.name,
          description: input.description,
          type: input.type,
          body: input.body,
          source: opts.source ?? 'manual',
          enabled: input.enabled ?? true,
        },
        tx,
      );
      await this.skills.insertVersion(
        {
          skillId: skill.id,
          version: INITIAL_VERSION,
          message: opts.message ?? INITIAL_VERSION_MESSAGE,
          name: skill.name,
          description: skill.description,
          type: skill.type,
          body: skill.body,
        },
        tx,
      );
      return skill;
    });
  }
}
