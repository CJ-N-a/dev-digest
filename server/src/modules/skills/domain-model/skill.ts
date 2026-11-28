import type { SkillSource, SkillType } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../../platform/errors.js';

/** Skill entity owned by the skills module — not the API DTO, not the Drizzle row. */
export interface Skill {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly type: SkillType;
  readonly source: SkillSource;
  readonly body: string;
  readonly enabled: boolean;
  readonly version: number;
  readonly evidenceFiles: string[] | null;
  readonly createdAt: Date;
}

/** The versioned part of a skill: a change to any of these is a new version. */
export interface SkillContent {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

export interface NewSkill extends SkillContent {
  workspaceId: string;
  source: SkillSource;
  enabled: boolean;
}

/** One `skill_versions` row. name/description/type are null for pre-M2 rows. */
export interface SkillSnapshot {
  readonly skillId: string;
  readonly version: number;
  readonly message: string;
  readonly name: string | null;
  readonly description: string | null;
  readonly type: SkillType | null;
  readonly body: string;
  readonly createdAt: Date;
}

export const INITIAL_VERSION = 1;
export const INITIAL_VERSION_MESSAGE = 'Initial version';

export const importedMessage = (file: string): string => `Imported from ${file}`;
export const restoredMessage = (version: number): string => `Restored from v${version}`;

/** Auto change-note labels, in the order they are joined. */
const CHANGE_LABELS: ReadonlyArray<[keyof SkillContent, string]> = [
  ['body', 'Edited body'],
  ['name', 'Renamed'],
  ['type', 'Changed type'],
  ['description', 'Edited description'],
];

/** Content fields of `patch` that differ from `current` (undefined = not sent). */
export function changedFields(current: SkillContent, patch: Partial<SkillContent>): (keyof SkillContent)[] {
  return CHANGE_LABELS.map(([field]) => field).filter(
    (field) => patch[field] !== undefined && patch[field] !== current[field],
  );
}

/** Note for a new version: the user's note, or one generated from what changed. */
export function changeMessage(fields: (keyof SkillContent)[], note?: string): string {
  const trimmed = note?.trim();
  if (trimmed) return trimmed;
  return CHANGE_LABELS.filter(([field]) => fields.includes(field))
    .map(([, label]) => label)
    .join(', ');
}

/**
 * Content to restore from a snapshot. Old rows have no name/description/type,
 * so those fall back to the current skill (only the body is brought back).
 */
export function contentFromSnapshot(snapshot: SkillSnapshot, current: SkillContent): SkillContent {
  return {
    name: snapshot.name ?? current.name,
    description: snapshot.description ?? current.description,
    type: snapshot.type ?? current.type,
    body: snapshot.body,
  };
}

export class SkillNameTakenError extends AppError {
  constructor(name: string) {
    super('skill_name_taken', `A skill named "${name}" already exists`, 409, { name });
  }
}

export class SkillNotFoundError extends NotFoundError {
  constructor(message = 'Skill not found') {
    super(message);
  }
}
