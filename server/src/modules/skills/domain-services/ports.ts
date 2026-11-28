import type { SkillType } from '@devdigest/shared';
import type { NewSkill, Skill, SkillContent, SkillSnapshot } from '../domain-model/skill.js';
import type { SkillCounters } from '../domain-model/skill-stats.js';

/** Opaque transaction handle — only infrastructure knows it is a Drizzle tx. */
export type TxHandle = { readonly __tx: unique symbol };

export interface UnitOfWork {
  run<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T>;
}

/** Skills + their version snapshots. Every method is workspace-scoped. */
export interface SkillStore {
  list(workspaceId: string, q?: string): Promise<Skill[]>;
  /** `forUpdate` locks the row for the rest of the transaction. */
  getById(workspaceId: string, id: string, tx?: TxHandle, forUpdate?: boolean): Promise<Skill | undefined>;
  findByName(workspaceId: string, name: string, tx?: TxHandle): Promise<Skill | undefined>;
  /** Throws SkillNameTakenError on a (workspace, name) unique violation. */
  insert(skill: NewSkill, tx?: TxHandle): Promise<Skill>;
  /** Throws SkillNameTakenError on a (workspace, name) unique violation. */
  update(
    workspaceId: string,
    id: string,
    fields: Partial<SkillContent> & { enabled?: boolean; version?: number },
    tx?: TxHandle,
  ): Promise<Skill | undefined>;
  delete(workspaceId: string, id: string): Promise<boolean>;
  insertVersion(snapshot: Omit<SkillSnapshot, 'createdAt'>, tx?: TxHandle): Promise<void>;
  /** Newest first. Caller must have checked the skill belongs to the workspace. */
  listVersions(skillId: string): Promise<SkillSnapshot[]>;
  getVersion(skillId: string, version: number): Promise<SkillSnapshot | undefined>;
}

export interface SkillStatsDetail {
  findings: number;
  agents: { id: string; name: string }[];
  byCategory: { category: string; count: number }[];
}

/** Read-side aggregation over agent_skills / agent_run_skills / runs / findings. */
export interface SkillStatsReader {
  /** Counters per skill id (skills without data are absent). */
  counters(workspaceId: string, since: Date, skillIds?: string[]): Promise<Map<string, SkillCounters>>;
  detail(workspaceId: string, skillId: string, since: Date): Promise<SkillStatsDetail>;
}

/** Result of parsing an uploaded skill file — still to be validated as SkillInput. */
export interface ParsedSkillFile {
  draft: { name: string; description: string; type: SkillType; body: string };
  sourceFiles: string[];
  ignoredFiles: { path: string; reason: string }[];
  warnings: string[];
}

/** Turns an uploaded `.md` / `.zip` into a draft. In memory; never executes anything. */
export interface SkillFileParser {
  parse(filename: string, bytes: Uint8Array): ParsedSkillFile;
}
