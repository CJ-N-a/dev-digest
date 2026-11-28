import { SkillNotFoundError, type Skill } from '../domain-model/skill.js';
import type { SkillStore } from '../domain-services/ports.js';
import type { SkillsContext } from './context.js';

export class GetSkill {
  constructor(private skills: SkillStore) {}

  async execute(ctx: SkillsContext, id: string): Promise<Skill> {
    const skill = await this.skills.getById(ctx.workspaceId, id);
    if (!skill) throw new SkillNotFoundError();
    return skill;
  }
}

/** Links and versions cascade; agent_run_skills keep name + version (skill_id → null). */
export class DeleteSkill {
  constructor(private skills: SkillStore) {}

  async execute(ctx: SkillsContext, id: string): Promise<void> {
    const ok = await this.skills.delete(ctx.workspaceId, id);
    if (!ok) throw new SkillNotFoundError();
  }
}
