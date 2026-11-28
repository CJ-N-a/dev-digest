import type {
  Skill as SkillDto,
  SkillListItem,
  SkillStats,
  SkillVersion,
  SkillVersionFull,
} from '@devdigest/shared';
import type { SkillWithSummary } from './application-services/list-skills.js';
import type { SkillStatsView } from './application-services/get-skill-stats.js';
import type { VersionView } from './application-services/skill-versions.js';
import type { Skill } from './domain-model/skill.js';
import type { SkillSummaryValues } from './domain-model/skill-stats.js';

/** Domain → API DTO mappers (UI ring). */

export const toSkillDto = (s: Skill): SkillDto => ({
  id: s.id,
  name: s.name,
  description: s.description,
  type: s.type,
  source: s.source,
  body: s.body,
  enabled: s.enabled,
  version: s.version,
  evidence_files: s.evidenceFiles,
});

const toSummaryDto = (s: SkillSummaryValues) => ({
  agents_count: s.agentsCount,
  pull_rate: s.pullRate,
  accept_rate: s.acceptRate,
});

export const toSkillListItemDto = ({ skill, summary }: SkillWithSummary): SkillListItem => ({
  ...toSkillDto(skill),
  summary: toSummaryDto(summary),
});

export const toSkillStatsDto = (s: SkillStatsView): SkillStats => ({
  ...toSummaryDto(s),
  findings_30d: s.findings,
  agents: s.agents,
  by_category: s.byCategory,
});

export const toSkillVersionDto = ({ snapshot, current }: VersionView): SkillVersion => ({
  version: snapshot.version,
  message: snapshot.message,
  created_at: snapshot.createdAt.toISOString(),
  current,
});

export const toSkillVersionFullDto = (v: VersionView): SkillVersionFull => ({
  ...toSkillVersionDto(v),
  name: v.snapshot.name,
  description: v.snapshot.description,
  type: v.snapshot.type,
  body: v.snapshot.body,
});
