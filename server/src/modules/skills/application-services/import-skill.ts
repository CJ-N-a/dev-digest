import type { ImportPreview, SkillInput } from '@devdigest/shared';
import { importedMessage, type Skill } from '../domain-model/skill.js';
import type { SkillFileParser, SkillStore } from '../domain-services/ports.js';
import type { SkillsContext } from './context.js';
import type { CreateSkill } from './create-skill.js';

/** Parse an uploaded `.md` / `.zip` into a preview. Writes nothing. */
export class PreviewSkillImport {
  constructor(
    private parser: SkillFileParser,
    private skills: SkillStore,
  ) {}

  async execute(ctx: SkillsContext, filename: string, bytes: Uint8Array): Promise<ImportPreview> {
    const parsed = this.parser.parse(filename, bytes);
    const conflict = await this.skills.findByName(ctx.workspaceId, parsed.draft.name);
    return {
      draft: parsed.draft,
      source_files: parsed.sourceFiles,
      ignored_files: parsed.ignoredFiles,
      warnings: parsed.warnings,
      name_conflict: conflict !== undefined,
    };
  }
}

/** Save the confirmed (possibly edited) draft: source `imported_url`, v1 "Imported from <file>". */
export class ImportSkill {
  constructor(private createSkill: CreateSkill) {}

  async execute(ctx: SkillsContext, input: SkillInput, filename?: string): Promise<Skill> {
    return this.createSkill.execute(ctx, input, {
      source: 'imported_url',
      message: importedMessage(filename?.trim() || 'file'),
    });
  }
}
