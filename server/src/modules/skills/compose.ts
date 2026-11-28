import type { Container } from '../../platform/container.js';
import { CreateSkill } from './application-services/create-skill.js';
import { DeleteSkill, GetSkill } from './application-services/get-skill.js';
import { GetSkillStats } from './application-services/get-skill-stats.js';
import { ImportSkill, PreviewSkillImport } from './application-services/import-skill.js';
import { ListSkills } from './application-services/list-skills.js';
import {
  GetSkillVersion,
  ListSkillVersions,
  RestoreSkillVersion,
} from './application-services/skill-versions.js';
import { UpdateSkill } from './application-services/update-skill.js';
import { FflateSkillFileParser } from './infrastructure/import-parser.js';
import { DrizzleSkillStatsReader } from './infrastructure/skill-stats.drizzle-reader.js';
import { DrizzleSkillStore, DrizzleUnitOfWork } from './infrastructure/skill.drizzle-store.js';

/** Composition root of the skills module: the only file that sees Container. */
export function composeSkills(c: Container) {
  const store = new DrizzleSkillStore(c.db);
  const stats = new DrizzleSkillStatsReader(c.db);
  const uow = new DrizzleUnitOfWork(c.db);
  const createSkill = new CreateSkill(store, uow);
  return {
    listSkills: new ListSkills(store, stats),
    getSkill: new GetSkill(store),
    createSkill,
    updateSkill: new UpdateSkill(store, uow),
    deleteSkill: new DeleteSkill(store),
    getStats: new GetSkillStats(store, stats),
    listVersions: new ListSkillVersions(store),
    getVersion: new GetSkillVersion(store),
    restoreVersion: new RestoreSkillVersion(store, uow),
    previewImport: new PreviewSkillImport(new FflateSkillFileParser(), store),
    importSkill: new ImportSkill(createSkill),
  };
}
